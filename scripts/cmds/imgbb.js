const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../../config.json");
const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "imgbb",
    aliases: ["i"],
    version: "1.9",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    category: "upload",
    description: { en: "Convert an image to an image URL" },
    guide: { en: "{pn} - Reply to an image or send an image directly" }
  },

  onStart: async function ({ sock, chatId, event, reply }) {
    try {
      const msg = event.message || {};
      const contextInfo = msg?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      const imageMsg = quoted?.imageMessage
        || quoted?.documentWithCaptionMessage?.message?.imageMessage
        || quoted?.viewOnceMessageV2?.message?.imageMessage
        || msg?.imageMessage
        || null;

      if (!imageMsg) {
        return reply(box({ title: "Imgbb", emoji: "❌", body: `Veuillez répondre à une image valide ou en envoyer une directement.` }));
      }

      const stream = await downloadContentFromMessage(imageMsg, "image");
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const imageBuffer = Buffer.concat(chunks);

      if (!imageBuffer || imageBuffer.length < 100) {
        return reply(box({ title: "Imgbb", emoji: "❌", body: "Impossible de télécharger cette image." }));
      }

      const form = new FormData();
      form.append("key", config.imgbbApiKey);
      form.append("image", imageBuffer.toString("base64"));

      const response = await axios.post("https://api.imgbb.com/1/upload", form, { headers: form.getHeaders() });
      const result = response.data.data;

      return reply(box({
        title: "Imgbb",
        emoji: "🖼️",
        body: `${bold("URL de l'image")} :\n${result.url}`
      }));

    } catch (err) {
      console.error("[IMGBB]", err.message);
      return reply(box({ title: "Imgbb", emoji: "❌", body: "Échec de l'upload de l'image sur Imgbb." }));
    }
  }
};
