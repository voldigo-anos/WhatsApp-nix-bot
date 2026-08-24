const axios = require("axios");
const validUrl = require("valid-url");
const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { box, bold, line } = require("../../func/style.js");

const BASE = "https://testai-christus-api-3xjn.vercel.app";
const CHAT_URL = `${BASE}/api/public/chat`;
const TMP_DIR = path.join(__dirname, "tmp");

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const downloadFile = async (url, ext) => {
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);
  const response = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
};

const urlToBase64 = async (url) => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data).toString("base64");
};

// --- Anti-surcharge -------------------------------------------------
// L'API partage un quota Groq entre tous les utilisateurs : quand trop
// de requêtes arrivent en même temps/trop vite, elle répond (en 200)
// avec un message de type "connexions IA surchargées". On limite les
// rafales avec une file d'attente, et on réessaie en silence avant de
// montrer quoi que ce soit à l'utilisateur.

const OVERLOAD_PATTERNS = [/surcharg/i, /quota/i, /groq/i];
const isOverloadReply = (text) => !!text && OVERLOAD_PATTERNS.some((r) => r.test(text));

let requestQueue = Promise.resolve();
const MIN_INTERVAL_MS = 1500; // délai mini entre deux requêtes à l'API

const enqueue = (task) => {
  const run = requestQueue.then(async () => {
    try {
      return await task();
    } finally {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS));
    }
  });
  requestQueue = run.catch(() => {}); // la file continue même si une tâche échoue
  return run;
};

const callChatWithRetry = async (payload, maxAttempts = 3) => {
  let lastResponse;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResponse = await axios.post(CHAT_URL, payload, { timeout: 60000 });
    const replyText = lastResponse.data?.reply;
    if (!isOverloadReply(replyText)) return lastResponse;
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  return lastResponse;
};
// ---------------------------------------------------------------------

const resetConversation = async ({ sock, chatId, event, senderId, reply }) => {
  await sock.sendMessage(chatId, { react: { text: "♻️", key: event.key } });
  try {
    await axios.post(CHAT_URL, { uid: senderId, message: "reset", reset: true });
    return reply(box({ title: "Christus AI", emoji: "🤖", body: "✅ Conversation réinitialisée." }));
  } catch {
    return reply(box({ title: "Christus AI", emoji: "🤖", body: "❌ Échec de la réinitialisation." }));
  }
};

const handleAIRequest = async ({ sock, chatId, event, senderId, reply, commandName }, userInput) => {
  let imageBase64 = null;
  let messageContent = userInput;

  await sock.sendMessage(chatId, { react: { text: "⏳", key: event.key } });

  const contextInfo = event.message?.extendedTextMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;
  const quotedImage = quoted?.imageMessage;
  if (quotedImage) {
    try {
      const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
      const stream = await downloadContentFromMessage(quotedImage, "image");
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      imageBase64 = Buffer.concat(chunks).toString("base64");
    } catch {}
  }

  const urlMatch = messageContent.match(/(https?:\/\/[^\s]+)/)?.[0];
  if (urlMatch && validUrl.isWebUri(urlMatch)) {
    messageContent = messageContent.replace(urlMatch, "").trim();
    if (!imageBase64) {
      try { imageBase64 = await urlToBase64(urlMatch); } catch {}
    }
  }

  if (!messageContent && !imageBase64) {
    await sock.sendMessage(chatId, { react: { text: "❌", key: event.key } });
    return;
  }

  try {
    const response = await enqueue(() =>
      callChatWithRetry({
        message: messageContent || "Décris cette image.",
        uid: senderId,
        image: imageBase64 || undefined
      })
    );

    const { reply: aiReply, images, lyrics } = response.data;

    let body = String(aiReply || "").trim();

    if (lyrics) {
      const title = lyrics.title || "";
      const artist = lyrics.artist || "";
      const lyricsText = lyrics.lyrics || lyrics.text || "";
      if (title || lyricsText) {
        body += `\n\n${line}\n🎵 ${bold(title)}${artist ? " · " + artist : ""}\n${lyricsText}`;
      }
    }

    const finalBody = box({ title: "Christus AI", emoji: "🤖", body });

    const imageBuffers = [];
    if (Array.isArray(images) && images.length) {
      for (const imgUrl of images.slice(0, 4)) {
        try {
          const filePath = await downloadFile(imgUrl, "jpg");
          imageBuffers.push(fs.readFileSync(filePath));
          fs.unlink(filePath).catch(() => {});
        } catch {}
      }
    }

    let sentMsg;
    if (imageBuffers.length) {
      sentMsg = await sock.sendMessage(chatId, {
        image: imageBuffers[0],
        caption: finalBody
      }, { quoted: event });
      for (const buf of imageBuffers.slice(1)) {
        await sock.sendMessage(chatId, { image: buf }, { quoted: event });
      }
    } else {
      sentMsg = await sock.sendMessage(chatId, { text: finalBody }, { quoted: event });
    }

    if (sentMsg?.key?.id) {
      global.NixBot.onReply.push({
        commandName: commandName || "ai",
        messageID: sentMsg.key.id,
        author: senderId
      });
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: event.key } });

  } catch (err) {
    console.error("❌ Christus AI error:", err.response?.data || err.message);
    await sock.sendMessage(chatId, { react: { text: "❌", key: event.key } });
    reply(box({ title: "Christus AI", emoji: "🤖", body: "❌ Une erreur est survenue." }));
  }
};

module.exports = {
  config: {
    name: "ai",
    aliases: ["shizu"],
    version: "3.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    category: "ai",
    description: { en: "Chat with Christus AI" },
    guide: { en: "{pn} <message> - Chat with the AI\n{pn} clear/reset - Reset the conversation" }
  },

  onStart: async function (ctx) {
    const { args, reply } = ctx;
    const input = args.join(" ").trim();

    if (!input) {
      return reply(box({ title: "Christus AI", emoji: "🤖", body: `Écris un message après ${bold("ai")} pour discuter avec l'IA.` }));
    }

    if (["clear", "reset"].includes(input.toLowerCase())) {
      return resetConversation(ctx);
    }

    return handleAIRequest(ctx, input);
  },

  onReply: async function (ctx) {
    const { event, senderId } = ctx;
    const repliedId = event.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const data = global.NixBot.onReply.find(r => r.commandName === "ai" && r.messageID === repliedId);
    if (!data) return;
    if (senderId !== data.author) return;

    const body = event.message?.conversation || event.message?.extendedTextMessage?.text || "";
    return handleAIRequest(ctx, body);
  },

  onChat: async function (ctx) {
    const { event } = ctx;
    const body = (event.message?.conversation || event.message?.extendedTextMessage?.text || "").trim();
    if (!body?.toLowerCase().startsWith("ai")) return;

    const input = body.slice(2).trim();

    if (!input) {
      return ctx.reply(box({ title: "Christus AI", emoji: "🤖", body: `Écris un message après ${bold("ai")} pour discuter avec l'IA.` }));
    }

    if (["clear", "reset"].includes(input.toLowerCase())) {
      return resetConversation(ctx);
    }

    return handleAIRequest(ctx, input);
  }
};
