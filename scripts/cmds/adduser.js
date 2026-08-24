const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "adduser",
    aliases: ["add"],
    version: "1.0",
    author: "ArYAN",
    countDown: 5,
    role: 1,
    description: "Add user to group chat",
    category: "box chat",
    guide: {
      en: "{pn} [phone number | @mention | reply]"
    }
  },

  onStart: async function ({ sock, chatId, event, senderId, args, reply, isGroup }) {
    const lang = {
      alreadyInGroup: "Déjà dans le groupe",
      cannotAddUser: "Bot bloqué ou utilisateur refusant les invitations",
      notGroup: "Cette commande ne peut être utilisée que dans un groupe.",
      noInput: "Veuillez fournir un numéro de téléphone, une @mention, ou répondre à un message.",
      notOnWhatsApp: "Non enregistré sur WhatsApp"
    };

    if (!isGroup) {
      return reply(box({ title: "Ajouter Utilisateur", emoji: "❌", body: lang.notGroup }));
    }

    let uidsToAdd = [];

    const msg = event.message;
    const contextInfo = msg?.extendedTextMessage?.contextInfo
      || msg?.imageMessage?.contextInfo
      || msg?.videoMessage?.contextInfo
      || msg?.conversation?.contextInfo
      || event.message?.contextInfo
      || {};

    if (contextInfo.mentionedJid && contextInfo.mentionedJid.length > 0) {
      for (const jid of contextInfo.mentionedJid) {
        uidsToAdd.push(jid);
      }
    }

    if (contextInfo.participant) {
      const repliedJid = contextInfo.participant;
      if (!uidsToAdd.includes(repliedJid)) {
        uidsToAdd.push(repliedJid);
      }
    }

    for (const item of args) {
      let cleaned = item.replace(/[@\s\-\+\(\)]/g, '');
      if (/^\d{7,15}$/.test(cleaned)) {
        if (cleaned.startsWith('0')) {
          cleaned = '88' + cleaned;
        }
        const phoneJid = cleaned + "@s.whatsapp.net";
        if (!uidsToAdd.includes(phoneJid)) {
          uidsToAdd.push(phoneJid);
        }
      }
    }

    if (uidsToAdd.length === 0) {
      return reply(box({ title: "Ajouter Utilisateur", emoji: "❌", body: lang.noInput }));
    }

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(chatId);
    } catch (e) {
      groupMeta = { participants: [] };
    }

    const currentMembers = groupMeta.participants.map(p => p.id);

    const success = [];
    const waitApproval = [];
    const failed = [];

    for (const uid of uidsToAdd) {
      let resolvedJid = uid;

      if (uid.endsWith("@lid")) {
        try {
          const phoneNum = uid.split("@")[0];
          const [result] = await sock.onWhatsApp(phoneNum + "@s.whatsapp.net");
          if (result && result.jid) {
            resolvedJid = result.jid;
          }
        } catch (e) {}
      }

      if (currentMembers.some(m => m === resolvedJid || m === uid)) {
        const displayNum = uid.replace(/@.*/, '');
        failed.push({ uid: displayNum, reason: lang.alreadyInGroup });
        continue;
      }

      if (resolvedJid.endsWith("@s.whatsapp.net")) {
        try {
          const results = await sock.onWhatsApp(resolvedJid);
          if (!results || results.length === 0 || !results[0].exists) {
            const displayNum = uid.replace(/@.*/, '');
            failed.push({ uid: displayNum, reason: lang.notOnWhatsApp });
            continue;
          }
          resolvedJid = results[0].jid;
        } catch (e) {
          console.error("[ADDUSER] onWhatsApp check error:", e.message);
        }
      }

      async function tryInviteFallback() {
        try {
          const invResult = await sock.groupParticipantsUpdate(chatId, [resolvedJid], 'invite');
          const invStatus = Number(invResult?.[0]?.status || invResult?.[0]?.content?.toString() || 0);
          if (invStatus === 200 || invStatus === 409) {
            waitApproval.push(resolvedJid);
            return true;
          }
        } catch (e) {}
        try {
          const code = await sock.groupInviteCode(chatId);
          const link = `https://chat.whatsapp.com/${code}`;
          const groupName = groupMeta.subject || "the group";
          await sock.sendMessage(resolvedJid, { text: `Vous avez été invité à rejoindre "${groupName}":\n${link}` });
          waitApproval.push(resolvedJid);
          return true;
        } catch (e) {}
        return false;
      }

      try {
        const result = await sock.groupParticipantsUpdate(chatId, [resolvedJid], 'add');
        const status = result?.[0]?.status || result?.[0]?.content?.toString() || "";
        const statusNum = Number(status) || 0;

        if (statusNum === 200) {
          success.push(resolvedJid);
        } else if (statusNum === 403 || statusNum === 408) {
          const invited = await tryInviteFallback();
          if (!invited) {
            const displayNum = uid.replace(/@.*/, '');
            failed.push({ uid: displayNum, reason: lang.cannotAddUser });
          }
        } else if (statusNum === 409) {
          waitApproval.push(resolvedJid);
        } else {
          const displayNum = uid.replace(/@.*/, '');
          failed.push({ uid: displayNum, reason: lang.cannotAddUser });
        }
      } catch (err) {
        const errCode = err.data || 0;
        const errMsg = err.message || "";
        if (errMsg.includes('403') || errMsg.includes('408') || errCode === 403 || errCode === 408) {
          const invited = await tryInviteFallback();
          if (!invited) {
            const displayNum = uid.replace(/@.*/, '');
            failed.push({ uid: displayNum, reason: lang.cannotAddUser });
          }
        } else {
          console.error("[ADDUSER] Add error:", errMsg);
          const displayNum = uid.replace(/@.*/, '');
          failed.push({ uid: displayNum, reason: lang.cannotAddUser });
        }
      }
    }

    let body = "";
    if (success.length > 0) {
      body += `✅ ${bold("Ajoutés avec succès")} : ${success.length} membre(s)\n`;
    }
    if (waitApproval.length > 0) {
      body += `⏳ ${bold("En attente d'approbation")} : ${waitApproval.length} membre(s)\n`;
    }
    if (failed.length > 0) {
      body += `❌ ${bold("Échecs")} : ${failed.length} membre(s)`;
      for (const f of failed) {
        body += `\n    • ${f.uid} : ${f.reason}`;
      }
    }

    if (!body.trim()) {
      body = "Aucun utilisateur n'a pu être ajouté.";
    }

    return reply(box({ title: "Ajouter Utilisateur", emoji: "➕", body: body.trim() }));
  }
};
