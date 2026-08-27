const axios = require("axios");

const API_URL = "https://zuhyxx.bond/api/image/animaxl";
const HEADER = "🎨 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗔𝗻𝗶𝗺𝗲\n━━━━━━━━━\n\n";

const DEFAULT_PROMPT =
  "1girl, yamada ryo, yellow eyes, short hair, hair over one eye, blue hair, mole under eye, eyes visible through hair, hairclip, shimokitazawa high";

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
    name: "animaxl",
    aliases: ["animegen", "animeai"],
    version: "1.1",
    author: "Christus",
    role: 0,
    countDown: 10,
    description: {
      en: "Generate anime style portrait from description (tags)"
    },
    category: "ai",
    nixPrefix: true,
    guide: {
      en:
        "   {pn} <description/tags>\n" +
        "   {pn} — without argument, generates a default example\n\n" +
        "   Example: {pn} 1girl, red hair, green eyes, school uniform, smiling"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    const prompt = args.join(" ").trim() || DEFAULT_PROMPT;

    try {
      const waitMsg = await sock.sendMessage(chatId, {
        text: `⏳ Génération en cours...\n📝 Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`
      }, { quoted: event });

      const { data } = await axios.post(API_URL, { prompt }, { timeout: 60000 });
      const imageUrl = data?.imageUrl?.url || data?.imageUrl || data?.url;

      if (!imageUrl) {
        console.error("❌ Christus Anime - réponse inattendue :\n" + JSON.stringify(data, null, 2));
        throw new Error("Aucune image retournée par l'API.");
      }

      const imageBuffer = await getBufferFromURL(imageUrl);

      if (!imageBuffer) {
        throw new Error("Impossible de télécharger l'image générée.");
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: `${HEADER}✅ Image générée avec succès !\n\n📝 Prompt: ${prompt}\n🎨 Style: Anime XL\n\n🔄 Utilisez ${prefix}animaxl <description> pour générer d'autres images.`
      }, { quoted: event });

    } catch (err) {
      console.error("❌ Christus Anime error:", err.response?.data || err.message);
      return reply(`${HEADER}❌ Échec de la génération.\n📄 Raison: ${err.response?.data?.message || err.message || "Erreur inconnue"}\n\n🔄 Réessayez plus tard.`);
    }
  }
};
