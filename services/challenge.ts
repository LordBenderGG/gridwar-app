import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  collection,
  where,
  serverTimestamp,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { createGame } from './game';
import { calculateRank } from './ranking';

// Generador de IDs único compatible con Hermes (sin crypto.getRandomValues)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 9);
  const random2 = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random1}-${random2}`;
}

export interface Challenge {
  challengeId: string;
  from: string;
  fromUsername: string;
  fromAvatar: string;
  fromPhotoURL: string | null;
  fromRank: string;
  fromPoints: number;
  to: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  gameId?: string; // se rellena cuando el retado acepta
}

const CHALLENGE_TIMEOUT_MS = 30 * 1000;
const BLOCK_ON_REJECT_MS = 30 * 60 * 1000;
const POINTS_NO_ACCEPT = -50;

export const sendChallenge = async (
  fromUid: string,
  fromUsername: string,
  fromAvatar: string,
  fromPhotoURL: string | null,
  fromRank: string,
  fromPoints: number,
  toUid: string
): Promise<string> => {
  const challengeId = generateId();
  const now = Date.now();

  const challenge: Challenge = {
    challengeId,
    from: fromUid,
    fromUsername,
    fromAvatar,
    fromPhotoURL,
    fromRank,
    fromPoints,
    to: toUid,
    status: 'pending',
    createdAt: now,
    expiresAt: now + CHALLENGE_TIMEOUT_MS,
  };

  await setDoc(doc(db, 'challenges', challengeId), challenge);
  await updateDoc(doc(db, 'users', fromUid), { status: 'challenged' });
  await updateDoc(doc(db, 'users', toUid), { status: 'challenged' });

  // Auto-expire después de 30s (solo funciona si la app está abierta;
  // para producción usar Cloud Functions)
  setTimeout(async () => {
    await expireChallenge(challengeId, fromUid, toUid);
  }, CHALLENGE_TIMEOUT_MS + 1000);

  return challengeId;
};

export const acceptChallenge = async (
  challengeId: string,
  challenge: Challenge,
  toUsername: string,
  toAvatar: string
): Promise<string> => {
  const gameId = generateId();

  // Guardar gameId en el challenge ANTES de crear el game,
  // así el retador (quien escucha onSnapshot en el doc) puede leerlo directamente
  // sin necesidad de queries compuestas con índices.
  await updateDoc(doc(db, 'challenges', challengeId), {
    status: 'accepted',
    gameId,
  });

  await createGame(
    gameId,
    challenge.from,
    challenge.to,
    challenge.fromUsername,
    toUsername,
    challenge.fromAvatar,
    toAvatar,
    'global'
  );

  return gameId;
};

export const rejectChallenge = async (
  challengeId: string,
  fromUid: string,
  toUid: string
): Promise<void> => {
  await updateDoc(doc(db, 'challenges', challengeId), { status: 'rejected' });
  // Penalizar al receptor que rechaza (toUid)
  await penalizeNoAccept(toUid);
  await updateDoc(doc(db, 'users', fromUid), { status: 'available' });
};

export const expireChallenge = async (
  challengeId: string,
  fromUid: string,
  toUid: string
): Promise<void> => {
  const snap = await getDoc(doc(db, 'challenges', challengeId));
  if (!snap.exists()) return;
  if (snap.data().status !== 'pending') return;

  await updateDoc(doc(db, 'challenges', challengeId), { status: 'expired' });
  // Penalizar al que no aceptó (toUid) y liberar al retador (fromUid)
  await penalizeNoAccept(toUid);
  // penalizeNoAccept pone status 'blocked' al toUid, solo liberar al fromUid
  await updateDoc(doc(db, 'users', fromUid), { status: 'available' });
};

const penalizeNoAccept = async (uid: string): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', uid);
    const snap = await transaction.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const newPoints = Math.max(0, (data.points || 0) + POINTS_NO_ACCEPT);
    const blockUntil = Date.now() + BLOCK_ON_REJECT_MS;
    transaction.update(userRef, {
      points: newPoints,
      rank: calculateRank(newPoints),
      // Un solo campo unificado que usan tanto home.tsx como blocked.tsx
      challengeBlockedUntil: blockUntil,
      status: 'blocked',
    });
  });
};

export const subscribeToIncomingChallenges = (
  uid: string,
  callback: (challenges: Challenge[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'challenges'),
    where('to', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const challenges = snap.docs.map((d) => d.data() as Challenge);
    callback(challenges);
  });
};
