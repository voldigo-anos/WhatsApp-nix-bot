const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const { box, bold, line } = require('../../func/style.js');

// Helper to download an image from URL and return a buffer
async function getBufferFromURL(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

// Pinterest canvas generator (adapted from original)
async function generatePinterestCanvas(imageObjects, query, page, totalPages) {
  const canvasWidth = 800;
  const canvasHeight = 1600;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('🔍 Recherche Pinterest', 20, 45);

  ctx.font = '16px Arial';
  ctx.fillStyle = '#b0b0b0';
  ctx.fillText(`Résultats de recherche pour "${query}", affichant jusqu'à ${imageObjects.length} images.`, 20, 75);

  const numColumns = 3;
  const padding = 15;
  const columnWidth = (canvasWidth - (padding * (numColumns + 1))) / numColumns;
  const columnHeights = Array(numColumns).fill(100);

  const loadedPairs = await Promise.all(
    imageObjects.map(obj =>
      loadImage(obj.url)
        .then(img => ({ img, originalIndex: obj.originalIndex, url: obj.url }))
        .catch(e => {
          console.error(`Impossible de charger l'image : ${obj.url}`, e && e.message);
          return null;
        })
    )
  );

  const successful = loadedPairs.filter(x => x !== null);

  if (successful.length === 0) {
    ctx.fillStyle = '#ff6666';
    ctx.font = '16px Arial';
    ctx.fillText(`Aucune image n'a pu être chargée pour cette page.`, 20, 110);
    const outputPath = path.join(__dirname, 'cache', `pinterest_page_${Date.now()}.png`);
    await fs.ensureDir(path.dirname(outputPath));
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    return { outputPath, displayedMap: [] };
  }

  let displayNumber = 0;
  const displayedMap = [];

  for (let i = 0; i < successful.length; i++) {
    const { img, originalIndex } = successful[i];

    const minHeight = Math.min(...columnHeights);
    const columnIndex = columnHeights.indexOf(minHeight);

    const x = padding + columnIndex * (columnWidth + padding);
    const y = minHeight + padding;

    const scale = columnWidth / img.width;
    const scaledHeight = img.height * scale;

    ctx.drawImage(img, x, y, columnWidth, scaledHeight);

    displayNumber += 1;
    displayedMap.push(originalIndex);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, 50, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${displayNumber}`, x + 25, y + 12);

    ctx.fillStyle = '#b0b0b0';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${img.width} x ${img.height}`, x + columnWidth - 6, y + scaledHeight - 6);

    columnHeights[columnIndex] += scaledHeight + padding;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  const footerY = Math.max(...columnHeights) + 40;
  ctx.fillText(`Anchestor - Page ${page}/${totalPages}`, canvasWidth / 2, footerY);

  const outputPath = path.join(__dirname, 'cache', `pinterest_page_${Date.now()}.png`);
  await fs.ensureDir(path.dirname(outputPath));
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  return { outputPath, displayedMap };
}

module.exports = {
  config: {
    name: 'pinterest',
    aliases: ['pin'],
    version: '2.2',
    author: 'Christus',
    countDown: 10,
    role: 0,
    description: {
      en: 'Search images on Pinterest with canvas preview or direct download'
    },
    category: 'image',
    nixPrefix: true,
    guide: {
      en: '   {pn} <query> [-count] - Search Pinterest\n'
        + '   • Without -count: shows interactive canvas with numbered images\n'
        + '   • With -count: sends the images directly (e.g., {pn} cute cat -5)\n'
        + '   • After canvas, reply with a number to get that image, or "next" for more pages.'
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName }) {
    // Parse count argument (e.g., -5)
    let count = null;
    const countArg = args.find(arg => /^-\d+$/.test(arg));
    if (countArg) {
      count = parseInt(countArg.slice(1), 10);
      args = args.filter(arg => arg !== countArg);
    }

    const query = args.join(' ').trim();
    if (!query) {
      return reply(box({ title: 'Pinterest', emoji: '📌', body: `❌ Usage : ${prefix}${commandName} <query> [-count]` }));
    }

    // Send processing message
    const waitMsg = await sock.sendMessage(chatId, {
      text: box({ title: 'Pinterest', emoji: '📌', body: '🔍 Recherche sur Pinterest...' })
    }, { quoted: event });

    try {
      // Fetch images from API
      const apiUrl = `https://pinspiration-hub.onrender.com/api/pin?query=${encodeURIComponent(query)}&num=90`;
      const res = await axios.get(apiUrl);
      const allImageUrls = res.data.results || [];

      if (allImageUrls.length === 0) {
        await sock.sendMessage(chatId, { delete: waitMsg.key });
        return reply(box({ title: 'Pinterest', emoji: '📌', body: `❌ Aucune image trouvée pour "${query}".` }));
      }

      // Direct download mode (with count)
      if (count) {
        const urls = allImageUrls.slice(0, count);
        const buffers = await Promise.all(
          urls.map(url => getBufferFromURL(url).catch(() => null))
        );
        const validBuffers = buffers.filter(b => b);

        await sock.sendMessage(chatId, { delete: waitMsg.key });

        if (validBuffers.length === 0) {
          return reply(box({ title: 'Pinterest', emoji: '📌', body: '❌ Impossible de récupérer les images demandées.' }));
        }

        // Send each image individually
        for (const buffer of validBuffers) {
          await sock.sendMessage(chatId, {
            image: buffer,
            caption: box({ title: 'Pinterest', emoji: '📸', body: `Image pour "${query}"` })
          }, { quoted: event });
        }
        return;
      }

      // Canvas preview mode
      const imagesPerPage = 21;
      const totalPages = Math.ceil(allImageUrls.length / imagesPerPage);
      const startIndex = 0;
      const endIndex = Math.min(allImageUrls.length, imagesPerPage);
      const imagesForPage1 = allImageUrls.slice(startIndex, endIndex).map((url, idx) => ({
        url,
        originalIndex: startIndex + idx
      }));

      const { outputPath: canvasPath, displayedMap } = await generatePinterestCanvas(
        imagesForPage1,
        query,
        1,
        totalPages
      );

      // Send canvas image
      const canvasBuffer = fs.readFileSync(canvasPath);
      const sentMsg = await sock.sendMessage(chatId, {
        image: canvasBuffer,
        caption: box({ title: 'Pinterest', emoji: '🖼️', body: `${bold(String(allImageUrls.length))} images trouvées pour "${query}".\nRépondez avec un numéro (affiché sur le canvas) pour obtenir l'image, ou "next" pour plus.` })
      }, { quoted: event });

      // Clean up temp file
      fs.unlink(canvasPath).catch(console.error);

      // Delete processing message
      await sock.sendMessage(chatId, { delete: waitMsg.key });

      // Store reply data
      global.NixBot.onReply.push({
        commandName: 'pinterest',
        messageID: sentMsg.key.id,
        author: senderId,
        allImageUrls,
        query,
        imagesPerPage,
        currentPage: 1,
        totalPages,
        displayedMap,
        displayCount: displayedMap.length
      });

    } catch (error) {
      console.error('[PINTEREST]', error);
      await sock.sendMessage(chatId, { delete: waitMsg.key });
      reply(box({ title: 'Pinterest', emoji: '📌', body: "❌ Une erreur est survenue. Le serveur ou l'API peut être indisponible." }));
    }
  },

  onReply: async function ({ sock, chatId, message, senderId, event }) {
    // Get the original data
    const repliedMsgId = event.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!repliedMsgId) return;

    const data = global.NixBot.onReply.find(
      r => r.commandName === 'pinterest' && r.author === senderId && r.messageID === repliedMsgId
    );
    if (!data) return;

    const input = (event.message?.conversation || event.message?.extendedTextMessage?.text || '').trim().toLowerCase();

    // Handle "next" command
    if (input === 'next') {
      if (data.currentPage >= data.totalPages) {
        return sock.sendMessage(chatId, {
          text: box({ title: 'Pinterest', emoji: '📌', body: '❌ Vous êtes déjà sur la dernière page des résultats.' })
        }, { quoted: event });
      }

      const nextPage = data.currentPage + 1;
      const startIndex = (nextPage - 1) * data.imagesPerPage;
      const endIndex = Math.min(startIndex + data.imagesPerPage, data.allImageUrls.length);
      const imagesForNextPage = data.allImageUrls.slice(startIndex, endIndex).map((url, idx) => ({
        url,
        originalIndex: startIndex + idx
      }));

      // Send "loading" message
      const loadingMsg = await sock.sendMessage(chatId, {
        text: box({ title: 'Pinterest', emoji: '📌', body: `⏳ Chargement de la page ${nextPage}...` })
      }, { quoted: event });

      const { outputPath: canvasPath, displayedMap: nextDisplayedMap } = await generatePinterestCanvas(
        imagesForNextPage,
        data.query,
        nextPage,
        data.totalPages
      );

      // Send new canvas
      const canvasBuffer = fs.readFileSync(canvasPath);
      const sentMsg = await sock.sendMessage(chatId, {
        image: canvasBuffer,
        caption: box({ title: 'Pinterest', emoji: '🖼️', body: `Page ${bold(String(nextPage))}/${data.totalPages}.\nRépondez avec un numéro (du canvas) pour obtenir l'image, ou "next" pour continuer.` })
      }, { quoted: event });

      // Clean up
      fs.unlink(canvasPath).catch(console.error);
      await sock.sendMessage(chatId, { delete: loadingMsg.key });

      // Remove old reply handler and set new one
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === data.messageID);
      if (idx !== -1) global.NixBot.onReply.splice(idx, 1);
      global.NixBot.onReply.push({
        commandName: 'pinterest',
        messageID: sentMsg.key.id,
        author: senderId,
        allImageUrls: data.allImageUrls,
        query: data.query,
        imagesPerPage: data.imagesPerPage,
        currentPage: nextPage,
        totalPages: data.totalPages,
        displayedMap: nextDisplayedMap,
        displayCount: nextDisplayedMap.length
      });

      return;
    }

    // Handle number selection
    const number = parseInt(input, 10);
    if (isNaN(number) || number <= 0) {
      return sock.sendMessage(chatId, {
        text: box({ title: 'Pinterest', emoji: '📌', body: "❌ Répondez avec un numéro (du canvas) pour obtenir l'image, ou 'next' pour charger d'autres pages." })
      }, { quoted: event });
    }

    if (number > data.displayCount) {
      return sock.sendMessage(chatId, {
        text: box({ title: 'Pinterest', emoji: '📌', body: `❌ Numéro invalide. Le canvas actuel affiche seulement ${data.displayCount} image(s). Choisissez un numéro de 1 à ${data.displayCount}, ou tapez 'next' pour charger plus.` })
      }, { quoted: event });
    }

    const originalIndex = data.displayedMap[number - 1];
    if (originalIndex == null || originalIndex < 0 || originalIndex >= data.allImageUrls.length) {
      return sock.sendMessage(chatId, {
        text: box({ title: 'Pinterest', emoji: '📌', body: '❌ Impossible de trouver cette image. Réessayez avec un autre numéro.' })
      }, { quoted: event });
    }

    const imageUrl = data.allImageUrls[originalIndex];
    const buffer = await getBufferFromURL(imageUrl).catch(() => null);
    if (!buffer) {
      return sock.sendMessage(chatId, {
        text: box({ title: 'Pinterest', emoji: '📌', body: "❌ Impossible de récupérer l'image demandée." })
      }, { quoted: event });
    }

    // Send the selected image
    await sock.sendMessage(chatId, {
      image: buffer,
      caption: box({ title: 'Pinterest', emoji: '📸', body: `Image #${bold(String(number))} pour la requête "${data.query}"` })
    }, { quoted: event });

    // Keep the reply handler active for further selections; do not delete data.
  }
};
