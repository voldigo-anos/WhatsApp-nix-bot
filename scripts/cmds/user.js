const { box, bold } = require("../../func/style.js");

function getBanList() {
  if (!global.NixBot.controlData) global.NixBot.controlData = {};
  const ub = global.NixBot.controlData.userBan;
  if (!ub) {
    global.NixBot.controlData.userBan = [];
    return global.NixBot.controlData.userBan;
  }
  if (Array.isArray(ub)) return ub;
  if (typeof ub === "object" && ub.id) {
    global.NixBot.controlData.userBan = [ub];
    return global.NixBot.controlData.userBan;
  }
  global.NixBot.controlData.userBan = [];
  return global.NixBot.controlData.userBan;
}

function cleanId(id) {
  return (id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

function isBanned(targetId) {
  const list = getBanList();
  return list.find(b => cleanId(b.id) === targetId) || null;
}

module.exports = {
  config: {
    name: "user",
    aliases: [],
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 2,
    prefix: true,
    category: "owner",
    description: "Manage users in bot system",
    guide: {
      en: "{pn} ban <@tag | uid> <reason> - Ban user from using bot\n{pn} unban <@tag | uid> - Unban user\n{pn} banlist - Show all banned users\n{pn} info <@tag | uid> - Show user info"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, isGroup }) {
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      const body = `1. ${bold("user ban")} <@tag | uid> <raison>\n`
        + `2. ${bold("user unban")} <@tag | uid>\n`
        + `3. ${bold("user banlist")}\n`
        + `4. ${bold("user info")} <@tag | uid>`;
      return reply(box({ title: "User", emoji: "👤", body: `${bold("Commandes disponibles")} :\n${body}` }));
    }

    const contextInfo = event.message?.extendedTextMessage?.contextInfo || {};
    const mentionedJids = contextInfo?.mentionedJid || [];
    const quotedParticipant = contextInfo?.participant || null;

    function getTargetId() {
      if (mentionedJids.length > 0) {
        return cleanId(mentionedJids[0]);
      }
      if (quotedParticipant) {
        return cleanId(quotedParticipant);
      }
      if (args[1]) {
        return args[1].replace(/[^0-9]/g, "");
      }
      return null;
    }

    function getTargetJid() {
      if (mentionedJids.length > 0) return mentionedJids[0];
      if (quotedParticipant) return quotedParticipant;
      if (args[1]) return args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      return null;
    }

    switch (sub) {
      case "ban":
      case "-b": {
        const targetId = getTargetId();
        if (!targetId) return reply(box({ title: "User", emoji: "⚠️", body: "L'UID de l'utilisateur à bannir ne peut pas être vide. Taguez, répondez ou indiquez un UID via `user ban <uid> <raison>`." }));

        let reason;
        if (mentionedJids.length > 0) {
          reason = args.slice(1).join(" ").replace(/@\d+/g, "").trim();
        } else if (quotedParticipant) {
          reason = args.slice(1).join(" ").trim();
        } else {
          reason = args.slice(2).join(" ").trim();
        }

        if (!reason) return reply(box({ title: "User", emoji: "⚠️", body: "La raison du bannissement ne peut pas être vide. Utilisez `user ban <uid> <raison>`." }));

        const banList = getBanList();
        const existing = isBanned(targetId);

        if (existing) {
          return reply(box({ title: "User", emoji: "⚠️", body: `L'utilisateur [${targetId} | ${existing.name || targetId}] est déjà banni :\n${bold("Raison")} : ${existing.reason || "Aucune raison"}\n${bold("Date")} : ${existing.date || "Inconnue"}` }));
        }

        const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });

        let name = targetId;
        try {
          if (isGroup) {
            const groupMeta = await sock.groupMetadata(chatId);
            const p = groupMeta.participants.find(m => cleanId(m.id) === targetId);
            if (p) name = p.notify || p.verifiedName || targetId;
          }
        } catch (e) {}

        banList.push({ id: targetId, name, reason, date: now });

        return reply(box({ title: "User", emoji: "✅", body: `L'utilisateur [${targetId} | ${name}] a été banni :\n${bold("Raison")} : ${reason}\n${bold("Date")} : ${now}` }));
      }

      case "unban":
      case "-u": {
        const targetId = getTargetId();
        if (!targetId) return reply(box({ title: "User", emoji: "⚠️", body: "L'UID de l'utilisateur à débannir ne peut pas être vide." }));

        const banList = getBanList();
        const idx = banList.findIndex(b => cleanId(b.id) === targetId);

        if (idx === -1) {
          return reply(box({ title: "User", emoji: "⚠️", body: `L'utilisateur [${targetId}] n'est pas banni.` }));
        }

        const removed = banList.splice(idx, 1)[0];
        return reply(box({ title: "User", emoji: "✅", body: `L'utilisateur [${targetId} | ${removed.name || targetId}] a été débanni.` }));
      }

      case "banlist": {
        const banList = getBanList();
        if (!banList.length) return reply(box({ title: "User", emoji: "📋", body: "Aucun utilisateur banni." }));

        let body = `${bold("Utilisateurs bannis")} (${banList.length}) :\n`;
        for (const ban of banList) {
          const id = cleanId(ban.id);
          body += `\n╭ ID : ${id}`;
          body += `\n│ Nom : ${ban.name || "Inconnu"}`;
          body += `\n│ Raison : ${ban.reason || "Aucune raison"}`;
          body += `\n╰ Date : ${ban.date || "Inconnue"}\n`;
        }
        return reply(box({ title: "User", emoji: "📋", body }));
      }

      case "info": {
        if (!isGroup) return reply(box({ title: "User", emoji: "❌", body: "Cette commande ne peut être utilisée que dans un groupe." }));
        const targetId = getTargetId();
        if (!targetId) return reply(box({ title: "User", emoji: "⚠️", body: "Veuillez taguer un utilisateur ou fournir un UID." }));

        try {
          const groupMeta = await sock.groupMetadata(chatId);
          const p = groupMeta.participants.find(m => cleanId(m.id) === targetId);

          if (!p) return reply(box({ title: "User", emoji: "❌", body: `Utilisateur ${targetId} introuvable dans ce groupe.` }));

          const name = p.notify || p.verifiedName || "Inconnu";
          const role = p.admin === "superadmin" ? "Super Admin" : p.admin === "admin" ? "Admin" : "Membre";
          const banned = isBanned(targetId);

          const body = `╭ ${bold("Nom")} : ${name}\n`
            + `│ ${bold("ID")} : ${targetId}\n`
            + `│ ${bold("Rôle")} : ${role}\n`
            + `╰ ${bold("Banni")} : ${banned ? "Oui" : "Non"}`;
          return reply(box({ title: "User Info", emoji: "👤", body }));
        } catch (err) {
          console.error("[USER INFO ERROR]", err.message);
          return reply(box({ title: "User", emoji: "❌", body: "Échec de la récupération des infos utilisateur." }));
        }
      }

      default:
        return reply(box({ title: "User", emoji: "⚠️", body: "Sous-commande invalide. Utilisez `user` pour l'aide." }));
    }
  }
};
