const { box, bold, line } = require("../../func/style.js");

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

module.exports = {
  config: {
    name: "help",
    aliases: [],
    version: "3.1.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    category: "info",
    description: { en: "🧰 Affiche la liste des commandes disponibles et leurs détails" },
    guide: {
      en: "{pn} : menu principal\n{pn} <commande> : infos sur une commande\n{pn} basics : commandes de base\n{pn} search <mot> : rechercher une commande",
    },
  },

  onStart: async function ({ sock, chatId, args, event, reply, prefix, cmds }) {
    const arg = args[0]?.toLowerCase();

    const allCommands = [];
    const seen = new Set();
    for (const [name, cmd] of cmds) {
      if (seen.has(cmd.config.name)) continue;
      seen.add(cmd.config.name);
      allCommands.push(cmd);
    }
    allCommands.sort((a, b) => a.config.name.localeCompare(b.config.name));

    if (!arg) {
      const categorized = {};
      for (const cmd of allCommands) {
        const cat = cmd.config.category || "other";
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(cmd.config.name);
      }

      const sortedCats = Object.keys(categorized).sort();
      let body = "";

      for (const cat of sortedCats) {
        body += `${bold(toTitleCase(cat))} (${categorized[cat].length})\n`;
        const list = categorized[cat].sort();
        for (let i = 0; i < list.length; i += 3) {
          body += list.slice(i, i + 3).map(c => `📄 ${c}`).join("   ") + "\n";
        }
        body += "\n";
      }

      body += `${line}\n`;
      body += `📊 Total : ${allCommands.length}\n`;
      body += `${bold("➜ Détails :")} ${prefix}help <commande>\n`;
      body += `${bold("➜ Basiques :")} ${prefix}help basics\n`;
      body += `${bold("➜ Recherche :")} ${prefix}help search <mot>\n`;
      body += `${bold("➜ Développé par @Christus")} 🎀`;

      return reply(box({ title: "Available Commands", emoji: "🔍", body }));
    }

    if (arg === "basics") {
      const basicCmdList = [
        "register", "items", "gift", "bal", "bank", "active", "streak",
        "vault", "bag", "rank", "ratings", "report", "trade", "uid",
        "pet", "rosashop", "garden", "arena", "mtls",
      ];

      const validCommands = [];
      for (const cmdName of basicCmdList) {
        const cmd = cmds.get(cmdName);
        if (cmd) validCommands.push(cmd);
      }

      if (validCommands.length === 0) {
        return reply(box({ title: "Help", emoji: "❌", body: "Aucune commande de base disponible pour votre rôle." }));
      }

      let body = "";
      for (const cmd of validCommands) {
        const cfg = cmd.config;
        const desc = cfg.description?.en || cfg.description?.fr || "Aucune description";
        body += `📁 ${prefix}${cfg.name} ${bold("➜")} ${desc}\n`;
      }
      body += `\n${bold("➜ Explorez encore plus de commandes !")}\n`;
      body += `${bold("➜ Voir tout :")} ${prefix}help\n`;
      body += `${bold("➜ Développé par @Christus")} 🎀`;

      return reply(box({ title: "Basic Commands", emoji: "✅", body }));
    }

    if (arg === "search" || arg === "find") {
      const searchStr = args[1];
      if (!searchStr) {
        return reply(box({ title: "Help", emoji: "🔎", body: `Recherchez une commande en indiquant un mot-clé.\n\n${bold("EXEMPLE :")} ${prefix}help search shop` }));
      }

      const searchLower = searchStr.toLowerCase();
      const results = [];
      for (const cmd of allCommands) {
        const cfg = cmd.config;
        const searchableText = `${cfg.name} ${cfg.category || ""} ${(cfg.aliases || []).join(" ")} ${cfg.description?.en || cfg.description?.fr || ""}`.toLowerCase();
        if (searchableText.includes(searchLower)) results.push(cmd);
      }

      if (results.length === 0) {
        return reply(box({ title: "Search Results (0)", emoji: "🔎", body: "❓ Aucun résultat." }));
      }

      const topResults = results.slice(0, 5);
      let body = "";
      for (const cmd of topResults) {
        const cfg = cmd.config;
        const aliasesList = cfg.aliases && cfg.aliases.length > 0 ? `\nAlias : ${cfg.aliases.join(", ")}` : "";
        body += `📁 ${prefix}${bold(cfg.name)}${aliasesList}\n`;
        body += `${bold("➜")} ${cfg.description?.en || cfg.description?.fr || "Aucune description"}\n\n`;
      }
      body += `${bold("➜ Développé par @Christus")} 🎀`;

      return reply(box({ title: `Search Results (${topResults.length})`, emoji: "🔎", body }));
    }

    const query = args[0].toLowerCase();
    let cmd = cmds.get(query);
    if (!cmd) {
      for (const [, c] of cmds) {
        if (c.config.aliases?.includes(query)) { cmd = c; break; }
      }
    }

    if (!cmd) {
      return reply(box({ title: "Help", emoji: "❌", body: `Commande "${query}" introuvable.` }));
    }

    const roleMap = { 0: "Tout le monde", 1: "Admin du groupe", 2: "Admin du bot", 3: "Propriétaire" };
    const cfg = cmd.config;
    const guideText = cfg.guide?.en || cfg.guide?.fr || cfg.guide || "Aucun guide disponible";
    const usage = guideText.replace(/\{pn\}/g, `${prefix}${cfg.name}`).replace(/\{p\}/g, prefix);

    const detail = [
      `📝 ${bold("Description")} : ${cfg.description?.en || cfg.description?.fr || "Aucune"}`,
      `📂 ${bold("Catégorie")} : ${cfg.category || "Divers"}`,
      `🔤 ${bold("Alias")} : ${cfg.aliases?.length ? cfg.aliases.join(", ") : "Aucun"}`,
      `🛡️ ${bold("Rôle")} : ${roleMap[cfg.role] || cfg.role} | ⏱️ ${bold("Cooldown")} : ${cfg.countDown || 0}s`,
      `🚀 ${bold("Version")} : ${cfg.version} | 👨‍💻 ${bold("Auteur")} : ${cfg.author}`,
      `💡 ${bold("Usage")} : ${usage}`,
    ].join("\n");

    return reply(box({ title: cfg.name.toUpperCase(), emoji: "✨", body: detail }));
  },
};
