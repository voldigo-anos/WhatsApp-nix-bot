const fs = require("fs-extra");
const path = require("path");
const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "prefix",
    aliases: [],
    version: "1.5",
    author: "Christus",
    countDown: 10,
    role: 0,
    shortDescription: "Affiche ou change le préfixe du bot",
    longDescription: "Permet de voir le préfixe actuel, de le changer pour ce chat ou globalement (admin), de le réinitialiser ou de rafraîchir le cache.",
    category: "config",
    guide: {
      en: "👋 Need help with prefixes? Here's what I can do:\n" +
        "╰‣ Type: {pn} <newPrefix>\n" +
        "   ↪ Set a new prefix for this chat only\n" +
        "   ↪ Example: {pn} $\n" +
        "╰‣ Type: {pn} <newPrefix> -g\n" +
        "   ↪ Set a new global prefix (admin only)\n" +
        "   ↪ Example: {pn} ! -g\n" +
        "╰‣ Type: {pn} reset\n" +
        "   ↪ Reset to default prefix from config\n" +
        "╰‣ Type: {pn} refresh\n" +
        "   ↪ Refresh prefix cache for this chat\n" +
        "╰‣ Just type: prefix\n" +
        "   ↪ Shows current prefix info"
    },
    nixPrefix: true
  },

  onStart: async function ({ sock, chatId, event, args, senderId, usersData, reply, role }) {
    const globalPrefix = global.NixBot.config.prefix;
    const userName = event.pushName || (await usersData.get(senderId))?.name || "there";

    let threadPrefix = globalPrefix;
    if (global.NixBot.threadConfig && global.NixBot.threadConfig.has(chatId)) {
      threadPrefix = global.NixBot.threadConfig.get(chatId).prefix || globalPrefix;
    }

    if (!args[0]) {
      return reply(box({
        title: "Préfixe",
        emoji: "👋",
        body: `Hey ${userName}, did you ask for my prefix?\n\n` +
          `${bold("Global")} : ${globalPrefix}\n` +
          `${bold("Ce chat")} : ${threadPrefix}\n${line}\n` +
          `📂 try "${threadPrefix}help" to see all commands.`
      }));
    }

    if (args[0] === "reset") {
      if (global.NixBot.threadConfig && global.NixBot.threadConfig.has(chatId)) {
        global.NixBot.threadConfig.delete(chatId);
      }
      return reply(box({
        title: "Préfixe",
        emoji: "✅",
        body: `Hey ${userName}, chat prefix has been reset!\n\n` +
          `${bold("Global")} : ${globalPrefix}\n` +
          `${bold("Ce chat")} : ${globalPrefix}`
      }));
    }

    if (args[0] === "refresh") {
      return reply(box({
        title: "Préfixe",
        emoji: "🔄",
        body: `Hey ${userName}, prefix cache has been refreshed!\n\n` +
          `${bold("Global")} : ${globalPrefix}\n` +
          `${bold("Ce chat")} : ${threadPrefix}`
      }));
    }

    const newPrefix = args[0];
    const setGlobal = args[1] === "-g";

    if (setGlobal && role < 2) {
      return reply(box({
        title: "Préfixe",
        emoji: "⛔",
        body: `Hey ${userName}, Admin privileges required for global change!`
      }));
    }

    const confirmBody = setGlobal
      ? `Hey ${userName}, confirm global prefix change?\n\n${bold("Actuel")} : ${globalPrefix}\n${bold("Nouveau")} : ${newPrefix}\n\n🤖 React to confirm!`
      : `Hey ${userName}, confirm chat prefix change?\n\n${bold("Actuel")} : ${threadPrefix}\n${bold("Nouveau")} : ${newPrefix}\n\n🤖 React to confirm!`;

    const sentMsg = await sock.sendMessage(chatId, { text: box({ title: "Confirmation", emoji: "⚙️", body: confirmBody }) }, { quoted: event });

    if (!global.NixBot.onReaction) global.NixBot.onReaction = new Map();
    global.NixBot.onReaction.set(sentMsg.key.id, {
      author: senderId,
      newPrefix,
      setGlobal,
      chatId
    });
  },

  onChat: async function ({ sock, chatId, event, senderId, usersData }) {
    const body = (event.message?.conversation || event.message?.extendedTextMessage?.text || "").toLowerCase().trim();
    if (!body) return;

    const triggers = ["prefix", "ňč", "nøøbcore"];
    if (!triggers.includes(body)) return;

    const globalPrefix = global.NixBot.config.prefix;
    const userName = event.pushName || (await usersData.get(senderId))?.name || "there";
    let threadPrefix = globalPrefix;
    if (global.NixBot.threadConfig && global.NixBot.threadConfig.has(chatId)) {
      threadPrefix = global.NixBot.threadConfig.get(chatId).prefix || globalPrefix;
    }

    await sock.sendMessage(chatId, {
      text: box({
        title: "Préfixe",
        emoji: "👋",
        body: `Hey ${userName}, did you ask for my prefix?\n\n` +
          `${bold("Global")} : ${globalPrefix}\n` +
          `${bold("Ce chat")} : ${threadPrefix}\n${line}\n` +
          `📂 try "${threadPrefix}help" to see all commands.`
      })
    }, { quoted: event });
  },

  onReaction: async function ({ sock, event, usersData }) {
    const messageId = event.message?.reactionMessage?.key?.id || event.key?.id;
    if (!messageId) return;

    const reactionData = global.NixBot.onReaction?.get(messageId);
    if (!reactionData) return;

    const { author, newPrefix, setGlobal, chatId } = reactionData;
    const reactor = event.key.participant || event.key.remoteJid;

    if (reactor !== author) return;

    const userName = event.pushName || (await usersData.get(author))?.name || "there";

    if (setGlobal) {
      global.NixBot.config.prefix = newPrefix;
      try {
        const configPath = path.join(process.cwd(), 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config.prefix = newPrefix;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, {
          text: box({ title: "Préfixe", emoji: "✅", body: `Hey ${userName}, global prefix updated to: ${newPrefix}` })
        });
      } catch (err) {
        await sock.sendMessage(chatId, {
          text: box({ title: "Préfixe", emoji: "❌", body: "Failed to save global prefix config." })
        });
      }
    } else {
      if (!global.NixBot.threadConfig) global.NixBot.threadConfig = new Map();
      global.NixBot.threadConfig.set(chatId, { prefix: newPrefix });
      await sock.sendMessage(chatId, {
        text: box({ title: "Préfixe", emoji: "✅", body: `Hey ${userName}, chat prefix updated to: ${newPrefix}` })
      });
    }

    global.NixBot.onReaction.delete(messageId);
  }
};
