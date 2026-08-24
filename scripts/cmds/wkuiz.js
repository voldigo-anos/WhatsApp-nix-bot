const axios = require("axios");
const { box, bold, line } = require("../../func/style.js");

const BASE_URL = "https://quiz-api-zd8a.onrender.com/api";
const ICONS = {
  anime: '🎌', flag: '🏁', cartoon: '📺', animaux: '🐾',
  monument: '🏛️', sport: '⚽', science: '🔬', histoire: '📖',
  cinema: '🎬', geographie: '🌍', maths: '➗', culture: '🎭',
  torf: '⚖️', general: '🎯'
};

function optionsText(options) {
  return options.map((opt, i) => `${bold(String.fromCharCode(65 + i))}. ${opt}`).join("\n");
}

function generateProgressBar(percentile) {
  const filled = Math.round((percentile || 0) / 10);
  const empty = 10 - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function getUserTitle(correct) {
  if (correct >= 50000) return '🌟 Quiz Omniscient';
  if (correct >= 25000) return '👑 Quiz Divinité';
  if (correct >= 15000) return '⚡ Quiz Titan';
  if (correct >= 10000) return '🏆 Quiz Légende';
  if (correct >= 7500) return '🎓 Grand Maître';
  if (correct >= 5000) return '👨‍🎓 Maître du Quiz';
  if (correct >= 2500) return '🔥 Expert Quiz';
  if (correct >= 1500) return '📚 Savant Quiz';
  if (correct >= 1000) return '🎯 Apprenti Quiz';
  if (correct >= 750) return '🌟 Chercheur de Connaissances';
  if (correct >= 500) return '📖 Apprenant Rapide';
  if (correct >= 250) return '🚀 Étoile Montante';
  if (correct >= 100) return '💡 Débutant';
  if (correct >= 50) return '🎪 Premiers Pas';
  if (correct >= 25) return '🌱 Nouveau Venu';
  if (correct >= 10) return '🔰 Débutant';
  if (correct >= 1) return '👶 Recrue';
  return '🆕 Nouveau Joueur';
}

async function getAvailableCategories() {
  try {
    const res = await axios.get(`${BASE_URL}/categories`);
    return (res.data || []).map(c => String(c).toLowerCase());
  } catch (e) {
    console.error("Erreur catégories:", e.message);
    return [];
  }
}

async function fetchImageBuffer(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20000, maxRedirects: 5 });
    return Buffer.from(res.data);
  } catch (e) {
    console.error("Échec téléchargement image:", url, e.message);
    return null;
  }
}

function registerReply(data) {
  global.NixBot.onReply.push(data);
}

function removeReply(messageID) {
  const idx = global.NixBot.onReply.findIndex(r => r.messageID === messageID);
  if (idx !== -1) global.NixBot.onReply.splice(idx, 1);
}

async function sendQuestion({ sock, chatId, event, senderId, commandName, title, body, imageUrl, data }) {
  const buffer = imageUrl ? await fetchImageBuffer(imageUrl) : null;
  let sentMsg;
  if (buffer) {
    sentMsg = await sock.sendMessage(chatId, { image: buffer, caption: box({ title, emoji: data.emoji || "🎯", body }) }, { quoted: event });
  } else {
    sentMsg = await sock.sendMessage(chatId, { text: box({ title, emoji: data.emoji || "🎯", body }) }, { quoted: event });
  }

  registerReply({
    commandName: "quiz",
    messageID: sentMsg.key.id,
    author: senderId,
    startTime: Date.now(),
    ...data
  });

  setTimeout(async () => {
    const found = global.NixBot.onReply.find(r => r.messageID === sentMsg.key.id);
    if (found) {
      await sock.sendMessage(chatId, {
        text: box({ title: "Temps écoulé", emoji: "⏰", body: `${bold("Bonne réponse")} : ${data.answer}` })
      }, { quoted: event }).catch(() => {});
      removeReply(sentMsg.key.id);
    }
  }, 30000);
}

async function handleDefaultView({ reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/categories`);
    const categories = res.data || [];
    const catText = categories.map(c => `${ICONS[c] || '📍'} ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");

    const body =
      `${bold("Catégories")} (${categories.length})\n\n${catText}\n\n${line}\n\n` +
      `${bold("Utilisation")}\n` +
      `• wkuiz rank - Voir votre classement\n` +
      `• wkuiz leaderboard - Voir le classement global\n` +
      `• wkuiz torf - Jouer au quiz Vrai/Faux\n` +
      `• wkuiz flag - Jouer au quiz des drapeaux\n` +
      `• wkuiz anime - Jouer au quiz anime\n` +
      `• wkuiz cartoon - Jouer au quiz dessins animés\n` +
      `• wkuiz animaux - Jouer au quiz animaux\n` +
      `• wkuiz monument - Jouer au quiz monuments\n` +
      `• wkuiz sport - Jouer au quiz sport\n\n` +
      `🎮 Utilisez: wkuiz <catégorie> pour commencer le quiz`;

    return reply(box({ title: "Quiz", emoji: "🎯", body }));
  } catch (err) {
    console.error("Erreur vue par défaut:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer les catégories. Essayez 'wkuiz help'." }));
  }
}

async function handleRank({ event, senderId, reply, usersData }) {
  try {
    const userName = event.pushName || "Joueur Anonyme";
    await axios.post(`${BASE_URL}/user/update`, { userId: senderId, name: userName }).catch(() => {});
    const res = await axios.get(`${BASE_URL}/user/${senderId}`);
    const user = res.data;

    if (!user || user.total === 0) {
      return reply(box({ title: "Profil Quiz", emoji: "❌", body: `Vous n'avez pas encore joué de quiz ! Utilisez "wkuiz random" pour commencer.\n👤 Bienvenue, ${userName} !` }));
    }

    const position = user.position ?? "N/A";
    const totalUser = user.totalUsers ?? "N/A";
    const progressBar = generateProgressBar(user.percentile ?? 0);
    const title = getUserTitle(user.correct || 0);

    const streakInfo = user.currentStreak > 0
      ? `🔥 ${bold("Série en cours")}: ${user.currentStreak}${user.currentStreak >= 5 ? ' 🚀' : ''}`
      : `🔥 ${bold("Série en cours")}: 0`;

    const bestStreakInfo = user.bestStreak > 0
      ? `🏅 ${bold("Meilleure série")}: ${user.bestStreak}${user.bestStreak >= 10 ? ' 👑' : user.bestStreak >= 5 ? ' ⭐' : ''}`
      : `🏅 ${bold("Meilleure série")}: 0`;

    const userData = await usersData.get(senderId);
    const userMoney = userData.money || 0;

    const currentXP = user.xp ?? 0;
    const xpTo1000 = Math.max(0, 1000 - currentXP);
    const xpProgress = Math.min(100, (currentXP / 1000) * 100);
    const xpProgressBar = generateProgressBar(xpProgress);

    const body =
      `👤 ${userName}\n🎖️ ${title}\n🏆 ${bold("Classement global")}: #${position}/${totalUser}\n📈 ${bold("Percentile")}: ${progressBar} ${user.percentile ?? 0}%\n\n` +
      `${bold("Statistiques")}\n` +
      `✅ Bonnes réponses: ${user.correct ?? 0}\n` +
      `❌ Mauvaises réponses: ${user.wrong ?? 0}\n` +
      `📝 Total: ${user.total ?? 0}\n` +
      `🎯 Précision: ${user.accuracy ?? 0}%\n` +
      `⚡ Temps moyen de réponse: ${(user.avgResponseTime ?? 0).toFixed(1)}s\n\n` +
      `${bold("Richesse & XP")}\n` +
      `💵 Argent: ${userMoney.toLocaleString()}\n` +
      `✨ XP: ${currentXP}/1000\n` +
      `🎯 XP restant pour 1000: ${xpTo1000}\n` +
      `${xpProgressBar} ${xpProgress.toFixed(1)}%\n\n` +
      `${bold("Info série")}\n${streakInfo}\n${bestStreakInfo}\n\n` +
      `🎯 Prochain objectif: ${user.nextMilestone || "Continuez à jouer !"}`;

    return reply(box({ title: "Profil Quiz", emoji: "🎮", body }));
  } catch (err) {
    console.error("Erreur classement:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer le classement. Réessayez plus tard." }));
  }
}

async function handleLeaderboard({ reply, args }) {
  try {
    const page = parseInt(args?.[0]) || 1;
    const res = await axios.get(`${BASE_URL}/leaderboards?page=${page}&limit=8`);
    const { rankings, stats, pagination } = res.data;

    if (!rankings || rankings.length === 0) {
      return reply(box({ title: "Classement global", emoji: "🏆", body: "Aucun joueur dans le classement. Commencez à jouer pour être le premier !" }));
    }

    const players = rankings.map((u, i) => {
      const userName = u.name || 'Joueur Anonyme';
      const position = (pagination.currentPage - 1) * 8 + i + 1;
      const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : position <= 10 ? "🏅" : "🎯";
      const title = getUserTitle(u.correct || 0);
      const accuracy = u.accuracy ?? (u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0);
      return `${crown} #${position} ${userName}\n🎖️ ${title}\n📊 ${u.correct || 0} ✅ / ${u.wrong || 0} ❌ (Précision: ${accuracy}%)\n🔥 Série: ${u.currentStreak || 0} | 🏅 Meilleure: ${u.bestStreak || 0}`;
    });

    const body =
      `${players.join('\n\n')}\n\n${line}\n\n` +
      `📖 Page ${pagination?.currentPage || 1}/${pagination?.totalPages || 1} | 👥 Total: ${stats?.totalUsers || 0}\n` +
      `🔄 Utilisez: wkuiz leaderboard <page>`;

    return reply(box({ title: "Classement global", emoji: "🏆", body }));
  } catch (err) {
    console.error("Erreur classement:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer le classement." }));
  }
}

async function handleCategories({ reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/categories`);
    const categories = res.data || [];
    const catText = categories.map(c => `${ICONS[c] || '📍'} ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");
    const body = `${catText}\n\n🎯 Utilisez: wkuiz <catégorie>\n🎲 Aléatoire: wkuiz random\n🏆 Quotidien: wkuiz daily`;
    return reply(box({ title: `Catégories du Quiz (${categories.length})`, emoji: "📚", body }));
  } catch (err) {
    console.error("Erreur catégories:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer les catégories." }));
  }
}

async function handleCategoryLeaderboard({ reply, args }) {
  try {
    const category = args[0]?.toLowerCase();
    if (!category) return reply(box({ title: "Classement catégorie", emoji: "📚", body: "Veuillez spécifier une catégorie." }));

    const page = parseInt(args[1]) || 1;
    const res = await axios.get(`${BASE_URL}/leaderboard/category/${category}?page=${page}&limit=10`);
    const { users, pagination } = res.data;

    if (!users || users.length === 0) {
      return reply(box({ title: "Classement catégorie", emoji: "🏆", body: `Aucun joueur trouvé pour la catégorie: ${category}.` }));
    }

    const topPlayers = users.map((u, i) => {
      const userName = u.name || 'Joueur Anonyme';
      const position = (pagination.currentPage - 1) * 10 + i + 1;
      const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
      const title = getUserTitle(u.correct || 0);
      return `${crown} #${position} ${userName}\n🎖️ ${title}\n📊 ${u.correct || 0}/${u.total || 0} (${u.accuracy || 0}%)`;
    }).join('\n\n');

    const body = `${topPlayers}\n\n📖 Page ${pagination.currentPage}/${pagination.totalPages}\n👥 Total joueurs: ${pagination.totalUsers}`;
    return reply(box({ title: `Classement: ${category.charAt(0).toUpperCase() + category.slice(1)}`, emoji: "🏆", body }));
  } catch (err) {
    console.error("Erreur classement catégorie:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer le classement de la catégorie." }));
  }
}

async function handleDailyChallenge({ sock, chatId, event, senderId, reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/challenge/daily?userId=${senderId}`);
    const { question, challengeDate, reward, streak } = res.data;

    const body = `📅 ${challengeDate}\n🎯 Récompense bonus: +${reward} XP\n🔥 Série quotidienne: ${streak}\n\n❓ ${question.question}\n\n${optionsText(question.options)}\n\n⏰ 30 secondes pour répondre !`;

    await sendQuestion({
      sock, chatId, event, senderId, title: "Défi quotidien", body,
      data: { emoji: "🌟", answer: question.answer, questionId: question._id, isDailyChallenge: true, bonusReward: reward, options: question.options }
    });
  } catch (err) {
    console.error("Erreur défi quotidien:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de créer le défi quotidien." }));
  }
}

async function handleTrueOrFalse({ sock, chatId, event, senderId, reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=torf&userId=${senderId}`);
    const { _id, question, answer } = res.data;
    const correctAnswer = String(answer).toUpperCase();
    const body = `💭 ${bold("Question")}: ${question}\n\nRépondez par ${bold("VRAI")} ou ${bold("FAUX")}\n⏰ 30 secondes pour répondre`;

    await sendQuestion({
      sock, chatId, event, senderId, title: "Quiz (Vrai/Faux)", body,
      data: { emoji: "⚖️", answer: correctAnswer, questionId: _id, isTorf: true }
    });
  } catch (err) {
    console.error("Erreur Vrai/Faux:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de créer la question Vrai/Faux." }));
  }
}

async function handleFlagQuiz({ sock, chatId, event, senderId, reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=flag&userId=${senderId}`, { timeout: 25000 });
    const { _id, options, answer, imageUrl } = res.data;
    if (!Array.isArray(options) || !options.length) {
      return reply(box({ title: "Quiz drapeaux", emoji: "❌", body: "Aucune question sur les drapeaux disponible pour le moment." }));
    }
    const body = `🌍 Devinez le pays de ce drapeau :\n\n${optionsText(options)}\n\n⏰ 30 secondes pour répondre.`;
    await sendQuestion({
      sock, chatId, event, senderId, title: "Quiz drapeaux", body, imageUrl,
      data: { emoji: "🏁", answer, options, questionId: _id, isFlag: true, reward: 12000 }
    });
  } catch (err) {
    console.error("Erreur quiz drapeaux:", err.message);
    const detail = err?.response?.data?.error || err.message || "erreur inconnue";
    return reply(box({ title: "Erreur", emoji: "❌", body: `Impossible de créer le quiz drapeaux.\n📄 Raison: ${detail}` }));
  }
}

async function handleAnimeQuiz({ sock, chatId, event, senderId, reply }) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=anime&userId=${senderId}`, { timeout: 25000 });
    const { _id, question, options, answer, imageUrl, hint } = res.data;
    if (!Array.isArray(options) || !options.length) {
      return reply(box({ title: "Quiz Anime", emoji: "❌", body: "Aucune question anime disponible pour le moment." }));
    }
    const body = `❔ ${bold("Indice")}: ${hint || question}\n\n${optionsText(options)}\n\n⏰ 30 secondes\n🎯 Défi de reconnaissance de personnage !`;
    await sendQuestion({
      sock, chatId, event, senderId, title: "Quiz Anime", body, imageUrl,
      data: { emoji: "🎌", answer, options, questionId: _id, isAnime: true, reward: 15000 }
    });
  } catch (err) {
    console.error("Erreur quiz anime:", err.message);
    const detail = err?.response?.data?.error || err.message || "erreur inconnue";
    return reply(box({ title: "Erreur", emoji: "❌", body: `Impossible de créer le quiz anime.\n📄 Raison: ${detail}` }));
  }
}

async function handleImageQuiz({ sock, chatId, event, senderId, reply, category, title, emoji }) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=${category}&userId=${senderId}`, { timeout: 25000 });
    const { _id, question, options, answer, imageUrl, hint } = res.data;
    if (!Array.isArray(options) || !options.length) {
      return reply(box({ title, emoji: "❌", body: `Aucune question « ${category} » disponible pour le moment.` }));
    }
    const body = `❔ ${hint || question}\n\n${optionsText(options)}\n\n⏰ 30 secondes pour répondre (A/B/C/D)`;
    await sendQuestion({
      sock, chatId, event, senderId, title, body, imageUrl,
      data: { emoji, answer, options, questionId: _id, isImage: true, category, reward: 12000 }
    });
  } catch (err) {
    console.error(`Erreur quiz ${category}:`, err.message);
    const detail = err?.response?.data?.error || err.message || "erreur inconnue";
    return reply(box({ title, emoji: "❌", body: `Impossible de créer le quiz ${category}.\n📄 Raison: ${detail}` }));
  }
}

async function handleQuiz({ sock, chatId, event, senderId, reply, args, forcedDifficulty }) {
  try {
    const userName = event.pushName || "Joueur Anonyme";
    await axios.post(`${BASE_URL}/user/update`, { userId: senderId, name: userName }).catch(() => {});

    const category = args[0]?.toLowerCase() || "";
    let queryParams = { userId: senderId };
    if (category && category !== "random") queryParams.category = category;
    if (forcedDifficulty) queryParams.difficulty = forcedDifficulty;

    const res = await axios.get(`${BASE_URL}/question`, { params: queryParams });
    const { _id, question, options, answer, category: qCategory, difficulty, imageUrl, hint } = res.data;

    const body =
      `📚 ${bold("Catégorie")}: ${qCategory?.charAt(0).toUpperCase() + qCategory?.slice(1) || "Aléatoire"}\n` +
      `🎚️ ${bold("Difficulté")}: ${difficulty?.charAt(0).toUpperCase() + difficulty?.slice(1) || "Moyen"}\n` +
      `❓ ${bold("Question")}: ${hint || question}\n\n${optionsText(options)}\n\n⏰ Vous avez 30 secondes pour répondre (A/B/C/D):`;

    await sendQuestion({
      sock, chatId, event, senderId, title: "Quiz Challenge", body, imageUrl,
      data: { emoji: "🎯", answer, options, questionId: _id, difficulty, category: qCategory, isImage: !!imageUrl }
    });
  } catch (err) {
    console.error("Erreur du quiz:", err.message);
    return reply(box({ title: "Erreur", emoji: "❌", body: "Impossible de récupérer une question. Essayez 'wkuiz categories'." }));
  }
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["wkuiz", "kuiz"],
    version: "4.0",
    author: "Christus",
    countDown: 0,
    role: 0,
    category: "game",
    description: {
      en: "Jeu de quiz avancé avec 6000+ questions, images, succès et classements"
    },
    guide: {
      en: `{pn} <catégorie>\n\n📚 Catégories disponibles :\n🎌 anime, 🏁 flag, 📺 cartoon, 🐾 animaux, 🏛️ monument, ⚽ sport, 🔬 science, 📖 histoire, 🎬 cinema, 🌍 geographie, ➗ maths, 🎭 culture, ⚖️ torf`
    }
  },

  onStart: async function (context) {
    const { sock, chatId, args, event, senderId, reply, usersData } = context;
    try {
      const command = args[0]?.toLowerCase();

      if (!args[0] || command === "help") {
        return await handleDefaultView({ reply });
      }

      switch (command) {
        case "rank":
        case "profile":
          return await handleRank({ event, senderId, reply, usersData });
        case "leaderboard":
        case "lb":
          return await handleLeaderboard({ reply, args: args.slice(1) });
        case "category":
          if (args.length > 1) {
            return await handleCategoryLeaderboard({ reply, args: args.slice(1) });
          }
          return await handleCategories({ reply });
        case "daily":
          return await handleDailyChallenge({ sock, chatId, event, senderId, reply });
        case "torf":
          return await handleTrueOrFalse({ sock, chatId, event, senderId, reply });
        case "flag":
          return await handleFlagQuiz({ sock, chatId, event, senderId, reply });
        case "anime":
          return await handleAnimeQuiz({ sock, chatId, event, senderId, reply });
        case "cartoon":
        case "dessin":
        case "dessins":
        case "kids":
          return await handleImageQuiz({ sock, chatId, event, senderId, reply, category: "cartoon", title: "Quiz Dessins Animés", emoji: "📺" });
        case "animaux":
        case "animal":
          return await handleImageQuiz({ sock, chatId, event, senderId, reply, category: "animaux", title: "Quiz Animaux", emoji: "🐾" });
        case "monument":
        case "monuments":
          return await handleImageQuiz({ sock, chatId, event, senderId, reply, category: "monument", title: "Quiz Monuments", emoji: "🏛️" });
        case "sport":
        case "sports":
          return await handleImageQuiz({ sock, chatId, event, senderId, reply, category: "sport", title: "Quiz Sport", emoji: "⚽" });
        case "cinema":
        case "film":
        case "films":
          return await handleImageQuiz({ sock, chatId, event, senderId, reply, category: "cinema", title: "Quiz Cinéma", emoji: "🎬" });
        case "hard":
          return await handleQuiz({ sock, chatId, event, senderId, reply, args: ["general"], forcedDifficulty: "hard" });
        case "medium":
          return await handleQuiz({ sock, chatId, event, senderId, reply, args: ["general"], forcedDifficulty: "medium" });
        case "easy":
          return await handleQuiz({ sock, chatId, event, senderId, reply, args: ["general"], forcedDifficulty: "easy" });
        case "random":
          return await handleQuiz({ sock, chatId, event, senderId, reply, args: [] });
        default: {
          const categories = await getAvailableCategories();
          if (categories.includes(command)) {
            return await handleQuiz({ sock, chatId, event, senderId, reply, args: [command] });
          }
          return await handleDefaultView({ reply });
        }
      }
    } catch (err) {
      console.error("Erreur de démarrage du quiz:", err);
      return reply(box({ title: "Erreur", emoji: "❌", body: "Une erreur est survenue, réessayez." }));
    }
  },

  onReply: async function ({ sock, chatId, event, senderId, reply, usersData }) {
    const repliedId = event.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!repliedId) return;

    const data = global.NixBot.onReply.find(r => r.commandName === "quiz" && r.messageID === repliedId);
    if (!data) return;
    if (data.author !== senderId) return;

    const text = (event.message?.conversation || event.message?.extendedTextMessage?.text || "").trim();

    try {
      const timeSpent = (Date.now() - data.startTime) / 1000;
      if (timeSpent > 30) {
        removeReply(data.messageID);
        return reply(box({ title: "Temps écoulé", emoji: "⏰", body: "Trop tard !" }));
      }

      let userAnswer;
      let isCorrect;

      if (data.isTorf) {
        const ans = text.toUpperCase();
        if (!["VRAI", "FAUX", "V", "F"].includes(ans)) {
          return reply(box({ title: "Quiz", emoji: "❌", body: "Veuillez répondre par VRAI ou FAUX uniquement !" }));
        }
        userAnswer = (ans === "VRAI" || ans === "V") ? "A" : "B";
        isCorrect = userAnswer === data.answer;
      } else {
        const ans = text.toUpperCase();
        if (!["A", "B", "C", "D"].includes(ans)) {
          return reply(box({ title: "Quiz", emoji: "❌", body: "Veuillez répondre avec A, B, C ou D uniquement !" }));
        }
        if ((data.isFlag || data.isAnime || data.isImage || data.isDailyChallenge) && data.options) {
          const optionIndex = ans.charCodeAt(0) - 65;
          userAnswer = optionIndex >= 0 && optionIndex < data.options.length ? data.options[optionIndex] : ans;
        } else {
          userAnswer = ans;
        }
        isCorrect = String(userAnswer).toLowerCase() === String(data.answer).toLowerCase();
      }

      const userName = event.pushName || "Joueur Anonyme";
      let user = {};
      try {
        const answerData = { userId: senderId, questionId: data.questionId, answer: userAnswer, timeSpent, userName };
        const res = await axios.post(`${BASE_URL}/answer`, answerData);
        user = res.data?.user || {};
      } catch (e) {
        console.error("Erreur envoi réponse:", e.message);
      }

      const userData = await usersData.get(senderId);

      let responseMsg;
      if (isCorrect) {
        let baseMoneyReward = 10000;
        if (data.difficulty === 'hard') baseMoneyReward = 15000;
        if (data.difficulty === 'easy') baseMoneyReward = 7500;
        if (data.isFlag) baseMoneyReward = 12000;
        if (data.isAnime) baseMoneyReward = 15000;
        if (data.isImage) baseMoneyReward = 12000;
        if (data.isDailyChallenge) baseMoneyReward = 20000;
        if (data.isTorf) baseMoneyReward = 10000;

        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;
        const xpGained = user.xpGained || 15;

        await usersData.set(senderId, {
          money: (userData.money || 0) + totalMoneyReward,
          exp: (userData.exp || 0) + xpGained
        });

        responseMsg = box({
          title: "Bonne réponse !", emoji: "🎉",
          body: `💵 ${bold("Argent")}: +${totalMoneyReward.toLocaleString()}\n` +
                `✨ ${bold("XP")}: +${xpGained}\n` +
                `📊 ${bold("Score")}: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
                `🔥 ${bold("Série")}: ${user.currentStreak || 0}\n` +
                `⚡ ${bold("Temps de réponse")}: ${timeSpent.toFixed(1)}s\n` +
                `👤 ${userName}`
        });
      } else {
        responseMsg = box({
          title: "Mauvaise réponse", emoji: "❌",
          body: `🎯 ${bold("Bonne réponse")}: ${data.answer}\n` +
                `📊 ${bold("Score")}: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
                `💔 Série réinitialisée\n👤 ${userName}`
        });
      }

      await reply(responseMsg);

      if (user.achievements && user.achievements.length > 0) {
        const achievementMsg = user.achievements.map(ach => `🏆 ${ach}`).join('\n');
        const freshData = await usersData.get(senderId);
        await usersData.set(senderId, { money: (freshData.money || 0) + 50000, exp: (freshData.exp || 0) + 100 });
        await reply(box({ title: "Succès débloqué !", emoji: "🏆", body: `${achievementMsg}\n💰 +50 000 pièces bonus !\n✨ +100 XP bonus !` }));
      }

      removeReply(data.messageID);
    } catch (err) {
      console.error("Erreur de réponse quiz:", err);
      const errorMsg = err.response?.data?.error || err.message || "Erreur inconnue";
      return reply(box({ title: "Erreur", emoji: "❌", body: `Erreur lors du traitement de votre réponse: ${errorMsg}` }));
    }
  }
};
