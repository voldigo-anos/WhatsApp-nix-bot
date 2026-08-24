const axios = require("axios");
const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "emojimix",
    aliases: [],
    version: "1.4",
    author: "NTKhang",
    countDown: 5,
    role: 0,
    category: "fun",
    description: { en: "Mix 2 emoji together" },
    guide: { en: "{pn} <emoji1> <emoji2>\nExemple: {pn} 🤣 🥰" }
  },

  onStart: async function ({ args, chatId, event, reply, sock, prefix, commandName }) {
    const emoji1 = args[0];
    const emoji2 = args[1];

    if (!emoji1 || !emoji2) {
      return reply(box({ title: "Emojimix", emoji: "❌", body: `Syntaxe invalide.\n${bold("Usage")} : ${prefix}${commandName} <emoji1> <emoji2>` }));
    }

    const buffers = [];
    const b1 = await generateEmojimix(emoji1, emoji2);
    const b2 = await generateEmojimix(emoji2, emoji1);
    if (b1) buffers.push(b1);
    if (b2) buffers.push(b2);

    if (buffers.length === 0) {
      return reply(box({ title: "Emojimix", emoji: "❌", body: `Désolé, les emoji ${emoji1} et ${emoji2} ne peuvent pas être mixés.` }));
    }

    const caption = box({ title: "Emojimix", emoji: "🎭", body: `Les emoji ${emoji1} et ${emoji2} donnent ${buffers.length} image(s).` });

    for (let i = 0; i < buffers.length; i++) {
      await sock.sendMessage(chatId, {
        image: buffers[i],
        caption: i === 0 ? caption : undefined
      }, { quoted: event });
    }
  }
};

async function generateEmojimix(emoji1, emoji2) {
  try {
    const response = await axios.get("https://goatbotserver.onrender.com/taoanhdep/emojimix", {
      params: { emoji1, emoji2 },
      responseType: "arraybuffer",
      timeout: 20000
    });
    return Buffer.from(response.data);
  } catch (e) {
    return null;
  }
}
