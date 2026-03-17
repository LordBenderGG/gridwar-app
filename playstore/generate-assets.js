/**
 * Genera Feature Graphic (1024x500) y Screenshots placeholder (1080x1920)
 * para la ficha de Play Store.
 *
 * Uso: node playstore/generate-assets.js
 */
const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname);

// Colores de la app
const BG = '#0A0E1A';
const CYAN = '#00F5FF';
const YELLOW = '#FFD600';
const WHITE = '#E0E0E0';
const SURFACE = '#141829';

// ─── Feature Graphic 1024x500 ───────────────────────────────────────────────
async function featureGraphic() {
  const w = 1024, h = 500;
  const svg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0A0E1A"/>
        <stop offset="100%" style="stop-color:#141829"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    
    <!-- Grid lines decorativas -->
    <line x1="160" y1="120" x2="160" y2="380" stroke="${CYAN}" stroke-width="3" opacity="0.3"/>
    <line x1="280" y1="120" x2="280" y2="380" stroke="${CYAN}" stroke-width="3" opacity="0.3"/>
    <line x1="40" y1="210" x2="400" y2="210" stroke="${CYAN}" stroke-width="3" opacity="0.3"/>
    <line x1="40" y1="300" x2="400" y2="300" stroke="${CYAN}" stroke-width="3" opacity="0.3"/>

    <!-- X y O en el grid -->
    <text x="100" y="185" font-family="Arial Black" font-size="60" fill="${CYAN}" text-anchor="middle" filter="url(#glow)">X</text>
    <text x="220" y="275" font-family="Arial Black" font-size="60" fill="${YELLOW}" text-anchor="middle" filter="url(#glow)">O</text>
    <text x="340" y="185" font-family="Arial Black" font-size="60" fill="${CYAN}" text-anchor="middle" filter="url(#glow)">X</text>
    <text x="100" y="365" font-family="Arial Black" font-size="60" fill="${YELLOW}" text-anchor="middle" filter="url(#glow)">O</text>
    <text x="220" y="185" font-family="Arial Black" font-size="40" fill="#333" text-anchor="middle">?</text>

    <!-- Titulo -->
    <text x="700" y="200" font-family="Arial Black" font-size="90" fill="${CYAN}" text-anchor="middle" filter="url(#glow)" letter-spacing="12">TIKTAK</text>
    
    <!-- Subtitulo -->
    <text x="700" y="270" font-family="Arial" font-size="26" fill="${YELLOW}" text-anchor="middle" letter-spacing="4">TIC-TAC-TOE &#xB7; NO MERCY</text>

    <!-- Badges -->
    <rect x="500" y="310" width="155" height="40" rx="20" fill="${CYAN}" opacity="0.15"/>
    <text x="577" y="337" font-family="Arial" font-size="16" fill="${CYAN}" text-anchor="middle" font-weight="bold">8 WILDCARDS</text>
    
    <rect x="670" y="310" width="140" height="40" rx="20" fill="${YELLOW}" opacity="0.15"/>
    <text x="740" y="337" font-family="Arial" font-size="16" fill="${YELLOW}" text-anchor="middle" font-weight="bold">7 RANKS</text>
    
    <rect x="825" y="310" width="160" height="40" rx="20" fill="#FF6B35" opacity="0.15"/>
    <text x="905" y="337" font-family="Arial" font-size="16" fill="#FF6B35" text-anchor="middle" font-weight="bold">REAL-TIME</text>

    <!-- Iconos comodin -->
    <text x="540" y="420" font-size="32" text-anchor="middle">&#x2744;&#xFE0F;</text>
    <text x="600" y="420" font-size="32" text-anchor="middle">&#x26A1;</text>
    <text x="660" y="420" font-size="32" text-anchor="middle">&#x1F300;</text>
    <text x="720" y="420" font-size="32" text-anchor="middle">&#x1F6E1;&#xFE0F;</text>
    <text x="780" y="420" font-size="32" text-anchor="middle">&#x1F635;</text>
    <text x="840" y="420" font-size="32" text-anchor="middle">&#x1F4A3;</text>

    <!-- Borde glow inferior -->
    <rect x="0" y="490" width="${w}" height="10" fill="${CYAN}" opacity="0.4"/>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'feature-graphic.png'));
  console.log('feature-graphic.png (1024x500) OK');
}

// ─── Screenshot generico ────────────────────────────────────────────────────
async function screenshot(filename, title, subtitle, items, accentColor) {
  const w = 1080, h = 1920;
  const itemsSvg = items.map((item, i) => `
    <rect x="80" y="${680 + i * 160}" width="920" height="130" rx="20" fill="${SURFACE}" stroke="${accentColor}" stroke-width="1" opacity="0.8"/>
    <text x="140" y="${755 + i * 160}" font-family="Arial" font-size="36" fill="${accentColor}">${item.icon}</text>
    <text x="210" y="${745 + i * 160}" font-family="Arial Black" font-size="30" fill="${WHITE}">${item.name}</text>
    <text x="210" y="${785 + i * 160}" font-family="Arial" font-size="22" fill="#888">${item.desc}</text>
  `).join('');

  const svg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${BG}"/>
    <rect x="0" y="0" width="${w}" height="8" fill="${accentColor}"/>
    
    <!-- Status bar fake -->
    <text x="40" y="60" font-family="Arial" font-size="24" fill="#666">9:41</text>
    
    <!-- Header -->
    <text x="540" y="250" font-family="Arial Black" font-size="72" fill="${accentColor}" text-anchor="middle" letter-spacing="8">${title}</text>
    <text x="540" y="320" font-family="Arial" font-size="30" fill="#888" text-anchor="middle">${subtitle}</text>

    <!-- Linea separadora -->
    <line x1="200" y1="380" x2="880" y2="380" stroke="${accentColor}" stroke-width="2" opacity="0.3"/>

    <!-- Logo TIKTAK mini -->
    <text x="540" y="500" font-family="Arial Black" font-size="100" fill="${accentColor}" text-anchor="middle" opacity="0.1" letter-spacing="15">TIKTAK</text>

    ${itemsSvg}

    <!-- Footer -->
    <rect x="0" y="1880" width="${w}" height="40" fill="${accentColor}" opacity="0.3"/>
    <text x="540" y="1908" font-family="Arial" font-size="20" fill="${WHITE}" text-anchor="middle">TIKTAK - No Mercy</text>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, filename));
  console.log(`${filename} (1080x1920) OK`);
}

async function main() {
  await featureGraphic();

  await screenshot('screenshot-1-wildcards.png', 'WILDCARDS', '8 powers to dominate the board', [
    { icon: '❄️', name: 'Freeze', desc: 'Opponent loses their next turn' },
    { icon: '🌀', name: 'Teleport', desc: 'Move your piece anywhere' },
    { icon: '🛡️', name: 'Shield', desc: 'Block enemy wildcards' },
    { icon: '💥', name: 'Earthquake', desc: 'Scramble all enemy pieces' },
    { icon: '⚡', name: 'Turbo', desc: 'Reset your timer to 30s' },
    { icon: '😵', name: 'Confusion', desc: 'Invert opponent board view' },
    { icon: '💣', name: 'Sabotage', desc: 'Relocate their last move' },
  ], CYAN);

  await screenshot('screenshot-2-ranks.png', 'RANKS', 'Climb from Rookie to Legend', [
    { icon: '🪨', name: 'Rookie', desc: '0 - 199 points' },
    { icon: '🥉', name: 'Bronze', desc: '200 - 499 points' },
    { icon: '🥈', name: 'Silver', desc: '500 - 999 points' },
    { icon: '🥇', name: 'Gold', desc: '1000 - 1999 points' },
    { icon: '💎', name: 'Diamond', desc: '2000 - 3999 points' },
    { icon: '👑', name: 'Master', desc: '4000 - 7999 points' },
    { icon: '💀', name: 'Legend', desc: '8000+ points' },
  ], YELLOW);

  await screenshot('screenshot-3-features.png', 'FEATURES', 'Everything you need to dominate', [
    { icon: '⚔️', name: 'Real-Time PvP', desc: 'Challenge any player instantly' },
    { icon: '🏆', name: 'Tournaments', desc: 'Up to 16 players, elimination bracket' },
    { icon: '💀', name: 'Hall of Shame', desc: 'Worst losers displayed publicly' },
    { icon: '🎯', name: 'Daily Missions', desc: 'Complete challenges for gems' },
    { icon: '🛒', name: 'Shop', desc: 'Wildcards, frames, themes and more' },
    { icon: '🏅', name: '15+ Achievements', desc: 'Track your progress' },
    { icon: '📍', name: 'Local Mode', desc: 'Play on your WiFi network' },
  ], '#FF6B35');

  console.log('\nAll assets generated in playstore/');
}

main().catch(console.error);
