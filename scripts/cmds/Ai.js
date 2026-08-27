const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const crypto = require("crypto"); // Pour générer des UUID sans dépendance

const API_ENDPOINT = "https://shizuai.vercel.app/chat";
const CLEAR_ENDPOINT = "https://shizuai.vercel.app/chat/clear";
const TMP_DIR = path.join(__dirname, "cache");

// S'assurer que le dossier temporaire existe
fs.ensureDirSync(TMP_DIR);

/**
 * Génère un identifiant unique (similaire à uuid v4)
 */
function generateUUID() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Télécharge un fichier depuis une URL et retourne son chemin local
 */
async function download(url, ext) {
  const filePath = path.join(TMP_DIR, `${generateUUID()}.${ext}`);
  const res = await axios.get(url, { responseType: "arraybuffer" });
  await fs.writeFile(filePath, res.data);
  return filePath;
}

/**
 * Supprime les références à l'auteur original et les astérisques
 */
function normalizeText(text) {
  if (!text) return text;
  return text
    .replace(/Aryan\s*Chauchan/gi, "Christus")
    .replace(/Aryan\s*Chauhan/gi, "Christus")
    .replace(/A\.?\s*Chauchan/gi, "Christus")
    .replace(/\*/g, "");
}

/**
 * Simule la police sans-serif (ne fait rien, car fonts.js est absent)
 */
function sansSerif(text) {
  return text; // Pas de transformation
}

/**
 * Extrait une image du message et la convertit en data URL (base64)
 */
async function getImageDataUrlFromMessage(sock, message) {
  if (!message.message?.imageMessage) return null;

  const buffer = await sock.downloadMediaMessage(message);
  const mime = message.message.imageMessage.mimetype || "image/jpeg";
  const base64 = buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
}

module.exports = {
  config: {
    name: "ai",
    aliases: ["shizu"],
    version: "3.0.1",
    author: "Christus",
    countDown: 3,
    role: 0,
    description: {
      en: "Advanced AI (text, image, music, video, lyrics)"
    },
    category: "ai",
    nixPrefix: false,
    guide: {
      en: "   {pn} <message | image> - Chat with AI (can also reply to an image)"
        + "\n   {pn} reset - Clear conversation history"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply }) {
    const input = args.join(" ").trim();
    const userId = senderId;

    // --- Commande de réinitialisation ---
    if (["reset", "clear"].includes(input.toLowerCase())) {
      try {
        await axios.delete(`${CLEAR_ENDPOINT}/${encodeURIComponent(userId)}`);
        return reply("♻️ Conversation réinitialisée avec succès.");
      } catch {
        return reply("❌ Échec de la réinitialisation de la conversation.");
      }
    }

    // --- Recherche d'une image dans le message actuel ou dans un message cité ---
    let imageDataUrl = null;
    let targetMessage = event;

    if (event.message?.imageMessage) {
      // Le message lui-même contient une image
      imageDataUrl = await getImageDataUrlFromMessage(sock, event);
    } else if (event.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      // L'utilisateur a cité un message contenant une image
      const quoted = {
        key: {
          remoteJid: chatId,
          fromMe: false,
          id: event.message.extendedTextMessage.contextInfo.stanzaId
        },
        message: event.message.extendedTextMessage.contextInfo.quotedMessage
      };
      imageDataUrl = await getImageDataUrlFromMessage(sock, quoted);
    }

    // Si aucun texte ni image, on arrête
    if (!input && !imageDataUrl) {
      return reply("💬 Veuillez fournir un message ou une image.");
    }

    const timestamp = moment().tz("Asia/Manila").format("MMMM D, YYYY h:mm A");

    // Message d'attente
    const waitMsg = await sock.sendMessage(chatId, {
      text: `🤖 L'IA réfléchit...\n━━━━━━━━━━━━━━━\n📅 ${timestamp}`
    }, { quoted: event });

    const createdFiles = [];

    try {
      // Appel à l'API
      const res = await axios.post(API_ENDPOINT, {
        uid: userId,
        message: input || "",
        image_url: imageDataUrl || null
      });

      const { reply: aiReply, image_url, music_data, video_data, shoti_data, lyrics_data } = res.data;

      // Normalisation et application de la police sans‑serif (simulée)
      let text = normalizeText(aiReply || "✅ Réponse de l'IA");
      text = sansSerif(text);

      const attachments = [];

      // Image générée
      if (image_url) {
        const file = await download(image_url, "jpg");
        attachments.push({ type: "image", path: file });
        createdFiles.push(file);
      }

      // Musique (audio)
      if (music_data?.downloadUrl) {
        const file = await download(music_data.downloadUrl, "mp3");
        attachments.push({ type: "audio", path: file });
        createdFiles.push(file);
      }

      // Vidéo (soit video_data soit shoti_data)
      const videoUrl = video_data?.downloadUrl || shoti_data?.downloadUrl;
      if (videoUrl) {
        const file = await download(videoUrl, "mp4");
        attachments.push({ type: "video", path: file });
        createdFiles.push(file);
      }

      // Paroles (lyrics)
      if (lyrics_data?.lyrics) {
        let lyrics = normalizeText(lyrics_data.lyrics.slice(0, 1500));
        lyrics = sansSerif(lyrics);
        text += `\n\n🎵 ${sansSerif(lyrics_data.track_name || "Titre inconnu")}\n${lyrics}`;
      }

      // Supprimer le message d'attente
      await sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          fromMe: true,
          id: waitMsg.key.id,
          participant: waitMsg.key.participant || waitMsg.key.remoteJid
        }
      });

      // Envoi des médias (avec le texte en légende)
      if (attachments.length) {
        for (const media of attachments) {
          const buffer = await fs.readFile(media.path);
          const msgOptions = {
            caption: text,
            quoted: event
          };

          if (media.type === "image") {
            await sock.sendMessage(chatId, { image: buffer, ...msgOptions });
          } else if (media.type === "audio") {
            await sock.sendMessage(chatId, { audio: buffer, mimetype: "audio/mpeg", ...msgOptions });
          } else if (media.type === "video") {
            await sock.sendMessage(chatId, { video: buffer, ...msgOptions });
          }
        }
      } else {
        // Pas de média, seulement le texte
        await sock.sendMessage(chatId, { text }, { quoted: event });
      }

    } catch (err) {
      console.error("AI Command Error:", err);
      // Modifier le message d'attente pour signaler l'erreur
      await sock.sendMessage(chatId, {
        text: "❌ Une erreur est survenue avec l'IA.",
        edit: waitMsg.key
      });
    } finally {
      // Nettoyage des fichiers temporaires
      for (const file of createdFiles) {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
        }
      }
    }
  }
};
