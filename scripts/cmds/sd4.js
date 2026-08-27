const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

async function getBufferFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Erreur de téléchargement image:', error.message);
    return null;
  }
}

module.exports = {
  config: {
    name: "seedream4",
    aliases: ["sd4", "seedream"],
    version: "1.2",
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
    const quotedMsg = event.message?.messageReply;
    let imageRepondue = null;

    if (quotedMsg?.message?.imageMessage) {
      imageRepondue = {
        type: "photo",
        url: quotedMsg.message.imageMessage.url
      };
    } else if (quotedMsg?.message?.videoMessage) {
      imageRepondue = {
        type: "video",
        url: quotedMsg.message.videoMessage.url
      };
    }

    let prompt = args.join(" ").trim();

    let ratioAspect = "Auto";
    const correspondanceRatio = prompt.match(/--ar\s+(\d+:\d+)/i);
    if (correspondanceRatio) {
      ratioAspect = correspondanceRatio[1];
      prompt = prompt.replace(/--ar\s+\d+:\d+/i, "").trim();
    }

    const ratiosValides = ["1:1","9:16","16:9","3:4","4:3","3:2","2:3","4:5","5:4","21:9","Auto"];
    if (!imageRepondue && !ratiosValides.includes(ratioAspect)) {
      return reply(
        "❌ Ratio invalide.\n\n📐 Ratios disponibles :\n" +
        "• 1:1  • 9:16  • 16:9  • 3:4  • 4:3\n" +
        "• 3:2  • 2:3  • 4:5  • 5:4  • 21:9"
      );
    }

    if (!prompt && !imageRepondue) {
      return reply(
        `❌ Fournissez un prompt.\n\n📝 Exemples :\n` +
        `${prefix}seedream4 une ville cyberpunk\n` +
        `${prefix}seedream4 un beau paysage --ar 16:9\n` +
        `${prefix}seedream4 rends-le anime (répondre à une image)`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: imageRepondue 
          ? `🖼️ Modification de votre image en cours...\n📝 Prompt: ${prompt || "Éditer cette image"}`
          : `🎨 Génération de votre image en cours...\n📝 Prompt: ${prompt}\n📐 Ratio: ${ratioAspect}`
      }, { quoted: event });

      const params = new URLSearchParams();
      if (imageRepondue) {
        params.append("prompt", prompt || "Éditer cette image");
        params.append("imgurl", imageRepondue.url);
      } else {
        params.append("prompt", prompt);
        params.append("aspect_ratio", ratioAspect);
      }

      const urlComplete = `https://sakura-apis.onrender.com/api/seedream4?${params.toString()}`;
      
      const response = await axios.get(urlComplete, {
        responseType: "arraybuffer",
        timeout: 180000,
      });

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      const imageBuffer = Buffer.from(response.data);

      const corps = imageRepondue
        ? `✅ Image modifiée avec succès !\n\n📝 Prompt : ${prompt}\n🔄 Utilisez ${prefix}seedream4 <prompt> pour en générer d'autres.`
        : `✅ Image générée avec succès !\n\n📝 Prompt : ${prompt}\n📐 Ratio : ${ratioAspect}\n🔄 Utilisez ${prefix}seedream4 <prompt> pour en générer d'autres.`;

      await sock.sendMessage(chatId, {
        image: imageBuffer,
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
