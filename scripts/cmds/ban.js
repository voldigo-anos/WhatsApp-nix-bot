const { threadsData } = global.utils;
const { box, bold, line } = require("../../func/style.js");

function cleanId(id) {
  return (id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

module.exports = {
  config: {
    name: "ban",
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 1,
    prefix: true,
    category: "group",
    description: "Ban user from group - auto kick if added back",
    guide: {
      en: "{pn} <@tag | reply> <reason> - Ban & kick user from group"
        + "\n{pn} unban <@tag | reply> - Unban user so they can rejoin"
        + "\n{pn} list - Show all banned users in this group"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, isGroup, senderId, commandName }) {
    if (!isGroup) return reply(box({ title: "Ban", emoji: "❌", body: "Cette commande ne peut être utilisée que dans un groupe." }));

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(chatId);
    } catch (e) {
      return reply(box({ title: "Ban", emoji: "❌", body: "Impossible de récupérer les infos du groupe." }));
    }

    const botNumber = (sock.user?.id?.split(":")[0] || "").replace(/\D/g, "");
    let botIsAdmin = false;
    for (const p of groupMeta.participants) {
      const pNum = (p.phoneNumber?.split("@")[0] || "").replace(/\D/g, "");
      const pId = (p.id?.split("@")[0] || "").replace(/\D/g, "");
      if (pNum === botNumber || pId === botNumber) {
        if (p.admin === "admin" || p.admin === "superadmin") botIsAdmin = true;
        break;
      }
    }

    if (!botIsAdmin) return reply(box({ title: "Ban", emoji: "❌", body: "Le bot doit être admin pour utiliser cette commande." }));

    const senderNum = cleanId(senderId);
    const senderParticipant = groupMeta.participants.find(p => cleanId(p.id) === senderNum);
    const senderIsAdmin = senderParticipant && (senderParticipant.admin === "admin" || senderParticipant.admin === "superadmin");
    const ownerNumbers = (global.config?.adminBot || []).map(n => n.replace(/\D/g, ""));
    const senderIsOwner = ownerNumbers.includes(senderNum);

    if (!senderIsAdmin && !senderIsOwner) return reply(box({ title: "Ban", emoji: "❌", body: "Vous devez être admin du groupe pour utiliser cette commande." }));

    const contextInfo = event.message?.extendedTextMessage?.contextInfo || {};
    const mentionedJids = contextInfo?.mentionedJid || [];
    const quotedParticipant = contextInfo?.participant || null;

    function getTargetId() {
      if (mentionedJids.length > 0) return cleanId(mentionedJids[0]);
      if (quotedParticipant) return cleanId(quotedParticipant);
      if (args[0] && /\d{7,}/.test(args[0])) return args[0].replace(/[^0-9]/g, "");
      return null;
    }

    function getTargetJid() {
      if (mentionedJids.length > 0) return mentionedJids[0];
      if (quotedParticipant) return quotedParticipant;
      const targetId = getTargetId();
      if (targetId) {
        const found = groupMeta.participants.find(p => cleanId(p.id) === targetId);
        if (found) return found.id;
        return targetId + "@s.whatsapp.net";
      }
      return null;
    }

    const threadData = await threadsData.get(chatId) || {};
    const groupBans = threadData.groupBans || [];

    if (args[0] === "unban") {
      args.shift();
      const targetId = getTargetId();
      if (!targetId) return reply(box({ title: "Ban", emoji: "⚠️", body: "Veuillez taguer ou répondre à l'utilisateur à débannir." }));

      const idx = groupBans.findIndex(b => cleanId(b.id) === targetId);
      if (idx === -1) return reply(box({ title: "Ban", emoji: "⚠️", body: `L'utilisateur ${targetId} n'est pas banni de ce groupe.` }));

      const removed = groupBans.splice(idx, 1)[0];
      await threadsData.set(chatId, { groupBans });
      return reply(box({ title: "Ban", emoji: "✅", body: `Débanni ${removed.name || targetId} (${targetId}).\nIl/elle peut désormais rejoindre le groupe.` }));
    }

    if (args[0] === "list") {
      if (!groupBans.length) return reply(box({ title: "Ban", emoji: "📋", body: "Aucun utilisateur banni dans ce groupe." }));

      let body = `${bold("Utilisateurs bannis")} (${groupBans.length}) :\n`;
      for (const ban of groupBans) {
        body += `\n╭ ID : ${ban.id}`;
        body += `\n│ Nom : ${ban.name || "Inconnu"}`;
        body += `\n│ Raison : ${ban.reason || "Aucune raison"}`;
        body += `\n╰ Date : ${ban.date || "Inconnue"}\n`;
      }
      return reply(box({ title: "Ban", emoji: "📋", body }));
    }

    const targetId = getTargetId();
    const targetJid = getTargetJid();
    if (!targetId || !targetJid) return reply(box({ title: "Ban", emoji: "⚠️", body: "Veuillez taguer ou répondre à l'utilisateur à bannir." }));

    if (targetId === botNumber) return reply(box({ title: "Ban", emoji: "❌", body: "Vous ne pouvez pas bannir le bot." }));

    const targetParticipant = groupMeta.participants.find(p => cleanId(p.id) === targetId);
    if (targetParticipant && (targetParticipant.admin === "admin" || targetParticipant.admin === "superadmin")) {
      return reply(box({ title: "Ban", emoji: "❌", body: "Vous ne pouvez pas bannir un admin du groupe." }));
    }

    if (ownerNumbers.includes(targetId)) return reply(box({ title: "Ban", emoji: "❌", body: "Vous ne pouvez pas bannir un propriétaire du bot." }));

    const existing = groupBans.find(b => cleanId(b.id) === targetId);
    if (existing) {
      return reply(box({ title: "Ban", emoji: "⚠️", body: `L'utilisateur ${existing.name || targetId} est déjà banni.\n${bold("Raison")} : ${existing.reason || "Aucune raison"}\n${bold("Date")} : ${existing.date || "Inconnue"}` }));
    }

    let reason;
    if (mentionedJids.length > 0) {
      reason = args.join(" ").replace(/@\d+/g, "").trim();
    } else if (quotedParticipant) {
      reason = args.join(" ").trim();
    } else {
      reason = args.slice(1).join(" ").trim();
    }
    if (!reason) reason = "Aucune raison";

    let name = targetId;
    const participant = groupMeta.participants.find(p => cleanId(p.id) === targetId);
    if (participant) name = participant.notify || participant.verifiedName || targetId;

    const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });

    groupBans.push({ id: targetId, jid: targetJid, name, reason, date: now, bannedBy: cleanId(senderId) });
    await threadsData.set(chatId, { groupBans });

    try {
      await sock.groupParticipantsUpdate(chatId, [targetJid], "remove");
    } catch (e) {
      console.error("[BAN KICK ERROR]", e.message);
      return reply(box({ title: "Ban", emoji: "⚠️", body: `Banni ${name} (${targetId}) mais échec du kick.\n${bold("Raison")} : ${reason}\n${bold("Date")} : ${now}\n${line}\nLe bot n'a peut-être pas la permission de kicker cet utilisateur.` }));
    }

    return reply(box({ title: "Ban", emoji: "✅", body: `Banni et kické ${name} (${targetId}).\n${bold("Raison")} : ${reason}\n${bold("Date")} : ${now}\n${line}\nIl/elle sera re-kické s'il/elle est réajouté(e). Utilisez !ban unban pour autoriser son retour.` }));
  },

  onEvent: async function ({ sock, eventData }) {
    if (eventData.type !== "group-participants.update") return;
    const { id, participants, action } = eventData.data;
    if (action !== "add") return;

    const threadData = await threadsData.get(id) || {};
    const groupBans = threadData.groupBans || [];
    if (!groupBans.length) return;

    for (const jid of participants) {
      const jidStr = typeof jid === "string" ? jid : jid?.id || jid?.toString() || "";
      if (!jidStr) continue;

      const num = cleanId(jidStr);
      const phoneNum = (typeof jid === "object" && jid?.phoneNumber || "").split(":")[0].split("@")[0].replace(/\D/g, "");

      const banned = groupBans.find(b => cleanId(b.id) === num || (phoneNum && cleanId(b.id) === phoneNum));
      if (banned) {
        try {
          await sock.sendMessage(id, { text: box({ title: "Ban", emoji: "⚠️", body: `@${num} est banni de ce groupe.\n${bold("Raison")} : ${banned.reason || "Aucune raison"}\n${line}\nAuto-kick en cours...` }), mentions: [jidStr] });
          await sock.groupParticipantsUpdate(id, [jidStr], "remove");
        } catch (e) {}
      }
    }
  }
};
