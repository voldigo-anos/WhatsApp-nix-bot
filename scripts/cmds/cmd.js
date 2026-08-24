const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { box, bold, line } = require("../../func/style.js");

const CMDS_DIR = __dirname;

function getDomain(url) {
  const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isURL(str) {
  try { new URL(str); return true; } catch (e) { return false; }
}

function clearRequireCache(filePath) {
  try {
    const resolved = require.resolve(filePath);
    delete require.cache[resolved];
  } catch (_) {}
}

function loadCommandFile(fileName, cmds) {
  const cleanName = fileName.endsWith(".js") ? fileName.slice(0, -3) : fileName;
  const filePath = path.join(CMDS_DIR, `${cleanName}.js`);
  if (!fs.existsSync(filePath)) {
    return { status: "error", name: cleanName, error: { name: "FileNotFound", message: `Le fichier ${cleanName}.js est introuvable.` } };
  }
  try {
    clearRequireCache(filePath);
    const command = require(filePath);
    if (!command?.config?.name || typeof command.onStart !== "function") {
      return { status: "error", name: cleanName, error: { name: "InvalidCommand", message: "Le fichier ne respecte pas le format attendu (config.name / onStart)." } };
    }
    cmds.set(command.config.name, command);
    if (Array.isArray(command.config.aliases)) {
      for (const alias of command.config.aliases) cmds.set(alias, command);
    }
    return { status: "success", name: command.config.name };
  } catch (error) {
    return { status: "error", name: cleanName, error: { name: error.name, message: error.message } };
  }
}

function unloadCommandFile(fileName, cmds) {
  const cleanName = fileName.endsWith(".js") ? fileName.slice(0, -3) : fileName;
  let target = null;
  for (const [key, cmd] of cmds) {
    if (cmd.config.name === cleanName) { target = cmd; break; }
  }
  if (!target) {
    return { status: "error", name: cleanName, error: { name: "NotLoaded", message: "Cette commande n'est pas actuellement chargée." } };
  }
  const keysToDelete = [target.config.name, ...(target.config.aliases || [])];
  for (const k of keysToDelete) cmds.delete(k);
  const filePath = path.join(CMDS_DIR, `${cleanName}.js`);
  clearRequireCache(filePath);
  return { status: "success", name: cleanName };
}

module.exports = {
  config: {
    name: "cmd",
    aliases: ["commande", "gestioncmd"],
    version: "1.17",
    author: "Christus",
    countDown: 5,
    role: 3,
    category: "owner",
    description: { en: "📦 Gérer les fichiers de commandes du bot (charger, décharger, installer)" },
    guide: {
      en:
        "{pn} load <nom_fichier> : charger une commande\n" +
        "{pn} loadAll : charger toutes les commandes\n" +
        "{pn} unload <nom_fichier> : décharger une commande\n" +
        "{pn} install <url> <fichier.js> : installer depuis une URL\n" +
        "{pn} install <fichier.js> <code> : installer depuis un code",
    },
  },

  onStart: async ({ args, reply, cmds, event }) => {
    if (!args[0] || args[0].toLowerCase() === "help") {
      const body =
        `${bold("load <commande>")} – charge une commande\n` +
        `${bold("loadAll")} – charge toutes les commandes\n` +
        `${bold("unload <commande>")} – décharge une commande\n` +
        `${bold("install <url> <fichier.js>")} – installe depuis une URL\n` +
        `${bold("install <fichier.js> <code>")} – installe depuis un code\n\n` +
        `${bold("📌 Exemples :")}\n` +
        `• cmd load admin\n` +
        `• cmd install admin.js code...\n` +
        `• cmd unload admin`;
      return reply(box({ title: "Commandes Disponibles", emoji: "🚀", body }));
    }

    const sub = args[0].toLowerCase();

    if (sub === "load" && args.length === 2) {
      if (!args[1]) return reply(box({ title: "Cmd", emoji: "❌", body: "Veuillez préciser le nom de la commande à charger." }));
      const infoLoad = loadCommandFile(args[1], cmds);
      if (infoLoad.status === "success") {
        return reply(box({ title: "Cmd", emoji: "✅", body: `Commande "${infoLoad.name}" chargée avec succès.` }));
      }
      return reply(box({ title: "Cmd", emoji: "❌", body: `Échec du chargement de "${infoLoad.name}" : ${infoLoad.error.name} — ${infoLoad.error.message}` }));
    }

    if (sub === "loadall" || (sub === "load" && args.length > 2)) {
      const fileNeedToLoad = sub === "loadall"
        ? fs.readdirSync(CMDS_DIR).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3))
        : args.slice(1);

      const successList = [];
      const failList = [];
      for (const fileName of fileNeedToLoad) {
        const infoLoad = loadCommandFile(fileName, cmds);
        if (infoLoad.status === "success") successList.push(fileName);
        else failList.push(`❌ ${fileName} → ${infoLoad.error.name}: ${infoLoad.error.message}`);
      }

      let body = "";
      if (successList.length) body += `✅ ${successList.length} commande(s) chargée(s) avec succès.\n`;
      if (failList.length) body += `\n❌ Échec du chargement de ${failList.length} commande(s) :\n${failList.join("\n")}`;
      return reply(box({ title: "Cmd — LoadAll", emoji: "📦", body: body || "Aucune commande à charger." }));
    }

    if (sub === "unload") {
      if (!args[1]) return reply(box({ title: "Cmd", emoji: "❌", body: "Veuillez préciser le nom de la commande à décharger." }));
      const infoUnload = unloadCommandFile(args[1], cmds);
      if (infoUnload.status === "success") {
        return reply(box({ title: "Cmd", emoji: "✅", body: `Commande "${infoUnload.name}" déchargée avec succès.` }));
      }
      return reply(box({ title: "Cmd", emoji: "❌", body: `Échec du déchargement de "${infoUnload.name}" : ${infoUnload.error.name} — ${infoUnload.error.message}` }));
    }

    if (sub === "install") {
      let url = args[1];
      let fileName = args[2];
      let rawCode;

      if (!url || !fileName) {
        return reply(box({ title: "Cmd", emoji: "❌", body: "Veuillez fournir l'URL (ou le code) et le nom du fichier." }));
      }

      if (url.endsWith(".js") && !isURL(url)) {
        const tmp = fileName;
        fileName = url;
        url = tmp;
      }

      if (/^(https?:\/\/(?:www\.|(?!www)))/.test(url)) {
        if (!fileName || !fileName.endsWith(".js")) {
          return reply(box({ title: "Cmd", emoji: "❌", body: "Nom de fichier invalide, il doit se terminer par .js" }));
        }

        const domain = getDomain(url);
        if (!domain) return reply(box({ title: "Cmd", emoji: "❌", body: "Domaine non reconnu." }));

        if (domain === "pastebin.com") {
          const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
          if (regex.test(url)) url = url.replace(regex, "https://pastebin.com/raw/$1");
          if (url.endsWith("/")) url = url.slice(0, -1);
        } else if (domain === "github.com") {
          const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
          if (regex.test(url)) url = url.replace(regex, "https://raw.githubusercontent.com/$1/$2");
        }

        try {
          const res = await axios.get(url);
          rawCode = res.data;
        } catch (error) {
          return reply(box({ title: "Cmd", emoji: "❌", body: `Impossible de récupérer le code depuis l'URL : ${error.message}` }));
        }
      } else {
        const textBody = event.message?.conversation || event.message?.extendedTextMessage?.text || "";
        if (args[args.length - 1].endsWith(".js")) {
          fileName = args[args.length - 1];
          rawCode = textBody.slice(textBody.indexOf("install") + 7, textBody.lastIndexOf(fileName) - 1);
        } else if (args[1].endsWith(".js")) {
          fileName = args[1];
          rawCode = textBody.slice(textBody.indexOf(fileName) + fileName.length + 1);
        } else {
          return reply(box({ title: "Cmd", emoji: "❌", body: "Nom de fichier manquant ou invalide." }));
        }
      }

      if (!rawCode || !String(rawCode).trim()) {
        return reply(box({ title: "Cmd", emoji: "❌", body: "Impossible de récupérer le code source." }));
      }

      const targetPath = path.join(CMDS_DIR, fileName);
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (_) {}
      }

      try {
        fs.writeFileSync(targetPath, rawCode);
      } catch (error) {
        return reply(box({ title: "Cmd", emoji: "❌", body: `Impossible d'écrire le fichier : ${error.message}` }));
      }

      const infoLoad = loadCommandFile(fileName, cmds);
      if (infoLoad.status === "success") {
        return reply(box({ title: "Cmd", emoji: "✅", body: `Commande "${infoLoad.name}" installée avec succès.\nFichier : scripts/cmds/${fileName}` }));
      }
      try { fs.unlinkSync(targetPath); } catch (_) {}
      return reply(box({ title: "Cmd", emoji: "❌", body: `Échec de l'installation de "${infoLoad.name}" : ${infoLoad.error.name} — ${infoLoad.error.message}` }));
    }

    return reply(box({ title: "Cmd", emoji: "❓", body: "Commande inconnue. Utilisez `cmd help` pour voir les commandes disponibles." }));
  },
};
