const { uploadImage } = global.utils;
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "setwelcome",
    aliases: ["setwc"],
    version: "1.8",
    author: "Christus",
    countDown: 5,
    role: 1,
    prefix: true,
    category: "group",
    description: "Set custom welcome message for group",
    guide: {
      en: "{pn} text <message> - Set custom welcome message"
        + "\n{pn} text reset - Reset to default"
        + "\n{pn} image - Set welcome image (reply/send with image)"
        + "\n{pn} image reset - Remove welcome image"
        + "\n{pn} on - Turn on welcome message"
        + "\n{pn} off - Turn off welcome message"
        + "\n{pn} view - View current welcome message"
        + "\n\nShortcodes:"
        + "\n  {userName} - New member's name"
        + "\n  {userNameTag} - New member's name (with tag)"
        + "\n  {boxName} - Group name"
        + "\n  {member} - Member count"
        + "\n  {session} - Time of day"
        + "\n  {addedBy} - Who added the member"
        + "\n  {time} - Current time"
    }
  },

  onStart: async function ({ sock, chatId, event, args, reply, isGroup, threadsData }) {
    if (!isGroup) return reply(box({ title: "Setwelcome", emoji: "❌", body: "Cette commande ne fonctionne qu'en groupe." }));

    const sub = args[0]?.toLowerCase();
    const threadData = await threadsData.get(chatId) || {};

    if (!sub) {
      const msg =
        `${bold("setwelcome text <message>")} - Définir le message\n` +
        `${bold("setwelcome text reset")} - Réinitialiser\n` +
        `${bold("setwelcome image")} - Définir l'image (répondre/joindre)\n` +
        `${bold("setwelcome image reset")} - Retirer l'image\n` +
        `${bold("setwelcome on")} - Activer\n` +
        `${bold("setwelcome off")} - Désactiver\n` +
        `${bold("setwelcome view")} - Voir la config actuelle\n${line}\n` +
        `${bold("Shortcodes")} : {userName} {userNameTag} {boxName} {member} {session} {addedBy} {time}`;
      return reply(box({ title: "Setwelcome", emoji: "🎉", body: msg }));
    }

    switch (sub) {
      case "text": {
        if (!args[1]) return reply(box({ title: "Setwelcome", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        if (args[1].toLowerCase() === "reset") {
          await threadsData.set(chatId, { welcomeMessage: null });
          return reply(box({ title: "Setwelcome", emoji: "✅", body: "Le message de bienvenue a été réinitialisé." }));
        }

        const body = (
          event.message?.conversation ||
          event.message?.extendedTextMessage?.text || ""
        ).trim();

        const cmdText = body.indexOf("text");
        const welcomeMsg = body.slice(cmdText + 4).trim();

        if (!welcomeMsg) return reply(box({ title: "Setwelcome", emoji: "❌", body: "Veuillez entrer le contenu du message." }));

        await threadsData.set(chatId, { welcomeMessage: welcomeMsg, welcomeEnabled: true });
        return reply(box({ title: "Setwelcome", emoji: "✅", body: `Message de bienvenue défini :\n\n${welcomeMsg}` }));
      }

      case "image":
      case "img":
      case "pic":
      case "photo": {
        if (args[1]?.toLowerCase() === "reset") {
          await threadsData.set(chatId, { welcomeImage: null });
          return reply(box({ title: "Setwelcome", emoji: "✅", body: "L'image de bienvenue a été retirée." }));
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
          return reply(box({ title: "Setwelcome", emoji: "❌", body: "Veuillez envoyer ou répondre à une image avec cette commande." }));
        }

        try {
          const url = await uploadImage(imageBuffer);
          await threadsData.set(chatId, { welcomeImage: url });
          return reply(box({ title: "Setwelcome", emoji: "✅", body: "L'image de bienvenue a été définie avec succès." }));
        } catch (e) {
          console.error("[SETWELCOME IMAGE ERROR]", e.message);
          return reply(box({ title: "Setwelcome", emoji: "❌", body: "Échec de l'envoi de l'image. Réessayez." }));
        }
      }

      case "on": {
        await threadsData.set(chatId, { welcomeEnabled: true });
        return reply(box({ title: "Setwelcome", emoji: "✅", body: "Message de bienvenue activé pour ce groupe." }));
      }

      case "off": {
        await threadsData.set(chatId, { welcomeEnabled: false });
        return reply(box({ title: "Setwelcome", emoji: "✅", body: "Message de bienvenue désactivé pour ce groupe." }));
      }

      case "view": {
        const enabled = threadData.welcomeEnabled !== false;
        const custom = threadData.welcomeMessage || null;
        const hasImage = !!threadData.welcomeImage;

        let msg = `${bold("Statut")} : ${enabled ? "ON" : "OFF"}\n`;
        msg += `${bold("Image")} : ${hasImage ? "Définie" : "Aucune"}\n${line}\n`;
        msg += custom ? `${bold("Message personnalisé")} :\n${custom}` : "Message de bienvenue par défaut utilisé.";

        if (hasImage) {
          try {
            const res = await require("axios").get(threadData.welcomeImage, { responseType: "arraybuffer" });
            return await sock.sendMessage(chatId, { image: Buffer.from(res.data), caption: box({ title: "Setwelcome", emoji: "🎉", body: msg }) }, { quoted: event });
          } catch (e) {}
        }

        return reply(box({ title: "Setwelcome", emoji: "🎉", body: msg }));
      }

      default: {
        return reply(box({ title: "Setwelcome", emoji: "❌", body: "Option invalide. Utilisez : text <message> | image | on | off | view" }));
      }
    }
  }
};
