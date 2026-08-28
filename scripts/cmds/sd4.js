const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { uploadImage } = global.utils;

module.exports = {
  config: {
    name: "seedream4",
    aliases: ["sd4", "seedream"],
    version: "1.3",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Generate or edit images with Seedream 4 AI"
    },
    category: "ai",
    nixPrefix: true,
    guide: {
      en:
        "   {pn} <prompt> - Generate an image\n" +
        "   {pn} <prompt> --ar 16:9 - Generate with aspect ratio\n" +
        "   {pn} <prompt> (reply to an image to edit it)\n\n" +
        "   Available ratios: 1:1, 9:16, 16:9, 3:4, 4:3, 3:2, 2:3, 4:5, 5:4, 21:9"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    let prompt = args.join(" ").trim();

    let ratioAspect = "Auto";
    const correspondanceRatio = prompt.match(/--ar\s+(\d+:\d+)/i);
    if (correspondanceRatio) {
      ratioAspect = correspondanceRatio[1];
      prompt = prompt.replace(/--ar\s+\d+:\d+/i, "").trim();
    }

    const ratiosValides = ["1:1","9:16","16:9","3:4","4:3","3:2","2:3","4:5","5:4","21:9","Auto"];
    let imageBuffer = null;
    let isEdit = false;

    // Récupérer l'image en réponse
    const quotedMessage = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quotedMessage?.imageMessage 
      || quotedMessage?.viewOnceMessage?.message?.imageMessage
      || quotedMessage?.documentWithCaptionMessage?.message?.imageMessage
      || null;

    if (imageMsg) {
      try {
        const stream = await downloadContentFromMessage(
          imageMsg.imageMessage || imageMsg,
          'image'
        );
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        imageBuffer = Buffer.concat(chunks);
        if (imageBuffer && imageBuffer.length > 100) {
          isEdit = true;
        } else {
          imageBuffer = null;
        }
      } catch (err) {
        console.error("Erreur téléchargement image répondue:", err.message);
        imageBuffer = null;
      }
    }

    // Si pas d'image en réponse, vérifier une URL dans les arguments
    if (!isEdit) {
      const urlIndex = args.findIndex((a) => /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp)/i.test(a));
      if (urlIndex !== -1) {
        try {
          const url = args[urlIndex];
          const resp = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          imageBuffer = Buffer.from(resp.data);
          if (imageBuffer && imageBuffer.length > 100) {
            isEdit = true;
            // retirer l'URL des arguments pour garder seulement le prompt
            args.splice(urlIndex, 1);
            prompt = args.join(" ").trim();
          } else {
            imageBuffer = null;
          }
        } catch (err) {
          console.error("Erreur téléchargement image URL:", err.message);
        }
      }
    }

    // Si c'est une édition et qu'on a un prompt vide, définir un défaut
    if (isEdit && !prompt) {
      prompt = "améliorer cette image";
    }

    // Vérifications finales
    if (!isEdit && !prompt) {
      return reply(
        `❌ Fournissez un prompt.\n\n📝 Exemples :\n` +
        `${prefix}seedream4 une ville cyberpunk\n` +
        `${prefix}seedream4 un beau paysage --ar 16:9\n` +
        `${prefix}seedream4 rends-le anime (répondre à une image)`
      );
    }

    if (isEdit && !imageBuffer) {
      return reply(
        `❌ Impossible de récupérer l'image.\n\n` +
        `💡 Répondez à une image valide ou fournissez une URL d'image.`
      );
    }

    if (!isEdit && !ratiosValides.includes(ratioAspect)) {
      return reply(
        "❌ Ratio invalide.\n\n📐 Ratios disponibles :\n" +
        "• 1:1  • 9:16  • 16:9  • 3:4  • 4:3\n" +
        "• 3:2  • 2:3  • 4:5  • 5:4  • 21:9"
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: isEdit 
          ? `🖼️ Modification de votre image en cours...\n📝 Prompt: ${prompt || "Éditer cette image"}`
          : `🎨 Génération de votre image en cours...\n📝 Prompt: ${prompt}\n📐 Ratio: ${ratioAspect}`
      }, { quoted: event });

      let resultBuffer;

      if (isEdit) {
        // Uploader l'image pour l'édition
        const uploadedUrl = await uploadImage(imageBuffer);
        
        const params = new URLSearchParams();
        params.append("prompt", prompt);
        params.append("imgurl", uploadedUrl);
        // L'API d'édition ignore le ratio, on ne l'envoie pas

        const urlComplete = `https://sakura-apis.onrender.com/api/seedream4?${params.toString()}`;
        const response = await axios.get(urlComplete, {
          responseType: "arraybuffer",
          timeout: 180000,
        });
        resultBuffer = Buffer.from(response.data);
      } else {
        const params = new URLSearchParams();
        params.append("prompt", prompt);
        params.append("aspect_ratio", ratioAspect);

        const urlComplete = `https://sakura-apis.onrender.com/api/seedream4?${params.toString()}`;
        const response = await axios.get(urlComplete, {
          responseType: "arraybuffer",
          timeout: 180000,
        });
        resultBuffer = Buffer.from(response.data);
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      const corps = isEdit
        ? `✅ Image modifiée avec succès !\n\n📝 Prompt : ${prompt}\n🔄 Utilisez ${prefix}seedream4 <prompt> pour en générer d'autres.`
        : `✅ Image générée avec succès !\n\n📝 Prompt : ${prompt}\n📐 Ratio : ${ratioAspect}\n🔄 Utilisez ${prefix}seedream4 <prompt> pour en générer d'autres.`;

      await sock.sendMessage(chatId, {
        image: resultBuffer,
        caption: corps
      }, { quoted: event });

    } catch (erreur) {
      console.error("[seedream4] Erreur :", erreur.message);
      
      const statut = erreur.response?.status;
      let errorMsg = "❌ Échec du traitement.\n";
      
      if (statut === 400) {
        errorMsg += "📄 Prompt ou paramètres invalides. Vérifiez votre saisie.";
      } else if (statut === 500) {
        errorMsg += "🔧 Erreur serveur. L'API rencontre des problèmes. Réessayez plus tard.";
      } else if (erreur.code === "ECONNABORTED") {
        errorMsg += "⏰ Délai dépassé. Essayez avec un prompt plus court.";
      } else {
        errorMsg += `📄 ${erreur.response?.data?.error || erreur.message || "Réessayez plus tard."}`;
      }
      
      reply(errorMsg);
    }
  }
};
