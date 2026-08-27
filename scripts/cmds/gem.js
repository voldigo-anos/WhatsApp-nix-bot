const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

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

async function getBufferFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Erreur de téléchargement image:', error.message);
    return null;
  }
}

module.exports = {
  config: {
    name: "gem",
    aliases: ["gen", "imagine", "generate"],
    version: "1.1",
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
    let cleanArgs = [...args];

    let ratio = "1:1";
    const ratioIndex = cleanArgs.findIndex((a) => /^\d+:\d+$/.test(a));
    if (ratioIndex !== -1) {
      ratio = cleanArgs[ratioIndex];
      cleanArgs.splice(ratioIndex, 1);
    }

    let imageSource = null;
    let isEdit = false;

    if (event.message?.messageReply?.message?.imageMessage) {
      const quotedMsg = event.message.messageReply;
      if (quotedMsg.message?.imageMessage) {
        imageSource = quotedMsg.message.imageMessage.url;
        isEdit = true;
      } else if (quotedMsg.message?.videoMessage) {
        imageSource = quotedMsg.message.videoMessage.url;
        isEdit = true;
      }
    }

    if (!isEdit) {
      const urlIndex = cleanArgs.findIndex((a) => /^https?:\/\/\S+$/i.test(a));
      if (urlIndex !== -1) {
        imageSource = cleanArgs[urlIndex];
        cleanArgs.splice(urlIndex, 1);
        isEdit = true;
      }
    }

    const prompt = cleanArgs.join(" ").trim();

    if (!prompt) {
      return reply(
        `${HEADER}❓ Décris ce que tu veux ${isEdit ? "modifier sur l'image" : "générer"}.\n\n` +
        `💡 ${prefix}gem un dragon de cristal 16:9\n` +
        `💡 ${prefix}gem ajoute un chapeau (en réponse à une photo)`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `${HEADER}⏳ ${isEdit ? "Modification" : "Génération"} en cours...\n📝 Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}\n📐 Ratio: ${ratio}`
      }, { quoted: event });

      let imageBuffer;

      if (isEdit) {
        const response = await axios.post(
          EDIT_URL,
          { prompt, image: imageSource, ratio },
          { responseType: "arraybuffer", timeout: 90000 }
        );
        imageBuffer = Buffer.from(response.data);
      } else {
        const response = await axios.post(
          GENERATE_URL,
          { prompt, ratio, format: "jpg", nw: true },
          { responseType: "arraybuffer", timeout: 90000 }
        );
        imageBuffer = Buffer.from(response.data);
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      const caption =
        `${HEADER}✅ ${isEdit ? "Image modifiée" : "Image générée"} avec succès !\n\n` +
        `📝 Prompt : ${prompt}\n` +
        `📐 Ratio  : ${ratio}\n` +
        `🔄 Utilisez ${prefix}gem <description> pour en générer d'autres.`;

      await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: caption
      }, { quoted: event });

    } catch (err) {
      console.error("❌ Christus Gem error:", err.response?.data || err.message);
      const errorMsg = extractErrorMessage(err);
      return reply(`${HEADER}❌ Échec de la ${isEdit ? "modification" : "génération"}.\n📄 Raison: ${errorMsg}`);
    }
  }
};
