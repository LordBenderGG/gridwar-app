import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { createGame } from './game';
import { calculateRank } from './ranking';
import { sendPushToUser } from './notifications';

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
  fromFrame?: string | null;
  fromNameColor?: string | null;
  fromBoardTheme?: string | null;
  to: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  gameId?: string; // se rellena cuando el retado acepta
}

const CHALLENGE_TIMEOUT_MS = 30 * 1000;
const POINTS_NO_ACCEPT = -50;

// Mapa de timers activos por challengeId para permitir su cancelación
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const cancelChallengeTimer = (challengeId: string): void => {
  const timer = pendingTimers.get(challengeId);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingTimers.delete(challengeId);
  }
};

export const sendChallenge = async (
  fromUid: string,
  fromUsername: string,
  fromAvatar: string,
  fromPhotoURL: string | null,
  fromRank: string,
  fromPoints: number,
  toUid: string,
  fromFrame: string | null = null,
  fromNameColor: string | null = null,
  fromBoardTheme: string | null = null
): Promise<string> => {
  if (!fromUid || !toUid) throw new Error('INVALID_CHALLENGE_USERS');
  if (fromUid === toUid) throw new Error('INVALID_CHALLENGE_TARGET');
  const challengeId = generateId();
  const now = Date.now();
  const challengeRef = doc(db, 'challenges', challengeId);
  const fromRef = doc(db, 'users', fromUid);
  const toRef = doc(db, 'users', toUid);

  const challenge: Challenge = {
    challengeId,
    from: fromUid,
    fromUsername,
    fromAvatar,
    fromPhotoURL,
    fromRank,
    fromPoints,
    fromFrame,
    fromNameColor,
    fromBoardTheme,
    to: toUid,
    status: 'pending',
    createdAt: now,
    expiresAt: now + CHALLENGE_TIMEOUT_MS,
  };

  await runTransaction(db, async (transaction) => {
    const [fromSnap, toSnap] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);

    if (!fromSnap.exists() || !toSnap.exists()) throw new Error('CHALLENGE_USER_NOT_FOUND');

    const fromData = fromSnap.data() as any;
    const toData = toSnap.data() as any;

    if (fromData?.status !== 'available') throw new Error('FROM_NOT_AVAILABLE');
    if (toData?.status !== 'available') throw new Error('TARGET_NOT_AVAILABLE');
    if (fromData?.activeChallengeId) throw new Error('FROM_ALREADY_CHALLENGED');
    if (toData?.activeChallengeId) throw new Error('TARGET_ALREADY_CHALLENGED');

    transaction.set(challengeRef, challenge);
    transaction.update(fromRef, {
      status: 'challenged',
      activeChallengeId: challengeId,
    });
    transaction.update(toRef, {
      status: 'challenged',
      activeChallengeId: challengeId,
    });
  });

  // Enviar push al retado (funciona en background)
  sendPushToUser(
    toUid,
    '⚔️ ¡Te han retado!',
    `${fromUsername} te desafía a una batalla en GRIDWAR. ¡Tienes 30 segundos!`,
    { type: 'challenge', challengeId },
    'challenges'
  ).catch(() => {});

  // Auto-expire después de 30s (solo funciona si la app está abierta;
  // para producción usar Cloud Functions)
  const timer = setTimeout(async () => {
    pendingTimers.delete(challengeId);
    await expireChallenge(challengeId, fromUid, toUid);
  }, CHALLENGE_TIMEOUT_MS + 1000);
  pendingTimers.set(challengeId, timer);

  return challengeId;
};

export const acceptChallenge = async (
  challengeId: string,
  challenge: Challenge,
  toUsername: string,
  toAvatar: string,
  toPhotoURL: string | null = null,
  toFrame: string | null = null,
  toNameColor: string | null = null
): Promise<string> => {
  if (!challenge.from || !challenge.to) throw new Error('INVALID_CHALLENGE_USERS');
  cancelChallengeTimer(challengeId);
  const gameId = generateId();
  const challengeRef = doc(db, 'challenges', challengeId);
  const fromRef = doc(db, 'users', challenge.from);
  const toRef = doc(db, 'users', challenge.to);

  await runTransaction(db, async (transaction) => {
    const [challengeSnap, fromSnap, toSnap] = await Promise.all([
      transaction.get(challengeRef),
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);

    if (!challengeSnap.exists()) throw new Error('CHALLENGE_NOT_FOUND');
    const liveChallenge = challengeSnap.data() as Challenge;
    if (liveChallenge.status !== 'pending') {
      throw new Error('CHALLENGE_NOT_PENDING');
    }

    if (!fromSnap.exists() || !toSnap.exists()) throw new Error('CHALLENGE_USER_NOT_FOUND');

    transaction.update(challengeRef, {
      status: 'accepted',
      gameId,
    });
    transaction.update(fromRef, {
      status: 'in_game',
      activeChallengeId: null,
    });
    transaction.update(toRef, {
      status: 'in_game',
      activeChallengeId: null,
    });
  });

  await createGame(
    gameId,
    challenge.from,
    challenge.to,
    challenge.fromUsername,
    toUsername,
    challenge.fromAvatar,
    toAvatar,
    'global',
    undefined,
    challenge.fromPhotoURL,
    toPhotoURL,
    challenge.fromBoardTheme ?? null,
    challenge.fromFrame ?? null,
    toFrame,
    challenge.fromNameColor ?? null,
    toNameColor
  );

  return gameId;
};

export const rejectChallenge = async (
  challengeId: string,
  fromUid: string,
  toUid: string
): Promise<void> => {
  cancelChallengeTimer(challengeId);
  await runTransaction(db, async (transaction) => {
    const challengeRef = doc(db, 'challenges', challengeId);
    const fromRef = doc(db, 'users', fromUid);
    const toRef = doc(db, 'users', toUid);

    const [challengeSnap, fromSnap, toSnap] = await Promise.all([
      transaction.get(challengeRef),
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!challengeSnap.exists() || !fromSnap.exists() || !toSnap.exists()) return;

    const challengeData = challengeSnap.data() as Challenge;
    if (challengeData.status !== 'pending') return;

    const toData = toSnap.data() as any;
    const newPoints = Math.max(0, (toData.points || 0) + POINTS_NO_ACCEPT);
    transaction.update(challengeRef, { status: 'rejected' });
    transaction.update(fromRef, { status: 'available', activeChallengeId: null });
    transaction.update(toRef, {
      points: newPoints,
      rank: calculateRank(newPoints),
      challengeBlockedUntil: null,
      status: 'available',
      activeChallengeId: null,
    });
  });
};

export const expireChallenge = async (
  challengeId: string,
  fromUid: string,
  toUid: string
): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const challengeRef = doc(db, 'challenges', challengeId);
    const fromRef = doc(db, 'users', fromUid);
    const toRef = doc(db, 'users', toUid);

    const [challengeSnap, fromSnap, toSnap] = await Promise.all([
      transaction.get(challengeRef),
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!challengeSnap.exists() || !fromSnap.exists() || !toSnap.exists()) return;

    const challengeData = challengeSnap.data() as Challenge;
    if (challengeData.status !== 'pending') return;

    const toData = toSnap.data() as any;
    const newPoints = Math.max(0, (toData.points || 0) + POINTS_NO_ACCEPT);
    transaction.update(challengeRef, { status: 'expired' });
    transaction.update(fromRef, { status: 'available', activeChallengeId: null });
    transaction.update(toRef, {
      points: newPoints,
      rank: calculateRank(newPoints),
      challengeBlockedUntil: null,
      status: 'available',
      activeChallengeId: null,
    });
  });
};

export const cancelChallenge = async (
  challengeId: string,
  fromUid: string,
  toUid: string
): Promise<void> => {
  cancelChallengeTimer(challengeId);
  await runTransaction(db, async (transaction) => {
    const challengeRef = doc(db, 'challenges', challengeId);
    const fromRef = doc(db, 'users', fromUid);
    const toRef = doc(db, 'users', toUid);

    const [challengeSnap, fromSnap, toSnap] = await Promise.all([
      transaction.get(challengeRef),
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!challengeSnap.exists() || !fromSnap.exists() || !toSnap.exists()) return;

    const challengeData = challengeSnap.data() as Challenge;
    if (challengeData.status !== 'pending') return;

    transaction.update(challengeRef, { status: 'expired' });
    transaction.update(fromRef, { status: 'available', activeChallengeId: null });
    transaction.update(toRef, { status: 'available', activeChallengeId: null });
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
