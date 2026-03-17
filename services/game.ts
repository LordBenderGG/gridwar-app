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
  increment,
} from 'firebase/firestore';
import { ref, set, onValue, update, get, runTransaction as runRTDBTransaction } from 'firebase/database';
import { db, rtdb } from './firebase';
import { calculateRank } from './ranking';
import { POINTS_WIN, POINTS_LOSS, XP_WIN, XP_LOSS, calculateLevel } from '../constants/theme';
import { checkAndUnlock, AchievementStats } from './achievements';
import { updateMissionProgress } from './missions';
import { addCreatorRoyaltySafe } from './creator';

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
  rivalTimerReducedTarget: string | null;
  earthquakeActive: boolean;
  earthquakeTarget: string | null;
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
  player1PhotoURL: string | null;
  player2PhotoURL: string | null;
  player1Frame?: string | null;
  player2Frame?: string | null;
  player1NameColor?: string | null;
  player2NameColor?: string | null;
  boardTheme?: string | null;
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
  tournamentId?: string,
  player1PhotoURL: string | null = null,
  player2PhotoURL: string | null = null,
  boardTheme: string | null = null,
  player1Frame: string | null = null,
  player2Frame: string | null = null,
  player1NameColor: string | null = null,
  player2NameColor: string | null = null
): Promise<void> => {
  if (!player1 || !player2) {
    throw new Error('INVALID_GAME_PLAYERS');
  }

  const gameDoc: GameDoc = {
    gameId,
    player1,
    player2,
    player1Username,
    player2Username,
    player1Avatar,
    player2Avatar,
    player1PhotoURL,
    player2PhotoURL,
    player1Frame,
    player2Frame,
    player1NameColor,
    player2NameColor,
    boardTheme,
    status: 'active',
    round: 1,
    score: { [player1]: 0, [player2]: 0 },
    winner: null,
    type,
    ...(tournamentId && { tournamentId }),
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'games', gameId), gameDoc);

  const gameState: GameState & { players: Record<string, boolean>; chat: null } = {
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
    rivalTimerReducedTarget: null,
    earthquakeActive: false,
    earthquakeTarget: null,
    confusionActive: false,
    confusionTarget: null,
    teleportPending: false,
    teleportPlayer: null,
    players: { [player1]: true, [player2]: true },
    chat: null,
  };
  await set(ref(rtdb, `games/${gameId}`), gameState);

  await updateDoc(doc(db, 'users', player1), { status: 'in_game' }).catch(() => {});
  await updateDoc(doc(db, 'users', player2), { status: 'in_game' }).catch(() => {});
};

export const makeMove = async (
  gameId: string,
  cell: number,
  requesterUid: string,
  player1: string,
  player2: string
): Promise<{ ok: true; board: CellValue[] } | { ok: false; reason: string }> => {
  if (cell < 0 || cell > 8) return { ok: false, reason: 'invalid_cell' };
  if (!requesterUid) return { ok: false, reason: 'missing_requester' };
  try {
    const gameRef = ref(rtdb, `games/${gameId}`);
    const tx = await runRTDBTransaction(gameRef, (liveRaw: any) => {
      if (!liveRaw) return;
      const live = liveRaw as GameState;

      if (!Array.isArray(live.board)) return;
      const actingPlayer = live.currentTurn;
      if (!actingPlayer) return;
      if (actingPlayer !== player1 && actingPlayer !== player2) return;
      if (actingPlayer !== requesterUid) return;

      const symbol: 'X' | 'O' = actingPlayer === player1 ? 'X' : 'O';
      const opponentId = actingPlayer === player1 ? player2 : player1;
      const board = [...live.board];
      if (board[cell] !== '') return;
      const frozenPlayer = live.frozenPlayer ?? null;

      board[cell] = symbol;
      const nextTurn = frozenPlayer === opponentId ? actingPlayer : opponentId;

      const next: any = {
        ...liveRaw,
        board,
        currentTurn: nextTurn,
        timerStart: Date.now(),
        wildcardUsed: false,
        frozenPlayer: frozenPlayer === actingPlayer ? null : frozenPlayer,
        lastMove: { player: actingPlayer, cell },
        turboActive: false,
        turboPlayer: null,
        teleportPending: false,
        teleportPlayer: null,
      };

      if (live.earthquakeActive && live.earthquakeTarget === actingPlayer) {
        next.earthquakeActive = false;
        next.earthquakeTarget = null;
      }
      if (live.confusionActive && live.confusionTarget === actingPlayer) {
        next.confusionActive = false;
        next.confusionTarget = null;
      }
      if (live.rivalTimerReduced && live.rivalTimerReducedTarget === actingPlayer) {
        next.rivalTimerReduced = false;
        next.rivalTimerReducedTarget = null;
      }
      if (live.shieldActive && live.shieldPlayer !== actingPlayer) {
        next.shieldActive = false;
        next.shieldPlayer = null;
      }

      return next;
    });

    const after = tx.snapshot.val() as GameState | null;
    if (!tx.committed) {
      if (!after) return { ok: false, reason: 'missing_game_state' };
      if (!Array.isArray(after.board)) return { ok: false, reason: 'invalid_live_board' };
      if (after.board[cell] !== '') return { ok: false, reason: 'cell_busy' };
      if (!after.currentTurn) return { ok: false, reason: 'missing_turn' };
      if (after.currentTurn !== requesterUid) return { ok: false, reason: 'not_your_turn' };
      return { ok: false, reason: 'tx_not_committed' };
    }
    if (!after?.lastMove || after.lastMove.cell !== cell) {
      return { ok: false, reason: 'postcheck_failed' };
    }
    return { ok: true, board: after.board };
  } catch (e: any) {
    return { ok: false, reason: `exception:${String(e?.message || e || 'unknown')}` };
  }
};

// Pasa el turno sin hacer movimiento (cuando se agota el tiempo o freeze)
export const skipTurn = async (
  gameId: string,
  opponentId: string,
  _currentState?: GameState,
  skippedPlayer?: string
): Promise<void> => {
  const gameRef = ref(rtdb, `games/${gameId}`);
  await runRTDBTransaction(gameRef, (liveRaw: any) => {
    if (!liveRaw) return;
    const live = liveRaw as GameState;
    if (!live.currentTurn) return;
    if (skippedPlayer && live.currentTurn !== skippedPlayer) return;

    const next: any = {
      ...liveRaw,
      currentTurn: opponentId,
      timerStart: Date.now(),
      wildcardUsed: false,
      frozenPlayer: null,
      turboActive: false,
      turboPlayer: null,
      teleportPending: false,
      teleportPlayer: null,
    };

    const turnOwner = skippedPlayer || live.currentTurn;
    if (live.earthquakeActive && live.earthquakeTarget === turnOwner) {
      next.earthquakeActive = false;
      next.earthquakeTarget = null;
    }
    if (live.confusionActive && live.confusionTarget === turnOwner) {
      next.confusionActive = false;
      next.confusionTarget = null;
    }
    if (live.rivalTimerReduced && live.rivalTimerReducedTarget === turnOwner) {
      next.rivalTimerReduced = false;
      next.rivalTimerReducedTarget = null;
    }
    if (live.shieldActive && live.shieldPlayer !== turnOwner) {
      next.shieldActive = false;
      next.shieldPlayer = null;
    }

    return next;
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
  const gameSnap = await getDoc(doc(db, 'games', gameId));
  const gameData = gameSnap.exists() ? (gameSnap.data() as GameDoc) : null;

  // Idempotencia: si ya finalizó, no volver a procesar ronda.
  if (gameData?.status === 'finished') {
    return { roundWinner: winnerId, matchWinner: gameData.winner ?? null };
  }

  const liveScore = gameSnap.exists()
    ? ((gameData?.score || currentScore) as Record<string, number>)
    : currentScore;

  const newScore = { ...liveScore };
  if (winnerId) newScore[winnerId] = (newScore[winnerId] || 0) + 1;

  const matchWinner = Object.keys(newScore).find((uid) => newScore[uid] >= 2) || null;

  if (matchWinner) {
    // Intentar cerrar recompensas/historial sin bloquear el cierre oficial del juego.
    try {
      await finishMatch(gameId, matchWinner, matchWinner === player1 ? player2 : player1);
    } catch (_) {
      // Evitar que jugadores queden ocultos en Home por status stale.
      await Promise.all([
        updateDoc(doc(db, 'users', player1), { status: 'available' }).catch(() => {}),
        updateDoc(doc(db, 'users', player2), { status: 'available' }).catch(() => {}),
      ]);
    }

    // Ahora sí marcar el game como finished (los puntos/gemas ya están escritos)
    await updateDoc(doc(db, 'games', gameId), {
      score: newScore,
      status: 'finished',
      winner: matchWinner,
    });
    await Promise.all([
      updateDoc(doc(db, 'users', player1), { status: 'available' }).catch(() => {}),
      updateDoc(doc(db, 'users', player2), { status: 'available' }).catch(() => {}),
    ]);
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
      rivalTimerReducedTarget: null,
      earthquakeActive: false,
      earthquakeTarget: null,
      confusionActive: false,
      confusionTarget: null,
      teleportPending: false,
      teleportPlayer: null,
    };
    await update(ref(rtdb, `games/${gameId}`), resetState);
  } else {
    await updateDoc(doc(db, 'games', gameId), {
      score: newScore,
      round: increment(1),
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
      rivalTimerReducedTarget: null,
      earthquakeActive: false,
      earthquakeTarget: null,
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
  const BLOCK_HOURS = 3;

  // Leer el documento del juego para saber el marcador exacto (2-0 o 2-1)
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  const gameData = gameSnap.data() as GameDoc;
  const loserScore = gameData?.score?.[loserId] ?? 0;

  // Determinar si es un torneo local → no sumar/restar puntos al ranking global
  let skipPoints = false;
  if (gameData?.type === 'tournament' && gameData?.tournamentId) {
    try {
      const tournamentSnap = await getDoc(doc(db, 'tournaments', gameData.tournamentId));
      if (tournamentSnap.exists() && tournamentSnap.data().type === 'local') {
        skipPoints = true;
      }
    } catch (_) {
      // Si falla la lectura del torneo, no bloquear el flujo — asumir puntos normales
    }
  }

  // Gems por resultado (todos los modos excepto entrenamiento):
  // ganador 2-0 = +20, ganador 2-1 = +15, perdedor = -5
  const GEMS_WIN_SWEEP = 20;   // 2-0
  const GEMS_WIN_CLOSE = 15;   // 2-1
  const GEMS_LOSE = -5;

  const winnerGemsEarned = loserScore === 0 ? GEMS_WIN_SWEEP : GEMS_WIN_CLOSE;

  // Variables para capturar datos de la transacción y reutilizarlos en logros
  let winnerDataSnapshot: AchievementStats = {
    wins: 0, losses: 0, gamesPlayed: 0, gems: 0, currentWinStreak: 0,
    tournamentsWon: 0, wildcardsUsedTotal: 0, shopPurchasesTotal: 0,
    dailyLoginStreak: 0, tournamentCreated: 0,
  };
  let loserDataSnapshot: AchievementStats = {
    wins: 0, losses: 0, gamesPlayed: 0, gems: 0, currentWinStreak: 0,
    tournamentsWon: 0, wildcardsUsedTotal: 0, shopPurchasesTotal: 0,
    dailyLoginStreak: 0, tournamentCreated: 0,
  };

  await runTransaction(db, async (transaction) => {
    const winnerRef = doc(db, 'users', winnerId);
    const loserRef = doc(db, 'users', loserId);
    const winnerSnap = await transaction.get(winnerRef);
    const loserSnap = await transaction.get(loserRef);

    if (!winnerSnap.exists() || !loserSnap.exists()) return;

    const winnerData = winnerSnap.data();
    const loserData = loserSnap.data();

    // Capturar para uso posterior (logros) — estos son los datos ANTES de la transacción
    // pero los campos que importan a logros (wins, gamesPlayed, etc.) se calculan aquí
    winnerDataSnapshot = {
      wins: (winnerData.wins || 0) + 1,
      losses: winnerData.losses || 0,
      gamesPlayed: (winnerData.gamesPlayed || 0) + 1,
      gems: (winnerData.gems || 0) + winnerGemsEarned,
      currentWinStreak: (winnerData.currentWinStreak || 0) + 1,
      tournamentsWon: winnerData.tournamentsWon || 0,
      wildcardsUsedTotal: winnerData.wildcardsUsedTotal || 0,
      shopPurchasesTotal: winnerData.shopPurchasesTotal || 0,
      dailyLoginStreak: winnerData.dailyLoginStreak || 0,
      tournamentCreated: winnerData.tournamentCreated || 0,
    };
    loserDataSnapshot = {
      wins: loserData.wins || 0,
      losses: (loserData.losses || 0) + 1,
      gamesPlayed: (loserData.gamesPlayed || 0) + 1,
      gems: Math.max(0, (loserData.gems || 0) + GEMS_LOSE),
      currentWinStreak: 0,
      tournamentsWon: loserData.tournamentsWon || 0,
      wildcardsUsedTotal: loserData.wildcardsUsedTotal || 0,
      shopPurchasesTotal: loserData.shopPurchasesTotal || 0,
      dailyLoginStreak: loserData.dailyLoginStreak || 0,
      tournamentCreated: loserData.tournamentCreated || 0,
    };

    // Si es torneo local, no modificar puntos ni rango — mantener los actuales
    const winnerNewPoints = skipPoints
      ? (winnerData.points || 0)
      : (winnerData.points || 0) + POINTS_WIN;
    const loserNewPoints = skipPoints
      ? (loserData.points || 0)
      : Math.max(0, (loserData.points || 0) + POINTS_LOSS);
    const blockUntil = Date.now() + BLOCK_HOURS * 60 * 60 * 1000;

    // Calcular racha del ganador y bonus de gems
    const newWinStreak = (winnerData.currentWinStreak || 0) + 1;
    let streakBonus = 0;
    if (newWinStreak === 2) streakBonus = 2;
    else if (newWinStreak >= 3) streakBonus = 4;

    const winnerGemsTotal = (winnerData.gems || 0) + winnerGemsEarned + streakBonus;
    const loserGemsTotal = Math.max(0, (loserData.gems || 0) + GEMS_LOSE);

    // XP y niveles
    const winnerNewXP = (winnerData.xp || 0) + XP_WIN;
    const loserNewXP = (loserData.xp || 0) + XP_LOSS;
    const winnerNewLevel = calculateLevel(winnerNewXP);
    const loserNewLevel = calculateLevel(loserNewXP);

    transaction.update(winnerRef, {
      points: winnerNewPoints,
      gems: winnerGemsTotal,
      wins: (winnerData.wins || 0) + 1,
      gamesPlayed: (winnerData.gamesPlayed || 0) + 1,
      rank: calculateRank(winnerNewPoints),
      status: 'available',
      currentWinStreak: newWinStreak,
      xp: winnerNewXP,
      level: winnerNewLevel,
    });

    transaction.update(loserRef, {
      points: loserNewPoints,
      gems: loserGemsTotal,
      losses: (loserData.losses || 0) + 1,
      gamesPlayed: (loserData.gamesPlayed || 0) + 1,
      rank: calculateRank(loserNewPoints),
      challengeBlockedUntil: blockUntil,
      status: 'available',
      currentWinStreak: 0,  // reset racha al perder
      xp: loserNewXP,
      level: loserNewLevel,
    });
  });

  // Royalty del creador: 2% del total de gemas del partido (silencioso)
  const totalGems = winnerGemsEarned + Math.abs(GEMS_LOSE);
  addCreatorRoyaltySafe(totalGems, { source: 'match', eventId: gameId }).catch(() => {});

  // Contribuir al pozo semanal: 1 gem por partido disputado
  try {
    const poolRef = doc(db, 'economy', 'weeklyPool');
    const poolSnap = await getDoc(poolRef);
    const now = Date.now();

    if (!poolSnap.exists()) {
      // Crear el pozo con base 5000 gems
      await setDoc(poolRef, {
        total: 5000 + 1,
        weekStart: now,
        lastReset: now,
      });
    } else {
      const poolData = poolSnap.data();
      const weekStart = poolData.weekStart || now;
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;

      if (now - weekStart >= msPerWeek) {
        // Nuevo lunes: resetear pozo
        await setDoc(poolRef, {
          total: 5000 + 1,
          weekStart: now,
          lastReset: now,
        });
      } else {
        await updateDoc(poolRef, { total: increment(1) });
      }
    }
  } catch (_) {
    // Ignorar errores del pozo — no bloquear el flujo principal
  }

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

  // Evaluar logros para ganador y perdedor (no bloqueante)
  try {
    await Promise.all([
      checkAndUnlock(winnerId, {
        ...winnerDataSnapshot,
        lastMatchScore: { winner: gameData.score[winnerId] ?? 2, loser: gameData.score[loserId] ?? 0 },
      }),
      checkAndUnlock(loserId, loserDataSnapshot),
    ]);
  } catch (_) {
    // Logros no deben bloquear el flujo principal
  }

  // Actualizar progreso de misiones diarias (no bloqueante)
  try {
    const [winnerGemsGames, winnerGemsWins, loserGemsFromMissions] = await Promise.all([
      updateMissionProgress(winnerId, 'games'),
      updateMissionProgress(winnerId, 'wins'),
      updateMissionProgress(loserId, 'games'),
    ]);
    const winnerGemsFromMissions = (winnerGemsGames || 0) + (winnerGemsWins || 0);

    // Dar gems por misiones completadas
    const gemUpdates: Promise<void>[] = [];
    if (winnerGemsFromMissions > 0) {
      gemUpdates.push(
        updateDoc(doc(db, 'users', winnerId), { gems: increment(winnerGemsFromMissions) })
      );
    }
    if (loserGemsFromMissions > 0) {
      gemUpdates.push(
        updateDoc(doc(db, 'users', loserId), { gems: increment(loserGemsFromMissions) })
      );
    }
    if (gemUpdates.length > 0) await Promise.all(gemUpdates);
  } catch (_) {
    // Misiones no deben bloquear el flujo principal
  }
};

export const sendChatEmoji = async (
  gameId: string,
  uid: string,
  emoji: string
): Promise<void> => {
  await update(ref(rtdb, `games/${gameId}/chat`), { uid, emoji, ts: Date.now() });
};

export const applyEarthquakeBoard = async (
  gameId: string,
  newBoard: CellValue[]
): Promise<void> => {
  await update(ref(rtdb, `games/${gameId}`), { board: newBoard });
};

export const forfeitGame = async (
  gameId: string,
  forfeitingPlayerId: string,
  opponentId: string
): Promise<void> => {
  // Primero actualizar puntos/gemas, luego marcar finished.
  // Si falla la liquidacion, igual liberar estados para no dejar usuarios ocultos.
  try {
    await finishMatch(gameId, opponentId, forfeitingPlayerId);
  } catch {
    await Promise.all([
      updateDoc(doc(db, 'users', forfeitingPlayerId), { status: 'available' }).catch(() => {}),
      updateDoc(doc(db, 'users', opponentId), { status: 'available' }).catch(() => {}),
    ]);
  }
  await updateDoc(doc(db, 'games', gameId), {
    status: 'finished',
    winner: opponentId,
  });
};
