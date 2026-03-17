/**
 * Genera 4 imagenes promocionales (1024x500) con logo + "Disponible en Play Store".
 * Uso: node playstore/generate-promos.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1024;
const H = 500;
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'logo.png');
const OUT_DIR = path.join(__dirname, 'promos');

const THEMES = [
  {
    file: 'promo-1-duelo.png',
    title: 'DUEL0S EN TIEMPO REAL',
    subtitle: 'Reta jugadores y domina el tablero',
    gradA: '#071122',
    gradB: '#0C2B43',
    accent: '#00E5FF',
  },
  {
    file: 'promo-2-torneos.png',
    title: 'TORNEOS CON LLAVES',
    subtitle: 'Globales y locales con recompensas',
    gradA: '#140B23',
    gradB: '#2A164A',
    accent: '#FFD166',
  },
  {
    file: 'promo-3-comodines.png',
    title: 'COMODINES EPICOS',
    subtitle: 'Congela, teleporta y cambia la partida',
    gradA: '#101A0A',
    gradB: '#20401A',
    accent: '#82FF9E',
  },
  {
    file: 'promo-4-ranking.png',
    title: 'SUBE EN EL RANKING',
    subtitle: 'Gana puntos, gemas y prestigio',
    gradA: '#2A1108',
    gradB: '#4A1F0F',
    accent: '#FFB074',
  },
];

function buildSvg(theme) {
  return `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.gradA}"/>
        <stop offset="100%" stop-color="${theme.gradB}"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${theme.accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="8" fill="${theme.accent}"/>
    <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${theme.accent}" opacity="0.75"/>

    <rect x="36" y="40" width="620" height="420" rx="24" fill="#FFFFFF" opacity="0.04"/>
    <rect x="36" y="210" width="952" height="64" fill="url(#glow)"/>

    <text x="370" y="180" font-family="Arial Black, Arial" font-size="56" fill="#FFFFFF" letter-spacing="2">${theme.title}</text>
    <text x="370" y="232" font-family="Arial, sans-serif" font-size="28" fill="#E7EDF5">${theme.subtitle}</text>

    <rect x="370" y="286" width="360" height="64" rx="32" fill="#111820" stroke="${theme.accent}" stroke-width="2"/>
    <circle cx="404" cy="318" r="12" fill="#34A853"/>
    <text x="430" y="326" font-family="Arial Black, Arial" font-size="26" fill="#FFFFFF">Disponible en Play Store</text>

    <text x="370" y="400" font-family="Arial, sans-serif" font-size="22" fill="${theme.accent}">DESCARGA GRIDWAR HOY</text>
  </svg>`;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generateOne(theme) {
  const base = sharp(Buffer.from(buildSvg(theme)));
  const logoBuffer = await sharp(LOGO)
    .resize(230, 230, { fit: 'contain' })
    .png()
    .toBuffer();

  await base
    .composite([
      {
        input: logoBuffer,
        left: 760,
        top: 130,
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, theme.file));
}

async function main() {
  await ensureDir(OUT_DIR);

  for (const t of THEMES) {
    await generateOne(t);
    console.log(`OK ${t.file}`);
  }

  console.log(`\nGeneradas 4 promos en: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
