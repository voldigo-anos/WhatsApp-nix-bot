const axios = require("axios");
const { box, bold } = require("../../func/style.js");

module.exports = {
  config: {
    name: "translate",
    aliases: ["trans"],
    version: "1.5",
    author: "NTKhang",
    countDown: 5,
    role: 0,
    category: "utility",
    description: { en: "Translate text to the desired language" },
    guide: {
      en: "   {pn} <text>: Translate text to the default language\n"
        + "   {pn} <text> -> <ISO 639-1>: Translate text to the desired language\n"
        + "   or reply to a message to translate its content\n"
        + "   Exemple: {pn} hello -> fr"
    }
  },

  onStart: async function ({ event, args, reply }) {
    const contextInfo = event.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const body = event.message?.conversation || event.message?.extendedTextMessage?.text || "";

    let content;
    let langCodeTrans;
    const defaultLang = "fr";

    if (quoted) {
      content = quoted.conversation || quoted.extendedTextMessage?.text || "";
      let lastIndexSeparator = body.lastIndexOf("->");
      if (lastIndexSeparator == -1) lastIndexSeparator = body.lastIndexOf("=>");

      if (lastIndexSeparator != -1 && (body.length - lastIndexSeparator == 4 || body.length - lastIndexSeparator == 5)) {
        langCodeTrans = body.slice(lastIndexSeparator + 2);
      } else if ((args[0] || "").match(/\w{2,3}/)) {
        langCodeTrans = args[0].match(/\w{2,3}/)[0];
      } else {
        langCodeTrans = defaultLang;
      }
    } else {
      content = body;
      let lastIndexSeparator = content.lastIndexOf("->");
      if (lastIndexSeparator == -1) lastIndexSeparator = content.lastIndexOf("=>");

      if (lastIndexSeparator != -1 && (content.length - lastIndexSeparator == 4 || content.length - lastIndexSeparator == 5)) {
        langCodeTrans = content.slice(lastIndexSeparator + 2);
        content = content.slice(content.indexOf(args[0]), lastIndexSeparator).trim();
      } else {
        langCodeTrans = defaultLang;
        content = args.join(" ");
      }
    }

    if (!content || !content.trim()) {
      return reply(box({ title: "Translate", emoji: "❌", body: `Syntaxe invalide.\n${bold("Usage")} : {pn} <texte> -> <code langue>` }));
    }

    try {
      const { text, lang } = await translate(content.trim(), langCodeTrans.trim());
      return reply(box({
        title: "Translate",
        emoji: "🌐",
        body: `${text}\n\n${bold("Traduit de")} ${lang} ${bold("vers")} ${langCodeTrans.trim()}`
      }));
    } catch (err) {
      console.error("[TRANSLATE]", err.message);
      return reply(box({ title: "Translate", emoji: "❌", body: `Une erreur est survenue : ${err.message}` }));
    }
  }
};

async function translate(text, langCode) {
  const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`);
  return {
    text: res.data[0].map(item => item[0]).join(""),
    lang: res.data[2]
  };
}
