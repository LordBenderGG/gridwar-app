/**
 * services/achievements.ts
 * Sistema de logros / achievements (Fase 2B)
 *
 * Subcolección: /users/$uid/achievements/{achievementId}
 * Documento: { id: string, unlockedAt: number }
 */
import {
  doc, getDoc, setDoc, collection, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  gems: number;
  currentWinStreak: number;
  tournamentsWon: number;
  // Contadores adicionales almacenados en Firestore
  wildcardsUsedTotal: number;   // campo /users/$uid.wildcardsUsedTotal
  shopPurchasesTotal: number;   // campo /users/$uid.shopPurchasesTotal
  dailyLoginStreak: number;     // campo /users/$uid.dailyLoginStreak
  tournamentCreated: number;    // campo /users/$uid.tournamentCreated
  // Resultado del último partido (para perfect_match)
  lastMatchScore?: { winner: number; loser: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    label: 'Primera Victoria',
    description: 'Gana tu primera partida',
    icon: '🏅',
    condition: (s) => s.wins >= 1,
  },
  {
    id: 'win_streak_5',
    label: 'Racha Imparable',
    description: '5 victorias seguidas',
    icon: '🔥',
    condition: (s) => s.currentWinStreak >= 5,
  },
  {
    id: 'tournament_winner',
    label: 'Campeón de Torneo',
    description: 'Gana un torneo',
    icon: '🏆',
    condition: (s) => s.tournamentsWon >= 1,
  },
  {
    id: 'tournament_creator',
    label: 'Organizador',
    description: 'Crea 3 torneos',
    icon: '📋',
    condition: (s) => s.tournamentCreated >= 3,
  },
  {
    id: 'wildcard_master',
    label: 'Maestro de Comodines',
    description: 'Usa 50 comodines en total',
    icon: '🃏',
    condition: (s) => s.wildcardsUsedTotal >= 50,
  },
  {
    id: 'gem_hoarder',
    label: 'Acaparador',
    description: 'Acumula 1000 gemas',
    icon: '💎',
    condition: (s) => s.gems >= 1000,
  },
  {
    id: 'perfect_match',
    label: 'Perfecto',
    description: 'Gana una partida 2-0',
    icon: '⭐',
    condition: (s) => !!(s.lastMatchScore && s.lastMatchScore.winner >= 2 && s.lastMatchScore.loser === 0),
  },
  {
    id: '100_games',
    label: 'Centenario',
    description: 'Juega 100 partidas',
    icon: '💯',
    condition: (s) => s.gamesPlayed >= 100,
  },
  {
    id: 'shop_addict',
    label: 'Comprador Compulsivo',
    description: '10 compras en la tienda',
    icon: '🛒',
    condition: (s) => s.shopPurchasesTotal >= 10,
  },
  {
    id: 'daily_7',
    label: 'Fiel',
    description: '7 días consecutivos de login',
    icon: '📅',
    condition: (s) => s.dailyLoginStreak >= 7,
  },
  {
    id: 'first_tournament',
    label: 'Debutante',
    description: 'Participa en tu primer torneo',
    icon: '🎟️',
    condition: (s) => s.tournamentCreated >= 1 || s.tournamentsWon >= 1,
  },
  {
    id: 'veteran',
    label: 'Veterano',
    description: 'Juega 50 partidas',
    icon: '⚔️',
    condition: (s) => s.gamesPlayed >= 50,
  },
  {
    id: 'gem_collector',
    label: 'Coleccionista',
    description: 'Acumula 500 gemas',
    icon: '💰',
    condition: (s) => s.gems >= 500,
  },
  {
    id: 'win_10',
    label: 'Guerrero',
    description: 'Gana 10 partidas',
    icon: '🗡️',
    condition: (s) => s.wins >= 10,
  },
  {
    id: 'win_50',
    label: 'Leyenda',
    description: 'Gana 50 partidas',
    icon: '👑',
    condition: (s) => s.wins >= 50,
  },
];

/**
 * Devuelve los logros ya desbloqueados del usuario.
 */
export const getUserAchievements = async (uid: string): Promise<string[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'achievements'));
  return snap.docs.map((d) => d.id);
};

/**
 * Evalúa todos los logros y desbloquea los nuevos.
 * Devuelve los IDs de logros recién desbloqueados.
 */
export const checkAndUnlock = async (
  uid: string,
  stats: AchievementStats
): Promise<string[]> => {
  const alreadyUnlocked = await getUserAchievements(uid);
  const newlyUnlocked: string[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (alreadyUnlocked.includes(ach.id)) continue;
    if (ach.condition(stats)) {
      await setDoc(doc(db, 'users', uid, 'achievements', ach.id), {
        id: ach.id,
        unlockedAt: Date.now(),
      });
      newlyUnlocked.push(ach.id);
    }
  }

  return newlyUnlocked;
};
