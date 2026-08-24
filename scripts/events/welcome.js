const { getTime, threadsData } = global.utils;
const axios = require("axios");

module.exports = {
  config: {
    name: "welcome",
    version: "1.3.0",
    author: "ArYAN",
    description: "Welcome new members with custom or default message"
  },
  onEvent: async function ({ sock, eventData }) {
    if (eventData.type !== "group-participants.update") return;
    const { id, participants, action, author } = eventData.data;
    if (action !== "add") return;

    const botJid = sock.user.id.split(":")[0].split("@")[0];
    const botLid = (sock.user?.lid || "").split(":")[0].split("@")[0];

    let groupName = "this group";
    let memberCount = 0;
    try {
      const metadata = await sock.groupMetadata(id);
      groupName = metadata.subject || "this group";
      memberCount = metadata.participants?.length || 0;
    } catch (e) {}

    const threadData = await threadsData.get(id) || {};
    if (threadData.welcomeEnabled === false) return;

    const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false });
    const h = parseInt(hour);
    let session = "day";
    if (h >= 5 && h < 12) session = "morning";
    else if (h >= 12 && h < 17) session = "afternoon";
    else if (h >= 17 && h < 20) session = "evening";
    else session = "night";

    let addedByNum = "";
    if (author) addedByNum = author.split(":")[0].split("@")[0];

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

      const lidNum = (typeof jid === "string" ? jid : jid?.id || "").split(":")[0].split("@")[0];
      const phoneNum = (typeof jid === "object" && jid?.phoneNumber || "").split(":")[0].split("@")[0];
      if (lidNum === botJid || lidNum === botLid || phoneNum === botJid || phoneNum === botLid) continue;

      let suffix = "th";
      const mc = memberCount;
      if (mc % 10 === 1 && mc % 100 !== 11) suffix = "st";
      else if (mc % 10 === 2 && mc % 100 !== 12) suffix = "nd";
      else if (mc % 10 === 3 && mc % 100 !== 13) suffix = "rd";

      let text;
      const customMsg = threadData.welcomeMessage;

      if (customMsg) {
        text = customMsg
          .replace(/\{userName\}/g, username)
          .replace(/\{userNameTag\}/g, `@${username}`)
          .replace(/\{boxName\}/g, groupName)
          .replace(/\{member\}/g, `${mc}`)
          .replace(/\{session\}/g, session)
          .replace(/\{addedBy\}/g, addedByNum ? `@${addedByNum}` : "Unknown")
          .replace(/\{time\}/g, getTime("DD/MM/YYYY HH:mm:ss"));
      } else {
        text = `Hello @${username}. Welcome you to the chat group: ${groupName}. You're the ${mc}${suffix} member of this group. Have a nice ${session}. I Hope you Enjoy the Chat BOX.\n\nAdded by: @${addedByNum}`;
      }

      const mentions = [jidStr];
      if (author) mentions.push(author);

      try {
        if (threadData.welcomeImage) {
          const res = await axios.get(threadData.welcomeImage, { responseType: "arraybuffer" });
          await sock.sendMessage(id, { image: Buffer.from(res.data), caption: text, mentions });
        } else {
          await sock.sendMessage(id, { text, mentions });
        }
      } catch (e) {}
    }
  }
};
