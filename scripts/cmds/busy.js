const { box, bold } = require("../../func/style.js");

const busyUsers = new Map();

module.exports = {
  config: {
    name: "busy",
    aliases: [],
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 0,
    prefix: true,
    category: "utility",
    description: "Turn on do not disturb mode, when you are tagged bot will notify.",
    guide: {
      en: "{pn} [reason] - Turn on do not disturb mode\n{pn} off - Turn off do not disturb mode"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, senderId }) {
    const senderJid = event.key?.participant || senderId;
    const senderNum = senderJid.split("@")[0].split(":")[0];

    if (args[0]?.toLowerCase() === "off") {
      for (const [key, val] of busyUsers) {
        if (val.ids.includes(senderNum)) {
          busyUsers.delete(key);
          break;
        }
      }
      busyUsers.delete(senderNum);
      return reply(box({ title: "Busy", emoji: "✅", body: "Le mode « ne pas déranger » a été désactivé." }));
    }

    const reason = args.join(" ") || "";

    let phoneNum = senderNum;
    try {
      const results = await sock.onWhatsApp(senderNum + "@s.whatsapp.net");
      if (results?.[0]?.jid) {
        phoneNum = results[0].jid.split("@")[0].split(":")[0];
      }
    } catch (e) {}

    const ids = [senderNum];
    if (phoneNum !== senderNum) ids.push(phoneNum);

    const fullJid = senderJid;
    busyUsers.set(senderNum, { reason, ids, jid: fullJid });
    if (phoneNum !== senderNum) {
      busyUsers.set(phoneNum, { reason, ids, jid: fullJid });
    }

    if (reason) {
      return reply(box({ title: "Busy", emoji: "✅", body: `Mode « ne pas déranger » activé.\n${bold("Raison")} : ${reason}` }));
    }
    return reply(box({ title: "Busy", emoji: "✅", body: "Mode « ne pas déranger » activé." }));
  },

  onChat: async function ({ sock, chatId, event, isGroup }) {
    if (!isGroup) return;

    const body = (
      event.message?.conversation
      || event.message?.extendedTextMessage?.text
      || ""
    ).trim();

    if (!body) return;

    const mentionedJids = event.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentionedJids.length) return;

    const senderJid = event.key?.participant || "";
    const senderNum = senderJid.split("@")[0].split(":")[0];

    for (const mentionedJid of mentionedJids) {
      const mentionedNum = mentionedJid.split("@")[0].split(":")[0];

      if (mentionedNum === senderNum) continue;

      let busyData = busyUsers.get(mentionedNum);

      if (!busyData) {
        try {
          const results = await sock.onWhatsApp(mentionedNum + "@s.whatsapp.net");
          if (results?.[0]?.jid) {
            const phoneNum = results[0].jid.split("@")[0].split(":")[0];
            busyData = busyUsers.get(phoneNum);
          }
        } catch (e) {}
      }

      if (!busyData) {
        for (const [, val] of busyUsers) {
          if (val.ids.includes(mentionedNum)) {
            busyData = val;
            break;
          }
        }
      }

      if (busyData) {
        const bodyMsg = busyData.reason
          ? `${bold("Utilisateur")} @${mentionedNum} est actuellement occupé.\n${bold("Raison")} : ${busyData.reason}`
          : `${bold("Utilisateur")} @${mentionedNum} est actuellement occupé.`;
        await sock.sendMessage(chatId, {
          text: box({ title: "Busy", emoji: "🔕", body: bodyMsg }),
          mentions: [mentionedJid]
        });
        return;
      }
    }
  }
};
