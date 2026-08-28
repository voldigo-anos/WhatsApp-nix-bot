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

async function downloadImageFromMessage(imageMsg) {
  try {
    const stream = await downloadContentFromMessage(imageMsg, "image");
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer && buffer.length > 100) {
      return buffer;
    }
    return null;
  } catch (error) {
    console.error("Erreur téléchargement image répondue:", error.message);
    return null;
  }
}

async function downloadImageFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error("Erreur téléchargement image URL:", error.message);
    return null;
  }
}

async function downloadAndUploadImage(imageMsg) {
  try {
    let buffer = null;
    
    // Essayer via downloadContentFromMessage
    try {
      buffer = await downloadImageFromMessage(imageMsg);
      if (buffer) return buffer;
    } catch (e) {
      console.log("Échec downloadContentFromMessage, tentative alternative...");
    }

    // Alternative: essayer de récupérer l'URL directe de l'image
    try {
      const url = imageMsg?.url || imageMsg?.jpegThumbnail || imageMsg?.thumbnail;
      if (url && url.startsWith("http")) {
        buffer = await downloadImageFromURL(url);
        if (buffer) return buffer;
      }
    } catch (e) {
      console.log("Échec récupération URL directe...");
    }

    // Dernier recours: essayer avec le buffer existant
    try {
      if (imageMsg?.buffer) {
        return Buffer.from(imageMsg.buffer);
      }
    } catch (e) {}

    return null;
  } catch (error) {
    console.error("Erreur téléchargement/upload image:", error.message);
    return null;
  }
}

module.exports = {
  config: {
    name: "gem",
    aliases: ["gen", "imagine", "generate"],
    version: "1.3",
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
    let imageUrl = null;

    // Vérifier si l'utilisateur a répondu à une image
    const contextInfo = event.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    
    // Détection des différents types de messages répondus
    const imageMsg = quoted?.imageMessage
      || quoted?.documentWithCaptionMessage?.message?.imageMessage
      || quoted?.viewOnceMessageV2?.message?.imageMessage
      || quoted?.videoMessage
      || null;

    if (imageMsg) {
      try {
        // Essayer de télécharger l'image avec plusieurs méthodes
        const buffer = await downloadAndUploadImage(imageMsg);
        if (buffer && buffer.length > 100) {
          imageBuffer = buffer;
          isEdit = true;
          console.log("✅ Image téléchargée avec succès, taille:", buffer.length);
        } else {
          console.log("❌ Échec téléchargement image, buffer invalide");
        }
      } catch (err) {
        console.error("Erreur téléchargement image répondue:", err.message);
      }
    }

    // Si pas d'image en réponse, vérifier si une URL est fournie dans les arguments
    if (!isEdit) {
      const urlIndex = cleanArgs.findIndex((a) => /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp)/i.test(a));
      if (urlIndex !== -1) {
        try {
          const buffer = await downloadImageFromURL(cleanArgs[urlIndex]);
          if (buffer && buffer.length > 100) {
            imageBuffer = buffer;
            isEdit = true;
            imageUrl = cleanArgs[urlIndex];
            cleanArgs.splice(urlIndex, 1);
            prompt = cleanArgs.join(" ").trim();
            console.log("✅ Image téléchargée depuis URL, taille:", buffer.length);
          }
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
        `💡 Assurez-vous de répondre à une image valide.\n` +
        `💡 Vous pouvez aussi fournir une URL d'image.\n\n` +
        `Exemple: ${prefix}gem rends cette image en style anime ${imageUrl || ''}`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `${HEADER}⏳ ${isEdit ? "Modification" : "Génération"} en cours...\n📝 Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}\n📐 Ratio: ${ratio}`
      }, { quoted: event });

      let resultBuffer;

      if (isEdit) {
        // Uploader l'image pour l'édition
        console.log("📤 Upload de l'image pour édition...");
        const uploadedUrl = await uploadImage(imageBuffer);
        console.log("✅ Image uploadée:", uploadedUrl);
        
        console.log("🔧 Envoi de la requête d'édition...");
        const response = await axios.post(
          EDIT_URL,
          { prompt, image: uploadedUrl, ratio },
          { 
            responseType: "arraybuffer", 
            timeout: 120000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        resultBuffer = Buffer.from(response.data);
        console.log("✅ Édition réussie, taille:", resultBuffer.length);
      } else {
        console.log("🎨 Envoi de la requête de génération...");
        const response = await axios.post(
          GENERATE_URL,
          { prompt, ratio, format: "jpg", nw: true },
          { 
            responseType: "arraybuffer", 
            timeout: 120000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        resultBuffer = Buffer.from(response.data);
        console.log("✅ Génération réussie, taille:", resultBuffer.length);
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
                  `• Exemple: rends cette image en style anime\n` +
                  `• Vous pouvez aussi fournir une URL: ${prefix}gem ajoute un chat (url_image)`;
      }
      
      return reply(`${HEADER}❌ Échec de la ${isEdit ? "modification" : "génération"}.\n📄 Raison: ${errorMsg}${helpMsg}`);
    }
  }
};
