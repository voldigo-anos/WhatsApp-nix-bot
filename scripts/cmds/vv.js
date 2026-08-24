const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), 'nixbot_viewonce');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const cleanup = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Erreur nettoyage fichier:', err);
    });
  }
};

module.exports = {
  config: {
    name: 'vv',
    aliases: ['viewonce', 'vuunique'],
    version: '1.1.0',
    author: 'Christus',
    countDown: 5,
    role: 0,
    description: {
      en: 'Retrieve and resend a view-once message (image/video)',
      fr: 'Récupère et renvoie un message vu unique (image/vidéo)'
    },
    category: 'media',
    nixPrefix: true,
    guide: {
      en: '   {pn} - Reply to a view-once message to recover it',
      fr: '   {pn} - Répondez à un message vu unique pour le récupérer'
    }
  },

  onLoad: function () {
    console.log('[VV] Command loaded (améliorée)');
  },

  onStart: async function ({ sock, chatId, event, reply }) {
    const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return reply('❌ Répondez à un message "vu unique" avec cette commande.');
    }

    const extractMedia = (msgObj) => {
      if (msgObj?.imageMessage) {
        return { media: msgObj.imageMessage, type: 'image' };
      }
      if (msgObj?.videoMessage) {
        return { media: msgObj.videoMessage, type: 'video' };
      }
      return null;
    };

    let viewOnceMedia = null;
    let mediaType = null;

    const directMedia = extractMedia(quoted);
    if (directMedia && directMedia.media.viewOnce === true) {
      viewOnceMedia = directMedia.media;
      mediaType = directMedia.type;
    }
    else if (quoted.viewOnceMessageV2) {
      const nested = quoted.viewOnceMessageV2.message;
      const extracted = extractMedia(nested);
      if (extracted) {
        viewOnceMedia = extracted.media;
        mediaType = extracted.type;
      }
    }
    else if (quoted.viewOnceMessage) {
      const nested = quoted.viewOnceMessage.message;
      const extracted = extractMedia(nested);
      if (extracted) {
        viewOnceMedia = extracted.media;
        mediaType = extracted.type;
      }
    }

    if (!viewOnceMedia || !mediaType) {
      return reply('❌ Le message cité n’est pas un média vu unique valide.');
    }

    const timestamp = Date.now();
    const ext = mediaType === 'image' ? 'jpg' : 'mp4';
    const filePath = path.join(tmpDir, `viewonce_${timestamp}.${ext}`);

    try {
      const stream = await downloadContentFromMessage(viewOnceMedia, mediaType);
      const buffer = [];
      for await (const chunk of stream) {
        buffer.push(chunk);
      }
      fs.writeFileSync(filePath, Buffer.concat(buffer));

      const mediaBuffer = fs.readFileSync(filePath);
      if (mediaType === 'image') {
        await sock.sendMessage(
          chatId,
          { image: mediaBuffer, caption: '👁️ Message vu unique récupéré (image)' },
          { quoted: event }
        );
      } else {
        await sock.sendMessage(
          chatId,
          { video: mediaBuffer, caption: '👁️ Message vu unique récupéré (vidéo)' },
          { quoted: event }
        );
      }

      cleanup(filePath);
    } catch (error) {
      console.error('Erreur lors de la récupération du vu unique:', error);
      cleanup(filePath);
      reply(`❌ Erreur : ${error.message}`);
    }
  }
};
