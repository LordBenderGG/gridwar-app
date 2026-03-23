import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  onSnapshot,
  doc,
  getDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from './auth';
import i18n from '../i18n';

export const RANKS = [
  { key: 'novato',   name: 'Novato',   min: 0,    max: 199,      icon: '🔰', color: '#9E9E9E' },
  { key: 'bronce',   name: 'Bronce',   min: 200,  max: 499,      icon: '🥉', color: '#CD7F32' },
  { key: 'plata',    name: 'Plata',    min: 500,  max: 999,      icon: '🥈', color: '#C0C0C0' },
  { key: 'oro',      name: 'Oro',      min: 1000, max: 1999,     icon: '🥇', color: '#FFD700' },
  { key: 'diamante', name: 'Diamante', min: 2000, max: 3999,     icon: '💎', color: '#00BFFF' },
  { key: 'maestro',  name: 'Maestro',  min: 4000, max: 7999,     icon: '👑', color: '#9B59B6' },
  { key: 'leyenda',  name: 'Leyenda',  min: 8000, max: Infinity, icon: '🏆', color: '#FFD700' },
];

/** Devuelve el nombre del rango traducido al idioma actual */
export const getTranslatedRankName = (rankName: string): string => {
  const rank = RANKS.find((r) => r.name === rankName);
  if (!rank) return rankName;
  return i18n.t(`ranks.${rank.key}`);
};

export const calculateRank = (points: number): string => {
  for (const rank of RANKS) {
    if (points >= rank.min && points <= rank.max) return rank.name;
  }
  return 'Novato';
};

export const getRankInfo = (rankName: string) => {
  return RANKS.find((r) => r.name === rankName) || RANKS[0];
};

export const getTopPlayers = async (limitCount = 10): Promise<UserProfile[]> => {
  const q = query(
    collection(db, 'users'),
    orderBy('points', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const getBottomPlayers = async (limitCount = 10): Promise<UserProfile[]> => {
  const q = query(
    collection(db, 'users'),
    orderBy('points', 'asc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const getAllPlayers = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, 'users'), orderBy('points', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const subscribeToTopPlayers = (
  callback: (players: UserProfile[]) => void,
  limitCount = 10,
  mode: 'global' | 'local' = 'global'
): (() => void) => {
  const q = query(
    collection(db, 'users'),
    where('mode', '==', mode),
    orderBy('points', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as UserProfile));
  });
};

export const subscribeToBottomPlayers = (
  callback: (players: UserProfile[]) => void,
  limitCount = 10,
  mode: 'global' | 'local' = 'global'
): (() => void) => {
  const q = query(
    collection(db, 'users'),
    where('mode', '==', mode),
    orderBy('points', 'asc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as UserProfile));
  });
};

export const getPlayerRankPosition = async (uid: string): Promise<number> => {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return -1;
  const userPoints = userSnap.data().points || 0;

  // Contar cuántos jugadores tienen MÁS puntos — solo 1 lectura de agregado (O(1) en costos)
  const countSnap = await getCountFromServer(
    query(collection(db, 'users'), where('points', '>', userPoints))
  );
  return countSnap.data().count + 1; // posición = jugadores con más puntos + 1
};

/** Devuelve un título de ganador traducido según la posición */
export const getWinnerTitle = (position: number): string => {
  const titles: string[] = i18n.t('winnerTitles', { returnObjects: true }) as string[];
  return titles[Math.min(position - 1, titles.length - 1)];
};

/** Devuelve un título de perdedor traducido según la posición */
export const getLoserTitle = (position: number): string => {
  const titles: string[] = i18n.t('loserTitles', { returnObjects: true }) as string[];
  return titles[Math.min(position - 1, titles.length - 1)];
};
