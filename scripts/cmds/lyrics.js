const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

async function getBufferFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
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
    name: "lyrics",
    aliases: ["paroles", "lyric"],
    version: "3.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Get detailed lyrics with title, artist, album and cover art"
    },
    category: "search",
    nixPrefix: true,
    guide: {
      en: "   {pn} <song name>\n   Example: {pn} Adele Hello"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    const query = args.join(" ");
    if (!query) {
      return reply(
        `${prefix}lyrics <nom de la chanson>\n\n` +
        `📝 Exemple: ${prefix}lyrics Adele Hello\n` +
        `🎵 Exemple: ${prefix}lyrics Bohemian Rhapsody`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `🎵 Recherche des paroles pour "${query}"...`
      }, { quoted: event });

      const { data } = await axios.get(
        `https://christus-lyrics.vercel.app/api/lyrics?song=${encodeURIComponent(query)}`,
        { timeout: 15000 }
      );

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      if (!data?.success) {
        return reply(
          `❌ Paroles non trouvées pour "${query}".\n\n` +
          `💡 Essayez:\n` +
          `• Vérifier l'orthographe\n` +
          `• Utiliser le nom complet de la chanson\n` +
          `• Ajouter le nom de l'artiste`
        );
      }

      const { 
        song, 
        artist, 
        album, 
        lyrics, 
        image
      } = data;

      let lyricsText = lyrics || "Paroles non disponibles";

      if (lyricsText.length > 15000) {
        lyricsText = lyricsText.slice(0, 15000) + "\n\n... (suite tronquée)";
      }

      let messageBody = `🎵 𝗣𝗮𝗿𝗼𝗹𝗲𝘀 𝗱𝗲 𝗹𝗮 𝗰𝗵𝗮𝗻𝘀𝗼𝗻\n━━━━━━━━━\n\n`;
      messageBody += `🎶 Titre: ${song || query}\n`;
      if (artist) messageBody += `👤 Artiste: ${artist}\n`;
      if (album) messageBody += `💿 Album: ${album}\n`;
      messageBody += `\n📜 𝗣𝗮𝗿𝗼𝗹𝗲𝘀:\n━━━━━━━━━\n\n${lyricsText}`;

      let imageBuffer = null;
      if (image) {
        imageBuffer = await getBufferFromURL(image);
      }

      if (imageBuffer) {
        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: messageBody
        }, { quoted: event });
      } else {
        await sock.sendMessage(chatId, {
          text: messageBody
        }, { quoted: event });
      }

    } catch (err) {
      console.error("Erreur API Lyrics:", err);
      
      let errorMsg = "❌ Erreur: Impossible de récupérer les paroles.\n";
      
      if (err.code === 'ECONNABORTED') {
        errorMsg += "⏰ Délai d'attente dépassé. Le serveur est peut-être lent.";
      } else if (err.response?.status === 404) {
        errorMsg += "📭 Aucune parole trouvée pour cette chanson.";
      } else if (err.response?.status === 429) {
        errorMsg += "🚦 Trop de requêtes. Attendez un peu avant de réessayer.";
      } else if (err.response?.status === 500) {
        errorMsg += "🔧 Erreur serveur. Réessayez plus tard.";
      } else {
        errorMsg += `🔧 ${err.response?.data?.error || err.message || "Essayez plus tard."}`;
      }
      
      reply(`${errorMsg}\n\n💡 Essayez avec un autre titre ou vérifiez l'orthographe.`);
    }
  }
};
