"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  RANK CELESTIAL — Carte stellaire personnelle (portage NixBot / WhatsApp)
//  Auteur   : Christus
//  Concept  : l'utilisateur devient une étoile centrale entourée de ses propres
//             planètes-statistiques en orbite, reliées par des lignes de
//             constellation.
//  Canvas   : 1500 × 850 px
// ═══════════════════════════════════════════════════════════════════════════════

const { box, bold, line } = require("../../func/style.js");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
  const cv = require("canvas");
  loadImage = cv.loadImage;
  createCanvas = cv.createCanvas;
  registerFont = cv.registerFont;
  canvasAvailable = true;
} catch (e) {
  console.error("Canvas indisponible :", e.message);
}

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

// ─── Polices (réutilise celles déjà présentes dans assets/fonts, fallback Arial) ─
const FONTS_DIR = path.join(__dirname, "assets", "fonts");
let fontsLoaded = false;
let FONT_FAMILY = "Arial";
function ensureFonts() {
  if (fontsLoaded || !canvasAvailable || !registerFont) return;
  fontsLoaded = true;
  try {
    const boldPath = path.join(FONTS_DIR, "Bold.ttf");
    const semiPath = path.join(FONTS_DIR, "SemiBold.ttf");
    const regPath = path.join(FONTS_DIR, "Regular.ttf");
    let any = false;
    if (fs.existsSync(boldPath)) { registerFont(boldPath, { family: "RF", weight: "bold" }); any = true; }
    if (fs.existsSync(semiPath)) { registerFont(semiPath, { family: "RF", weight: "600" }); any = true; }
    if (fs.existsSync(regPath)) { registerFont(regPath, { family: "RF", weight: "normal" }); any = true; }
    FONT_FAMILY = any ? "RF" : "Arial";
  } catch (e) {
    console.error("[RANK] Erreur de police :", e.message);
    FONT_FAMILY = "Arial";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr); ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h); ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl); ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y); ctx.closePath();
}
function expToLevel(exp) { return Math.floor((1 + Math.sqrt(1 + (8 * exp) / 5)) / 2); }
function levelToExp(l) { return Math.floor(((l ** 2 - l) * 5) / 2); }
function fmt(n) {
  if (!n || isNaN(n) || !Number.isFinite(n)) return "0";
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  20 THÈMES — cartes stellaires, chacun avec sa propre teinte de nébuleuse
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
  nebuleuse_doree: { name: "Nébuleuse Dorée", primary: "#D4AF6A", glowC: "#F4E4BC", bg1: "#0A0704", bg2: "#120D08", neb1: "212,175,106", neb2: "255,220,150" },
  amas_azure: { name: "Amas Azuré", primary: "#5FA8E8", glowC: "#B8DAFF", bg1: "#020610", bg2: "#081020", neb1: "95,168,232", neb2: "150,200,255" },
  voie_pourpre: { name: "Voie Pourpre", primary: "#B873D9", glowC: "#E8C8FF", bg1: "#0A0414", bg2: "#160828", neb1: "184,115,217", neb2: "230,180,255" },
  comete_emeraude: { name: "Comète Émeraude", primary: "#5FD9A0", glowC: "#B8FFD8", bg1: "#020A06", bg2: "#081410", neb1: "95,217,160", neb2: "180,255,210" },
  supernova_corail: { name: "Supernova Corail", primary: "#E87F5F", glowC: "#FFC8A8", bg1: "#100502", bg2: "#1E0A05", neb1: "232,127,95", neb2: "255,180,140" },
  eclipse_argentee: { name: "Éclipse Argentée", primary: "#C8D4E0", glowC: "#F0F4F8", bg1: "#060708", bg2: "#0C0E10", neb1: "200,212,224", neb2: "230,240,250" },
  pulsar_cramoisi: { name: "Pulsar Cramoisi", primary: "#D94060", glowC: "#FFA8C0", bg1: "#100208", bg2: "#1E0410", neb1: "217,64,96", neb2: "255,150,180" },
  quasar_jaune: { name: "Quasar Jaune", primary: "#E0C040", glowC: "#FFEFA0", bg1: "#0E0A02", bg2: "#1A1404", neb1: "224,192,64", neb2: "255,230,150" },
  brume_glaciaire: { name: "Brume Glaciaire", primary: "#7FE0E8", glowC: "#C8FFFF", bg1: "#020A0E", bg2: "#08161A", neb1: "127,224,232", neb2: "180,255,255" },
  astre_carmin: { name: "Astre Carmin", primary: "#C83838", glowC: "#FF9090", bg1: "#100404", bg2: "#1E0808", neb1: "200,56,56", neb2: "255,140,140" },
  constellation_jade: { name: "Constellation Jade", primary: "#40C090", glowC: "#A0F0D0", bg1: "#020E0A", bg2: "#081C14", neb1: "64,192,144", neb2: "160,240,210" },
  voile_lavande: { name: "Voile Lavande", primary: "#9890E0", glowC: "#D0CCFF", bg1: "#08060E", bg2: "#100A1C", neb1: "152,144,224", neb2: "208,204,255" },
  horizon_ambre: { name: "Horizon Ambre", primary: "#E0A040", glowC: "#FFD890", bg1: "#0E0802", bg2: "#1C1004", neb1: "224,160,64", neb2: "255,216,144" },
  zenith_cyan: { name: "Zénith Cyan", primary: "#40D0E0", glowC: "#A0F0FF", bg1: "#020C0E", bg2: "#08181C", neb1: "64,208,224", neb2: "160,240,255" },
  aurore_rosee: { name: "Aurore Rosée", primary: "#E090B0", glowC: "#FFD0E0", bg1: "#0E0408", bg2: "#1C0810", neb1: "224,144,176", neb2: "255,208,224" },
  vortex_indigo: { name: "Vortex Indigo", primary: "#6050D0", glowC: "#B0A0FF", bg1: "#06041A", bg2: "#0C0830", neb1: "96,80,208", neb2: "176,160,255" },
  marais_phosphore: { name: "Marais Phosphoré", primary: "#90E040", glowC: "#D0FFA0", bg1: "#060E02", bg2: "#0C1C04", neb1: "144,224,64", neb2: "208,255,160" },
  crepuscule_violet: { name: "Crépuscule Violet", primary: "#A050C0", glowC: "#E0A0FF", bg1: "#0A0414", bg2: "#140828", neb1: "160,80,192", neb2: "224,160,255" },
  etoile_polaire: { name: "Étoile Polaire", primary: "#E0E8F0", glowC: "#FFFFFF", bg1: "#060810", bg2: "#0C1020", neb1: "224,232,240", neb2: "255,255,255" },
  nova_safran: { name: "Nova Safran", primary: "#E8A030", glowC: "#FFD080", bg1: "#0E0800", bg2: "#1C1000", neb1: "232,160,48", neb2: "255,208,128" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PRIMITIVES DE DESSIN
// ═══════════════════════════════════════════════════════════════════════════════
function T(ctx, s, x, y, sz, color, { align = "left", weight = "bold", glow = null, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${sz}px ${FONT_FAMILY}, Georgia, serif`;
  ctx.textAlign = align; ctx.textBaseline = "middle";
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
  ctx.restore();
}
function GL(ctx, x1, y1, x2, y2, color, w = 1.2) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, "transparent"); g.addColorStop(0.5, color); g.addColorStop(1, "transparent");
  ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

function drawCelestialBg(ctx, W, H, t) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, t.bg1); grad.addColorStop(0.6, t.bg2); grad.addColorStop(1, t.bg1);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  [[W * 0.25, H * 0.2, t.neb1, 420], [W * 0.85, H * 0.85, t.neb2, 360]].forEach(([gx, gy, c, r]) => {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, `rgba(${c},0.10)`); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  ctx.save();
  ctx.strokeStyle = `rgba(${t.neb1},0.05)`; ctx.lineWidth = 0.6;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  const seed = (s) => () => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
  const rnd = seed(4242);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = rnd() * 1.4 + 0.3;
    const alpha = rnd() * 0.7 + 0.15;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W, y = rnd() * H;
    ctx.save();
    ctx.shadowColor = t.primary; ctx.shadowBlur = 8;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

async function drawCentralStar(ctx, avatarBuf, cx, cy, R, level, t) {
  const haloR = R + 30 + Math.min(level * 1.5, 60);
  const haloG = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, haloR);
  haloG.addColorStop(0, `${t.primary}55`); haloG.addColorStop(1, "transparent");
  ctx.fillStyle = haloG;
  ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.strokeStyle = t.primary; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const rayLen = R + 20 + (i % 2 === 0 ? 14 : 0);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    ctx.lineTo(cx + Math.cos(a) * rayLen, cy + Math.sin(a) * rayLen);
    ctx.stroke();
  }
  ctx.restore();

  [0, 1].forEach(i => {
    ctx.save();
    ctx.strokeStyle = t.primary + (i === 0 ? "90" : "40"); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 10 + i * 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  if (avatarBuf) {
    try {
      const img = await loadImage(avatarBuf);
      ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2);
    } catch (_) { drawStarFallback(ctx, cx, cy, R, "?", t); }
  } else {
    drawStarFallback(ctx, cx, cy, R, "?", t);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = t.primary; ctx.lineWidth = 3;
  ctx.shadowColor = t.glowC; ctx.shadowBlur = 20;
  ctx.stroke(); ctx.restore();
}
function drawStarFallback(ctx, cx, cy, R, init, t) {
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  bg.addColorStop(0, t.primary + "CC"); bg.addColorStop(1, t.glowC + "55");
  ctx.fillStyle = bg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  T(ctx, init.toUpperCase(), cx, cy, R * 0.7, "#FFF", { align: "center" });
}

function drawLunarPhaseRing(ctx, cx, cy, R, pct, t) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
  ctx.strokeStyle = t.primary + "60"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * pct;
  ctx.save();
  ctx.shadowColor = t.glowC; ctx.shadowBlur = 12;
  ctx.strokeStyle = t.primary; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, R, startAngle, endAngle); ctx.stroke();
  ctx.restore();

  const tipX = cx + Math.cos(endAngle) * R;
  const tipY = cy + Math.sin(endAngle) * R;
  ctx.save();
  ctx.fillStyle = t.glowC; ctx.shadowColor = t.glowC; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawOrbitPlanet(ctx, centerX, centerY, planetX, planetY, radius, sym, label, val, t, dashed = true) {
  ctx.save();
  ctx.strokeStyle = t.primary + "50"; ctx.lineWidth = 1;
  if (dashed) ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(planetX, planetY); ctx.stroke();
  ctx.restore();

  ctx.save();
  const pg = ctx.createRadialGradient(planetX - radius * 0.3, planetY - radius * 0.3, 0, planetX, planetY, radius);
  pg.addColorStop(0, t.glowC); pg.addColorStop(1, t.primary);
  ctx.shadowColor = t.primary; ctx.shadowBlur = 14;
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(planetX, planetY, radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = t.glowC + "90"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(planetX, planetY, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  T(ctx, sym, planetX, planetY, radius * 0.85, t.bg1, { align: "center", weight: "900" });

  const isRight = planetX >= centerX;
  const labelX = planetX + (isRight ? radius + 12 : -(radius + 12));
  T(ctx, label, labelX, planetY - 9, 11.5, t.primary, { align: isRight ? "left" : "right", weight: "600", alpha: 0.75 });
  T(ctx, val, labelX, planetY + 10, 16, "#FFFFFF", { align: isRight ? "left" : "right", weight: "800" });
}

function drawOrbitRing(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color + "25"; ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS PRINCIPAL — 1500 × 850
// ═══════════════════════════════════════════════════════════════════════════════
const CW = 1500, CH = 850;
const PAD = 30;
const CENTER_X = CW * 0.42;
const CENTER_Y = CH * 0.5;
const STAR_R = 70;
const PANEL_X = CW * 0.74;
const PANEL_W = CW - PANEL_X - PAD;

async function buildCanvas(data, theme, avatarBuf) {
  ensureFonts();
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

  drawCelestialBg(ctx, CW, CH, theme);

  ctx.save();
  ctx.shadowColor = theme.primary; ctx.shadowBlur = 22;
  ctx.strokeStyle = theme.primary; ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, CW - 36, CH - 36);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = theme.primary + "40"; ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, CW - 52, CH - 52);
  ctx.restore();

  T(ctx, "◈  CARTE STELLAIRE PERSONNELLE  ◈", CW / 2, 56, 18, theme.primary, { align: "center", weight: "700", alpha: 0.85 });
  T(ctx, theme.name.toUpperCase(), CW / 2, 80, 12, "#FFFFFF", { align: "center", weight: "600", alpha: 0.4 });

  const level = data.level;
  const exp = data.exp, neededExp = data.neededExp;
  const pct = Math.min(exp / neededExp, 1);

  const orbitRadii = [165, 215, 265];
  orbitRadii.forEach(r => drawOrbitRing(ctx, CENTER_X, CENTER_Y, r, theme.primary));

  await drawCentralStar(ctx, avatarBuf, CENTER_X, CENTER_Y, STAR_R, level, theme);
  drawLunarPhaseRing(ctx, CENTER_X, CENTER_Y, STAR_R + 46, pct, theme);

  T(ctx, data.name.length > 22 ? data.name.slice(0, 20) + "…" : data.name,
    CENTER_X, CENTER_Y + STAR_R + 78, 22, "#FFFFFF", { align: "center", weight: "700" });
  T(ctx, `NIVEAU ${level}  ·  ${(pct * 100).toFixed(1)}% VERS NIV. ${level + 1}`,
    CENTER_X, CENTER_Y + STAR_R + 102, 13, theme.primary, { align: "center", weight: "600" });

  const planets = [
    { sym: "◈", label: "XP TOTAL", val: fmt(data.totalExp), orbit: 0, angleDeg: -55 },
    { sym: "◉", label: "ARGENT", val: fmt(data.money), orbit: 0, angleDeg: 235 },
    { sym: "◆", label: "MESSAGES", val: fmt(data.totalMessages), orbit: 1, angleDeg: -20 },
    { sym: "◇", label: "RANG", val: `#${data.expRank}`, orbit: 1, angleDeg: 200 },
    { sym: "▲", label: "TOP", val: `${data.topPercent}%`, orbit: 2, angleDeg: 15 },
    { sym: "▣", label: "RANG $", val: `#${data.moneyRank}`, orbit: 2, angleDeg: 165 },
  ];
  const planetSizes = [22, 19, 16];

  planets.forEach(p => {
    const r = orbitRadii[p.orbit];
    const a = (p.angleDeg * Math.PI) / 180;
    const px = CENTER_X + Math.cos(a) * r;
    const py = CENTER_Y + Math.sin(a) * r;
    drawOrbitPlanet(ctx, CENTER_X, CENTER_Y, px, py, planetSizes[p.orbit], p.sym, p.label, p.val, theme);
  });

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  rr(ctx, PANEL_X, 110, PANEL_W, CH - 110 - 60, 14);
  ctx.fill();
  ctx.strokeStyle = theme.primary + "60"; ctx.lineWidth = 1.3;
  rr(ctx, PANEL_X, 110, PANEL_W, CH - 110 - 60, 14); ctx.stroke();
  ctx.restore();

  T(ctx, "◈ EPHÉMÉRIDE", PANEL_X + PANEL_W / 2, 140, 15, theme.primary, { align: "center", weight: "700" });
  GL(ctx, PANEL_X + 20, 160, PANEL_X + PANEL_W - 20, 160, theme.primary, 1);

  ctx.save();
  const rg = ctx.createLinearGradient(PANEL_X, 180, PANEL_X + PANEL_W, 260);
  rg.addColorStop(0, theme.primary); rg.addColorStop(1, theme.glowC);
  ctx.font = `900 64px ${FONT_FAMILY}, Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = theme.glowC; ctx.shadowBlur = 24; ctx.fillStyle = rg;
  ctx.fillText(`#${data.expRank}`, PANEL_X + PANEL_W / 2, 225);
  ctx.restore();
  T(ctx, "RANG GLOBAL", PANEL_X + PANEL_W / 2, 268, 11.5, "#FFFFFF", { align: "center", alpha: 0.5, weight: "600" });

  GL(ctx, PANEL_X + 20, 296, PANEL_X + PANEL_W - 20, 296, theme.primary, 1);

  const details = [
    ["Membres observés", String(data.totalUsers)],
    ["XP par jour", fmt(data.expPerDay)],
    ["Constellation", theme.name],
  ];
  details.forEach(([lbl, val], i) => {
    const yy = 330 + i * 56;
    T(ctx, lbl, PANEL_X + 20, yy, 12.5, "#FFFFFF", { alpha: 0.55, weight: "600" });
    T(ctx, val, PANEL_X + 20, yy + 22, 18, theme.primary, { weight: "700" });
  });

  const FOOT_Y = CH - 36;
  GL(ctx, 60, FOOT_Y - 18, CW - 60, FOOT_Y - 18, theme.primary, 1);
  const now = moment().tz("Africa/Douala").format("DD/MM/YYYY  HH:mm");
  T(ctx, `${theme.name}  ·  Christus  ·  ${now}`, CW / 2, FOOT_Y, 12.5, "#FFFFFF", { align: "center", alpha: 0.4, weight: "600" });

  return canvas;
}

// ─── Récupération de l'avatar via Baileys ──────────────────────────────────────
async function loadAvatarBuffer(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, "image").catch(() => null);
    if (url && typeof url === "string") {
      const res = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
      return Buffer.from(res.data);
    }
  } catch (_) {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "rank",
    aliases: ["rk", "classement", "carte"],
    version: "21.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    category: "info",
    description: { en: "◈ Rank Celestial — Carte stellaire personnelle avec 20 constellations exclusives." },
    guide: {
      en:
        "{pn} — votre carte stellaire\n" +
        "{pn} @mention — carte d'un autre membre\n" +
        "{pn} <1-20> — choisir une constellation\n" +
        "{pn} themes — liste des constellations",
    },
  },

  onStart: async function ({ sock, chatId, args, event, senderId, reply, usersData }) {
    if (!canvasAvailable) {
      return reply(box({ title: "Rank Celestial", emoji: "◈", body: "❌ Canvas non installé sur ce serveur." }));
    }

    const command = args[0]?.toLowerCase();

    if (command === "themes" || command === "list") {
      let body = "";
      Object.entries(THEMES).forEach(([, v], i) => {
        body += `${bold(String(i + 1))}. ${v.name}\n`;
      });
      body += `\n${line}\n◆ Utilisez : rank <numéro> pour appliquer une constellation.`;
      return reply(box({ title: "Constellations Rank Celestial", emoji: "◈", body }));
    }

    try {
      const mentionedJid = event.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = event.message?.extendedTextMessage?.contextInfo?.participant;
      let targetId = mentionedJid || quotedParticipant || senderId;

      const themeKeys = Object.keys(THEMES);
      const senderUD0 = await usersData.get(senderId).catch(() => ({})) || {};
      let themeKey = senderUD0.rankConstellation && THEMES[senderUD0.rankConstellation]
        ? senderUD0.rankConstellation
        : themeKeys[Math.floor(Math.random() * themeKeys.length)];

      let explicitThemeArg = null;
      for (const a of args) {
        const n = parseInt(a);
        if (!isNaN(n) && n >= 1 && n <= themeKeys.length) { themeKey = themeKeys[n - 1]; explicitThemeArg = a; break; }
        if (themeKeys.includes(a.toLowerCase())) { themeKey = a.toLowerCase(); explicitThemeArg = a; break; }
      }
      const theme = THEMES[themeKey];

      if (explicitThemeArg) {
        try {
          const ud = (await usersData.get(senderId)) || {};
          ud.rankConstellation = themeKey;
          await usersData.set(senderId, ud);
        } catch (_) {}
      }

      const userData = (await usersData.get(targetId).catch(() => null)) || {};
      const allUsersData = (await usersData.getAll?.().catch(() => [])) || [];

      const cleanTarget = targetId.split(":")[0].split("@")[0];
      const withExp = allUsersData.filter(u => (u?.exp || 0) > 0);
      const sortedExp = [...withExp].sort((a, b) => (b.exp || 0) - (a.exp || 0));
      const findClean = (u) => (u.id || u.senderID || "").split(":")[0].split("@")[0];
      let expRank = sortedExp.findIndex(u => findClean(u) === cleanTarget) + 1;
      if (expRank <= 0) expRank = allUsersData.length || 1;

      const withMoney = allUsersData.filter(u => (u?.money || 0) > 0);
      const sortedMoney = [...withMoney].sort((a, b) => (b.money || 0) - (a.money || 0));
      let moneyRank = sortedMoney.findIndex(u => findClean(u) === cleanTarget) + 1;
      if (moneyRank <= 0) moneyRank = allUsersData.length || 1;

      const exp = userData.exp || 0;
      const level = expToLevel(exp);
      const currentLevelExp = levelToExp(level);
      const nextLevelExp = levelToExp(level + 1);
      const progressExp = Math.max(0, exp - currentLevelExp);
      const neededExp = Math.max(1, nextLevelExp - currentLevelExp);
      const expPerDay = userData.lastActive && (Date.now() - userData.lastActive < 30 * 86400000)
        ? Math.round(exp / 30) : 0;
      const totalUsers = sortedExp.length || allUsersData.length || 1;
      const topPercent = ((totalUsers - expRank + 1) / totalUsers * 100).toFixed(1);

      const displayName = (targetId === senderId && event.pushName) ? event.pushName : (userData.name || `User_${cleanTarget}`);

      const renderData = {
        uid: cleanTarget,
        name: displayName,
        level,
        exp: progressExp,
        neededExp,
        totalExp: exp,
        money: userData.money || 0,
        totalMessages: Number(userData.msgCount) || 0,
        expPerDay,
        expRank,
        moneyRank,
        totalUsers,
        topPercent,
      };

      const avatarBuf = await loadAvatarBuffer(sock, targetId);
      const canvas = await buildCanvas(renderData, theme, avatarBuf);
      const buffer = canvas.toBuffer("image/png");

      const isSelf = targetId === senderId;
      const rankMedal = expRank === 1 ? "[ I ]" : expRank === 2 ? "[ II ]" : expRank === 3 ? "[ III ]" : `#${expRank}`;

      const captionBody = [
        `◆ ${bold("Rang global")}   : ${rankMedal}  (Top ${topPercent}%)`,
        `◈ ${bold("Niveau")}        : ${level}`,
        `◉ ${bold("XP total")}      : ${fmt(renderData.totalExp)}`,
        `▣ ${bold("Progression")}   : ${((progressExp / neededExp) * 100).toFixed(1)}%`,
        `◇ ${bold("Argent")}        : ${fmt(renderData.money)}`,
        `▲ ${bold("Messages")}      : ${fmt(renderData.totalMessages)}`,
        `◎ ${bold("Constellation")} : ${theme.name}`,
      ].join("\n");

      const caption = box({
        title: isSelf ? "Votre Carte Stellaire" : `Carte Stellaire — ${displayName}`,
        emoji: "◈",
        body: captionBody,
      });

      await sock.sendMessage(chatId, { image: buffer, caption }, { quoted: event });
    } catch (error) {
      console.error("[RANK] Erreur :", error);
      return reply(box({ title: "Rank Celestial", emoji: "❌", body: "Une erreur est survenue lors de la génération de la carte stellaire." }));
    }
  },
};
