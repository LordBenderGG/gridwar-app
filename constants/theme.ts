// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceBright: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  secondaryGlow: string;
  accent: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
  dangerGlow: string;
  success: string;
  warning: string;
  purple: string;
  purpleLight: string;
  border: string;
  borderBright: string;
  overlay: string;
  X: string;
  O: string;
  gradientPrimary: readonly [string, string];
  gradientFire: readonly [string, string];
  gradientGold: readonly [string, string];
  gradientPurple: readonly [string, string];
  gradientDark: readonly [string, string];
};

// ─── Tema OSCURO (por defecto) ────────────────────────────────────────────────
// Paleta amigable para sesiones largas — sin neons duros, tons suaves
export const DARK_COLORS: ThemeColors = {
  background: '#0F1624',       // Azul marino profundo, más cálido que negro puro
  surface: '#182234',          // Superficie oscura azulada
  surfaceLight: '#1E2D45',     // Superficie intermedia
  surfaceBright: '#253550',    // Superficie brillante para cards activas
  primary: '#60A5FA',          // Azul suave — mucho menos agresivo que el cyan
  primaryDark: '#3B82F6',      // Azul más oscuro
  secondary: '#FB7185',        // Rosa/coral suave (reemplaza naranja duro)
  secondaryGlow: '#FDA4AF',    // Rosa más claro
  accent: '#FCD34D',           // Ámbar cálido (reemplaza amarillo neón)
  text: '#E2E8F0',             // Blanco suave, reduce fatiga visual
  textSecondary: '#8B9CB8',    // Azul-gris neutro
  textMuted: '#4A5E80',        // Atenuado oscuro
  danger: '#F87171',           // Rojo suave
  dangerGlow: '#FCA5A5',       // Rojo más claro
  success: '#34D399',          // Verde menta calmado
  warning: '#FBBF24',          // Ámbar cálido
  purple: '#A78BFA',           // Violeta suave
  purpleLight: '#C4B5FD',      // Violeta claro
  border: '#1E3050',           // Borde oscuro
  borderBright: '#2A4060',     // Borde más visible
  overlay: 'rgba(0,0,0,0.85)',
  X: '#60A5FA',
  O: '#FB7185',
  gradientPrimary: ['#60A5FA', '#3B82F6'] as const,
  gradientFire: ['#FB7185', '#F43F5E'] as const,
  gradientGold: ['#FCD34D', '#F59E0B'] as const,
  gradientPurple: ['#A78BFA', '#7C3AED'] as const,
  gradientDark: ['#182234', '#0F1624'] as const,
};

// ─── Tema CLARO ───────────────────────────────────────────────────────────────
export const LIGHT_COLORS: ThemeColors = {
  background: '#F0F4F8',       // Gris azulado claro, no blanco puro
  surface: '#FFFFFF',          // Blanco
  surfaceLight: '#E8F0FA',     // Azul muy claro
  surfaceBright: '#D4E5F7',    // Azul claro brillante
  primary: '#2563EB',          // Azul fuerte, buen contraste
  primaryDark: '#1D4ED8',      // Azul más oscuro
  secondary: '#E11D48',        // Rosa/rojo
  secondaryGlow: '#F43F5E',    // Rosa más brillante
  accent: '#D97706',           // Ámbar oscuro
  text: '#1E293B',             // Slate oscuro, no negro puro
  textSecondary: '#475569',    // Slate medio
  textMuted: '#94A3B8',        // Slate claro
  danger: '#DC2626',           // Rojo
  dangerGlow: '#EF4444',       // Rojo más claro
  success: '#16A34A',          // Verde
  warning: '#B45309',          // Ámbar oscuro
  purple: '#7C3AED',           // Violeta
  purpleLight: '#8B5CF6',      // Violeta más claro
  border: '#CBD5E1',           // Borde claro
  borderBright: '#94A3B8',     // Borde visible
  overlay: 'rgba(0,0,0,0.5)',
  X: '#2563EB',
  O: '#E11D48',
  gradientPrimary: ['#2563EB', '#1D4ED8'] as const,
  gradientFire: ['#E11D48', '#DC2626'] as const,
  gradientGold: ['#D97706', '#B45309'] as const,
  gradientPurple: ['#7C3AED', '#6D28D9'] as const,
  gradientDark: ['#F0F4F8', '#E2EBF5'] as const,
};

// Alias retrocompatible (tema oscuro por defecto)
export const COLORS = DARK_COLORS;

// ─── Fuentes ──────────────────────────────────────────────────────────────────
export const FONTS = {
  regular: 'System',
  bold: 'System',
};

// ─── Constantes de juego ──────────────────────────────────────────────────────
export const TIMER_TOTAL = 30;
export const CHALLENGE_TIMEOUT = 30;
export const BLOCK_AFTER_LOSS_HOURS = 3;
export const BLOCK_AFTER_REJECT_MINUTES = 30;
export const POINTS_WIN = 100;
export const POINTS_LOSS = -30;
export const POINTS_NO_ACCEPT = -50;
export const GEMS_PER_POINTS = 500;

// XP ganado por resultado
export const XP_WIN = 30;
export const XP_LOSS = 10;

// Tabla de niveles XP (nivel 1-50)
export const LEVEL_TABLE: { level: number; xpRequired: number }[] = Array.from(
  { length: 50 },
  (_, i) => ({
    level: i + 1,
    xpRequired: i === 0 ? 0 : Math.floor(100 * Math.pow(1.18, i)),
  })
);

export const calculateLevel = (xp: number): number => {
  let level = 1;
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_TABLE[i].xpRequired) {
      level = LEVEL_TABLE[i].level;
      break;
    }
  }
  return level;
};
