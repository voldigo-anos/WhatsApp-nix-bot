const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { uploadImage } = global.utils;

const BASE = "https://image-gen-fix.vercel.app";
const GENERATE_URL = `${BASE}/generate`;
const EDIT_URL = `${BASE}/edit`;

const HEADER = "🖼️ 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗚𝗲𝗺\n━━━━━━━━━\n\n";

const extractErrorMessage = (err) => {
  try {
    if (err.response?.data) {
      const text = Buffer.from(err.response.data).toString("utf-8");
      const json = JSON.parse(text);
      return json.error || json.message || text;
    }
  } catch {}
  return err.message || "Erreur inconnue";
};

module.exports = {
  config: {
    name: "gem",
    aliases: ["gen", "imagine", "generate"],
    version: "1.2",
    author: "Christus",
    role: 0,
    countDown: 10,
    description: {
      en: "Generate or edit images with AI"
    },
    category: "ai",
    nixPrefix: true,
    guide: {
      en:
        "   {pn} <description> [ratio] - Generate an image\n" +
        "   {pn} <instruction> [ratio] - Edit an image (reply to an image)\n\n" +
        "   Examples:\n" +
        "   {pn} a crystal dragon 16:9\n" +
        "   {pn} add a hat (reply to a photo)"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    if (!fs.existsSync(path.join(__dirname, "cache"))) {
      fs.mkdirSync(path.join(__dirname, "cache"), { recursive: true });
    }

    let cleanArgs = [...args];

    let ratio = "1:1";
    const ratioIndex = cleanArgs.findIndex((a) => /^\d+:\d+$/.test(a));
    if (ratioIndex !== -1) {
      ratio = cleanArgs[ratioIndex];
      cleanArgs.splice(ratioIndex, 1);
    }

    let prompt = cleanArgs.join(" ").trim();
    let isEdit = false;
    let imageBuffer = null;

    // Vérifier si l'utilisateur a répondu à une image
    const contextInfo = event.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    
    // Détection des différents types de messages répondus
    const imageMsg = quoted?.imageMessage
      || quoted?.documentWithCaptionMessage?.message?.imageMessage
      || quoted?.viewOnceMessageV2?.message?.imageMessage
      || null;

    if (imageMsg) {
      try {
        const stream = await downloadContentFromMessage(imageMsg, "image");
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer && buffer.length > 100) {
          imageBuffer = buffer;
          isEdit = true;
        }
      } catch (err) {
        console.error("Erreur téléchargement image répondue:", err.message);
      }
    }

    // Vérifier si un lien d'image est présent dans les arguments
    if (!isEdit) {
      const urlIndex = cleanArgs.findIndex((a) => /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i.test(a));
      if (urlIndex !== -1) {
        try {
          const response = await axios.get(cleanArgs[urlIndex], {
            responseType: "arraybuffer",
            timeout: 30000
          });
          imageBuffer = Buffer.from(response.data);
          isEdit = true;
          cleanArgs.splice(urlIndex, 1);
          prompt = cleanArgs.join(" ").trim();
        } catch (err) {
          console.error("Erreur téléchargement image URL:", err.message);
          imageBuffer = null;
          isEdit = false;
        }
      }
    }

    // Si c'est une édition mais qu'il n'y a pas de prompt, définir un prompt par défaut
    if (isEdit && !prompt) {
      prompt = "améliorer cette image";
    }

    // Si ce n'est pas une édition et qu'il n'y a pas de prompt
    if (!isEdit && !prompt) {
      return reply(
        `${HEADER}❓ Décris ce que tu veux générer.\n\n` +
        `💡 ${prefix}gem un dragon de cristal 16:9\n` +
        `💡 ${prefix}gem ajoute un chapeau (en réponse à une photo)`
      );
    }

    // Si c'est une édition mais qu'il n'y a pas d'image
    if (isEdit && !imageBuffer) {
      return reply(
        `${HEADER}❌ Impossible de récupérer l'image.\n\n` +
        `💡 Répondez à une image ou fournissez une URL d'image valide.`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `${HEADER}⏳ ${isEdit ? "Modification" : "Génération"} en cours...\n📝 Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}\n📐 Ratio: ${ratio}`
      }, { quoted: event });

      let resultBuffer;

      if (isEdit) {
        // Uploader l'image pour l'édition
        const uploadedUrl = await uploadImage(imageBuffer);
        
        const response = await axios.post(
          EDIT_URL,
          { prompt, image: uploadedUrl, ratio },
          { 
            responseType: "arraybuffer", 
            timeout: 90000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        resultBuffer = Buffer.from(response.data);
      } else {
        const response = await axios.post(
          GENERATE_URL,
          { prompt, ratio, format: "jpg", nw: true },
          { 
            responseType: "arraybuffer", 
            timeout: 90000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        resultBuffer = Buffer.from(response.data);
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      const caption =
        `${HEADER}✅ ${isEdit ? "Image modifiée" : "Image générée"} avec succès !\n\n` +
        `📝 Prompt : ${prompt}\n` +
        `📐 Ratio  : ${ratio}\n` +
        `🔄 Utilisez ${prefix}gem <description> pour en générer d'autres.`;

      await sock.sendMessage(chatId, {
        image: resultBuffer,
        caption: caption
      }, { quoted: event });

    } catch (err) {
      console.error("❌ Christus Gem error:", err.response?.data || err.message);
      const errorMsg = extractErrorMessage(err);
      
      let helpMsg = "";
      if (isEdit) {
        helpMsg = `\n\n💡 Astuces pour l'édition:\n` +
                  `• Répondez à une image avec votre instruction\n` +
                  `• Exemple: ajoute un chapeau à cette personne\n` +
                  `• Exemple: rends cette image en style anime`;
      }
      
      return reply(`${HEADER}❌ Échec de la ${isEdit ? "modification" : "génération"}.\n📄 Raison: ${errorMsg}${helpMsg}`);
    }
  }
};
