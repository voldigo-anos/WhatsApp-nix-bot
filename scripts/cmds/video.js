const axios = require("axios");
const yts = require("yt-search");
const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "video",
    aliases: [],
    version: "2.2",
    author: "Rômeo",
    countDown: 5,
    role: 0,
    category: "media",
    description: { en: "Search and download video from YouTube or direct URL" },
    guide: { en: "{pn} <search term or URL>" }
  },

  onStart: async function ({ args, chatId, event, reply, sock, senderId, commandName }) {
    if (args.length < 1) {
      return reply(box({ title: "Video", emoji: "❌", body: `Utilisation : ${bold("{pn} <terme de recherche ou URL>")}` }));
    }

    const input = args.join(" ");

    if (input.startsWith("http")) {
      try {
        const videoId = extractVideoId(input);
        let videoInfo = null;
        if (videoId) {
          try { videoInfo = await yts({ videoId }); } catch (e) { videoInfo = null; }
        }
        await downloadDirectVideo(sock, chatId, event, reply, input, videoInfo);
      } catch (error) {
        await downloadDirectVideo(sock, chatId, event, reply, input, null);
      }
      return;
    }

    try {
      const searchResults = await yts(input);
      const videos = searchResults.videos.slice(0, 6);
      if (videos.length === 0) {
        return reply(box({ title: "Video", emoji: "⭕", body: `Aucun résultat trouvé pour : ${input}` }));
      }

      let list = "";
      videos.forEach((video, index) => {
        list += `${bold(String(index + 1))}. ${video.title}\n   ⏱ ${video.timestamp} | 📺 ${video.author.name}\n\n`;
      });

      const sentMsg = await sock.sendMessage(chatId, {
        text: box({ title: "Video", emoji: "🎬", body: `${list}Répondez avec un numéro pour sélectionner.` })
      }, { quoted: event });

      global.NixBot.onReply.push({
        commandName,
        messageID: sentMsg.key.id,
        author: senderId,
        videos
      });

    } catch (error) {
      console.error("[VIDEO]", error.message);
      return reply(box({ title: "Video", emoji: "❌", body: "Échec de la recherche YouTube." }));
    }
  },

  onReply: async function ({ event, chatId, reply, sock, senderId, commandName }) {
    const repliedId = event.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!repliedId) return;

    const data = global.NixBot.onReply.find(r => r.commandName === commandName && r.messageID === repliedId);
    if (!data) return;
    if (data.author !== senderId) return;

    const body = event.message?.conversation || event.message?.extendedTextMessage?.text || "";
    const choice = parseInt(body.trim(), 10);

    if (isNaN(choice) || choice <= 0 || choice > data.videos.length) {
      return reply(box({ title: "Video", emoji: "❌", body: "Veuillez entrer un numéro valide." }));
    }

    const selected = data.videos[choice - 1];
    await downloadDirectVideo(sock, chatId, event, reply, selected.url, selected);
  }
};

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function downloadDirectVideo(sock, chatId, event, reply, videoUrl, videoInfo) {
  const waitMsg = await sock.sendMessage(chatId, {
    text: box({ title: "Video", emoji: "⏳", body: "Téléchargement en cours..." })
  }, { quoted: event });

  try {
    const BASE_URL = await getApiUrl();
    if (!BASE_URL) {
      await sock.sendMessage(chatId, { delete: waitMsg.key });
      return reply(box({ title: "Video", emoji: "❌", body: "Impossible de récupérer l'API. Réessayez plus tard." }));
    }

    const { data } = await axios.get(`${BASE_URL}/api/ytb?url=${encodeURIComponent(videoUrl)}`, { timeout: 60000 });
    if (!data.mp4) {
      await sock.sendMessage(chatId, { delete: waitMsg.key });
      return reply(box({ title: "Video", emoji: "❌", body: "Impossible de récupérer un fichier vidéo. Essayez une autre URL." }));
    }

    const videoResponse = await axios.get(data.mp4, { responseType: "arraybuffer", timeout: 120000 });
    const buffer = Buffer.from(videoResponse.data);

    const title = videoInfo ? videoInfo.title : (data.title || "Titre inconnu");
    const channel = videoInfo ? videoInfo.author?.name : (data.author || "Chaîne inconnue");

    await sock.sendMessage(chatId, { delete: waitMsg.key });

    await sock.sendMessage(chatId, {
      video: buffer,
      caption: box({ title: "Video", emoji: "📥", body: `${bold("Téléchargement réussi")} :\n• ${bold("Titre")} : ${title}\n• ${bold("Chaîne")} : ${channel}` })
    }, { quoted: event });

  } catch (e) {
    console.error("[VIDEO]", e.message);
    await sock.sendMessage(chatId, { delete: waitMsg.key });
    return reply(box({ title: "Video", emoji: "❌", body: "Échec du téléchargement." }));
  }
}

async function getApiUrl() {
  try {
    const { data } = await axios.get(
      "https://raw.githubusercontent.com/romeoislamrasel/romeobot/refs/heads/main/api.json",
      { timeout: 15000 }
    );
    return data.api;
  } catch (error) {
    console.error("[VIDEO] getApiUrl error:", error.message);
    return null;
  }
}
