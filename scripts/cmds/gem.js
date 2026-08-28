const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys"); // Importation nécessaire pour décrypter l'image

module.exports = {
  config: {
    name: "gem",
    aliases: [],
    version: "2.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Génère et modifie des images artistiques via l'API GEM."
    },
    category: "ai",
    guide: {
      en: "{pn} <prompt> [--r X:Y] [--nw]"
    }
  },

  onStart: async function ({ sock, chatId, args, event }) {
    if (!args[0]) {
      return sock.sendMessage(chatId, { text: "🎨 | Veuillez fournir une description (prompt)." }, { quoted: event });
    }

    // Réaction initiale "Création en cours"
    await sock.sendMessage(chatId, {
      react: { text: "🎨", key: event.key }
    });

    try {
      let promptParts = [];
      let ratioArg = "1:1"; // Ratio par défaut
      let unfilteredMode = false;

      // Parsing des arguments
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--r" && i + 1 < args.length) {
          ratioArg = args[i + 1];
          i++;
        } else if (args[i] === "--nw") {
          unfilteredMode = true;
        } else {
          promptParts.push(args[i]);
        }
      }

      const userPrompt = promptParts.join(" ");
      if (!userPrompt) {
        return sock.sendMessage(chatId, { text: "🎨 | Veuillez fournir un prompt valide." }, { quoted: event });
      }

      // Logique d'optimisation artistique
      let finalPrompt = userPrompt;
      if (unfilteredMode) {
        finalPrompt = `Sophisticated fine art photography, classical figure study, artistic lighting, gallery quality: ${userPrompt}`;
      }

      let payload = {
        prompt: finalPrompt,
        ratio: ratioArg,
        format: "jpg"
      };

      let endpoint = "https://image-gen-fix.vercel.app/generate";

      // Gestion de la modification d'image (Édition via réponse à une photo)
      const quotedMessage = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isQuotedImage = quotedMessage?.imageMessage || quotedMessage?.viewOnceMessage?.message?.imageMessage;

      if (isQuotedImage) {
        const imageMsg = quotedMessage.imageMessage || quotedMessage.viewOnceMessage.message.imageMessage;
        
        try {
          // Téléchargement et décryptage de l'image via Baileys
          const stream = await downloadContentFromMessage(imageMsg, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          
          const imgBase64 = buffer.toString("base64");

          endpoint = "https://image-gen-fix.vercel.app/edit";
          payload.image = imgBase64;
          delete payload.ratio; // L'API d'édition gère le ratio basé sur l'image d'entrée
          
        } catch (downloadError) {
          console.error("Erreur lors du téléchargement de l'image citée:", downloadError);
          return sock.sendMessage(chatId, { text: "❌ | Impossible de lire l'image citée pour la modification." }, { quoted: event });
        }
      }

      // Requête vers l'API de génération / édition
      const res = await axios.post(endpoint, payload, {
        responseType: "arraybuffer",
        timeout: 180000
      });

      const imageBuffer = Buffer.from(res.data);

      // Réaction Succès
      await sock.sendMessage(chatId, {
        react: { text: "✅", key: event.key }
      });

      // Envoi de l'image générée
      return await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: `🎨✨ | Chef-d'œuvre créé !${unfilteredMode ? " [Mode Artistique]" : ""}`
      }, { quoted: event });

    } catch (error) {
      console.error("Erreur de génération d'image:", error);

      // Réaction Échec
      await sock.sendMessage(chatId, {
        react: { text: "❌", key: event.key }
      });

      let errorMessage = error.message;
      if (error.response && error.response.data) {
        // L'API renvoie l'erreur sous forme de buffer, on le convertit en texte
        errorMessage = Buffer.from(error.response.data).toString("utf8");
      }

      return sock.sendMessage(chatId, { 
        text: `❌ | Échec de la génération : ${errorMessage}` 
      }, { quoted: event });
    }
  }
};
