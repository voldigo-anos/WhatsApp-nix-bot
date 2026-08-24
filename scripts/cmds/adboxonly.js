const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "onlyadminbox",
    aliases: ["onlyadbox", "adboxonly", "adminboxonly"],
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 1,
    category: "box chat",
    nixPrefix: true,
    description: {
      en: "Turn on/off only group admin can use bot"
    },
    guide: {
      en: "{pn} on: Only group admins can use bot in this group\n{pn} off: Everyone can use bot in this group"
    }
  },

  onStart: async function ({ sock, chatId, event, args, isGroup, threadsData, reply }) {
    if (!isGroup) {
      return reply(box({ title: "Admin Box Only", emoji: "❌", body: "Cette commande ne peut être utilisée que dans un groupe." }));
    }

    if (!args[0] || !["on", "off"].includes(args[0].toLowerCase())) {
      return reply(box({ title: "Admin Box Only", emoji: "⚠️", body: `Usage : ${bold("!adboxonly on")} ou ${bold("!adboxonly off")}` }));
    }

    const value = args[0].toLowerCase() === "on";

    const threadData = await threadsData.get(chatId);
    threadData.onlyAdminBox = value;
    await threadsData.set(chatId, threadData);

    if (value) {
      return reply(box({ title: "Admin Box Only", emoji: "✅", body: "Seuls les admins du groupe peuvent maintenant utiliser le bot." }));
    } else {
      return reply(box({ title: "Admin Box Only", emoji: "✅", body: "Tout le monde peut maintenant utiliser le bot dans ce groupe." }));
    }
  }
};
