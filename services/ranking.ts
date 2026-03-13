import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from './auth';

export const RANKS = [
  { name: 'Novato', min: 0, max: 199, icon: '🪨', color: '#9E9E9E' },
  { name: 'Bronce', min: 200, max: 499, icon: '🥉', color: '#CD7F32' },
  { name: 'Plata', min: 500, max: 999, icon: '🥈', color: '#C0C0C0' },
  { name: 'Oro', min: 1000, max: 1999, icon: '🥇', color: '#FFD700' },
  { name: 'Diamante', min: 2000, max: 3999, icon: '💎', color: '#00BFFF' },
  { name: 'Maestro', min: 4000, max: 7999, icon: '👑', color: '#9B59B6' },
  { name: 'Leyenda', min: 8000, max: Infinity, icon: '💀', color: '#FFD700' },
];

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
  limitCount = 10
): (() => void) => {
  const q = query(
    collection(db, 'users'),
    orderBy('points', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as UserProfile));
  });
};

export const subscribeToBottomPlayers = (
  callback: (players: UserProfile[]) => void,
  limitCount = 10
): (() => void) => {
  const q = query(
    collection(db, 'users'),
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
  const q = query(
    collection(db, 'users'),
    orderBy('points', 'desc')
  );
  const snap = await getDocs(q);
  const players = snap.docs.map((d) => d.data() as UserProfile);
  return players.findIndex((p) => p.uid === uid) + 1;
};

export const WINNER_TITLES = [
  'La leyenda viviente del tablero',
  'Imbatible, imparable, inhumano',
  'El que todos temen retar',
  'Maestro del TIKTAK',
  'El terror del tablero',
  'Nadie le gana, nadie le iguala',
  'El campeon indiscutible',
];

export const LOSER_TITLES = [
  'El coleccionista oficial de derrotas',
  'Campeon del fracaso',
  'Novato eterno, esperanza cero',
  'Ni su mama le gana',
  'El tablero le tiene lastima',
  'Record mundial en perder',
  'La vergüenza del tablero',
  'Experto en rendirse',
];

export const getWinnerTitle = (position: number): string => {
  return WINNER_TITLES[Math.min(position - 1, WINNER_TITLES.length - 1)];
};

export const getLoserTitle = (position: number): string => {
  return LOSER_TITLES[Math.min(position - 1, LOSER_TITLES.length - 1)];
};
