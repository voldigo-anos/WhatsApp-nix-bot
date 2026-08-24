const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const BASE_URL = 'https://quiz-api-zd8a.onrender.com/api';

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

// Fonction pour télécharger une image depuis une URL
async function getBufferFromURL(url) {
  if (!url) return null;
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        Referer: "https://www.google.com/"
      }
    });
    return Buffer.from(response.data);
  } catch (e) {
    console.error("Échec du téléchargement de l'image:", url, e.message);
    return null;
  }
}

// Fonction pour envoyer une image avec fallback
async function sendImageWithFallback(sock, chatId, imageUrl, caption, quoted) {
  if (!imageUrl) {
    return await sock.sendMessage(chatId, { text: caption }, { quoted });
  }

  try {
    const buffer = await getBufferFromURL(imageUrl);
    if (buffer) {
      return await sock.sendMessage(chatId, {
        image: buffer,
        caption: caption
      }, { quoted });
    } else {
      // Fallback: envoyer sans image
      return await sock.sendMessage(chatId, { text: caption }, { quoted });
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'image:", error);
    // En cas d'erreur, envoyer sans image
    return await sock.sendMessage(chatId, { text: caption }, { quoted });
  }
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["q", "qz", "kuiz"],
    version: "5.0.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      en: "Jeu de quiz avancé avec 6000+ questions, images, succès et classements"
    },
    category: "game",
    nixPrefix: true,
    guide: {
      en: `{pn} <catégorie> - Commencer un quiz\n` +
          `{pn} rank - Voir votre profil\n` +
          `{pn} lb - Classement global\n` +
          `{pn} daily - Défi quotidien\n` +
          `{pn} torf - Quiz Vrai/Faux\n` +
          `{pn} flag - Quiz drapeaux\n` +
          `{pn} anime - Quiz anime\n` +
          `{pn} cartoon - Quiz dessins animés\n` +
          `{pn} animaux - Quiz animaux\n` +
          `{pn} monument - Quiz monuments\n` +
          `{pn} sport - Quiz sport\n` +
          `{pn} hard/medium/easy - Quiz par difficulté`
    }
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, usersData }) {
    const command = args[0]?.toLowerCase();
    const userId = senderId;
    const userName = event.pushName || "Joueur";

    try {
      await axios.post(`${BASE_URL}/user/update`, {
        userId: userId,
        name: userName
      }).catch(() => {});

      if (!args[0] || command === "help") {
        return await this.handleDefaultView(chatId, sock, reply, event);
      }

      switch (command) {
        case "rank":
        case "profile":
        case "rang":
        case "profil":
          return await this.handleRank(chatId, event, sock, userId, userName, reply, usersData);
          
        case "leaderboard":
        case "lb":
        case "classement":
          return await this.handleLeaderboard(chatId, event, sock, args.slice(1), reply);
          
        case "category":
        case "categorie":
          if (args.length > 1) {
            return await this.handleCategoryLeaderboard(chatId, event, sock, args.slice(1), reply);
          }
          return await this.handleCategories(chatId, sock, reply, event);
          
        case "daily":
        case "quotidien":
          return await this.handleDailyChallenge(chatId, event, sock, userId, userName, reply);
          
        case "torf":
        case "vrai/faux":
          return await this.handleTrueOrFalse(chatId, event, sock, userId, userName, reply);
          
        case "flag":
        case "drapeau":
          return await this.handleFlagQuiz(chatId, event, sock, userId, userName, reply);
          
        case "anime":
          return await this.handleAnimeQuiz(chatId, event, sock, userId, userName, reply);
          
        case "cartoon":
        case "dessin":
        case "dessins":
        case "kids":
          return await this.handleImageQuiz(chatId, event, sock, userId, userName, "cartoon", "📺 𝗤𝘂𝗶𝘇 𝗗𝗲𝘀𝘀𝗶𝗻𝘀 𝗔𝗻𝗶𝗺é𝘀", reply);
          
        case "animaux":
        case "animal":
          return await this.handleImageQuiz(chatId, event, sock, userId, userName, "animaux", "🐾 𝗤𝘂𝗶𝘇 𝗔𝗻𝗶𝗺𝗮𝘂𝘅", reply);
          
        case "monument":
        case "monuments":
          return await this.handleImageQuiz(chatId, event, sock, userId, userName, "monument", "🏛️ 𝗤𝘂𝗶𝘇 𝗠𝗼𝗻𝘂𝗺𝗲𝗻𝘁𝘀", reply);
          
        case "sport":
        case "sports":
          return await this.handleImageQuiz(chatId, event, sock, userId, userName, "sport", "⚽ 𝗤𝘂𝗶𝘇 𝗦𝗽𝗼𝗿𝘁", reply);
          
        case "cinema":
        case "film":
        case "films":
          return await this.handleImageQuiz(chatId, event, sock, userId, userName, "cinema", "🎬 𝗤𝘂𝗶𝘇 𝗖𝗶𝗻é𝗺𝗮", reply);
          
        case "hard":
        case "difficile":
          return await this.handleQuiz(chatId, event, sock, userId, userName, [], reply, "hard");
          
        case "medium":
        case "moyen":
          return await this.handleQuiz(chatId, event, sock, userId, userName, [], reply, "medium");
          
        case "easy":
        case "facile":
          return await this.handleQuiz(chatId, event, sock, userId, userName, [], reply, "easy");
          
        case "random":
        case "aleatoire":
          return await this.handleQuiz(chatId, event, sock, userId, userName, [], reply);
          
        default:
          const categories = await getAvailableCategories();
          if (categories.includes(command)) {
            return await this.handleQuiz(chatId, event, sock, userId, userName, [command], reply);
          } else {
            return await this.handleDefaultView(chatId, sock, reply, event);
          }
      }
    } catch (err) {
      console.error("Quiz start error:", err);
      return reply("⚠️ Erreur, réessayez plus tard.");
    }
  },

  onReaction: async function ({ sock, event, usersData }) {
    const messageId = event.message?.reactionMessage?.key?.id || event.key?.id;
    if (!messageId) return;

    const quizData = global.NixBot.onReactionQuiz?.get(messageId);
    if (!quizData) return;

    const reactor = event.key.participant || event.key.remoteJid;
    if (reactor !== quizData.author) return;

    const reaction = event.message?.reactionMessage?.text || "";
    const validReactions = ['👍', '❤️', '😂', '😮'];
    if (!validReactions.includes(reaction)) return;

    let userName = "Joueur";
    try {
      if (usersData && typeof usersData.get === 'function') {
        const userInfo = await usersData.get(quizData.author);
        userName = userInfo?.name || event.pushName || "Joueur";
      } else {
        userName = event.pushName || "Joueur";
      }
    } catch (e) {
      userName = event.pushName || "Joueur";
    }

    const timeSpent = (Date.now() - quizData.startTime) / 1000;

    if (timeSpent > 30) {
      global.NixBot.onReactionQuiz.delete(messageId);
      return sock.sendMessage(quizData.chatId, {
        text: `⏰ Temps écoulé ! La bonne réponse était: ${quizData.correctAnswer}`
      });
    }

    let userAnswer = '';
    
    // Pour Vrai/Faux
    if (quizData.isTorf) {
      if (reaction === '👍') userAnswer = 'A';
      else if (reaction === '❤️') userAnswer = 'B';
      else return;
    } 
    // Pour les quiz avec options A/B/C/D
    else {
      const reactionMap = {
        '👍': 'A',
        '❤️': 'B',
        '😂': 'C',
        '😮': 'D'
      };
      userAnswer = reactionMap[reaction] || '';
    }

    if (!userAnswer) return;

    let actualAnswer = userAnswer;
    if (quizData.options && !quizData.isTorf) {
      const optionIndex = userAnswer.charCodeAt(0) - 65;
      if (optionIndex >= 0 && optionIndex < quizData.options.length) {
        actualAnswer = quizData.options[optionIndex];
      }
    }

    try {
      const answerData = {
        userId: quizData.author,
        questionId: quizData.questionId,
        answer: actualAnswer,
        timeSpent,
        userName
      };

      const res = await axios.post(`${BASE_URL}/answer`, answerData);
      
      if (!res.data) throw new Error('Aucune donnée reçue');

      const { result, user } = res.data;
      let responseMsg;

      let currentMoney = 0;
      try {
        if (usersData && typeof usersData.get === 'function') {
          const userData = await usersData.get(quizData.author);
          currentMoney = Number(userData?.money) || 0;
        }
      } catch (e) {
        currentMoney = 0;
      }

      if (result === "correct") {
        let baseMoneyReward = 10000;
        if (quizData.difficulty === 'hard') baseMoneyReward = 15000;
        if (quizData.difficulty === 'easy') baseMoneyReward = 7500;
        if (quizData.isFlag) baseMoneyReward = 12000;
        if (quizData.isAnime) baseMoneyReward = 15000;
        if (quizData.isImage) baseMoneyReward = 12000;
        if (quizData.isDaily) baseMoneyReward = 20000;

        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;

        try {
          if (usersData && typeof usersData.set === 'function') {
            const userData = await usersData.get(quizData.author) || {};
            await usersData.set(quizData.author, {
              ...userData,
              money: (Number(userData.money) || 0) + totalMoneyReward
            });
            currentMoney = (Number(userData.money) || 0) + totalMoneyReward;
          }
        } catch (e) {
          console.error("Erreur mise à jour argent:", e);
        }

        const difficultyBonus = quizData.difficulty === 'hard' ? ' 🔥' : quizData.difficulty === 'easy' ? ' ⭐' : '';
        const streakBonus2 = (user.currentStreak || 0) >= 5 ? ` 🚀 ${user.currentStreak}x série !` : '';
        const flagBonus = quizData.isFlag ? ' 🏁' : '';
        const animeBonus = quizData.isAnime ? ' 🎌' : '';
        const imageBonus = quizData.isImage ? ' 🖼️' : '';
        const dailyBonus = quizData.isDaily ? ' 🌟' : '';

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
          `🎯 𝗕𝗼𝗻𝗻𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲: ${quizData.correctAnswer}\n` +
          `📊 𝗦𝗰𝗼𝗿𝗲: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `💔 𝗦𝗲́𝗿𝗶𝗲 𝗿𝗲́𝗶𝗻𝗶𝘁𝗶𝗮𝗹𝗶𝘀𝗲́𝗲\n` +
          `👤 ${userName}` + (quizData.isFlag ? ' 🏁' : '') + (quizData.isAnime ? ' 🎌' : '') + (quizData.isImage ? ' 🖼️' : '');
      }

      await sock.sendMessage(quizData.chatId, { text: responseMsg });

      if (user.achievements && user.achievements.length > 0) {
        try {
          if (usersData && typeof usersData.get === 'function' && typeof usersData.set === 'function') {
            const userData = await usersData.get(quizData.author) || {};
            await usersData.set(quizData.author, {
              ...userData,
              money: (Number(userData.money) || 0) + 50000
            });
          }
        } catch (e) {
          console.error("Erreur mise à jour succès:", e);
        }
        
        const achievementMsg = user.achievements.map(ach => `🏆 ${ach}`).join('\n');
        await sock.sendMessage(quizData.chatId, {
          text: `🏆 𝗦𝘂𝗰𝗰𝗲̀𝘀 𝗱𝗲́𝗯𝗹𝗼𝗾𝘂𝗲́ !\n${achievementMsg}\n💰 +50 000 pièces bonus !`
        });
      }

      global.NixBot.onReactionQuiz.delete(messageId);

    } catch (err) {
      console.error("Answer error:", err);
      await sock.sendMessage(quizData.chatId, {
        text: `⚠️ Erreur lors du traitement: ${err.message}`
      });
    }
  },

  // ============ FONCTIONS D'AFFICHAGE ============

  handleDefaultView: async function(chatId, sock, reply, event) {
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

      const prefix = global.NixBot?.config?.prefix || '/';

      const msg = 
        `🎯 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n` +
        `📚 𝗖𝗮𝘁𝗲́𝗴𝗼𝗿𝗶𝗲𝘀 (${categories.length})\n\n${catText}\n\n` +
        `━━━━━━━━━\n\n` +
        `🏆 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻\n` +
        `• ${prefix}quiz rank - Voir votre classement\n` +
        `• ${prefix}quiz lb - Voir le classement global\n` +
        `• ${prefix}quiz torf - Quiz Vrai/Faux\n` +
        `• ${prefix}quiz flag - Quiz drapeaux\n` +
        `• ${prefix}quiz anime - Quiz anime\n` +
        `• ${prefix}quiz cartoon - Quiz dessins animés\n` +
        `• ${prefix}quiz animaux - Quiz animaux\n` +
        `• ${prefix}quiz monument - Quiz monuments\n` +
        `• ${prefix}quiz sport - Quiz sport\n\n` +
        `🎮 Utilisez: ${prefix}quiz <catégorie> pour commencer`;

      await sock.sendMessage(chatId, { text: msg }, { quoted: event });
    } catch (err) {
      console.error("Default view error:", err);
      reply("⚠️ Impossible de récupérer les catégories.");
    }
  },

  handleRank: async function(chatId, event, sock, userId, userName, reply, usersData) {
    try {
      const res = await axios.get(`${BASE_URL}/user/${userId}`);
      const user = res.data;

      if (!user || user.total === 0) {
        const prefix = global.NixBot?.config?.prefix || '/';
        return reply(`❌ Vous n'avez pas encore joué de quiz ! Utilisez '${prefix}quiz random' pour commencer.\n👤 Bienvenue, ${userName} !`);
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

      const msg =
        `🎮 𝗣𝗿𝗼𝗳𝗶𝗹 𝗤𝘂𝗶𝘇\n━━━━━━━━━\n\n` +
        `👤 ${userName}\n` +
        `🎖️ ${title}\n` +
        `🏆 𝗥𝗮𝗻𝗴 𝗴𝗹𝗼𝗯𝗮𝗹: #${position}/${totalUser}\n` +
        `📈 𝗣𝗲𝗿𝗰𝗲𝗻𝘁𝗶𝗹𝗲: ${progressBar} ${user.percentile ?? 0}%\n\n` +
        `📊 𝗦𝘁𝗮𝘁𝗶𝘀𝘁𝗶𝗾𝘂𝗲𝘀\n` +
        `✅ 𝗕𝗼𝗻𝗻𝗲𝘀 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲𝘀: ${user.correct ?? 0}\n` +
        `❌ 𝗠𝗮𝘂𝘃𝗮𝗶𝘀𝗲𝘀 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲𝘀: ${user.wrong ?? 0}\n` +
        `📝 𝗧𝗼𝘁𝗮𝗹: ${user.total ?? 0}\n` +
        `🎯 𝗣𝗿𝗲́𝗰𝗶𝘀𝗶𝗼𝗻: ${user.accuracy ?? 0}%\n` +
        `⚡ 𝗧𝗲𝗺𝗽𝘀 𝗺𝗼𝘆𝗲𝗻: ${(user.avgResponseTime ?? 0).toFixed(1)}s\n\n` +
        `💰 𝗥𝗶𝗰𝗵𝗲𝘀𝘀𝗲 & 𝗫𝗣\n` +
        `💵 𝗔𝗿𝗴𝗲𝗻𝘁: ${userMoney.toLocaleString()}\n` +
        `✨ 𝗫𝗣: ${currentXP}/1000\n` +
        `${xpProgressBar} ${xpProgress.toFixed(1)}%\n\n` +
        `🔥 𝗜𝗻𝗳𝗼 𝘀𝗲́𝗿𝗶𝗲\n` +
        `🔥 𝗦𝗲́𝗿𝗶𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀: ${user.currentStreak || 0}${user.currentStreak >= 5 ? ' 🚀' : ''}\n` +
        `🏅 𝗠𝗲𝗶𝗹𝗹𝗲𝘂𝗿𝗲 𝘀𝗲́𝗿𝗶𝗲: ${user.bestStreak || 0}${user.bestStreak >= 10 ? ' 👑' : user.bestStreak >= 5 ? ' ⭐' : ''}\n\n` +
        `🎯 𝗣𝗿𝗼𝗰𝗵𝗮𝗶𝗻 𝗼𝗯𝗷𝗲𝗰𝘁𝗶𝗳: ${user.nextMilestone || "Continuez à jouer !"}`;

      await sock.sendMessage(chatId, { text: msg }, { quoted: event });
    } catch (err) {
      console.error("Rank error:", err);
      reply("⚠️ Impossible de récupérer votre rang.");
    }
  },

  handleLeaderboard: async function(chatId, event, sock, args, reply) {
    try {
      const page = parseInt(args?.[0]) || 1;
      const res = await axios.get(`${BASE_URL}/leaderboards?page=${page}&limit=8`);
      const { rankings, pagination } = res.data;

      if (!rankings || rankings.length === 0) {
        return reply("🏆 Aucun joueur dans le classement.");
      }

      const players = rankings.map((u, i) => {
        const position = (pagination.currentPage - 1) * 8 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
        const title = getUserTitle(u.correct || 0);
        const accuracy = u.accuracy ?? (u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0);
        
        return `${crown} #${position} ${u.name || 'Joueur'}\n` +
               `🎖️ ${title}\n` +
               `📊 ${u.correct || 0} ✅ / ${u.wrong || 0} ❌ (${accuracy}%)\n` +
               `🔥 Série: ${u.currentStreak || 0}`;
      });

      const msg = `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁\n━━━━━━━━━\n\n${players.join('\n\n')}\n\n📖 Page ${pagination.currentPage}/${pagination.totalPages}`;

      await sock.sendMessage(chatId, { text: msg }, { quoted: event });
    } catch (err) {
      console.error("Leaderboard error:", err);
      reply("⚠️ Impossible de récupérer le classement.");
    }
  },

  handleCategories: async function(chatId, sock, reply, event) {
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

      const prefix = global.NixBot?.config?.prefix || '/';

      const msg = `📚 𝗖𝗮𝘁𝗲́𝗴𝗼𝗿𝗶𝗲𝘀 𝗱𝘂 𝗤𝘂𝗶𝘇 (${categories.length})\n━━━━━━━━\n\n${catText}\n\n` +
                  `🎯 Utilisez: ${prefix}quiz <catégorie>\n` +
                  `🎲 Aléatoire: ${prefix}quiz random\n` +
                  `🏆 Quotidien: ${prefix}quiz daily`;

      await sock.sendMessage(chatId, { text: msg }, { quoted: event });
    } catch (err) {
      console.error("Categories error:", err);
      reply("⚠️ Impossible de récupérer les catégories.");
    }
  },

  handleCategoryLeaderboard: async function(chatId, event, sock, args, reply) {
    try {
      const category = args[0]?.toLowerCase();
      if (!category) {
        return reply("📚 Veuillez spécifier une catégorie.");
      }

      const page = parseInt(args[1]) || 1;
      const res = await axios.get(`${BASE_URL}/leaderboard/category/${category}?page=${page}&limit=10`);
      const { users, pagination } = res.data;

      if (!users || users.length === 0) {
        return reply(`🏆 Aucun joueur pour : ${category}.`);
      }

      const players = users.map((u, i) => {
        const position = (pagination.currentPage - 1) * 10 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
        const title = getUserTitle(u.correct || 0);
        return `${crown} #${position} ${u.name || 'Joueur'}\n🎖️ ${title}\n📊 ${u.correct || 0}/${u.total || 0} (${u.accuracy || 0}%)`;
      });

      const msg = `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁 : ${category}\n━━━━━━━━━\n\n${players.join('\n\n')}\n\n📖 Page ${pagination.currentPage}/${pagination.totalPages}`;

      await sock.sendMessage(chatId, { text: msg }, { quoted: event });
    } catch (err) {
      console.error("Category leaderboard error:", err);
      reply("⚠️ Impossible de récupérer le classement.");
    }
  },

  // ============ FONCTIONS DE QUIZ AVEC RÉACTIONS ============

  handleDailyChallenge: async function(chatId, event, sock, userId, userName, reply) {
    try {
      const res = await axios.get(`${BASE_URL}/challenge/daily?userId=${userId}`);
      let { question, challengeDate, reward, streak } = res.data;

      const optText = question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const sent = await sock.sendMessage(chatId, {
        text: `🌟 𝗗𝗲́𝗳𝗶 𝗤𝘂𝗼𝘁𝗶𝗱𝗶𝗲𝗻\n━━━━━━━━━\n\n` +
              `📅 ${challengeDate}\n` +
              `🎯 Récompense: +${reward} XP\n` +
              `🔥 Série: ${streak}\n\n` +
              `❓ ${question.question}\n\n${optText}\n\n` +
              `⏰ 30 secondes\n` +
              `👍 = A  |  ❤️ = B  |  😂 = C  |  😮 = D\n` +
              `Réagissez avec le bon emoji !`
      }, { quoted: event });

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: question.answer,
        options: question.options,
        questionId: question._id,
        startTime: Date.now(),
        isDaily: true,
        difficulty: "daily"
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("Daily challenge error:", err);
      reply("⚠️ Impossible de créer le défi quotidien.");
    }
  },

  handleTrueOrFalse: async function(chatId, event, sock, userId, userName, reply) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=torf&userId=${userId}`);
      let { _id, question, answer } = res.data;

      const sent = await sock.sendMessage(chatId, {
        text: `⚙ 𝗤𝘂𝗶𝘇 (Vrai/Faux)\n━━━━━━━━━━\n\n💭 ${question}\n\n` +
              `👍 = Vrai\n❤️ = Faux\n\n` +
              `⏰ 30 secondes - Réagissez avec 👍 ou ❤️`
      }, { quoted: event });

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: answer === "A" ? "Vrai" : "Faux",
        options: ["Vrai", "Faux"],
        questionId: _id,
        startTime: Date.now(),
        isTorf: true
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("True/False error:", err);
      reply("⚠️ Impossible de créer une question Vrai/Faux.");
    }
  },

  handleFlagQuiz: async function(chatId, event, sock, userId, userName, reply) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=flag&userId=${userId}`, { timeout: 25000 });
      const { _id, question, options, answer, imageUrl } = res.data;
        
      if (!Array.isArray(options) || !options.length) {
        return reply("⚠️ Aucune question sur les drapeaux disponible pour le moment.");
      }

      const caption = `🏁 𝗤𝘂𝗶𝘇 𝗱𝗲 𝗗𝗿𝗮𝗽𝗲𝗮𝘂𝘅\n━━━━━━━━\n\n🌍 Devinez le pays :\n\n` +
                      options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
                      `\n\n⏰ 30 secondes\n` +
                      `👍 = A  |  ❤️ = B  |  😂 = C  |  😮 = D\n` +
                      `Réagissez avec le bon emoji !`;

      let sent;
      if (imageUrl && imageUrl.startsWith('http')) {
        const buffer = await getBufferFromURL(imageUrl);
        if (buffer) {
          sent = await sock.sendMessage(chatId, {
            image: buffer,
            caption: caption
          }, { quoted: event });
        } else {
          sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
        }
      } else {
        sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
      }

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: answer,
        options: options,
        questionId: _id,
        startTime: Date.now(),
        isFlag: true
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("Flag quiz error:", err);
      reply("⚠️ Impossible de créer un quiz de drapeau.");
    }
  },

  handleAnimeQuiz: async function(chatId, event, sock, userId, userName, reply) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=anime&userId=${userId}`, { timeout: 25000 });
      const { _id, question, options, answer, imageUrl, hint } = res.data;
        
      if (!Array.isArray(options) || !options.length) {
        return reply("⚠️ Aucune question anime disponible pour le moment.");
      }

      const caption = `🎌 𝗤𝘂𝗶𝘇 𝗔𝗻𝗶𝗺𝗲\n━━━━━━━━\n\n❔ ${hint || question}\n\n` +
                      options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
                      `\n\n⏰ 30 secondes\n` +
                      `👍 = A  |  ❤️ = B  |  😂 = C  |  😮 = D\n` +
                      `Réagissez avec le bon emoji !`;

      let sent;
      if (imageUrl && imageUrl.startsWith('http')) {
        const buffer = await getBufferFromURL(imageUrl);
        if (buffer) {
          sent = await sock.sendMessage(chatId, {
            image: buffer,
            caption: caption
          }, { quoted: event });
        } else {
          sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
        }
      } else {
        sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
      }

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: answer,
        options: options,
        questionId: _id,
        startTime: Date.now(),
        isAnime: true
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("Anime quiz error:", err);
      reply("⚠️ Impossible de créer un quiz anime.");
    }
  },

  handleImageQuiz: async function(chatId, event, sock, userId, userName, category, title, reply) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=${category}&userId=${userId}`, { timeout: 25000 });
      const { _id, question, options, answer, imageUrl, hint } = res.data;
        
      if (!Array.isArray(options) || !options.length) {
        return reply(`⚠️ Aucune question « ${category} » disponible pour le moment.`);
      }

      const caption = `${title}\n━━━━━━━━\n\n❔ ${hint || question}\n\n` +
                      options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
                      `\n\n⏰ 30 secondes\n` +
                      `👍 = A  |  ❤️ = B  |  😂 = C  |  😮 = D\n` +
                      `Réagissez avec le bon emoji !`;

      let sent;
      if (imageUrl && imageUrl.startsWith('http')) {
        const buffer = await getBufferFromURL(imageUrl);
        if (buffer) {
          sent = await sock.sendMessage(chatId, {
            image: buffer,
            caption: caption
          }, { quoted: event });
        } else {
          sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
        }
      } else {
        sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
      }

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: answer,
        options: options,
        questionId: _id,
        startTime: Date.now(),
        isImage: true,
        category: category
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error(`Image quiz ${category} error:`, err);
      reply(`⚠️ Impossible de créer le quiz ${category}.`);
    }
  },

  handleQuiz: async function(chatId, event, sock, userId, userName, args, reply, forcedDifficulty = null) {
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

      const optText = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const caption = `🎯 𝗗𝗲́𝗳𝗶 𝗤𝘂𝗶𝘇\n━━━━━━━━━━\n\n` +
                      `📚 𝗖𝗮𝘁𝗲́𝗴𝗼𝗿𝗶𝗲: ${qCategory?.charAt(0).toUpperCase() + qCategory?.slice(1) || "Aléatoire"}\n` +
                      `🎚️ 𝗗𝗶𝗳𝗳𝗶𝗰𝘂𝗹𝘁𝗲́: ${difficulty?.charAt(0).toUpperCase() + difficulty?.slice(1) || "Moyen"}\n` +
                      `❓ ${hint || question}\n\n${optText}\n\n` +
                      `⏰ 30 secondes\n` +
                      `👍 = A  |  ❤️ = B  |  😂 = C  |  😮 = D\n` +
                      `Réagissez avec le bon emoji !`;

      let sent;
      if (imageUrl && imageUrl.startsWith('http')) {
        const buffer = await getBufferFromURL(imageUrl);
        if (buffer) {
          sent = await sock.sendMessage(chatId, {
            image: buffer,
            caption: caption
          }, { quoted: event });
        } else {
          sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
        }
      } else {
        sent = await sock.sendMessage(chatId, { text: caption }, { quoted: event });
      }

      if (!global.NixBot.onReactionQuiz) global.NixBot.onReactionQuiz = new Map();
      global.NixBot.onReactionQuiz.set(sent.key.id, {
        author: userId,
        chatId: chatId,
        correctAnswer: answer,
        options: options,
        questionId: _id,
        startTime: Date.now(),
        difficulty: difficulty,
        category: qCategory,
        isImage: !!imageUrl
      });

      setTimeout(() => {
        const data = global.NixBot.onReactionQuiz?.get(sent.key.id);
        if (data) {
          global.NixBot.onReactionQuiz.delete(sent.key.id);
          sock.sendMessage(chatId, {
            text: `⏰ Temps écoulé ! La bonne réponse était: ${data.correctAnswer}`
          }).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("Quiz error:", err);
      reply("⚠️ Impossible de récupérer une question.");
    }
  }
};