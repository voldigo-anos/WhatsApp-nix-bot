const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const { box, bold } = require("../../func/style.js");

const API_BASE = "https://azadx69x.is-a.dev";

const W = 640;
const HEADER_H = 80;
const ROW_H = 90;
const PADDING = 20;
const THUMB_W = 118;
const THUMB_H = 66;
const FOOT_H = 20;

function formatViews(n) {
  if (!n || n === 0) return "N/A vues";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B vues";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M vues";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K vues";
  return n + " vues";
}

function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function drawYTLogo(ctx, x, y) {
  const rw = 36, rh = 26, r = 6;
  ctx.fillStyle = "#FF0000";
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + rw - r, y);
  ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
  ctx.lineTo(x + rw, y + rh - r);
  ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
  ctx.lineTo(x + r, y + rh);
  ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const cx = x + rw / 2 + 2, cy = y + rh / 2;
  ctx.moveTo(cx - 7, cy - 7);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx - 7, cy + 7);
  ctx.closePath();
  ctx.fill();
}

async function generateSearchImage(results, query, type) {
  const totalH = HEADER_H + results.length * ROW_H + FOOT_H;
  const canvas = createCanvas(W, totalH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, W, totalH);

  drawYTLogo(ctx, PADDING, 22);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("Résultats de recherche", PADDING + 44, 43);

  const typeLabel = type === "audio" ? "Audio" : "Vidéo";
  ctx.fillStyle = "#aaaaaa";
  ctx.font = "13px sans-serif";
  ctx.fillText(`"${truncate(query, 40)}" — ${typeLabel}`, PADDING + 44, 62);

  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_H - 1);
  ctx.lineTo(W - PADDING, HEADER_H - 1);
  ctx.stroke();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const y = HEADER_H + i * ROW_H;
    const mid = y + ROW_H / 2;

    if (i % 2 === 0) {
      ctx.fillStyle = "#1f1f1f";
      ctx.fillRect(0, y, W, ROW_H);
    }

    ctx.fillStyle = "#666666";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(String(r.index), PADDING, mid + 7);

    const thumbX = PADDING + 30;
    const thumbY = y + (ROW_H - THUMB_H) / 2;

    ctx.fillStyle = "#333333";
    ctx.fillRect(thumbX, thumbY, THUMB_W, THUMB_H);

    try {
      const imgBuf = await axios.get(r.thumbnail, { responseType: "arraybuffer", timeout: 6000 });
      const img = await loadImage(Buffer.from(imgBuf.data));
      ctx.drawImage(img, thumbX, thumbY, THUMB_W, THUMB_H);
    } catch {
      ctx.fillStyle = "#444444";
      ctx.fillRect(thumbX, thumbY, THUMB_W, THUMB_H);
      ctx.fillStyle = "#888888";
      ctx.font = "11px sans-serif";
      ctx.fillText("Pas d'image", thumbX + 18, thumbY + 36);
    }

    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;
    ctx.strokeRect(thumbX, thumbY, THUMB_W, THUMB_H);

    const textX = thumbX + THUMB_W + 14;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(truncate(r.title, 52), textX, mid - 14);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${truncate(r.channel, 30)} • ${r.duration}`, textX, mid + 4);

    ctx.fillStyle = "#777777";
    ctx.font = "12px sans-serif";
    ctx.fillText(formatViews(r.views), textX, mid + 20);

    if (i < results.length - 1) {
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING + 30, y + ROW_H);
      ctx.lineTo(W - PADDING, y + ROW_H);
      ctx.stroke();
    }
  }

  return canvas.toBuffer("image/jpeg", { quality: 0.92 });
}

module.exports = {
  config: {
    name: "ytb",
    aliases: [],
    version: "0.0.7",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    category: "media",
    description: { en: "Search YouTube and download audio or video" },
    guide: { en: "{pn} -a <song name>\n{pn} -v <video title>" }
  },

  onStart: async function ({ args, chatId, event, reply, sock, senderId, commandName }) {
    const flag = (args[0] || "").toLowerCase();
    if (!flag || !args[1]) {
      return reply(box({ title: "Ytb", emoji: "❌", body: "Utilisation :\n-a <nom de chanson> → Audio\n-v <titre> → Vidéo" }));
    }

    const type = flag === "-a" ? "audio" : flag === "-v" ? "video" : null;
    if (!type) {
      return reply(box({ title: "Ytb", emoji: "❌", body: "Utilisez -a pour l'audio ou -v pour la vidéo." }));
    }

    const query = args.slice(1).join(" ").trim();
    if (!query) {
      return reply(box({ title: "Ytb", emoji: "❌", body: "Veuillez fournir un terme de recherche." }));
    }

    try {
      const { data } = await axios.get(
        `${API_BASE}/api/youtube-search?query=${encodeURIComponent(query)}&type=${type}`,
        { timeout: 15000 }
      );

      if (!data.status || !data.results || data.results.length === 0) {
        return reply(box({ title: "Ytb", emoji: "⭕", body: `Aucun résultat trouvé pour : ${query}` }));
      }

      const results = data.results;
      const total = results.length;

      const imgBuf = await generateSearchImage(results, query, type);

      const sentMsg = await sock.sendMessage(chatId, {
        image: imgBuf,
        caption: box({ title: "Ytb", emoji: "🔎", body: `Répondez avec 1–${total} pour télécharger ${type === "audio" ? "l'audio 🎵" : "la vidéo 🎬"}` })
      }, { quoted: event });

      global.NixBot.onReply.push({
        commandName,
        messageID: sentMsg.key.id,
        author: senderId,
        type,
        results,
        total
      });

    } catch (error) {
      console.error("[YTB]", error.message);
      return reply(box({ title: "Ytb", emoji: "❌", body: "Échec de la recherche YouTube." }));
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

    if (isNaN(choice) || choice <= 0 || choice > data.total) {
      return reply(box({ title: "Ytb", emoji: "❌", body: "Veuillez entrer un numéro valide." }));
    }

    const selected = data.results[choice - 1];

    const waitMsg = await sock.sendMessage(chatId, {
      text: box({ title: "Ytb", emoji: "⏳", body: "Téléchargement en cours..." })
    }, { quoted: event });

    try {
      const { data: dlData } = await axios.get(
        `${API_BASE}/api/youtube-download?url=${encodeURIComponent(selected.url)}&type=${data.type}`,
        { timeout: 60000 }
      );

      if (!dlData.status || !dlData.downloadUrl) {
        await sock.sendMessage(chatId, { delete: waitMsg.key });
        return reply(box({ title: "Ytb", emoji: "❌", body: "Impossible de récupérer le fichier." }));
      }

      const fileResp = await axios.get(dlData.downloadUrl, { responseType: "arraybuffer", timeout: 120000 });
      const buffer = Buffer.from(fileResp.data);

      await sock.sendMessage(chatId, { delete: waitMsg.key });

      if (data.type === "audio") {
        await sock.sendMessage(chatId, {
          audio: buffer,
          mimetype: "audio/mpeg",
          caption: box({ title: "Ytb", emoji: "🎵", body: `${bold("Titre")} : ${selected.title}` })
        }, { quoted: event });
      } else {
        await sock.sendMessage(chatId, {
          video: buffer,
          caption: box({ title: "Ytb", emoji: "🎬", body: `${bold("Titre")} : ${selected.title}` })
        }, { quoted: event });
      }

    } catch (e) {
      console.error("[YTB] download error:", e.message);
      await sock.sendMessage(chatId, { delete: waitMsg.key });
      return reply(box({ title: "Ytb", emoji: "❌", body: "Échec du téléchargement." }));
    }
  }
};
