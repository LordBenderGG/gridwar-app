import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { ref, set, onValue, update, get } from 'firebase/database';
import { db, rtdb } from './firebase';
import { calculateRank } from './ranking';

export type CellValue = 'X' | 'O' | '';

export interface GameState {
  board: CellValue[];
  currentTurn: string;
  timerStart: number;
  wildcardUsed: boolean;
  frozenPlayer: string | null;
  lastMove: { player: string; cell: number } | null;
  // Wildcard effect flags
  shieldActive: boolean;
  shieldPlayer: string | null;
  turboActive: boolean;
  turboPlayer: string | null;
  rivalTimerReduced: boolean;
  blindActive: boolean;
  blindTarget: string | null;
  confusionActive: boolean;
  confusionTarget: string | null;
  teleportPending: boolean;
  teleportPlayer: string | null;
}

export interface GameDoc {
  gameId: string;
  player1: string;
  player2: string;
  player1Username: string;
  player2Username: string;
  player1Avatar: string;
  player2Avatar: string;
  status: 'active' | 'finished' | 'abandoned';
  round: number;
  score: Record<string, number>;
  winner: string | null;
  type: 'global' | 'local' | 'tournament';
  tournamentId?: string;
  createdAt: any;
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const checkWinner = (board: CellValue[]): CellValue | null => {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

export const isBoardFull = (board: CellValue[]): boolean => {
  return board.every((cell) => cell !== '');
};

export const createGame = async (
  gameId: string,
  player1: string,
  player2: string,
  player1Username: string,
  player2Username: string,
  player1Avatar: string,
  player2Avatar: string,
  type: 'global' | 'local' | 'tournament' = 'global',
  tournamentId?: string
): Promise<void> => {
  const gameDoc: GameDoc = {
    gameId,
    player1,
    player2,
    player1Username,
    player2Username,
    player1Avatar,
    player2Avatar,
    status: 'active',
    round: 1,
    score: { [player1]: 0, [player2]: 0 },
    winner: null,
    type,
    ...(tournamentId && { tournamentId }),
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'games', gameId), gameDoc);

  const gameState: GameState = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentTurn: player1,
    timerStart: Date.now(),
    wildcardUsed: false,
    frozenPlayer: null,
    lastMove: null,
    shieldActive: false,
    shieldPlayer: null,
    turboActive: false,
    turboPlayer: null,
    rivalTimerReduced: false,
    blindActive: false,
    blindTarget: null,
    confusionActive: false,
    confusionTarget: null,
    teleportPending: false,
    teleportPlayer: null,
  };
  await set(ref(rtdb, `games/${gameId}`), gameState);

  await updateDoc(doc(db, 'users', player1), { status: 'in_game' });
  await updateDoc(doc(db, 'users', player2), { status: 'in_game' });
};

export const makeMove = async (
  gameId: string,
  cell: number,
  player: string,
  symbol: 'X' | 'O',
  currentBoard: CellValue[],
  opponentId: string,
  frozenPlayer: string | null
): Promise<void> => {
  if (cell < 0 || cell > 8) return; // ignorar celdas inválidas
  if (currentBoard[cell] !== '') return;

  const newBoard = [...currentBoard];
  newBoard[cell] = symbol;

  // Si el rival estaba congelado, el turno vuelve al jugador actual (no pasa al rival)
  const nextTurn = frozenPlayer === opponentId ? player : opponentId;

  await update(ref(rtdb, `games/${gameId}`), {
    board: newBoard,
    currentTurn: nextTurn,
    timerStart: Date.now(),
    wildcardUsed: false,
    // Limpiar todos los flags de comodines al cambiar de turno.
    // frozenPlayer se preserva si el jugador actual estaba congelado
    // (lo maneja handleCellPress antes de llegar aquí, pero por seguridad null)
    frozenPlayer: null,
    // Efectos que duran 1 turno del afectado — se limpian al terminar ese turno
    shieldActive: false,
    shieldPlayer: null,
    turboActive: false,
    turboPlayer: null,
    rivalTimerReduced: false,
    blindActive: false,
    blindTarget: null,
    confusionActive: false,
    confusionTarget: null,
    teleportPending: false,
    teleportPlayer: null,
    lastMove: { player, cell },
  });
};

// Pasa el turno sin hacer movimiento (cuando se agota el tiempo)
export const skipTurn = async (
  gameId: string,
  opponentId: string
): Promise<void> => {
  await update(ref(rtdb, `games/${gameId}`), {
    currentTurn: opponentId,
    timerStart: Date.now(),
    wildcardUsed: false,
    frozenPlayer: null,
    // Limpiar todos los flags de comodines al saltar turno
    shieldActive: false,
    shieldPlayer: null,
    turboActive: false,
    turboPlayer: null,
    rivalTimerReduced: false,
    blindActive: false,
    blindTarget: null,
    confusionActive: false,
    confusionTarget: null,
    teleportPending: false,
    teleportPlayer: null,
  });
};

export const subscribeToGame = (
  gameId: string,
  callback: (state: GameState) => void
): (() => void) => {
  const gameRef = ref(rtdb, `games/${gameId}`);
  const unsubscribe = onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as GameState);
    }
  });
  return () => unsubscribe();
};

export const subscribeToGameDoc = (
  gameId: string,
  callback: (doc: GameDoc) => void
): (() => void) => {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    if (snap.exists()) callback(snap.data() as GameDoc);
  });
};

export const finishRound = async (
  gameId: string,
  winnerId: string | null,
  currentScore: Record<string, number>,
  player1: string,
  player2: string
): Promise<{ roundWinner: string | null; matchWinner: string | null }> => {
  const newScore = { ...currentScore };
  if (winnerId) newScore[winnerId] = (newScore[winnerId] || 0) + 1;

  const matchWinner = Object.keys(newScore).find((uid) => newScore[uid] >= 2) || null;

  if (matchWinner) {
    await updateDoc(doc(db, 'games', gameId), {
      score: newScore,
      status: 'finished',
      winner: matchWinner,
    });
    const resetState = {
      board: ['', '', '', '', '', '', '', '', ''],
      currentTurn: player1,
      timerStart: Date.now(),
      wildcardUsed: false,
      frozenPlayer: null,
      lastMove: null,
      shieldActive: false,
      shieldPlayer: null,
      turboActive: false,
      turboPlayer: null,
      rivalTimerReduced: false,
      blindActive: false,
      blindTarget: null,
      confusionActive: false,
      confusionTarget: null,
      teleportPending: false,
      teleportPlayer: null,
    };
    await update(ref(rtdb, `games/${gameId}`), resetState);
    await finishMatch(gameId, matchWinner, matchWinner === player1 ? player2 : player1);
  } else {
    const gameSnap = await getDoc(doc(db, 'games', gameId));
    const currentRound = gameSnap.data()?.round || 1;
    await updateDoc(doc(db, 'games', gameId), {
      score: newScore,
      round: currentRound + 1,
    });
    const resetState = {
      board: ['', '', '', '', '', '', '', '', ''],
      currentTurn: player1,
      timerStart: Date.now(),
      wildcardUsed: false,
      frozenPlayer: null,
      lastMove: null,
      shieldActive: false,
      shieldPlayer: null,
      turboActive: false,
      turboPlayer: null,
      rivalTimerReduced: false,
      blindActive: false,
      blindTarget: null,
      confusionActive: false,
      confusionTarget: null,
      teleportPending: false,
      teleportPlayer: null,
    };
    await update(ref(rtdb, `games/${gameId}`), resetState);
  }

  return { roundWinner: winnerId, matchWinner };
};

export const finishMatch = async (
  gameId: string,
  winnerId: string,
  loserId: string
): Promise<void> => {
  const POINTS_WIN = 100;
  const POINTS_LOSS = -30;
  const BLOCK_HOURS = 3;

  await runTransaction(db, async (transaction) => {
    const winnerRef = doc(db, 'users', winnerId);
    const loserRef = doc(db, 'users', loserId);
    const winnerSnap = await transaction.get(winnerRef);
    const loserSnap = await transaction.get(loserRef);

    if (!winnerSnap.exists() || !loserSnap.exists()) return;

    const winnerData = winnerSnap.data();
    const loserData = loserSnap.data();

    const winnerNewPoints = (winnerData.points || 0) + POINTS_WIN;
    const loserNewPoints = Math.max(0, (loserData.points || 0) + POINTS_LOSS);
    const winnerNewGems = Math.floor(winnerNewPoints / 500);
    const blockUntil = Date.now() + BLOCK_HOURS * 60 * 60 * 1000;

    transaction.update(winnerRef, {
      points: winnerNewPoints,
      gems: winnerNewGems,
      wins: (winnerData.wins || 0) + 1,
      gamesPlayed: (winnerData.gamesPlayed || 0) + 1,
      rank: calculateRank(winnerNewPoints),
      status: 'available',
    });

    transaction.update(loserRef, {
      points: loserNewPoints,
      losses: (loserData.losses || 0) + 1,
      gamesPlayed: (loserData.gamesPlayed || 0) + 1,
      rank: calculateRank(loserNewPoints),
      challengeBlockedUntil: blockUntil,
      status: 'available',
    });
  });

  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  const gameData = gameSnap.data() as GameDoc;

  const historyBase = {
    result: 'win',
    score: `${gameData.score[winnerId]}-${gameData.score[loserId]}`,
    date: serverTimestamp(),
    type: gameData.type,
  };

  await setDoc(doc(db, 'users', winnerId, 'history', gameId), {
    ...historyBase,
    opponent: loserId,
    opponentUsername: winnerId === gameData.player1 ? gameData.player2Username : gameData.player1Username,
    result: 'win',
  });

  await setDoc(doc(db, 'users', loserId, 'history', gameId), {
    ...historyBase,
    opponent: winnerId,
    opponentUsername: loserId === gameData.player1 ? gameData.player2Username : gameData.player1Username,
    result: 'loss',
  });
};

export const forfeitGame = async (
  gameId: string,
  forfeitingPlayerId: string,
  opponentId: string
): Promise<void> => {
  await updateDoc(doc(db, 'games', gameId), {
    status: 'finished',
    winner: opponentId,
  });
  await finishMatch(gameId, opponentId, forfeitingPlayerId);
};
