const { getTime, threadsData } = global.utils;
const axios = require("axios");

module.exports = {
  config: {
    name: "leave",
    version: "1.3.0",
    author: "ArYAN",
    description: "Notify when members leave or are removed"
  },
  onEvent: async function ({ sock, eventData }) {
    if (eventData.type !== "group-participants.update") return;
    const { id, participants, action, author } = eventData.data;
    if (action !== "remove") return;

    const botJid = sock.user.id.split(":")[0].split("@")[0];
    const botLid = (sock.user?.lid || "").split(":")[0].split("@")[0];

    const botRemoved = participants.some(jid => {
      const jidStr = typeof jid === "string" ? jid : jid?.id || jid?.toString() || "";
      const num = jidStr.split(":")[0].split("@")[0];
      return num === botJid || num === botLid;
    });
    if (botRemoved) return;

    const threadData = await threadsData.get(id) || {};
    if (threadData.leaveEnabled === false) return;

    let groupName = "this group";
    let memberCount = 0;
    try {
      const metadata = await sock.groupMetadata(id);
      groupName = metadata.subject || "this group";
      memberCount = metadata.participants?.length || 0;
    } catch (e) {}

    const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false });
    const h = parseInt(hour);
    let session = "day";
    if (h >= 5 && h < 12) session = "morning";
    else if (h >= 12 && h < 17) session = "afternoon";
    else if (h >= 17 && h < 20) session = "evening";
    else session = "night";

    for (const jid of participants) {
      let jidStr, username;
      if (typeof jid === "string") {
        jidStr = jid;
        username = jid.split(":")[0].split("@")[0];
      } else {
        jidStr = jid?.id || jid?.toString() || "";
        username = (jid?.phoneNumber || jid?.id || "").split(":")[0].split("@")[0];
      }
      if (!jidStr) continue;

      let removedByAdmin = false;
      let removedByNum = "";
      if (author) {
        removedByNum = author.split(":")[0].split("@")[0];
        const authorClean = removedByNum;
        const memberClean = username;
        if (authorClean !== memberClean) {
          removedByAdmin = true;
        }
      }

      let text;
      const customLeave = threadData.leaveMessage;
      const customRemove = threadData.removeMessage;

      if (removedByAdmin && customRemove) {
        text = customRemove
          .replace(/\{userName\}/g, username)
          .replace(/\{userNameTag\}/g, `@${username}`)
          .replace(/\{boxName\}/g, groupName)
          .replace(/\{member\}/g, `${memberCount}`)
          .replace(/\{session\}/g, session)
          .replace(/\{removedBy\}/g, `@${removedByNum}`)
          .replace(/\{time\}/g, getTime("DD/MM/YYYY HH:mm:ss"));
      } else if (!removedByAdmin && customLeave) {
        text = customLeave
          .replace(/\{userName\}/g, username)
          .replace(/\{userNameTag\}/g, `@${username}`)
          .replace(/\{boxName\}/g, groupName)
          .replace(/\{member\}/g, `${memberCount}`)
          .replace(/\{session\}/g, session)
          .replace(/\{time\}/g, getTime("DD/MM/YYYY HH:mm:ss"));
      } else if (removedByAdmin) {
        text = `@${username} has been removed from ${groupName} by @${removedByNum}.`;
      } else {
        text = `@${username} has left ${groupName}. Goodbye!`;
      }

      const mentions = [jidStr];
      if (author) mentions.push(author);

      try {
        if (threadData.leaveImage) {
          const res = await axios.get(threadData.leaveImage, { responseType: "arraybuffer" });
          await sock.sendMessage(id, { image: Buffer.from(res.data), caption: text, mentions });
        } else {
          await sock.sendMessage(id, { text, mentions });
        }
      } catch (e) {}
    }
  }
};
