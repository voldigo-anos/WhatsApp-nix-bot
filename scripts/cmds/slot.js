const { box, bold, line } = require("../../func/style.js");

module.exports = {
  config: {
    name: "slot",
    aliases: [],
    version: "6.1",
    author: "Christus",
    countDown: 0,
    role: 0,
    category: "game",
    description: {
      en: "🎰 Slot Machine"
    },
    guide: {
      en: "{pn} <montant>"
    }
  },

  onStart: async function ({ args, chatId, senderId, usersData, reply }) {
    const user = await usersData.get(senderId);

    const bet = parseInt(args[0]);
    if (!bet || bet <= 0) {
      return reply(box({ title: "Slot Machine", emoji: "❌", body: "Entrez un montant de mise valide.\nUtilisation: slot <montant>" }));
    }

    const isSlotAdmin = (global.NixBot?.config?.adminBot || []).map(String).includes(String(senderId));
    if (!isSlotAdmin && bet > (user.money || 0)) {
      return reply(box({ title: "Slot Machine", emoji: "💸", body: `Solde insuffisant !\nVotre solde: $${(user.money || 0).toLocaleString()}` }));
    }

    if (!isSlotAdmin && bet > 50000) {
      return reply(box({ title: "Slot Machine", emoji: "❌", body: "La mise maximum est de $50,000." }));
    }

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const slotData = (user.data && user.data.slotData) || { lastPlay: 0, count: 0 };

    if (now - slotData.lastPlay > oneHour) {
      slotData.count = 0;
      slotData.lastPlay = now;
    }

    if (slotData.count >= 10) {
      const remaining = Math.ceil((oneHour - (now - slotData.lastPlay)) / 60000);
      return reply(box({ title: "Slot Machine", emoji: "⏳", body: `Limite horaire atteinte !\nRéessayez dans ${remaining} minute(s).` }));
    }

    slotData.count++;
    const userDataObj = user.data || {};
    userDataObj.slotData = slotData;
    await usersData.set(senderId, { data: userDataObj });

    const symbols = ["🍎", "🍍", "🍇", "🍊", "🍌", "⭐", "🔥", "💎", "7️⃣"];

    const lose = Math.random() < 0.40;
    let reels;

    if (lose) {
      do {
        reels = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      } while (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);
    } else {
      const jackpot = Math.random() < 0.05;
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      if (jackpot) {
        reels = [sym, sym, sym];
      } else {
        let other;
        do { other = symbols[Math.floor(Math.random() * symbols.length)]; } while (other === sym);
        reels = [sym, sym, other].sort(() => Math.random() - 0.5);
      }
    }

    const counts = reels.reduce((a, c) => { a[c] = (a[c] || 0) + 1; return a; }, {});
    const max = Math.max(...Object.values(counts));
    const multiplier = max === 3 ? 5 : max === 2 ? 2 : 0;

    const winAmount = multiplier ? bet * multiplier : 0;
    const profit = isSlotAdmin ? winAmount : (winAmount - bet);
    const newBalance = (user.money || 0) + profit;

    await usersData.set(senderId, { money: newBalance });

    const isWin = profit > 0;
    const isJackpot = max === 3;

    let body = `[ ${reels[0]} | ${reels[1]} | ${reels[2]} ]\n${line}\n`;
    body += `👤 ${bold("Joueur")}: ${user.name || "Joueur"}\n`;
    body += `💰 ${bold("Mise")}: $${bet.toLocaleString()}\n`;

    let title, emoji;
    if (isJackpot) {
      title = "Jackpot ! x5"; emoji = "🎉";
      body += `\n✅ ${bold("Gagné")}: +$${winAmount.toLocaleString()}\n`;
    } else if (isWin) {
      title = "Paire ! x2"; emoji = "🎊";
      body += `\n✅ ${bold("Gagné")}: +$${winAmount.toLocaleString()}\n`;
    } else {
      title = "Slot Machine"; emoji = "💔";
      body += `\nAucune correspondance — meilleure chance la prochaine fois !\n`;
      body += `❌ ${bold("Perdu")}: -$${bet.toLocaleString()}\n`;
    }

    body += `💳 ${bold("Solde")}: $${newBalance.toLocaleString()}`;

    return reply(box({ title: "🎰 Slot Machine", emoji, body }));
  }
};
