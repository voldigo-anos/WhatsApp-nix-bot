const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const tmp = path.join(os.tmpdir(), "stickers");
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

module.exports = {
  config: {
    name: "sticker",
    aliases: ["s", "stk"],
    version: "2.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: "Convert image en sticker",
    category: "media",
    nixPrefix: true
  },

  onStart: async function ({ sock, chatId, event, reply }) {

    let media = null;

    if (event.message?.imageMessage) {
      media = event.message.imageMessage;
    }

    else {
      const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (quoted?.imageMessage) {
        media = quoted.imageMessage;
      }
    }

    if (!media) {
      return reply("❌ Réponds à une image avec la commande sticker");
    }

    try {

      const stream = await downloadContentFromMessage(media, "image");
      const buffer = [];

      for await (const chunk of stream) {
        buffer.push(chunk);
      }

      const imgBuffer = Buffer.concat(buffer);

      const input = path.join(tmp, Date.now() + ".jpg");
      const output = path.join(tmp, Date.now() + ".webp");

      fs.writeFileSync(input, imgBuffer);

      await sharp(input)
        .resize(512, 512, { fit: "cover" })
        .webp()
        .toFile(output);

      const sticker = fs.readFileSync(output);

      await sock.sendMessage(
        chatId,
        { sticker: sticker },
        { quoted: event }
      );

      fs.unlinkSync(input);
      fs.unlinkSync(output);

    } catch (err) {
      console.log(err);
      reply("❌ Erreur lors de la création du sticker");
    }
  }
};
