export const COLORS = {
  background: '#060A14',      // Negro profundo con tinte azul
  surface: '#0D1526',         // Superficie oscura
  surfaceLight: '#152035',    // Superficie clara
  surfaceBright: '#1C2D4A',   // Superficie brillante para tarjetas activas
  primary: '#00EEFF',         // Cyan eléctrico
  primaryDark: '#00B8CC',     // Cyan oscuro
  secondary: '#FF5722',       // Naranja fuego
  secondaryGlow: '#FF7043',   // Naranja brillante
  accent: '#FFD600',          // Amarillo neón
  text: '#FFFFFF',
  textSecondary: '#8899BB',
  textMuted: '#4A6080',
  danger: '#FF1744',
  dangerGlow: '#FF4569',
  success: '#00E676',
  warning: '#FFAB00',
  purple: '#AA00FF',
  purpleLight: '#CC33FF',
  border: '#1E3050',
  borderBright: '#2A4570',
  overlay: 'rgba(0,0,0,0.85)',
  X: '#00EEFF',
  O: '#FF5722',

  // Gradientes (definidos como arrays para LinearGradient)
  gradientPrimary: ['#00EEFF', '#0066CC'] as const,
  gradientFire: ['#FF5722', '#FF1744'] as const,
  gradientGold: ['#FFD600', '#FF8F00'] as const,
  gradientPurple: ['#AA00FF', '#6600CC'] as const,
  gradientDark: ['#0D1526', '#060A14'] as const,
};

export const FONTS = {
  regular: 'System',
  bold: 'System',
};

export const TIMER_TOTAL = 30;
export const CHALLENGE_TIMEOUT = 30;
export const BLOCK_AFTER_LOSS_HOURS = 3;
export const BLOCK_AFTER_REJECT_MINUTES = 30;
export const POINTS_WIN = 100;
export const POINTS_LOSS = -30;
export const POINTS_NO_ACCEPT = -50;
export const GEMS_PER_POINTS = 500;
