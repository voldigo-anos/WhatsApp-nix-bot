const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const BASE_URL = 'https://quiz-api-eosin-xi.vercel.app/api';

// Helper pour télécharger une image depuis une URL et retourner un buffer
async function getBufferFromURL(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Erreur de téléchargement image:', error.message);
    return null;
  }
}

// Fonctions de traduction
async function translate(text, targetLang = 'fr') {
  if (!text || text.includes('http')) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url);
    return res.data[0].map(segment => segment[0]).join("");
  } catch (e) {
    return text;
  }
}

async function translateQuestion(questionData, targetLang = 'fr') {
  try {
    if (questionData.category === 'flag' || questionData.question?.includes('http')) {
      return questionData;
    }

    const [translatedQuestion, translatedCategory, translatedDifficulty] = await Promise.all([
      translate(questionData.question, targetLang),
      translate(questionData.category || '', targetLang),
      translate(questionData.difficulty || '', targetLang)
    ]);

    return {
      ...questionData,
      question: translatedQuestion || questionData.question,
      options: questionData.options,
      category: translatedCategory || questionData.category,
      difficulty: translatedDifficulty || questionData.difficulty,
      originalAnswer: questionData.answer
    };
  } catch (error) {
    console.error("Translation error:", error);
    return questionData;
  }
}

function generateProgressBar(percentile) {
  const filled = Math.round(percentile / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
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
    return res.data.map(cat => cat.toLowerCase());
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["q", "qz", "kuiz"],
    version: "4.0.2",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Advanced quiz game with 6000+ questions, images, achievements and leaderboards"
    },
    category: "game",
    nixPrefix: true,
    guide: {
      en: "   {pn} <category> - Start a quiz in a category\n"
        + "   {pn} rank - View your profile\n"
        + "   {pn} lb - Leaderboard\n"
        + "   {pn} daily - Daily challenge\n"
        + "   {pn} torf - True/False quiz\n"
        + "   {pn} flag - Flag quiz\n"
        + "   {pn} anime - Anime quiz\n"
        + "   {pn} cartoon - Cartoon quiz\n"
        + "   {pn} animaux - Animals quiz\n"
        + "   {pn} monument - Monuments quiz\n"
        + "   {pn} sport - Sports quiz\n"
        + "   {pn} cinema - Cinema quiz"
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, prefix, commandName, usersData }) {
    const command = args[0]?.toLowerCase();
    const userId = senderId;
    const userName = event.pushName || "Joueur";

    try {
      await axios.post(`${BASE_URL}/user/update`, {
        userId: userId,
        name: userName
      }).catch(() => {});

      if (!args[0] || command === "help") {
        return handleDefaultView(chatId, sock, reply, event);
      }

      switch (command) {
        case "rank":
        case "profile":
        case "rang":
        case "profil":
          return await handleRank(chatId, event, sock, userId, userName, reply, usersData);
          
        case "leaderboard":
        case "lb":
        case "classement":
          return await handleLeaderboard(chatId, event, sock, args.slice(1), reply);
          
        case "category":
        case "categorie":
          if (args.length > 1) {
            return await handleCategoryLeaderboard(chatId, event, sock, args.slice(1), reply);
          }
          return await handleCategories(chatId, sock, reply, event);
          
        case "daily":
        case "quotidien":
          return await handleDailyChallenge(chatId, event, sock, userId, userName, reply);
          
        case "torf":
        case "vrai/faux":
          return await handleTrueOrFalse(chatId, event, sock, userId, userName, reply);
          
        case "flag":
        case "drapeau":
          return await handleFlagQuiz(chatId, event, sock, userId, userName, reply);
          
        case "anime":
          return await handleAnimeQuiz(chatId, event, sock, userId, userName, reply);
          
        case "cartoon":
        case "dessin":
        case "dessins":
        case "kids":
          return await handleImageQuiz(chatId, event, sock, userId, userName, "cartoon", "📺 𝗤𝘂𝗶𝘇 𝗗𝗲𝘀𝘀𝗶𝗻𝘀 𝗔𝗻𝗶𝗺é𝘀", reply);
          
        case "animaux":
        case "animal":
          return await handleImageQuiz(chatId, event, sock, userId, userName, "animaux", "🐾 𝗤𝘂𝗶𝘇 𝗔𝗻𝗶𝗺𝗮𝘂𝘅", reply);
          
        case "monument":
        case "monuments":
          return await handleImageQuiz(chatId, event, sock, userId, userName, "monument", "🏛️ 𝗤𝘂𝗶𝘇 𝗠𝗼𝗻𝘂𝗺𝗲𝗻𝘁𝘀", reply);
          
        case "sport":
        case "sports":
          return await handleImageQuiz(chatId, event, sock, userId, userName, "sport", "⚽ 𝗤𝘂𝗶𝘇 𝗦𝗽𝗼𝗿𝘁", reply);
          
        case "cinema":
        case "film":
        case "films":
          return await handleImageQuiz(chatId, event, sock, userId, userName, "cinema", "🎬 𝗤𝘂𝗶𝘇 𝗖𝗶𝗻é𝗺𝗮", reply);
          
        case "hard":
        case "difficile":
          return await handleQuiz(chatId, event, sock, userId, userName, [], reply, "hard");
          
        case "medium":
        case "moyen":
          return await handleQuiz(chatId, event, sock, userId, userName, [], reply, "medium");
          
        case "easy":
        case "facile":
          return await handleQuiz(chatId, event, sock, userId, userName, [], reply, "easy");
          
        case "random":
        case "aleatoire":
          return await handleQuiz(chatId, event, sock, userId, userName, [], reply);
          
        default:
          const categories = await getAvailableCategories();
          if (categories.includes(command)) {
            return await handleQuiz(chatId, event, sock, userId, userName, [command], reply);
          } else {
            return handleDefaultView(chatId, sock, reply, event);
          }
      }
    } catch (err) {
      console.error("Quiz start error:", err);
      return reply("⚠️ Erreur, réessayez plus tard.");
    }
  },

  onReply: async function ({ sock, chatId, message, senderId, event, usersData }) {
    const repliedMsgId = event.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!repliedMsgId) return;

    const data = global.NixBot.onReply.find(
      r => r.commandName === "quiz" && r.author === senderId && r.messageID === repliedMsgId
    );
    if (!data) return;

    try {
      const ans = (message.message?.conversation || message.message?.extendedTextMessage?.text || "").trim().toUpperCase();
      if (!["A", "B", "C", "D"].includes(ans)) {
        return sock.sendMessage(chatId, {
          text: "❌ Veuillez répondre avec A, B, C ou D uniquement !"
        }, { quoted: event });
      }

      const timeSpent = (Date.now() - data.startTime) / 1000;
      if (timeSpent > 30) {
        const idx = global.NixBot.onReply.findIndex(r => r.messageID === data.messageID);
        if (idx !== -1) global.NixBot.onReply.splice(idx, 1);
        return sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
        }, { quoted: event });
      }

      const userName = event.pushName || "Joueur";

      let userAnswer = ans;
      if ((data.isFlag || data.isAnime || data.isImage) && data.options) {
        const optionIndex = ans.charCodeAt(0) - 65;
        if (optionIndex >= 0 && optionIndex < data.options.length) {
          userAnswer = data.options[optionIndex];
        }
      }

      const answerData = {
        userId: senderId,
        questionId: data.questionId,
        answer: userAnswer,
        timeSpent,
        userName
      };

      const res = await axios.post(`${BASE_URL}/answer`, answerData);

      if (!res.data) {
        throw new Error('Aucune donnée reçue');
      }

      const { result, user } = res.data;
      let responseMsg;

      let userData = await usersData.get(senderId);
      let currentMoney = Number(userData.money) || 0;

      if (result === "correct") {
        let baseMoneyReward = 10000;
        if (data.difficulty === 'hard') baseMoneyReward = 15000;
        if (data.difficulty === 'easy') baseMoneyReward = 7500;
        if (data.isFlag) baseMoneyReward = 12000;
        if (data.isAnime) baseMoneyReward = 15000;
        if (data.isImage) baseMoneyReward = 12000;
        if (data.isDaily) baseMoneyReward = 20000;

        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;

        await usersData.set(senderId, {
          ...userData,
          money: currentMoney + totalMoneyReward
        });

        userData = await usersData.get(senderId);
        currentMoney = userData.money;

        const difficultyBonus = data.difficulty === 'hard' ? ' 🔥' : data.difficulty === 'easy' ? ' ⭐' : '';
        const streakBonus2 = (user.currentStreak || 0) >= 5 ? ` 🚀 ${user.currentStreak}x série !` : '';
        const flagBonus = data.isFlag ? ' 🏁' : '';
        const animeBonus = data.isAnime ? ' 🎌' : '';
        const imageBonus = data.isImage ? ' 🖼️' : '';
        const dailyBonus = data.isDaily ? ' 🌟' : '';
        
        responseMsg = 
          `🎉 𝗕𝗼𝗻𝗻𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲 !\n` +
          `━━━━━━━━━━\n\n` +
          `💰 𝗔𝗿𝗴𝗲𝗻𝘁: +${totalMoneyReward.toLocaleString()}\n` +
          `✨ 𝗫𝗣: +${user.xpGained || 15}\n` +
          `📊 𝗦𝗰𝗼𝗿𝗲: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `🔥 𝗦𝗲́𝗿𝗶𝗲: ${user.currentStreak || 0}\n` +
          `⚡ 𝗧𝗲𝗺𝗽𝘀: ${timeSpent.toFixed(1)}s\n` +
          `🎯 𝗫𝗣 𝗧𝗼𝘁𝗮𝗹: ${user.xp || 0}/1000\n` +
          `💰 𝗦𝗼𝗹𝗱𝗲: ${currentMoney.toLocaleString()}\n` +
          `👤 ${userName}` + difficultyBonus + streakBonus2 + flagBonus + animeBonus + imageBonus + dailyBonus;
      } else {
        responseMsg = 
          `❌ 𝗠𝗮𝘂𝘃𝗮𝗶𝘀𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲\n` +
          `━━━━━━━━━━\n\n` +
          `🎯 𝗕𝗼𝗻𝗻𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲: ${data.correctAnswer}\n` +
          `📊 𝗦𝗰𝗼𝗿𝗲: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `💔 𝗦𝗲́𝗿𝗶𝗲 𝗿𝗲́𝗶𝗻𝗶𝘁𝗶𝗮𝗹𝗶𝘀𝗲́𝗲\n` +
          `👤 ${userName}` + (data.isFlag ? ' 🏁' : '') + (data.isAnime ? ' 🎌' : '') + (data.isImage ? ' 🖼️' : '');
      }

      await sock.sendMessage(chatId, { text: responseMsg }, { quoted: event });

      if (user.achievements && user.achievements.length > 0) {
        userData = await usersData.get(senderId);
        await usersData.set(senderId, {
          ...userData,
          money: (userData.money || 0) + 50000
        });
        
        const achievementMsg = user.achievements.map(ach => `🏆 ${ach}`).join('\n');
        await sock.sendMessage(chatId, {
          text: `🏆 𝗦𝘂𝗰𝗰𝗲̀𝘀 𝗱𝗲́𝗯𝗹𝗼𝗾𝘂𝗲́ !\n${achievementMsg}\n💰 +50 000 pièces bonus !\n✨ +100 XP bonus !`
        }, { quoted: event });
      }

      const idx = global.NixBot.onReply.findIndex(r => r.messageID === data.messageID);
      if (idx !== -1) global.NixBot.onReply.splice(idx, 1);
      
    } catch (err) {
      console.error("Answer error:", err);
      const errorMsg = err.response?.data?.error || err.message || "Erreur inconnue";
      sock.sendMessage(chatId, {
        text: `⚠️ Erreur lors du traitement: ${errorMsg}`
      }, { quoted: event });
    }
  }
};

// ==================== HANDLERS ====================

async function handleDefaultView(chatId, sock, reply, event) {
  try {
    const res = await axios.get(`${BASE_URL}/categories`);
    const categories = res.data;

    const icons = {
      anime: '🎌', flag: '🏁', cartoon: '📺', animaux: '🐾',
      monument: '🏛️', sport: '⚽', science: '🔬', histoire: '📖',
      cinema: '🎬', geographie: '🌍', maths: '➗', culture: '🎭',
      torf: '⚖️', general: '🎯'
    };

    const catText = categories.map(c => 
      `${icons[c] || '📍'} ${c.charAt(0).toUpperCase() + c.slice(1)}`
    ).join("\n");

    const msg = 
      `🎯 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n` +
      `📚 𝗖𝗮𝘁𝗲́𝗴𝗼𝗿𝗶𝗲𝘀 (${categories.length})\n\n${catText}\n\n` +
      `━━━━━━━━━\n\n` +
      `🏆 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻\n` +
      `• /quiz rang - Voir votre rang\n` +
      `• /quiz classement - Voir le classement\n` +
      `• /quiz vrai/faux - Jouer au quiz Vrai/Faux\n` +
      `• /quiz drapeau - Jouer au quiz de drapeaux\n` +
      `• /quiz anime - Jouer au quiz de personnages anime\n` +
      `• /quiz cartoon - Jouer au quiz dessins animés\n` +
      `• /quiz animaux - Jouer au quiz animaux\n` +
      `• /quiz monument - Jouer au quiz monuments\n` +
      `• /quiz sport - Jouer au quiz sport\n\n` +
      `🎮 Utilisez: /quiz <catégorie> pour commencer`;

    await sock.sendMessage(chatId, { text: msg }, { quoted: event });
  } catch (err) {
    console.error("Default view error:", err);
    reply("⚠️ Impossible de récupérer les catégories. Essayez '/quiz help' pour les commandes.");
  }
}

async function handleRank(chatId, event, sock, userId, userName, reply, usersData) {
  try {
    const res = await axios.get(`${BASE_URL}/user/${userId}`);
    const user = res.data;

    if (!user || user.total === 0) {
      return reply(`❌ Vous n'avez pas encore joué au quiz ! Utilisez '/quiz aléatoire' pour commencer.\n👤 Bienvenue, ${userName}!`);
    }

    const position = user.position ?? "N/A";
    const totalUser = user.totalUsers ?? "N/A";
    const progressBar = generateProgressBar(user.percentile ?? 0);
    const title = getUserTitle(user.correct || 0);

    const userData = await usersData.get(userId);
    const userMoney = Number(userData.money) || 0;

    const currentXP = user.xp ?? 0;
    const xpProgress = Math.min(100, (currentXP / 1000) * 100);
    const xpProgressBar = generateProgressBar(xpProgress);

    const streakInfo = user.currentStreak > 0 ? 
      `🔥 𝗦𝗲́𝗿𝗶𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀: ${user.currentStreak}${user.currentStreak >= 5 ? ' 🚀' : ''}` :
      `🔥 𝗦𝗲́𝗿𝗶𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀: 0`;

    const bestStreakInfo = user.bestStreak > 0 ?
      `🏅 𝗠𝗲𝗶𝗹𝗹𝗲𝘂𝗿𝗲 𝘀𝗲́𝗿𝗶𝗲: ${user.bestStreak}${user.bestStreak >= 10 ? ' 👑' : user.bestStreak >= 5 ? ' ⭐' : ''}` :
      `🏅 𝗠𝗲𝗶𝗹𝗹𝗲𝘂𝗿𝗲 𝘀𝗲́𝗿𝗶𝗲: 0`;

    const msg =
      `🎮 𝗣𝗿𝗼𝗳𝗶𝗹 𝗤𝘂𝗶𝘇\n━━━━━━━━━\n\n` +
      `👤 ${userName}\n` +
      `🎖️ ${title}\n` +
      `🏆 𝗥𝗮𝗻𝗴 𝗴𝗹𝗼𝗯𝗮𝗹: #${position}/${totalUser}\n` +
      `📈 𝗣𝗲𝗿𝗰𝗲𝗻𝘁𝗶𝗹𝗲: ${progressBar} ${user.percentile ?? 0}%\n\n` +
      `📊 𝗦𝘁𝗮𝘁𝗶𝘀𝘁𝗶𝗾𝘂𝗲𝘀\n` +
      `✅ 𝗖𝗼𝗿𝗿𝗲𝗰𝘁: ${user.correct ?? 0}\n` +
      `❌ 𝗜𝗻𝗰𝗼𝗿𝗿𝗲𝗰𝘁: ${user.wrong ?? 0}\n` +
      `📝 𝗧𝗼𝘁𝗮𝗹: ${user.total ?? 0}\n` +
      `🎯 𝗣𝗿𝗲́𝗰𝗶𝘀𝗶𝗼𝗻: ${user.accuracy ?? 0}%\n` +
      `⚡ 𝗧𝗲𝗺𝗽𝘀 𝗠𝗼𝘆𝗲𝗻: ${(user.avgResponseTime ?? 0).toFixed(1)}s\n\n` +
      `💰 𝗥𝗶𝗰𝗵𝗲𝘀𝘀𝗲 & 𝗫𝗣\n` +
      `💵 𝗔𝗿𝗴𝗲𝗻𝘁: ${userMoney.toLocaleString()}\n` +
      `✨ 𝗫𝗣: ${currentXP}/1000\n` +
      `${xpProgressBar} ${xpProgress.toFixed(1)}%\n\n` +
      `🔥 𝗜𝗻𝗳𝗼 𝗦𝗲́𝗿𝗶𝗲\n` +
      `${streakInfo}\n` +
      `${bestStreakInfo}\n\n` +
      `🎯 𝗣𝗿𝗼𝗰𝗵𝗮𝗶𝗻 𝗼𝗯𝗷𝗲𝗰𝘁𝗶𝗳: ${user.nextMilestone || "Continuez à jouer !"}`;

    await sock.sendMessage(chatId, { text: msg }, { quoted: event });
  } catch (err) {
    console.error("Rank error:", err);
    reply("⚠️ Impossible de récupérer votre rang. Veuillez réessayer plus tard.");
  }
}

async function handleLeaderboard(chatId, event, sock, args, reply) {
  try {
    const page = parseInt(args?.[0]) || 1;
    const res = await axios.get(`${BASE_URL}/leaderboards?page=${page}&limit=8`);
    const { rankings, stats, pagination } = res.data;

    if (!rankings || rankings.length === 0) {
      return reply("🏆 Aucun joueur trouvé dans le classement. Commencez à jouer pour être le premier !");
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
    const currentTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC'
    });

    const players = rankings.map((u, i) => {
      const position = (pagination.currentPage - 1) * 8 + i + 1;
      const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : position <= 10 ? "🏅" : "🎯";
      const title = getUserTitle(u.correct || 0);
      const accuracy = u.accuracy ?? (u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0);
      const level = u.level ?? Math.floor((u.correct || 0) / 50) + 1;
      const xp = u.xp ?? (u.correct || 0) * 10;
      
      return `${crown} #${position} ${u.name || 'Joueur Anonyme'}\n` +
             `🎖️ ${title} | 🌟 Nv.${level} | ✨ XP: ${xp.toLocaleString()}\n` +
             `📊 ${u.correct || 0} ✅ / ${u.wrong || 0} ❌ (${accuracy}%)\n` +
             `🔥 Série: ${u.currentStreak || 0} | 🏅 Meilleure: ${u.bestStreak || 0}\n` +
             `⚡ Temps moyen: ${u.avgResponseTime?.toFixed(2) || 'N/A'}s`;
    });

    const msg = 
      `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁 𝗚𝗹𝗼𝗯𝗮𝗹\n━━━━━━━━━\n\n` +
      `📅 ${currentDate}\n⏰ ${currentTime} UTC\n\n` +
      `━━━━━━━━━\n\n${players.join('\n\n')}\n\n` +
      `📖 Page ${pagination?.currentPage || 1}/${pagination?.totalPages || 1} | 👥 Total: ${stats?.totalUsers || 0}`;

    await sock.sendMessage(chatId, { text: msg }, { quoted: event });
  } catch (err) {
    console.error("Leaderboard error:", err);
    reply("⚠️ Impossible de récupérer le classement.");
  }
}

async function handleCategories(chatId, sock, reply, event) {
  try {
    const res = await axios.get(`${BASE_URL}/categories`);
    const categories = res.data;

    const icons = {
      anime: '🎌', flag: '🏁', cartoon: '📺', animaux: '🐾',
      monument: '🏛️', sport: '⚽', science: '🔬', histoire: '📖',
      cinema: '🎬', geographie: '🌍', maths: '➗', culture: '🎭',
      torf: '⚖️', general: '🎯'
    };

    const catText = categories.map(c => 
      `${icons[c] || '📍'} ${c.charAt(0).toUpperCase() + c.slice(1)}`
    ).join("\n");

    const msg = 
      `📚 𝗖𝗮𝘁𝗲́𝗴𝗼𝗿𝗶𝗲𝘀 𝗱𝘂 𝗤𝘂𝗶𝘇 (${categories.length})\n━━━━━━━━\n\n${catText}\n\n` +
      `🎯 Utilisez: /quiz <catégorie>\n` +
      `🎲 Aléatoire: /quiz aléatoire\n` +
      `🏆 Quotidien: /quiz quotidien\n` +
      `🌟 Spéciaux: /quiz vrai/faux, /quiz drapeau, /quiz anime\n` +
      `🐾 Quiz animaux: /quiz animaux\n` +
      `🏛️ Quiz monuments: /quiz monument\n` +
      `⚽ Quiz sport: /quiz sport`;

    await sock.sendMessage(chatId, { text: msg }, { quoted: event });
  } catch (err) {
    console.error("Categories error:", err);
    reply("⚠️ Impossible de récupérer les catégories.");
  }
}

async function handleCategoryLeaderboard(chatId, event, sock, args, reply) {
  try {
    const category = args[0]?.toLowerCase();
    if (!category) {
      return reply("📚 Veuillez spécifier une catégorie pour voir le classement.");
    }

    const page = parseInt(args[1]) || 1;
    const res = await axios.get(`${BASE_URL}/leaderboard/category/${category}?page=${page}&limit=10`);
    const { users, pagination } = res.data;

    if (!users || users.length === 0) {
      return reply(`🏆 Aucun joueur trouvé pour la catégorie : ${category}.`);
    }

    const players = users.map((u, i) => {
      const position = (pagination.currentPage - 1) * 10 + i + 1;
      const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
      const title = getUserTitle(u.correct || 0);
      return `${crown} #${position} ${u.name || 'Joueur Anonyme'}\n🎖️ ${title}\n📊 ${u.correct || 0}/${u.total || 0} (${u.accuracy || 0}%)`;
    });

    const msg = 
      `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁 : ${category.charAt(0).toUpperCase() + category.slice(1)}\n━━━━━━━━━\n\n${players.join('\n\n')}\n\n` +
      `📖 Page ${pagination.currentPage}/${pagination.totalPages}\n` +
      `👥 Total joueurs: ${pagination.totalUsers}`;

    await sock.sendMessage(chatId, { text: msg }, { quoted: event });
  } catch (err) {
    console.error("Category leaderboard error:", err);
    reply("⚠️ Impossible de récupérer le classement de la catégorie.");
  }
}

async function handleDailyChallenge(chatId, event, sock, userId, userName, reply) {
  try {
    const res = await axios.get(`${BASE_URL}/challenge/daily?userId=${userId}`);
    let { question, challengeDate, reward, streak } = res.data;

    const translatedData = await translateQuestion({
      question: question.question,
      options: question.options,
      answer: question.answer,
      _id: question._id
    });

    const optText = translatedData.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

    const sent = await sock.sendMessage(chatId, {
      text: `🌟 𝗗𝗲́𝗳𝗶 𝗤𝘂𝗼𝘁𝗶𝗱𝗶𝗲𝗻\n━━━━━━━━━\n\n` +
            `📅 ${challengeDate}\n` +
            `🎯 Récompense bonus: +${reward} XP\n` +
            `🔥 Série quotidienne: ${streak}\n\n\n` +
            `❓ ${translatedData.question}\n\n${optText}\n\n⏰ 30 secondes pour répondre !`
    }, { quoted: event });

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: translatedData.answer,
      options: translatedData.options,
      questionId: translatedData._id,
      startTime: Date.now(),
      isDaily: true,
      difficulty: "daily"
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${translatedData.answer}`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error("Daily challenge error:", err);
    reply("⚠️ Impossible de créer le défi quotidien.");
  }
}

async function handleTrueOrFalse(chatId, event, sock, userId, userName, reply) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=torf&userId=${userId}`);
    let { _id, question, answer } = res.data;

    const translatedData = await translateQuestion({
      question: question,
      options: ["Vrai", "Faux"],
      answer: answer,
      _id: _id
    });

    const sent = await sock.sendMessage(chatId, {
      text: `⚙ 𝗤𝘂𝗶𝘇 ( Vrai/Faux )\n━━━━━━━━━━\n\n💭 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${translatedData.question}\n\n` +
            `A. Vrai\nB. Faux\n\n⏰ 30 secondes pour répondre (A/B)`
    }, { quoted: event });

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: translatedData.answer,
      options: translatedData.options,
      questionId: translatedData._id,
      startTime: Date.now(),
      isTorf: true
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${translatedData.answer === "A" ? "Vrai" : "Faux"}`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error("True/False error:", err);
    reply("⚠️ Impossible de créer une question Vrai/Faux.");
  }
}

async function handleFlagQuiz(chatId, event, sock, userId, userName, reply) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=flag&userId=${userId}`);
    let { _id, question, options, answer, imageUrl } = res.data;

    // Vérifier si les données sont valides
    if (!options || !Array.isArray(options) || options.length === 0) {
      return reply("⚠️ Aucune question de drapeau disponible pour le moment.");
    }

    const caption = `🏁 𝗤𝘂𝗶𝘇 𝗱𝗲 𝗗𝗿𝗮𝗽𝗲𝗮𝘂𝘅\n━━━━━━━━\n\n🌍 Devinez le pays de ce drapeau :\n\n` +
                    options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
                    `\n\n⏰ Temps : 30 secondes pour répondre.`;

    let sent;

    if (imageUrl && imageUrl.startsWith('http')) {
      // Télécharger l'image en buffer
      const imageBuffer = await getBufferFromURL(imageUrl);
      
      if (imageBuffer) {
        sent = await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: caption
        }, { quoted: event });
      } else {
        // Fallback au texte si l'image ne peut pas être chargée
        sent = await sock.sendMessage(chatId, {
          text: caption + '\n\n⚠️ L\'image du drapeau n\'a pas pu être chargée.'
        }, { quoted: event });
      }
    } else {
      sent = await sock.sendMessage(chatId, {
        text: caption
      }, { quoted: event });
    }

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: answer,
      options: options,
      questionId: _id,
      startTime: Date.now(),
      isFlag: true
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${answer}`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error("Flag quiz error:", err);
    reply(`⚠️ Impossible de créer un quiz de drapeau. ${err.message || ''}`);
  }
}

async function handleAnimeQuiz(chatId, event, sock, userId, userName, reply) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=anime&userId=${userId}`);
    let { _id, question, options, answer, imageUrl, hint } = res.data;

    // Vérifier si les données sont valides
    if (!options || !Array.isArray(options) || options.length === 0) {
      return reply("⚠️ Aucune question anime disponible pour le moment.");
    }

    const caption = `🎌 𝗤𝘂𝗶𝘇 𝗔𝗻𝗶𝗺𝗲\n━━━━━━━━\n\n❔ 𝗜𝗻𝗱𝗶𝗰𝗲 : ${hint || question}\n\n` +
                    options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
                    `\n\n⏰ Temps : 30 secondes\n🎯 Défi de reconnaissance de personnages animés !`;

    let sent;

    if (imageUrl && imageUrl.startsWith('http')) {
      const imageBuffer = await getBufferFromURL(imageUrl);
      
      if (imageBuffer) {
        sent = await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: caption
        }, { quoted: event });
      } else {
        sent = await sock.sendMessage(chatId, {
          text: caption + '\n\n⚠️ L\'image du personnage n\'a pas pu être chargée.'
        }, { quoted: event });
      }
    } else {
      sent = await sock.sendMessage(chatId, {
        text: caption
      }, { quoted: event });
    }

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: answer,
      options: options,
      questionId: _id,
      startTime: Date.now(),
      isAnime: true
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${answer}\n🎌 Continuez à regarder des animés pour améliorer vos compétences !`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error("Anime quiz error:", err);
    reply(`⚠️ Impossible de créer un quiz anime. ${err.message || ''}`);
  }
}

async function handleImageQuiz(chatId, event, sock, userId, userName, category, title, reply) {
  try {
    const res = await axios.get(`${BASE_URL}/question?category=${category}&userId=${userId}`);
    let { _id, question, options, answer, imageUrl, hint } = res.data;

    // Vérifier si les données sont valides
    if (!options || !Array.isArray(options) || options.length === 0) {
      return reply(`⚠️ Aucune question pour la catégorie "${category}" disponible pour le moment.`);
    }

    const body = `${title}\n━━━━━━━━\n\n❔ ${hint || question}\n\n` +
      options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
      `\n\n⏰ 30 secondes pour répondre (A/B/C/D)`;

    let sent;

    if (imageUrl && imageUrl.startsWith('http')) {
      const imageBuffer = await getBufferFromURL(imageUrl);
      
      if (imageBuffer) {
        sent = await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: body
        }, { quoted: event });
      } else {
        sent = await sock.sendMessage(chatId, {
          text: body + '\n\n⚠️ L\'image n\'a pas pu être chargée.'
        }, { quoted: event });
      }
    } else {
      sent = await sock.sendMessage(chatId, {
        text: body
      }, { quoted: event });
    }

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: answer,
      options: options,
      questionId: _id,
      startTime: Date.now(),
      isImage: true,
      category: category
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${answer}`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error(`Image quiz (${category}) error:`, err);
    reply(`⚠️ Impossible de créer le quiz ${category}. ${err.message || ''}`);
  }
}

async function handleQuiz(chatId, event, sock, userId, userName, args, reply, forcedDifficulty = null) {
  try {
    const category = args[0]?.toLowerCase() || "";

    let queryParams = { userId: userId };
    if (category && category !== "random") {
      queryParams.category = category;
    }
    if (forcedDifficulty) {
      queryParams.difficulty = forcedDifficulty;
    }

    const res = await axios.get(`${BASE_URL}/question`, { params: queryParams });
    let { _id, question, options, answer, category: qCategory, difficulty, imageUrl, hint } = res.data;

    const translatedData = await translateQuestion({
      _id,
      question,
      options,
      answer,
      category: qCategory,
      difficulty
    });

    const optText = translatedData.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");
    const body = 
      `🎯 𝗗𝗲́𝗳𝗶 𝗤𝘂𝗶𝘇\n━━━━━━━━━━\n\n` +
      `📚 𝖢𝖺𝗍𝖾́𝗀𝗈𝗋𝗂𝖾: ${translatedData.category?.charAt(0).toUpperCase() + translatedData.category?.slice(1) || "Aléatoire"}\n` +
      `🎚️ 𝖣𝗂𝖿𝖿𝗂𝖼𝗎𝗅𝗍𝖾́: ${translatedData.difficulty?.charAt(0).toUpperCase() + translatedData.difficulty?.slice(1) || "Moyen"}\n` +
      `❓ 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${hint || translatedData.question}\n\n${optText}\n\n` +
      `⏰ 𝖵𝗈𝗎𝗌 𝖺𝗏𝖾𝗓 30 𝗌𝖾𝖼𝗈𝗇𝖽𝖾𝗌 𝗉𝗈𝗎𝗋 𝗋épondre (A/B/C/D):`;

    let sent;

    // Si l'image existe, l'envoyer avec la question
    if (imageUrl && imageUrl.startsWith('http')) {
      const imageBuffer = await getBufferFromURL(imageUrl);
      
      if (imageBuffer) {
        sent = await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: body
        }, { quoted: event });
      } else {
        sent = await sock.sendMessage(chatId, {
          text: body + '\n\n⚠️ L\'image n\'a pas pu être chargée.'
        }, { quoted: event });
      }
    } else {
      sent = await sock.sendMessage(chatId, {
        text: body
      }, { quoted: event });
    }

    global.NixBot.onReply.push({
      commandName: "quiz",
      messageID: sent.key.id,
      author: userId,
      correctAnswer: translatedData.answer,
      options: translatedData.options,
      questionId: translatedData._id,
      startTime: Date.now(),
      difficulty: translatedData.difficulty,
      category: translatedData.category,
      isImage: !!imageUrl
    });

    setTimeout(() => {
      const idx = global.NixBot.onReply.findIndex(r => r.messageID === sent.key.id);
      if (idx !== -1) {
        global.NixBot.onReply.splice(idx, 1);
        sock.sendMessage(chatId, {
          text: `⏰ Temps écoulé ! La bonne réponse était: ${translatedData.answer}`
        }, { quoted: event }).catch(() => {});
      }
    }, 30000);

  } catch (err) {
    console.error("Quiz error:", err);
    reply("⚠️ Impossible de récupérer une question. Essayez '/quiz categories' pour voir les options disponibles.");
  }
}