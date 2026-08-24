const moment = require("moment-timezone");
const { box, bold, line } = require("../../func/style.js");

const TIMEZONE = "Asia/Ho_Chi_Minh";
const REWARD_FIRST_DAY = { coin: 1500, exp: 450 };
const WEEKLY_BONUS = { coin: 3500, exp: 630 };

const DAY_NAMES_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function calculateStreakBonus(streakDays) {
  if (streakDays <= 7) {
    return 1 + (streakDays - 1) * 0.2 / 6;
  } else if (streakDays <= 14) {
    return 1.2 + (streakDays - 7) * 0.3 / 7;
  } else {
    const additionalDays = Math.min(streakDays - 14, 16);
    return 1.5 + additionalDays * 0.5 / 16;
  }
}

module.exports = {
  config: {
    name: "daily",
    aliases: ["claim"],
    version: "2.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    category: "economy",
    description: {
      en: "Recevez votre cadeau quotidien avec système de streak et bonus"
    },
    guide: {
      en: "{pn} : Recevoir le cadeau du jour\n{pn} info : Voir les informations des récompenses\n{pn} streak : Voir votre streak actuel\n{pn} leaderboard : Classement des streaks"
    }
  },

  onStart: async function ({ args, event, senderId, usersData, reply }) {
    try {
      if (args[0] === "info") {
        let body = "";
        for (let i = 1; i <= 7; i++) {
          const dayIndex = i === 7 ? 0 : i;
          const getCoin = Math.floor(REWARD_FIRST_DAY.coin * (1 + 20 / 1500) ** (i - 1));
          const getExp = Math.floor(REWARD_FIRST_DAY.exp * (1 + 20 / 1500) ** (i - 1));
          body += `${bold(DAY_NAMES_FR[dayIndex])}: ${getCoin.toLocaleString()} coins, ${getExp} XP\n`;
        }
        body += `\n${line}\n`;
        body += `🌟 ${bold("Système de bonus de série")}\n`;
        body += "1-7 jours: x1.0 - x1.2 bonus\n";
        body += "8-14 jours: x1.3 - x1.5 bonus\n";
        body += "15-30 jours: x1.6 - x2.0 bonus\n";
        body += "Bonus hebdomadaire tous les 7 jours !";
        return reply(box({ title: "Daily Reward Schedule", emoji: "📅", body }));
      }

      if (args[0] === "streak") {
        const userData = await usersData.get(senderId);
        const streakData = (userData.data && userData.data.dailyStreak) || { current: 0, lastClaim: null };
        const bonusMultiplier = calculateStreakBonus(streakData.current);

        let body = `🔥 ${bold("Streak")}: ${streakData.current} jours consécutifs\n📊 ${bold("Bonus actuel")}: x${bonusMultiplier.toFixed(1)}`;

        if (streakData.lastClaim) {
          const lastClaim = moment(streakData.lastClaim);
          const now = moment().tz(TIMEZONE);
          const hoursDiff = now.diff(lastClaim, 'hours');
          const minutesDiff = now.diff(lastClaim, 'minutes') % 60;
          body += `\n⏰ ${bold("Prochain cadeau dans")}: ${hoursDiff < 24 ? 24 - hoursDiff : 0}h ${minutesDiff > 0 ? 60 - minutesDiff : 0}m`;
        }

        body += `\n📈 ${bold("Total reçu")}: ${(userData.data?.totalCoinReceived || 0).toLocaleString()} coins, ${userData.data?.totalExpReceived || 0} XP`;
        return reply(box({ title: "Votre Streak", emoji: "🔥", body }));
      }

      if (args[0] === "leaderboard") {
        let allUsers = [];
        try {
          if (typeof usersData.getAll === "function") {
            allUsers = await usersData.getAll();
          }
        } catch (e) {
          allUsers = [];
        }

        const streakList = [];
        for (const user of allUsers) {
          if (user.data?.dailyStreak?.current > 0) {
            streakList.push({
              name: user.name || "Joueur",
              streak: user.data.dailyStreak.current,
              id: user.userID || user.id
            });
          }
        }

        streakList.sort((a, b) => b.streak - a.streak);

        let body = "";
        const top10 = streakList.slice(0, 10);

        if (top10.length === 0) {
          body = "Aucune donnée de streak pour le moment !";
        } else {
          top10.forEach((user, index) => {
            body += `${index + 1}. ${user.name} - ${user.streak} jours 🔥\n`;
          });
        }

        const userIndex = streakList.findIndex(u => u.id === senderId);
        if (userIndex !== -1) {
          body += `\n${bold("Votre position")}: #${userIndex + 1}`;
        }

        return reply(box({ title: "Classement des streaks", emoji: "🏆", body: body.trim() }));
      }

      const dateTime = moment().tz(TIMEZONE).format("YYYY-MM-DD");
      const currentDay = new Date().getDay();

      const userData = await usersData.get(senderId);
      const userDataObj = userData.data || {};

      if (!userDataObj.dailyStreak) {
        userDataObj.dailyStreak = { current: 0, lastClaim: null, longestStreak: 0 };
      }
      if (!userDataObj.totalCoinReceived) userDataObj.totalCoinReceived = 0;
      if (!userDataObj.totalExpReceived) userDataObj.totalExpReceived = 0;

      const streakData = userDataObj.dailyStreak;
      const lastClaimDate = streakData.lastClaim ? moment(streakData.lastClaim) : null;
      const currentDate = moment().tz(TIMEZONE);

      if (lastClaimDate && lastClaimDate.format("YYYY-MM-DD") === dateTime) {
        const nextClaim = lastClaimDate.clone().add(1, 'day');
        const hoursLeft = nextClaim.diff(currentDate, 'hours');
        const minutesLeft = nextClaim.diff(currentDate, 'minutes') % 60;
        const body = `Vous avez déjà reçu votre cadeau aujourd'hui !\n⏰ ${bold("Prochain cadeau dans")}: ${hoursLeft}h ${minutesLeft}m`;
        return reply(box({ title: "Cadeau quotidien", emoji: "🎁", body }));
      }

      const extraMessages = [];
      if (lastClaimDate) {
        const daysDiff = currentDate.diff(lastClaimDate, 'days');
        if (daysDiff === 1) {
          streakData.current++;
        } else if (daysDiff <= 3) {
          extraMessages.push("⚠️ Connexion depuis un autre appareil détectée, streak maintenu.");
        } else {
          extraMessages.push("⚠️ Votre streak a été réinitialisé car vous avez réclamé trop tard !");
          streakData.current = 1;
          extraMessages.push("🆕 Nouveau streak commencé !");
        }
      } else {
        streakData.current = 1;
        extraMessages.push("🆕 Nouveau streak commencé !");
      }

      if (streakData.current > (streakData.longestStreak || 0)) {
        streakData.longestStreak = streakData.current;
        if (streakData.current % 7 === 0) {
          extraMessages.push(`🎊 NOUVEAU RECORD ! ${streakData.current} jours de streak !`);
        }
      }

      let getCoin = Math.floor(REWARD_FIRST_DAY.coin * (1 + 20 / 1500) ** ((currentDay == 0 ? 7 : currentDay) - 1));
      let getExp = Math.floor(REWARD_FIRST_DAY.exp * (1 + 20 / 1500) ** ((currentDay == 0 ? 7 : currentDay) - 1));

      const streakMultiplier = calculateStreakBonus(streakData.current);
      const streakBonusCoin = Math.floor(getCoin * (streakMultiplier - 1));
      const streakBonusExp = Math.floor(getExp * (streakMultiplier - 1));

      getCoin += streakBonusCoin;
      getExp += streakBonusExp;

      let weeklyBonusMsg = "";
      if (streakData.current % 7 === 0) {
        getCoin += WEEKLY_BONUS.coin;
        getExp += WEEKLY_BONUS.exp;
        weeklyBonusMsg = `\n🎉 ${bold("FÉLICITATIONS")} ! Bonus hebdomadaire: ${WEEKLY_BONUS.coin} coins et ${WEEKLY_BONUS.exp} XP !`;
      }

      streakData.lastClaim = dateTime;
      userDataObj.dailyStreak = streakData;
      userDataObj.totalCoinReceived = (userDataObj.totalCoinReceived || 0) + getCoin;
      userDataObj.totalExpReceived = (userDataObj.totalExpReceived || 0) + getExp;
      userDataObj.lastTimeGetReward = dateTime;

      await usersData.set(senderId, {
        money: (userData.money || 0) + getCoin,
        exp: (userData.exp || 0) + getExp,
        data: userDataObj,
        name: event.pushName || userData.name || "Joueur"
      });

      let body = `🎉 Vous avez reçu ${getCoin.toLocaleString()} coins et ${getExp} points d'expérience !`;
      if (streakBonusCoin > 0 || streakBonusExp > 0) {
        body += `\n✨ +${streakBonusCoin.toLocaleString()} coins et +${streakBonusExp} XP bonus de streak !`;
      }
      body += weeklyBonusMsg;
      body += `\n🔥 ${bold("Streak")}: ${streakData.current} jours consécutifs\n📊 ${bold("Bonus actuel")}: x${streakMultiplier.toFixed(1)}`;

      if (extraMessages.length) {
        body = extraMessages.join("\n") + "\n\n" + body;
      }

      return reply(box({ title: "Cadeau quotidien réclamé", emoji: "🎉", body }));

    } catch (err) {
      console.error("[DAILY] Erreur:", err);
      return reply(box({ title: "Erreur", emoji: "❌", body: `Une erreur s'est produite : ${err.message}` }));
    }
  }
};
