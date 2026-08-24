const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fse.remove(filePath);
            console.log(`File deleted: ${filePath}`);
        } catch (error) {
            console.error(`Failed to delete file:`, error);
        }
    }, 10000);
};

module.exports = {
    config: {
        name: "simage",
        aliases: ["stickerimage", "sticker2img", "stickertoimage"],
        version: "1.0.0",
        author: "Christus",
        countDown: 5,
        role: 0,
        description: {
            en: "Convert a sticker to an image (PNG). Reply to a sticker with this command."
        },
        category: "utility",
        nixPrefix: false,
        guide: {
            en: "   {pn} - Reply to a sticker message to convert it to an image."
        }
    },

    onStart: async function ({ sock, chatId, event, reply }) {
        try {
            const quotedMessage = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMessage) {
                return reply("⚠️ Please reply to a sticker message.");
            }

            const stickerMessage = quotedMessage.stickerMessage;
            if (!stickerMessage) {
                return reply("❌ The replied message is not a sticker.");
            }

            const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
            const outputImagePath = path.join(tempDir, `converted_image_${Date.now()}.png`);

            const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            await fsPromises.writeFile(stickerFilePath, buffer);

            await sharp(stickerFilePath)
                .toFormat('png')
                .toFile(outputImagePath);

            const imageBuffer = await fsPromises.readFile(outputImagePath);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: "✅ Here's your converted image!"
            });

            scheduleFileDeletion(stickerFilePath);
            scheduleFileDeletion(outputImagePath);
        } catch (error) {
            console.error('Error converting sticker to image:', error);
            await sock.sendMessage(chatId, { text: 'An error occurred while converting the sticker.' });
        }
    }
};
