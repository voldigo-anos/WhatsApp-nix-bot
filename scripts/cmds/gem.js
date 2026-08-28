const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
  config: {
    name: "gem",
    aliases: [],
    version: "2.2",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Generate and edit artistic images via GEM API"
    },
    category: "ai",
    nixPrefix: true,
    guide: {
      en: "{pn} <prompt> [--r X:Y] [--nw]"
    }
  },

  onStart: async function ({ sock, chatId, args, event }) {
    if (!args[0]) {
      return sock.sendMessage(chatId, { text: "🎨 | Veuillez fournir une description (prompt)." }, { quoted: event });
    }

    await sock.sendMessage(chatId, {
      react: { text: "🎨", key: event.key }
    });

    try {
      let promptParts = [];
      let ratioArg = "1:1";
      let unfilteredMode = false;

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

      const quotedMessage = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isQuotedImage = quotedMessage?.imageMessage || quotedMessage?.viewOnceMessage?.message?.imageMessage;

      if (isQuotedImage) {
        const imageMsg = quotedMessage.imageMessage || quotedMessage.viewOnceMessage.message.imageMessage;
        
        try {
          const stream = await downloadContentFromMessage(imageMsg, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          
          const imgBase64 = buffer.toString("base64");

          endpoint = "https://image-gen-fix.vercel.app/edit";
          payload.image = imgBase64;
          delete payload.ratio;
          
        } catch (downloadError) {
          console.error("Erreur lors du téléchargement de l'image citée:", downloadError);
          return sock.sendMessage(chatId, { text: "❌ | Impossible de lire l'image citée pour la modification." }, { quoted: event });
        }
      }

      const res = await axios.post(endpoint, payload, {
        responseType: "arraybuffer",
        timeout: 180000
      });

      const imageBuffer = Buffer.from(res.data);

      await sock.sendMessage(chatId, {
        react: { text: "✅", key: event.key }
      });

      return await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: `🎨✨ | Chef-d'œuvre créé !${unfilteredMode ? " [Mode Artistique]" : ""}`
      }, { quoted: event });

    } catch (error) {
      console.error("Erreur de génération d'image:", error);

      await sock.sendMessage(chatId, {
        react: { text: "❌", key: event.key }
      });

      let errorMessage = error.message;
      if (error.response && error.response.data) {
        errorMessage = Buffer.from(error.response.data).toString("utf8");
      }

      return sock.sendMessage(chatId, { 
        text: `❌ | Échec de la génération : ${errorMessage}` 
      }, { quoted: event });
    }
  }
};
