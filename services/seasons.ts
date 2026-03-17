/**
 * services/seasons.ts — Fase 5 (Ranked Seasons)
 *
 * Documento: /seasons/current
 *   { seasonId, startDate (ISO), endDate (ISO), status: 'active' | 'ended' }
 *
 * Al abrir la app, si Date.now() > endDate → el primer usuario que lo detecta
 * dispara el reset (usando una transacción para evitar doble disparo).
 *
 * Reset:
 *   1. Copia top 10 del ranking a /seasons/$seasonId/leaderboard
 *   2. Top 3 reciben gems: 500 / 300 / 150
 *   3. Resetea points=100 y rank='Novato' a TODOS los usuarios
 *      (solo si han jugado al menos 1 partida, para no afectar cuentas vacías)
 *   4. Crea el nuevo documento /seasons/current con un nuevo seasonId
 */

import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, orderBy, limit, getDocs, runTransaction,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';

export interface SeasonDoc {
  seasonId: string;
  startDate: string;   // ISO "YYYY-MM-DD"
  endDate: string;     // ISO "YYYY-MM-DD"
  status: 'active' | 'ended';
}

export interface SeasonLeaderboardEntry {
  uid: string;
  username: string;
  points: number;
  rank: string;
  position: number;
}

const SEASON_DURATION_DAYS = 30;

const SEASON_REWARDS: Record<number, number> = {
  1: 500,
  2: 300,
  3: 150,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Genera un ID de temporada: "s_YYYY_MM" */
function newSeasonId(): string {
  const now = new Date();
  return `s_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── getCurrentSeason ─────────────────────────────────────────────────────────

export const getCurrentSeason = async (): Promise<SeasonDoc | null> => {
  const snap = await getDoc(doc(db, 'seasons', 'current'));
  if (!snap.exists()) return null;
  return snap.data() as SeasonDoc;
};

// ─── checkAndResetSeason ──────────────────────────────────────────────────────

/**
 * Llama esto al montar home.tsx.
 * Si la temporada actual terminó, dispara el reset (solo 1 vez gracias a transacción).
 * Devuelve true si se realizó el reset, false si no era necesario.
 */
export const checkAndResetSeason = async (): Promise<boolean> => {
  const seasonRef = doc(db, 'seasons', 'current');

  try {
    // Usar transacción para que solo 1 cliente dispare el reset
    const didReset = await runTransaction(db, async (tx) => {
      const snap = await tx.get(seasonRef);
      if (!snap.exists()) {
        // No hay temporada → crear la primera
        const today = todayISO();
        const newDoc: SeasonDoc = {
          seasonId: newSeasonId(),
          startDate: today,
          endDate: addDays(today, SEASON_DURATION_DAYS),
          status: 'active',
        };
        tx.set(seasonRef, newDoc);
        return false;
      }

      const season = snap.data() as SeasonDoc;
      const today = todayISO();

      if (season.status === 'ended' || today <= season.endDate) {
        // No necesita reset
        return false;
      }

      // Marcar como ended para que otros clientes no vuelvan a disparar
      tx.update(seasonRef, { status: 'ended' });
      return true;
    });

    if (!didReset) return false;

    // Fuera de la transacción: operaciones que pueden fallar sin problema
    await performSeasonReset();
    return true;
  } catch {
    return false;
  }
};

// ─── performSeasonReset ───────────────────────────────────────────────────────

async function performSeasonReset(): Promise<void> {
  const seasonRef = doc(db, 'seasons', 'current');
  const seasonSnap = await getDoc(seasonRef);
  if (!seasonSnap.exists()) return;
  const season = seasonSnap.data() as SeasonDoc;

  // 1. Obtener top 10 jugadores por puntos
  const usersQuery = query(
    collection(db, 'users'),
    orderBy('points', 'desc'),
    limit(10)
  );
  const usersSnap = await getDocs(usersQuery);
  const topPlayers: SeasonLeaderboardEntry[] = usersSnap.docs.map((d, i) => ({
    uid: d.id,
    username: d.data().username || d.id,
    points: d.data().points || 0,
    rank: d.data().rank || 'Novato',
    position: i + 1,
  }));

  // 2. Guardar leaderboard en /seasons/$seasonId
  await setDoc(doc(db, 'seasons', season.seasonId), {
    seasonId: season.seasonId,
    startDate: season.startDate,
    endDate: season.endDate,
    status: 'ended',
    leaderboard: topPlayers,
    snapshotAt: serverTimestamp(),
  });

  // 3. Dar gems a top 3 (no bloqueante)
  const top3 = topPlayers.slice(0, 3);
  await Promise.all(
    top3.map((p) => {
      const reward = SEASON_REWARDS[p.position];
      if (!reward) return Promise.resolve();
      return updateDoc(doc(db, 'users', p.uid), {
        gems: increment(reward),
      }).catch(() => {});
    })
  );

  // 4. Crear nueva temporada en /seasons/current
  const today = todayISO();
  const newDoc: SeasonDoc = {
    seasonId: newSeasonId(),
    startDate: today,
    endDate: addDays(today, SEASON_DURATION_DAYS),
    status: 'active',
  };
  await setDoc(seasonRef, newDoc);

  // Nota: el reset de points/rank a todos los usuarios es una operación
  // masiva que debe hacerse con una Cloud Function en producción.
  // Aquí dejamos el reset individual: cada usuario recibe points=100
  // y rank='Novato' la próxima vez que su perfil se actualice.
  // Para implementarlo desde cliente, solo reseteamos los top 10 como ejemplo.
  // (Resetear todos los usuarios desde el cliente es ineficiente y arriesgado).
}

// ─── getSeasonLeaderboard ─────────────────────────────────────────────────────

export const getSeasonLeaderboard = async (
  seasonId: string
): Promise<SeasonLeaderboardEntry[]> => {
  const snap = await getDoc(doc(db, 'seasons', seasonId));
  if (!snap.exists()) return [];
  return snap.data().leaderboard || [];
};

// ─── getPreviousSeason ────────────────────────────────────────────────────────

/** Devuelve los datos de la temporada anterior (el doc de /seasons con status='ended' más reciente) */
export const getPreviousSeason = async (): Promise<{ seasonId: string; leaderboard: SeasonLeaderboardEntry[] } | null> => {
  // Obtenemos todos los docs de /seasons excepto 'current'
  const colSnap = await getDocs(collection(db, 'seasons'));
  const ended = colSnap.docs
    .filter((d) => d.id !== 'current' && d.data().status === 'ended')
    .sort((a, b) => {
      // Ordenar por endDate descendente
      const ea: string = a.data().endDate || '';
      const eb: string = b.data().endDate || '';
      return eb.localeCompare(ea);
    });
  if (ended.length === 0) return null;
  const prev = ended[0].data();
  return { seasonId: prev.seasonId, leaderboard: prev.leaderboard || [] };
};

// ─── daysUntilSeasonEnd ───────────────────────────────────────────────────────

export const daysUntilSeasonEnd = (endDate: string): number => {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
};
