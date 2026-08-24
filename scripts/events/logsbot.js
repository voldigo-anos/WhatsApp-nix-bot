const config = require('../../config.json');

function getAdminIds() {
  const admins = new Set();
  if (config.roles) {
    for (const role of ["2", "3"]) {
      if (Array.isArray(config.roles[role])) {
        config.roles[role].forEach(id => admins.add(id.replace(/[^0-9]/g, '')));
      }
    }
  }
  if (Array.isArray(config.ownerNumber)) {
    config.ownerNumber.forEach(id => admins.add(id.replace(/[^0-9]/g, '')));
  }
  return [...admins].filter(Boolean);
}

async function resolveAdminJids(sock, adminIds) {
  const validJids = [];
  const resolved = new Set();
  for (const id of adminIds) {
    if (resolved.has(id)) continue;
    try {
      const [result] = await sock.onWhatsApp(id + "@s.whatsapp.net");
      if (result && result.exists) {
        validJids.push(result.jid);
        resolved.add(id);
        continue;
      }
    } catch (e) {}
    validJids.push(id + "@lid");
    resolved.add(id);
  }
  return validJids;
}

module.exports = {
  config: {
    name: "logsbot",
    version: "3.1.0",
    author: "ArYAN",
    description: "Send log messages to admin inbox when bot is added/kicked from groups"
  },

  onGroupAdd: async function (sock, group) {
    const adminIds = getAdminIds();
    if (adminIds.length === 0) return;
    const adminJids = await resolveAdminJids(sock, adminIds);

    const groupName = group.subject || "Unknown Group";
    const groupId = group.id || "Unknown";
    let memberCount = 0;
    try {
      const metadata = await sock.groupMetadata(groupId);
      memberCount = metadata.participants?.length || 0;
    } catch (e) {}

    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const logText = `📋 *Bot Added Log*\n\n` +
      `✅ *Event:* Bot has been added to a new group\n` +
      `📌 *Group:* ${groupName}\n` +
      `🆔 *Group ID:* ${groupId}\n` +
      `👥 *Members:* ${memberCount}\n` +
      `🕐 *Time:* ${now}`;

    for (const jid of adminJids) {
      try {
        await sock.sendMessage(jid, { text: logText });
      } catch (e) {
        console.error(`[LOGSBOT] Failed to send bot-added log to ${jid}: ${e.message}`);
      }
    }
  },

  onEvent: async function ({ sock, eventData }) {
    if (eventData.type !== "group-participants.update") return;

    const { id, participants, action, author } = eventData.data;
    const botFullId = sock.user.id || "";
    const botJid = botFullId.split(":")[0].split("@")[0];
    const botLid = (sock.user?.lid || "").split(":")[0].split("@")[0];

    const adminIds = getAdminIds();
    if (adminIds.length === 0) return;

    const isBotInvolved = participants.some(p => {
      if (typeof p === "string") {
        const num = p.split(":")[0].split("@")[0];
        return num === botJid || num === botLid;
      }
      const lidNum = (p?.id || "").split(":")[0].split("@")[0];
      const phoneNum = (p?.phoneNumber || "").split(":")[0].split("@")[0];
      return lidNum === botJid || lidNum === botLid || phoneNum === botJid || phoneNum === botLid;
    });

    const adminJids = await resolveAdminJids(sock, adminIds);

    async function sendToAdmins(text) {
      for (const jid of adminJids) {
        try {
          await sock.sendMessage(jid, { text });
        } catch (e) {
          console.error(`[LOGSBOT] Failed to send to ${jid}: ${e.message}`);
        }
      }
    }

    if (!isBotInvolved) return;

    let groupName = "Unknown Group";
    let memberCount = 0;
    try {
      const metadata = await sock.groupMetadata(id);
      groupName = metadata.subject || "Unknown Group";
      memberCount = metadata.participants?.length || 0;
    } catch (e) {}

    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const actionByName = author ? author.split(":")[0].split("@")[0] : "Unknown";

    if (action === "add") {
      const logText = `📋 *Bot Added Log*\n\n` +
        `✅ *Event:* Bot has been added to a new group\n` +
        `📌 *Group:* ${groupName}\n` +
        `🆔 *Group ID:* ${id}\n` +
        `👥 *Members:* ${memberCount}\n` +
        `➕ *Added by:* ${actionByName}\n` +
        `🕐 *Time:* ${now}`;
      await sendToAdmins(logText);
    } else if (action === "remove") {
      const logText = `📋 *Bot Removed Log*\n\n` +
        `❌ *Event:* Bot has been kicked from a group\n` +
        `📌 *Group:* ${groupName}\n` +
        `🆔 *Group ID:* ${id}\n` +
        `🚫 *Kicked by:* ${actionByName}\n` +
        `🕐 *Time:* ${now}`;
      await sendToAdmins(logText);
    }
  }
};
