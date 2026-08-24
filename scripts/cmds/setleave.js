const { uploadImage } = global.utils;
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "setleave",
    aliases: ["setgoodbye", "setbye", "setl"],
    version: "1.8",
    author: "Christus",
    countDown: 5,
    role: 1,
    prefix: true,
    category: "group",
    description: "Set custom leave/remove message for group",
    guide: {
      en: "{pn} text <message> - Set custom leave message (when user leaves)"
        + "\n{pn} text reset - Reset leave message to default"
        + "\n{pn} remove <message> - Set custom remove message (when admin kicks)"
        + "\n{pn} remove reset - Reset remove message to default"
        + "\n{pn} image - Set leave/remove image (reply/send with image)"
        + "\n{pn} image reset - Remove leave/remove image"
        + "\n{pn} on - Turn on leave/remove message"
        + "\n{pn} off - Turn off leave/remove message"
        + "\n{pn} view - View current settings"
        + "\n\nShortcodes:"
        + "\n  {userName} - Member's name"
        + "\n  {userNameTag} - Member's name (with tag)"
        + "\n  {boxName} - Group name"
        + "\n  {member} - Member count"
        + "\n  {session} - Time of day"
        + "\n  {removedBy} - Admin who removed (remove only)"
        + "\n  {time} - Current time"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, isGroup, threadsData }) {
    if (!isGroup) return reply(box({ title: "Setleave", emoji: "❌", body: "Cette commande ne fonctionne qu'en groupe." }));

    const sub = args[0]?.toLowerCase();
    const threadData = await threadsData.get(chatId) || {};

    if (!sub) {
      const msg =
        `${bold("setleave text <message>")} - Définir le message de départ\n` +
        `${bold("setleave text reset")} - Réinitialiser\n` +
        `${bold("setleave remove <message>")} - Message quand un admin exclut\n` +
        `${bold("setleave remove reset")} - Réinitialiser\n` +
        `${bold("setleave image")} - Définir l'image (répondre/joindre)\n` +
        `${bold("setleave image reset")} - Retirer l'image\n` +
        `${bold("setleave on")} - Activer\n` +
        `${bold("setleave off")} - Désactiver\n` +
        `${bold("setleave view")} - Voir la config actuelle\n${line}\n` +
        `${bold("Shortcodes")} : {userName} {userNameTag} {boxName} {member} {session} {removedBy} {time}`;
      return reply(box({ title: "Setleave", emoji: "🚪", body: msg }));
    }

    switch (sub) {
      case "text": {
        if (!args[1]) return reply(box({ title: "Setleave", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        if (args[1].toLowerCase() === "reset") {
          await threadsData.set(chatId, { leaveMessage: null });
          return reply(box({ title: "Setleave", emoji: "✅", body: "Le message de départ a été réinitialisé." }));
        }

        const body = (
          event.message?.conversation ||
          event.message?.extendedTextMessage?.text || ""
        ).trim();

        const cmdText = body.indexOf("text");
        const leaveMsg = body.slice(cmdText + 4).trim();

        if (!leaveMsg) return reply(box({ title: "Setleave", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        await threadsData.set(chatId, { leaveMessage: leaveMsg, leaveEnabled: true });
        return reply(box({ title: "Setleave", emoji: "✅", body: `Message de départ défini :\n\n${leaveMsg}` }));
      }

      case "remove":
      case "kick": {
        if (!args[1]) return reply(box({ title: "Setleave", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        if (args[1].toLowerCase() === "reset") {
          await threadsData.set(chatId, { removeMessage: null });
          return reply(box({ title: "Setleave", emoji: "✅", body: "Le message d'exclusion a été réinitialisé." }));
        }

        const body = (
          event.message?.conversation ||
          event.message?.extendedTextMessage?.text || ""
        ).trim();

        const cmdIdx = body.indexOf(sub);
        const removeMsg = body.slice(cmdIdx + sub.length).trim();

        if (!removeMsg) return reply(box({ title: "Setleave", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        await threadsData.set(chatId, { removeMessage: removeMsg, leaveEnabled: true });
        return reply(box({ title: "Setleave", emoji: "✅", body: `Message d'exclusion défini :\n\n${removeMsg}` }));
      }

      case "image":
      case "img":
      case "pic":
      case "photo": {
        if (args[1]?.toLowerCase() === "reset") {
          await threadsData.set(chatId, { leaveImage: null });
          return reply(box({ title: "Setleave", emoji: "✅", body: "L'image de départ a été retirée." }));
        }

        let imageBuffer = null;

        const imageMsg = event.message?.imageMessage;
        if (imageMsg) {
          const stream = await downloadContentFromMessage(imageMsg, "image");
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          imageBuffer = Buffer.concat(chunks);
        }

        if (!imageBuffer) {
          const contextInfo = event.message?.extendedTextMessage?.contextInfo;
          const quoted = contextInfo?.quotedMessage;
          const quotedImage = quoted?.imageMessage;
          if (quotedImage) {
            const stream = await downloadContentFromMessage(quotedImage, "image");
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            imageBuffer = Buffer.concat(chunks);
          }
        }

        if (!imageBuffer) {
          return reply(box({ title: "Setleave", emoji: "❌", body: "Veuillez envoyer ou répondre à une image avec cette commande." }));
        }

        try {
          const url = await uploadImage(imageBuffer);
          await threadsData.set(chatId, { leaveImage: url });
          return reply(box({ title: "Setleave", emoji: "✅", body: "L'image de départ a été définie avec succès." }));
        } catch (e) {
          console.error("[SETLEAVE IMAGE ERROR]", e.message);
          return reply(box({ title: "Setleave", emoji: "❌", body: "Échec de l'envoi de l'image. Réessayez." }));
        }
      }

      case "on": {
        await threadsData.set(chatId, { leaveEnabled: true });
        return reply(box({ title: "Setleave", emoji: "✅", body: "Message de départ/exclusion activé pour ce groupe." }));
      }

      case "off": {
        await threadsData.set(chatId, { leaveEnabled: false });
        return reply(box({ title: "Setleave", emoji: "✅", body: "Message de départ/exclusion désactivé pour ce groupe." }));
      }

      case "view": {
        const enabled = threadData.leaveEnabled !== false;
        const customLeave = threadData.leaveMessage || null;
        const customRemove = threadData.removeMessage || null;
        const hasImage = !!threadData.leaveImage;

        let msg = `${bold("Statut")} : ${enabled ? "ON" : "OFF"}\n`;
        msg += `${bold("Image")} : ${hasImage ? "Définie" : "Aucune"}\n${line}\n`;
        msg += `${bold("Message de départ")} :\n${customLeave || "Par défaut"}\n\n`;
        msg += `${bold("Message d'exclusion")} :\n${customRemove || "Par défaut"}`;

        if (hasImage) {
          try {
            const res = await require("axios").get(threadData.leaveImage, { responseType: "arraybuffer" });
            return await sock.sendMessage(chatId, { image: Buffer.from(res.data), caption: box({ title: "Setleave", emoji: "🚪", body: msg }) }, { quoted: event });
          } catch (e) {}
        }

        return reply(box({ title: "Setleave", emoji: "🚪", body: msg }));
      }

      default: {
        return reply(box({ title: "Setleave", emoji: "❌", body: "Option invalide. Utilisez : text | remove | image | on | off | view" }));
      }
    }
  }
};
