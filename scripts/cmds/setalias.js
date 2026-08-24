const { threadsData } = global.utils;
const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "setalias",
    version: "1.9",
    author: "Christus",
    countDown: 5,
    role: 1,
    prefix: true,
    category: "config",
    description: "Add or remove custom alias for commands in your group",
    guide: {
      en: "{pn} add <alias> <command> - Add alias for a command in this group"
        + "\n{pn} add <alias> <command> -g - Add alias globally (bot admin only)"
        + "\n{pn} remove <alias> <command> - Remove alias in this group"
        + "\n{pn} remove <alias> <command> -g - Remove alias globally (bot admin only)"
        + "\n{pn} list - List all aliases in this group"
        + "\n{pn} list -g - List all global aliases"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, isGroup, senderId }) {
    const commands = global.NixBot.commands;
    const ownerNumbers = (global.NixBot.config?.ownerNumber || []).map(n => String(n).replace(/\D/g, ""));
    const senderNum = (senderId || "").split("@")[0].split(":")[0].replace(/\D/g, "");
    const isOwner = ownerNumbers.includes(senderNum);

    const sub = (args[0] || "").toLowerCase();

    if (sub === "add") {
      if (!args[1] || !args[2])
        return reply(box({ title: "Setalias", emoji: "❌", body: "Usage : {pn} add <alias> <command>" }));

      const alias = args[1].toLowerCase();
      const commandName = args[2].toLowerCase();
      const isGlobal = args[3] === "-g";

      let cmdExists = false;
      for (const [name] of commands) {
        if (name === commandName) { cmdExists = true; break; }
      }
      if (!cmdExists)
        return reply(box({ title: "Setalias", emoji: "❌", body: `La commande "${bold(commandName)}" n'existe pas.` }));

      for (const [name, cmd] of commands) {
        const allNames = [cmd.config?.name, ...(cmd.config?.aliases || [])].map(n => (n || "").toLowerCase());
        if (allNames.includes(alias))
          return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias "${alias}" entre en conflit avec la commande "${name}".` }));
      }

      if (isGlobal) {
        if (!isOwner)
          return reply(box({ title: "Setalias", emoji: "⛔", body: "Seul l'admin du bot peut ajouter un alias global." }));

        if (!global.NixBot.globalAliases) global.NixBot.globalAliases = {};
        if (global.NixBot.globalAliases[alias]) {
          return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias global "${alias}" existe déjà pour "${global.NixBot.globalAliases[alias]}".` }));
        }
        global.NixBot.globalAliases[alias] = commandName;
        global.NixBot.aliases.set(alias, commandName);
        return reply(box({ title: "Setalias", emoji: "✅", body: `Alias global "${alias}" ajouté pour "${commandName}".` }));
      }

      if (!isGroup)
        return reply(box({ title: "Setalias", emoji: "❌", body: "Les alias de groupe ne peuvent être ajoutés qu'en groupe. Utilisez -g pour un alias global." }));

      const threadData = await threadsData.get(chatId) || {};
      const groupAliases = threadData.groupAliases || {};

      if (groupAliases[alias]) {
        return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias "${alias}" existe déjà pour "${groupAliases[alias]}" dans ce groupe.` }));
      }

      groupAliases[alias] = commandName;
      await threadsData.set(chatId, { groupAliases });
      return reply(box({ title: "Setalias", emoji: "✅", body: `Alias "${alias}" ajouté pour "${commandName}" dans ce groupe.` }));
    }

    if (sub === "remove" || sub === "rm") {
      if (!args[1] || !args[2])
        return reply(box({ title: "Setalias", emoji: "❌", body: "Usage : {pn} remove <alias> <command>" }));

      const alias = args[1].toLowerCase();
      const commandName = args[2].toLowerCase();
      const isGlobal = args[3] === "-g";

      if (isGlobal) {
        if (!isOwner)
          return reply(box({ title: "Setalias", emoji: "⛔", body: "Seul l'admin du bot peut retirer un alias global." }));

        if (!global.NixBot.globalAliases || !global.NixBot.globalAliases[alias]) {
          return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias global "${alias}" n'existe pas.` }));
        }
        if (global.NixBot.globalAliases[alias] !== commandName) {
          return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias global "${alias}" n'est pas lié à "${commandName}".` }));
        }
        delete global.NixBot.globalAliases[alias];
        global.NixBot.aliases.delete(alias);
        return reply(box({ title: "Setalias", emoji: "✅", body: `Alias global "${alias}" retiré de "${commandName}".` }));
      }

      if (!isGroup)
        return reply(box({ title: "Setalias", emoji: "❌", body: "Les alias de groupe ne peuvent être retirés qu'en groupe. Utilisez -g pour un alias global." }));

      const threadData = await threadsData.get(chatId) || {};
      const groupAliases = threadData.groupAliases || {};

      if (!groupAliases[alias]) {
        return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias "${alias}" n'existe pas dans ce groupe.` }));
      }
      if (groupAliases[alias] !== commandName) {
        return reply(box({ title: "Setalias", emoji: "❌", body: `L'alias "${alias}" n'est pas lié à "${commandName}" dans ce groupe.` }));
      }

      delete groupAliases[alias];
      await threadsData.set(chatId, { groupAliases });
      return reply(box({ title: "Setalias", emoji: "✅", body: `Alias "${alias}" retiré de "${commandName}" dans ce groupe.` }));
    }

    if (sub === "list") {
      const isGlobal = args[1] === "-g";

      if (isGlobal) {
        const ga = global.NixBot.globalAliases || {};
        const entries = Object.entries(ga);
        if (!entries.length)
          return reply(box({ title: "Setalias", emoji: "⚠️", body: "Aucun alias global défini." }));

        const grouped = {};
        for (const [alias, cmd] of entries) {
          if (!grouped[cmd]) grouped[cmd] = [];
          grouped[cmd].push(alias);
        }
        let list = "";
        for (const [cmd, aliases] of Object.entries(grouped)) list += `\n${bold(cmd)} : ${aliases.join(", ")}`;
        return reply(box({ title: "Alias Globaux", emoji: "📜", body: list.trim() }));
      }

      if (!isGroup)
        return reply(box({ title: "Setalias", emoji: "❌", body: "Utilisez le flag -g pour voir les alias globaux." }));

      const threadData = await threadsData.get(chatId) || {};
      const groupAliases = threadData.groupAliases || {};
      const entries = Object.entries(groupAliases);
      if (!entries.length)
        return reply(box({ title: "Setalias", emoji: "⚠️", body: "Aucun alias défini dans ce groupe." }));

      const grouped = {};
      for (const [alias, cmd] of entries) {
        if (!grouped[cmd]) grouped[cmd] = [];
        grouped[cmd].push(alias);
      }
      let list = "";
      for (const [cmd, aliases] of Object.entries(grouped)) list += `\n${bold(cmd)} : ${aliases.join(", ")}`;
      return reply(box({ title: "Alias du Groupe", emoji: "📜", body: list.trim() }));
    }

    return reply(box({ title: "Setalias", emoji: "❌", body: `Usage : {pn} add/remove/list\n${line}\nTapez {pn}help setalias pour plus de détails.` }));
  }
};
