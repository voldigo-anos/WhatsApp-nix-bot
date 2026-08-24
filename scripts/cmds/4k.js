const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { uploadImage } = global.utils;
const { box, bold, line } = require("../../func/style.js");

const cacheDir = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "4k",
    aliases: [],
    version: "0.0.7",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    category: "image",
    description: { en: "Upscale image to 4K" },
    guide: { en: "{pn} - Reply to an image or {pn} <image_url>" }
  },

  onStart: async function ({ sock, chatId, args, event, reply }) {
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    try {
      let imageUrl;

      const contextInfo = event.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const imageMsg = quoted?.imageMessage
        || quoted?.documentWithCaptionMessage?.message?.imageMessage
        || quoted?.viewOnceMessageV2?.message?.imageMessage
        || null;

      if (imageMsg) {
        const stream = await downloadContentFromMessage(imageMsg, "image");
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (!buffer || buffer.length < 100) throw new Error("Échec du téléchargement de l'image.");
        imageUrl = await uploadImage(buffer);
      } else if (args[0] && args[0].startsWith("http")) {
        imageUrl = args[0];
      } else {
        return reply(box({
          title: "4K Upscale",
          emoji: "❌",
          body: `Veuillez répondre à une image ou fournir une ${bold("URL")} d'image.`
        }));
      }

      const waitMsg = await sock.sendMessage(chatId, {
        text: box({ title: "4K Upscale", emoji: "😺", body: `${bold("Traitement en cours")}...\n⏳ Veuillez patienter...` })
      }, { quoted: event });

      const apiUrl = `https://azadx69x-4k-apis.vercel.app/api/4k?imgUrl=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (response.data.status !== "success" || !response.data.upscaledImage) {
        throw new Error("L'upscale a échoué.");
      }

      const upscaledImageUrl = response.data.upscaledImage;
      const imageResponse = await axios.get(upscaledImageUrl, { responseType: "arraybuffer", timeout: 30000 });
      const buffer = Buffer.from(imageResponse.data);

      await sock.sendMessage(chatId, { delete: waitMsg.key });

      await sock.sendMessage(chatId, {
        image: buffer,
        caption: box({ title: "4K Upscale", emoji: "✅", body: `${bold("Image upscalée en 4K avec succès")} !` })
      }, { quoted: event });

    } catch (error) {
      console.error("[4K] Upscale error:", error.message);
      reply(box({ title: "4K Upscale", emoji: "❌", body: `Échec de l'upscale 4K. Réessayez.\n${line}\n${error.message}` }));
    }
  }
};
