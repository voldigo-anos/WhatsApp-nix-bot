const axios = require("axios");
const moment = require("moment-timezone");
const config = require("../../config.json");
const { box, bold, line } = require("../../func/style.js");

function convertFtoC(F) {
  return Math.floor((F - 32) / 1.8);
}
function formatHours(hours) {
  return moment(hours).tz("Africa/Abidjan").format("HH[h]mm");
}

module.exports = {
  config: {
    name: "weather",
    aliases: [],
    version: "1.2",
    author: "NTKhang",
    countDown: 5,
    role: 0,
    category: "other",
    description: { en: "View the current weather forecast" },
    guide: { en: "{pn} <location>" }
  },

  onStart: async function ({ args, reply }) {
    const apikey = config.weatherApiKey;
    const area = args.join(" ");

    if (!area) {
      return reply(box({ title: "Météo", emoji: "❌", body: "Veuillez entrer un lieu." }));
    }

    let areaKey, areaName, dataWeather;

    try {
      const response = (await axios.get(`https://api.accuweather.com/locations/v1/cities/search.json?q=${encodeURIComponent(area)}&apikey=${apikey}&language=fr-fr`)).data;
      if (!response || response.length == 0) {
        return reply(box({ title: "Météo", emoji: "❌", body: `Lieu introuvable : ${area}` }));
      }
      const data = response[0];
      areaKey = data.Key;
      areaName = data.LocalizedName;
    } catch (err) {
      return reply(box({ title: "Météo", emoji: "❌", body: `Une erreur est survenue : ${err.response?.data?.Message || err.message}` }));
    }

    try {
      dataWeather = (await axios.get(`http://api.accuweather.com/forecasts/v1/daily/5day/${areaKey}?apikey=${apikey}&details=true&language=fr`)).data;
    } catch (err) {
      return reply(box({ title: "Météo", emoji: "❌", body: `Une erreur est survenue : ${err.response?.data?.Message || err.message}` }));
    }

    const today = dataWeather.DailyForecasts[0];

    const body = `${bold("Lieu")} : ${areaName}\n`
      + `${dataWeather.Headline.Text}\n`
      + `${line}\n`
      + `🌡 ${bold("Température")} : ${convertFtoC(today.Temperature.Minimum.Value)}°C - ${convertFtoC(today.Temperature.Maximum.Value)}°C\n`
      + `🌡 ${bold("Ressenti")} : ${convertFtoC(today.RealFeelTemperature.Minimum.Value)}°C - ${convertFtoC(today.RealFeelTemperature.Maximum.Value)}°C\n`
      + `🌅 ${bold("Lever du soleil")} : ${formatHours(today.Sun.Rise)}\n`
      + `🌄 ${bold("Coucher du soleil")} : ${formatHours(today.Sun.Set)}\n`
      + `🌃 ${bold("Lever de lune")} : ${formatHours(today.Moon.Rise)}\n`
      + `🏙️ ${bold("Coucher de lune")} : ${formatHours(today.Moon.Set)}\n`
      + `🌞 ${bold("Jour")} : ${today.Day.LongPhrase}\n`
      + `🌙 ${bold("Nuit")} : ${today.Night.LongPhrase}`;

    return reply(box({ title: "Météo", emoji: "⛅", body }));
  }
};
