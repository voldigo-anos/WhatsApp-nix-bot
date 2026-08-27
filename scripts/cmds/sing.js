const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const BASE_URL = "https://apischristus.vercel.app";
const SEARCH_URL = `${BASE_URL}/api/search/youtube`;
const DOWNLOAD_URL = `${BASE_URL}/api/download/youtube`;

const HEADER = "🎵 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗦𝗶𝗻𝗴\n━━━━━━━━━\n\n";

async function getBufferFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'audio/mpeg,audio/*,*/*;q=0.8'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Erreur de téléchargement audio:', error.message);
    return null;
  }
}

module.exports = {
  config: {
    name: "sing",
    aliases: ["song", "music", "audio"],
    version: "2.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Search and download YouTube audio"
    },
    category: "media",
    nixPrefix: true,
    guide: {
      en: "   {pn} <song name>\n   Example: {pn} Adele Hello"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    const query = args.join(" ");
    if (!query) {
      return reply(
        `${HEADER}⚠️ Fournis le nom d'une chanson.\n\n` +
        `📝 Exemple: ${prefix}sing Adele Hello\n` +
        `🎵 Exemple: ${prefix}sing Bohemian Rhapsody`
      );
    }

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `${HEADER}⏳ Recherche de "${query}"...`
      }, { quoted: event });

      const searchRes = await axios.get(SEARCH_URL, {
        params: { q: query, limit: 5 },
        timeout: 25000
      });

      const results = searchRes.data?.videos;
      if (!Array.isArray(results) || results.length === 0) {
        await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});
        return reply(`${HEADER}❌ Aucune chanson trouvée pour "${query}".\n\n💡 Essayez avec un autre titre ou vérifiez l'orthographe.`);
      }

      const selectedVideo = results[0];
      const videoUrl = selectedVideo.url;

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      const dlWaitMsg = await sock.sendMessage(chatId, {
        text: `${HEADER}⏳ Téléchargement de "${selectedVideo.title}"...`
      }, { quoted: event });

      const dlRes = await axios.get(DOWNLOAD_URL, {
        params: { url: videoUrl },
        timeout: 30000,
        validateStatus: () => true
      });

      if (!dlRes.data?.success) {
        await sock.sendMessage(chatId, { delete: dlWaitMsg.key }).catch(() => {});
        return reply(`${HEADER}❌ ${dlRes.data?.message || "Impossible de récupérer le lien de téléchargement."}`);
      }

      const audioUrl =
        dlRes.data.medias?.find(m => m.type === "audio")?.url ||
        dlRes.data.data?.mp3;
      const title = dlRes.data.data?.title || dlRes.data.title || selectedVideo.title;
      const duration = dlRes.data.data?.duration || selectedVideo.duration || "Inconnue";
      const author = dlRes.data.data?.author || selectedVideo.author || "Artiste inconnu";

      if (!audioUrl) {
        await sock.sendMessage(chatId, { delete: dlWaitMsg.key }).catch(() => {});
        return reply(`${HEADER}❌ Impossible de récupérer le lien de téléchargement.`);
      }

      let audioBuffer = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const fileRes = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
            maxContentLength: 26214400,
            maxBodyLength: 26214400,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Referer": BASE_URL
            }
          });

          if (fileRes.data && fileRes.data.byteLength > 0) {
            if (fileRes.data.byteLength > 26214400) {
              await sock.sendMessage(chatId, { delete: dlWaitMsg.key }).catch(() => {});
              return reply(`${HEADER}❌ Le fichier dépasse la limite de 25 Mo de Messenger.`);
            }
            audioBuffer = fileRes.data;
            break;
          }
        } catch (downloadErr) {
          console.error(`❌ Christus Sing - tentative ${attempt}/3 échouée :`, downloadErr.response?.status || downloadErr.message);
          if (attempt === 3) throw downloadErr;
          await new Promise((res) => setTimeout(res, 2000));
        }
      }

      if (!audioBuffer) {
        await sock.sendMessage(chatId, { delete: dlWaitMsg.key }).catch(() => {});
        return reply(`${HEADER}❌ Échec du téléchargement après plusieurs tentatives.`);
      }

      await sock.sendMessage(chatId, { delete: dlWaitMsg.key }).catch(() => {});

      const caption =
        `${HEADER}✅ ${title}\n\n` +
        `👤 Artiste: ${author}\n` +
        `⏱️ Durée: ${duration}\n` +
        `📥 Taille: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} Mo\n\n` +
        `🔄 Utilisez ${prefix}sing <chanson> pour en télécharger d'autres.`;

      await sock.sendMessage(chatId, {
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        caption: caption
      }, { quoted: event });

    } catch (err) {
      console.error("❌ Christus Sing error:", err?.response?.data || err.message || err);
      const errorMsg = err.response?.data?.message || err.message || "Erreur inconnue";
      reply(`${HEADER}❌ Une erreur est survenue.\n📄 Raison: ${errorMsg}\n\n💡 Réessayez avec un autre titre.`);
    }
  }
};
