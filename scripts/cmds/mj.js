const axios = require("axios");
const { box, bold } = require("../../func/style.js");

const baseApi = "https://azadx69x-all-apis-top.vercel.app/api/mj";

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["mj"],
    version: "0.0.9",
    author: "Azadx69x",
    countDown: 10,
    role: 0,
    category: "ai",
    description: { en: "Generate midjourney image using a prompt" },
    guide: { en: "{pn} <prompt>" }
  },

  onStart: async function ({ args, chatId, event, reply, sock }) {
    const prompt = args.join(" ");

    if (!prompt) {
      return reply(box({ title: "Midjourney", emoji: "⚠️", body: "Veuillez fournir un prompt." }));
    }

    const waitMsg = await sock.sendMessage(chatId, {
      text: box({ title: "Midjourney", emoji: "🎨", body: `${bold("Génération en cours")}...\n⏳ Veuillez patienter...` })
    }, { quoted: event });

    try {
      const apiUrl = `${baseApi}?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl, { timeout: 120000 });
      const result = response.data;

      if (!result.success || !result.data?.images?.length) {
        throw new Error("L'API n'a retourné aucune image.");
      }

      const images = result.data.images;
      const buffers = [];
      for (const imageUrl of images) {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 60000 });
        buffers.push(Buffer.from(imgResp.data));
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key });

      const caption = box({ title: "Midjourney", emoji: "🎨", body: `${bold("Prompt")} :\n${prompt}` });

      for (let i = 0; i < buffers.length; i++) {
        await sock.sendMessage(chatId, {
          image: buffers[i],
          caption: i === 0 ? caption : undefined
        }, { quoted: event });
      }

    } catch (err) {
      console.error("[MJ]", err.message);
      await sock.sendMessage(chatId, { delete: waitMsg.key });
      const msg = err.response?.data?.error || err.message || "Erreur lors de la génération de l'image.";
      reply(box({ title: "Midjourney", emoji: "❌", body: msg }));
    }
  }
};
