const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const BASE = "https://christus-downloader.vercel.app";
const AUTO_URL = `${BASE}/api/auto`;
const SUPPORTED_URL = `${BASE}/api/supported`;

const FB_BASE = "https://your-download-hub.vercel.app";
const FB_AUTO_URL = `${FB_BASE}/api/auto`;

const HEADER = "📥 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n━━━━━━━━━\n\n";

const FB_DOMAINS = ["facebook.com", "fb.watch"];

let supportedDomains = [
  "facebook.com", "fb.watch",
  "youtube.com", "youtu.be",
  "tiktok.com",
  "instagram.com", "instagr.am",
  "likee.com", "likee.video",
  "capcut.com",
  "spotify.com",
  "terabox.com",
  "twitter.com", "x.com",
  "drive.google.com",
  "soundcloud.com",
  "ndown.app",
  "pinterest.com", "pin.it"
];

const refreshSupportedDomains = async () => {
  try {
    const res = await axios.get(SUPPORTED_URL, { timeout: 15000 });
    const list = Array.isArray(res.data) ? res.data : res.data?.domains;
    if (Array.isArray(list) && list.length) supportedDomains = list;
  } catch {}
};

refreshSupportedDomains();
setInterval(refreshSupportedDomains, 30 * 60 * 1000);

const extractMedia = (data) => {
  const fromMedias = data.medias?.find(m => m.type === "video")?.url
    || data.medias?.find(m => m.type === "audio")?.url;

  const mediaURL = fromMedias || data.high_quality || data.low_quality || data.audio || data.data?.mp4 || data.data?.mp3;
  const isAudio = !fromMedias && !data.high_quality && !data.low_quality && !!data.audio;

  return { mediaURL, isAudio };
};

module.exports = {
  config: {
    name: "autodl",
    aliases: ["alldl", "dl"],
    version: "3.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Universal video/media downloader supporting 17+ platforms"
    },
    category: "utility",
    nixPrefix: true,
    guide: {
      en: "Send any supported media link (https://) to download it automatically.\n" +
          "Supported: YouTube, Facebook, TikTok, Instagram, Likee, CapCut,\n" +
          "Spotify, Terabox, Twitter, Google Drive, SoundCloud, NDown, Pinterest"
    }
  },

  onStart: async function ({ sock, chatId, event, reply }) {
    return sock.sendMessage(chatId, {
      text: `${HEADER}Envoie un lien vidéo/média (https://) depuis n'importe quel site supporté (YouTube, Facebook, TikTok, Instagram, Likee, CapCut, Spotify, Terabox, Twitter, Google Drive, SoundCloud, NDown, Pinterest, etc.) pour le télécharger automatiquement.`
    }, { quoted: event });
  },

  onChat: async function ({ sock, chatId, event, reply }) {
    const content = (event.message?.conversation || event.message?.extendedTextMessage?.text || "").trim();
    if (content.toLowerCase().startsWith("auto")) return;
    if (!content.startsWith("https://")) return;

    const isFacebook = FB_DOMAINS.some(domain => content.includes(domain));
    if (!isFacebook && !supportedDomains.some(domain => content.includes(domain))) return;

    await sock.sendMessage(chatId, { react: { text: "⌛️", key: event.key } });

    const cacheDir = path.join(__dirname, "cache");
    let filePath;

    try {
      const targetUrl = isFacebook ? FB_AUTO_URL : AUTO_URL;
      const res = await axios.get(targetUrl, {
        params: { url: content },
        timeout: 30000
      });

      if (!res.data) throw new Error("Pas de réponse de l'API");

      const { title, platform } = res.data;

      const { mediaURL, isAudio } = extractMedia(res.data);

      if (!mediaURL) throw new Error("Média introuvable");

      const extension = isAudio ? "mp3" : "mp4";
      const buffer = (await axios.get(mediaURL, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Referer": targetUrl
        }
      })).data;

      await fs.ensureDir(cacheDir);
      filePath = path.join(cacheDir, `auto_media_${Date.now()}.${extension}`);
      fs.writeFileSync(filePath, Buffer.from(buffer));

      await sock.sendMessage(chatId, { react: { text: "✅️", key: event.key } });

      const infoMsg =
        `${HEADER}` +
        `Titre      : ${title || "Titre inconnu"}\n` +
        `Plateforme : ${platform || (isFacebook ? "Facebook" : "Inconnue")}\n` +
        `Statut     : Succès`;

      if (isAudio) {
        await sock.sendMessage(chatId, {
          text: infoMsg
        }, { quoted: event });
        await sock.sendMessage(chatId, {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg"
        }, { quoted: event });
      } else {
        await sock.sendMessage(chatId, {
          video: fs.readFileSync(filePath),
          caption: infoMsg
        }, { quoted: event });
      }

      fs.unlinkSync(filePath);

    } catch (err) {
      console.error("❌ Christus Downloader error:", err.response?.data || err.message);
      await sock.sendMessage(chatId, { react: { text: "❌️", key: event.key } });
      reply(`${HEADER}❌ Une erreur est survenue lors du téléchargement.\n📄 Raison: ${err.response?.data?.error || err.message || "Erreur inconnue"}`);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};
