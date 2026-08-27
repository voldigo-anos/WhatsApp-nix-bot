const axios = require("axios");

const mahmud = async () => {
  try {
    const base = await axios.get(
      "https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json"
    );
    return base.data.mahmud;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'API base:", error);
    return null;
  }
};

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
    name: "anicdp",
    aliases: ["cdp"],
    version: "1.8",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Get random anime profile pictures / display pictures"
    },
    category: "media",
    nixPrefix: true,
    guide: {
      en: "   {pn} - Get a random anime DP\n   {pn} <category> - Get DP from specific category"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    try {
      const apiBase = await mahmud();
      if (!apiBase) {
        return reply("❌ Impossible de contacter l'API. Réessayez plus tard.");
      }

      const baseUrl = `${apiBase}/api/cdpvip2`;
      
      let category = args[0]?.toLowerCase() || "anime";
      
      const categories = ["anime", "boy", "girl", "couple", "sad", "love", "nature", "art"];
      
      if (!categories.includes(category)) {
        return reply(`❌ Catégorie invalide.\n\n📚 Catégories disponibles:\n${categories.map(c => `• ${c}`).join('\n')}\n\nExemple: ${prefix}anicdp girl`);
      }

      const waitMsg = await sock.sendMessage(chatId, {
        text: `⏳ Recherche de photos de profil ${category}...`
      }, { quoted: event });

      const res = await axios.get(`${baseUrl}?category=${category}`);
      const groupImages = res.data?.group || [];

      if (!groupImages || groupImages.length === 0) {
        await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});
        return reply(`⚠️ Aucune photo trouvée dans la catégorie "${category}".`);
      }

      const maxImages = Math.min(groupImages.length, 10);
      const selectedImages = groupImages.slice(0, maxImages);

      const imageBuffers = [];
      for (const url of selectedImages) {
        try {
          const buffer = await getBufferFromURL(url);
          if (buffer) {
            imageBuffers.push(buffer);
          }
        } catch (error) {
          console.warn(`⚠️ Échec du chargement de l'image: ${url}`, error.message);
        }
      }

      await sock.sendMessage(chatId, { delete: waitMsg.key }).catch(() => {});

      if (imageBuffers.length === 0) {
        return reply(`❌ Impossible de charger les images pour la catégorie "${category}".`);
      }

      const firstImage = imageBuffers[0];
      const title = category.charAt(0).toUpperCase() + category.slice(1);
      const total = groupImages.length;

      await sock.sendMessage(chatId, {
        image: firstImage,
        caption: `🎀 𝗣𝗵𝗼𝘁𝗼 𝗱𝗲 𝗽𝗿𝗼𝗳𝗶𝗹 ${title}\n━━━━━━━━━\n\n` +
                `📸 Affichage de ${imageBuffers.length} photo${imageBuffers.length > 1 ? 's' : ''} disponibles\n` +
                `📚 Catégorie: ${title}\n` +
                `📦 Total disponible: ${total} images\n\n` +
                `🔄 Utilisez ${prefix}anicdp ${category} pour en voir plus`
      }, { quoted: event });

      if (imageBuffers.length > 1) {
        for (let i = 1; i < imageBuffers.length; i++) {
          await sock.sendMessage(chatId, {
            image: imageBuffers[i]
          }, { quoted: event });
        }
      }

    } catch (err) {
      console.error("Erreur animecdp:", err);
      const errorMsg = err.response?.data?.error || err.message || "Erreur inconnue";
      reply(`❌ Erreur lors de la récupération des photos.\n📄 Raison: ${errorMsg}`);
    }
  }
};
