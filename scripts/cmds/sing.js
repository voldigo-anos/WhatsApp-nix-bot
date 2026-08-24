const axios = require("axios");
const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "sing",
    aliases: ["song", "music"],
    version: "0.0.7",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    category: "social",
    description: { en: "Sing a song from YouTube" },
    guide: { en: "{pn} <song name>" }
  },

  onStart: async function ({ args, chatId, event, reply, sock }) {
    const query = args.join(" ");

    if (!query) {
      return reply(box({ title: "Sing", emoji: "❌", body: "Veuillez fournir un nom de chanson." }));
    }

    try {
      await sock.sendMessage(chatId, { react: { text: "🔍", key: event.key } });

      const apiUrl = `https://azadx69x-all-apis-top.vercel.app/api/sing?song=${encodeURIComponent(query)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });

      if (!res.data?.success || !res.data?.audio?.url) {
        await sock.sendMessage(chatId, { react: { text: "❌", key: event.key } });
        return reply(box({ title: "Sing", emoji: "❌", body: "Échec de la récupération de l'audio." }));
      }

      const { info, audio } = res.data;

      await sock.sendMessage(chatId, { react: { text: "⬇️", key: event.key } });

      const downloadRes = await axios({
        url: audio.url,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const buffer = Buffer.from(downloadRes.data);

      await sock.sendMessage(chatId, {
        audio: buffer,
        mimetype: "audio/mpeg",
        caption: box({ title: "Sing", emoji: "🎵", body: `${bold("Titre")} : ${info.title}\n${bold("Artiste")} : ${info.artist}` })
      }, { quoted: event });

      await sock.sendMessage(chatId, { react: { text: "✅", key: event.key } });

    } catch (error) {
      console.error("[SING]", error.message);
      await sock.sendMessage(chatId, { react: { text: "❌", key: event.key } });
      return reply(box({ title: "Sing", emoji: "❌", body: `Erreur : ${error.message}` }));
    }
  }
};
