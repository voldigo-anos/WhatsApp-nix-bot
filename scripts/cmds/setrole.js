const { readFile, writeFile } = require("fs-extra");
const path = require("path");
const { box, bold } = require("../../func/style.js");

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");
const roleLabels = { 0: "Everyone", 1: "Group Admin", 2: "Bot Admin", 3: "Bot Owner" };

module.exports = {
  config: {
    name: "setrole",
    aliases: ["setrol"],
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 2,
    category: "owner",
    nixPrefix: true,
    description: {
      en: "Change role of any command"
    },
    guide: {
      en: "{pn} <commandName> <newRole>: Set new role for a command"
        + "\n   Roles:"
        + "\n   0 = Everyone can use"
        + "\n   1 = Group admin only"
        + "\n   2 = Bot admin only"
        + "\n   3 = Bot owner only"
        + "\n   default = Reset to original role"
        + "\n\n   {pn} view: View all modified roles"
        + "\n\n   Example:"
        + "\n   {pn} help 1 (only group admins can use help)"
        + "\n   {pn} help default (reset help to original role)"
    }
  },

  onStart: async function ({ sock, chatId, args, event, prefix, commandName, reply }) {
    if (!args[0]) return reply(box({ title: "Setrole", emoji: "⚠️", body: `Usage : ${prefix}${commandName} <commandName> <newRole>\nTapez ${prefix}help ${commandName} pour plus de détails.` }));

    let config;
    try {
      const data = await readFile(CONFIG_PATH, "utf8");
      config = JSON.parse(data);
      if (!config.commandRoles) config.commandRoles = {};
    } catch (e) {
      return reply(box({ title: "Setrole", emoji: "❌", body: "Échec du chargement de la configuration." }));
    }

    const saveConfig = async () => {
      await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
      global.NixBot.config = config;
    };

    const sendAndTrack = async (body, emoji = "👑") => {
      const oldMsgs = global.NixBot._setroleMessages || {};
      if (oldMsgs[chatId]) {
        try {
          await sock.sendMessage(chatId, { delete: oldMsgs[chatId] });
        } catch (e) {}
      }
      const sent = await sock.sendMessage(chatId, { text: box({ title: "Setrole", emoji, body }) }, { quoted: event });
      if (!global.NixBot._setroleMessages) global.NixBot._setroleMessages = {};
      global.NixBot._setroleMessages[chatId] = sent.key;
      return sent;
    };

    if (["view", "viewrole", "show", "list"].includes(args[0].toLowerCase())) {
      const roles = config.commandRoles || {};
      const entries = Object.entries(roles);
      if (entries.length === 0) return sendAndTrack("Aucune commande n'a de rôle modifié.");

      let msg = `${bold("Rôles de commandes modifiés")} :\n`;
      for (const [cmd, role] of entries) {
        msg += `\n• ${cmd} → Rôle ${role} (${roleLabels[role] || "Inconnu"})`;
      }
      return sendAndTrack(msg);
    }

    const targetCmd = args[0].toLowerCase();
    const newRole = args[1]?.toLowerCase();

    if (!newRole) return sendAndTrack(`Veuillez fournir un nouveau rôle.\nUsage : ${prefix}${commandName} ${targetCmd} <0|1|2|3|default>`, "⚠️");

    const commands = global.NixBot.commands;
    let foundCmd = null;

    for (const [name, cmd] of commands) {
      const cmdConfig = cmd.config || {};
      const names = [cmdConfig.name, ...(cmdConfig.aliases || [])].map(n => n?.toLowerCase());
      if (names.includes(targetCmd)) {
        foundCmd = { name: cmdConfig.name, cmd, config: cmdConfig };
        break;
      }
    }

    if (!foundCmd) return sendAndTrack(`Commande "${targetCmd}" introuvable.`, "❌");

    if (newRole === "default" || newRole === "reset") {
      if (config.commandRoles[foundCmd.name] !== undefined) {
        const originalRole = foundCmd.config._originalRole !== undefined ? foundCmd.config._originalRole : foundCmd.config.role;
        foundCmd.config.role = originalRole;
        delete foundCmd.config._originalRole;
        delete config.commandRoles[foundCmd.name];
        await saveConfig();
        return sendAndTrack(`Rôle de "${foundCmd.name}" réinitialisé par défaut : Rôle ${originalRole} (${roleLabels[originalRole] || "Inconnu"})`, "✅");
      }
      return sendAndTrack(`"${foundCmd.name}" est déjà à son rôle par défaut.`);
    }

    const roleNum = parseInt(newRole);
    if (isNaN(roleNum) || roleNum < 0 || roleNum > 3) {
      return sendAndTrack("Rôle invalide. Utilisez 0, 1, 2, 3 ou default.", "❌");
    }

    if (foundCmd.config._originalRole === undefined) {
      foundCmd.config._originalRole = foundCmd.config.role;
    }

    foundCmd.config.role = roleNum;
    config.commandRoles[foundCmd.name] = roleNum;
    await saveConfig();

    return sendAndTrack(`Rôle de "${foundCmd.name}" mis à jour : ${roleNum} (${roleLabels[roleNum]})`, "✅");
  }
};
