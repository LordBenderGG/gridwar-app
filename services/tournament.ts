/**
 * services/tournament.ts — Fase 4 (rediseño completo)
 *
 * Tipos de torneo:
 *   - 'global': el creador necesita tournament_pass (80💎). Cuota de entrada: 50💎/jugador.
 *               Solo 1 torneo global activo a la vez → /meta/tournaments.activeGlobalTournamentId
 *   - 'local':  gratis crear, sin cuota. Premios fijos.
 *
 * Distribución del pool (global):
 *   Pool real = entryFee × (maxPlayers - 1)  ← creador no paga cuota.
 *   Creador 20% | Economía global 2% | 1ro 49% | 2do 19.6% | 3ro 9.4%
 *
 * Premios locales fijos:
 *   1ro: 120💎 | 2do: 50💎 | 3ro: 30💎 | Creador: 20💎
 *
 * Bracket: eliminación directa tipo FIFA + partido por 3er puesto (semifinalistas perdedores).
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  increment,
  runTransaction,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { createGame } from './game';
import { addCreatorRoyaltySafe } from './creator';

/** Genera un ID único sin depender de uuid (compatible con Hermes/React Native). */
const generateId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TournamentMatch {
  matchId: string;
  p1: string;
  p2: string;
  p1Username: string;
  p2Username: string;
  winner: string | null;
  loser: string | null;
  gameId: string | null;
}

export interface TournamentPodium {
  first: string;
  second: string;
  third: string | null;
}

export interface Tournament {
  tournamentId: string;
  name: string;
  type: 'global' | 'local';
  createdBy: string;
  maxPlayers: 4 | 8 | 16;
  players: string[];
  playerUsernames: Record<string, string>;
  playerAvatars: Record<string, string>;
  bracket: Record<string, TournamentMatch[]>;
  thirdPlaceMatch: TournamentMatch | null;
  currentRound: number;
  totalRounds: number;
  status: 'waiting' | 'active' | 'finished';
  // Pool y premios
  entryFee: number;           // 50 para global, 0 para local
  registrationPool: number;   // suma de cuotas pagadas
  creatorCut: number;         // 20% del pool (global) o 20💎 fijo (local)
  economyCut: number;         // 2% del pool (global) o 0 (local)
  prizes: {
    first: number;
    second: number;
    third: number;
  };
  podium: TournamentPodium | null;
  spectators: string[];
  winner: string | null;
  createdAt: any;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ENTRY_FEE_GLOBAL = 50;
const TOURNAMENT_PASS_COST = 80;

/**
 * Pool real recaudado (global): solo los jugadores que PAGAN cuota.
 * El creador ocupa 1 plaza pero no paga, por lo que el pool real es
 * entryFee × (maxPlayers - 1).  Los premios se calculan sobre este
 * pool real para no crear gemas de la nada.
 */
const calcGlobalPool = (maxPlayers: number) => ENTRY_FEE_GLOBAL * (maxPlayers - 1);

/** Calcular distribución de premios del pool global */
function calcGlobalPrizes(maxPlayers: 4 | 8 | 16) {
  const pool = calcGlobalPool(maxPlayers);
  return {
    creatorCut: Math.floor(pool * 0.20),
    economyCut: Math.floor(pool * 0.02),
    first:      Math.floor(pool * 0.49),
    second:     Math.floor(pool * 0.196),
    third:      Math.floor(pool * 0.094),
  };
}

const LOCAL_PRIZES = { first: 120, second: 50, third: 30 };
const LOCAL_CREATOR_CUT = 20;

/** Número de rondas para bracket de eliminación directa */
const roundsForSize = (n: number) => Math.log2(n);

// ─── Shuffle ──────────────────────────────────────────────────────────────────

const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─── createTournament ─────────────────────────────────────────────────────────

export const createTournament = async (
  name: string,
  createdBy: string,
  creatorUsername: string,
  creatorAvatar: string,
  maxPlayers: 4 | 8 | 16,
  type: 'global' | 'local' = 'local'
): Promise<string> => {
  const userRef = doc(db, 'users', createdBy);

  if (type === 'global') {
    // Verificar que solo haya 1 torneo global activo
    const metaSnap = await getDoc(doc(db, 'meta', 'tournaments'));
    if (metaSnap.exists() && metaSnap.data().activeGlobalTournamentId) {
      throw new Error('GLOBAL_TOURNAMENT_EXISTS');
    }

    // Verificar que el creador tiene tournament_pass
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');
    const inv = userSnap.data().inventory || {};
    if (!inv.tournament_pass || inv.tournament_pass < 1) {
      throw new Error('NO_TOURNAMENT_PASS');
    }

    // Consumir tournament_pass
    await updateDoc(userRef, { 'inventory.tournament_pass': increment(-1) });
  }

  const tournamentId = generateId();
  const globalPrizes = type === 'global' ? calcGlobalPrizes(maxPlayers) : null;

  const tournament: Tournament = {
    tournamentId,
    name,
    type,
    createdBy,
    maxPlayers,
    players: [createdBy],
    playerUsernames: { [createdBy]: creatorUsername },
    playerAvatars: { [createdBy]: creatorAvatar },
    bracket: {},
    thirdPlaceMatch: null,
    currentRound: 0,
    totalRounds: roundsForSize(maxPlayers),
    status: 'waiting',
    entryFee: type === 'global' ? ENTRY_FEE_GLOBAL : 0,
    registrationPool: 0,            // el creador no paga cuota
    creatorCut: type === 'global' ? (globalPrizes!.creatorCut) : LOCAL_CREATOR_CUT,
    economyCut: type === 'global' ? (globalPrizes!.economyCut) : 0,
    prizes: type === 'global'
      ? { first: globalPrizes!.first, second: globalPrizes!.second, third: globalPrizes!.third }
      : { ...LOCAL_PRIZES },
    podium: null,
    spectators: [],
    winner: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'tournaments', tournamentId), tournament);

  // Registrar torneo global activo en /meta/tournaments
  if (type === 'global') {
    await setDoc(doc(db, 'meta', 'tournaments'), { activeGlobalTournamentId: tournamentId }, { merge: true });
  }

  // Registrar que el creador creó un torneo (para logros / misiones)
  await updateDoc(userRef, { tournamentCreated: increment(1) }).catch(() => {});

  return tournamentId;
};

// ─── joinTournament ───────────────────────────────────────────────────────────

export const joinTournament = async (
  tournamentId: string,
  uid: string,
  username: string,
  avatar: string
): Promise<void> => {
  const tSnap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tSnap.exists()) throw new Error('TOURNAMENT_NOT_FOUND');
  const t = tSnap.data() as Tournament;

  if (t.players.includes(uid)) throw new Error('ALREADY_JOINED');
  if (t.players.length >= t.maxPlayers) throw new Error('TOURNAMENT_FULL');
  if (t.status !== 'waiting') throw new Error('TOURNAMENT_STARTED');

  if (t.type === 'global' && t.entryFee > 0) {
    // Cobrar cuota de entrada via transacción
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');
      const gems = userSnap.data().gems || 0;
      if (gems < t.entryFee) throw new Error('NOT_ENOUGH_GEMS');
      tx.update(userRef, { gems: increment(-t.entryFee) });
      tx.update(doc(db, 'tournaments', tournamentId), {
        players: arrayUnion(uid),
        [`playerUsernames.${uid}`]: username,
        [`playerAvatars.${uid}`]: avatar,
        registrationPool: increment(t.entryFee),
      });
    });
    // Royalty del creador por inscripción global (silencioso)
    addCreatorRoyaltySafe(t.entryFee, { source: 'global_entry', eventId: `${tournamentId}:${uid}` }).catch(() => {});
  } else {
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      players: arrayUnion(uid),
      [`playerUsernames.${uid}`]: username,
      [`playerAvatars.${uid}`]: avatar,
    });
  }
};

// ─── startTournament ──────────────────────────────────────────────────────────

export const startTournament = async (tournamentId: string): Promise<void> => {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!snap.exists()) return;
  const tournament = snap.data() as Tournament;

  if (tournament.status !== 'waiting') throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.players.length < 4) throw new Error('NOT_ENOUGH_PLAYERS');
  if (tournament.players.length !== tournament.maxPlayers) throw new Error('TOURNAMENT_NOT_FULL');
  if (Object.keys(tournament.bracket || {}).length > 0) throw new Error('BRACKET_ALREADY_CREATED');

  const shuffledPlayers = shuffle(tournament.players);
  const round1: TournamentMatch[] = [];

  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const p1 = shuffledPlayers[i];
    const p2 = shuffledPlayers[i + 1];
    const matchId = generateId();
    const gameId = generateId();

    await createGame(
      gameId, p1, p2,
      tournament.playerUsernames[p1],
      tournament.playerUsernames[p2],
      tournament.playerAvatars[p1],
      tournament.playerAvatars[p2],
      'tournament',
      tournamentId
    );

    round1.push({
      matchId, p1, p2,
      p1Username: tournament.playerUsernames[p1],
      p2Username: tournament.playerUsernames[p2],
      winner: null,
      loser: null,
      gameId,
    });
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'bracket.round1': round1,
    currentRound: 1,
    status: 'active',
  });
};

// ─── deleteLocalTournament ────────────────────────────────────────────────────

/**
 * Permite al creador eliminar su torneo local mientras siga en espera.
 */
export const deleteLocalTournament = async (
  tournamentId: string,
  requesterUid: string
): Promise<void> => {
  const tRef = doc(db, 'tournaments', tournamentId);
  const snap = await getDoc(tRef);
  if (!snap.exists()) throw new Error('TOURNAMENT_NOT_FOUND');

  const t = snap.data() as Tournament;
  if (t.type !== 'local') throw new Error('ONLY_LOCAL_CAN_DELETE');
  if (t.createdBy !== requesterUid) throw new Error('NOT_CREATOR');
  if (t.status !== 'waiting') throw new Error('TOURNAMENT_ALREADY_STARTED');

  await deleteDoc(tRef);
};

// ─── syncTournamentProgress ───────────────────────────────────────────────────

/**
 * Sincroniza llaves con resultados de partidas y avanza rondas automáticamente.
 * Es idempotente: se puede llamar varias veces sin duplicar rondas/premios.
 */
export const syncTournamentProgress = async (tournamentId: string): Promise<void> => {
  const tRef = doc(db, 'tournaments', tournamentId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) return;

  let tournament = tSnap.data() as Tournament;
  if (tournament.status !== 'active') return;

  const updatedBracket: Record<string, TournamentMatch[]> = { ...(tournament.bracket || {}) };
  let thirdPlaceMatch: TournamentMatch | null = tournament.thirdPlaceMatch ? { ...tournament.thirdPlaceMatch } : null;
  let hasBracketUpdates = false;
  let thirdPlaceWinnerFromGame: string | null = null;

  const gameCache = new Map<string, any>();
  const getGameData = async (gameId: string) => {
    if (gameCache.has(gameId)) return gameCache.get(gameId);
    const gameSnap = await getDoc(doc(db, 'games', gameId));
    const data = gameSnap.exists() ? gameSnap.data() : null;
    gameCache.set(gameId, data);
    return data;
  };

  for (const roundKey of Object.keys(updatedBracket)) {
    const matches = updatedBracket[roundKey];
    const nextMatches = [...matches];
    let changed = false;

    for (let i = 0; i < nextMatches.length; i++) {
      const m = nextMatches[i];
      if (m.winner || !m.gameId) continue;
      const gameData = await getGameData(m.gameId);
      if (!gameData || gameData.status !== 'finished' || !gameData.winner) continue;

      const winner = gameData.winner as string;
      const loser = winner === m.p1 ? m.p2 : m.p1;
      nextMatches[i] = { ...m, winner, loser };
      changed = true;
    }

    if (changed) {
      updatedBracket[roundKey] = nextMatches;
      hasBracketUpdates = true;
    }
  }

  if (thirdPlaceMatch && !thirdPlaceMatch.winner && thirdPlaceMatch.gameId) {
    const thirdGameData = await getGameData(thirdPlaceMatch.gameId);
    if (thirdGameData && thirdGameData.status === 'finished' && thirdGameData.winner) {
      const winner = thirdGameData.winner as string;
      const loser = winner === thirdPlaceMatch.p1 ? thirdPlaceMatch.p2 : thirdPlaceMatch.p1;
      thirdPlaceMatch = { ...thirdPlaceMatch, winner, loser };
      thirdPlaceWinnerFromGame = winner;
      hasBracketUpdates = true;
    }
  }

  if (hasBracketUpdates) {
    const updatePayload: Record<string, any> = {
      bracket: updatedBracket,
      thirdPlaceMatch,
    };
    if (thirdPlaceWinnerFromGame) updatePayload['podium.third'] = thirdPlaceWinnerFromGame;
    await updateDoc(tRef, updatePayload);

    if (thirdPlaceWinnerFromGame && !tournament.podium?.third && tournament.prizes.third > 0) {
      await updateDoc(doc(db, 'users', thirdPlaceWinnerFromGame), {
        gems: increment(tournament.prizes.third),
      }).catch(() => {});
    }

    const refreshed = await getDoc(tRef);
    if (!refreshed.exists()) return;
    tournament = refreshed.data() as Tournament;
  }

  if (tournament.status !== 'active') return;

  const currentRoundKey = `round${tournament.currentRound}`;
  const currentMatches = tournament.bracket?.[currentRoundKey] || [];
  if (!currentMatches.length || currentMatches.some((m) => !m.winner)) return;

  const winners = currentMatches.map((m) => m.winner!) as string[];
  const losers = currentMatches.map((m) => m.loser!) as string[];

  // Final terminada
  if (currentMatches.length === 1) {
    const champion = winners[0];
    const runnerUp = losers[0];
    const third = tournament.thirdPlaceMatch?.winner ?? tournament.podium?.third ?? null;

    const podium: TournamentPodium = {
      first: champion,
      second: runnerUp,
      third,
    };

    await updateDoc(tRef, {
      status: 'finished',
      winner: champion,
      podium,
    });

    await distributePrizes(tournamentId, tournament, podium);

    if (tournament.type === 'global') {
      await setDoc(doc(db, 'meta', 'tournaments'), { activeGlobalTournamentId: null }, { merge: true });
    }
    return;
  }

  // Evitar crear siguiente ronda más de una vez
  const nextRound = tournament.currentRound + 1;
  if (tournament.bracket?.[`round${nextRound}`]?.length) return;

  // Semifinales -> final + 3er puesto
  if (winners.length === 2) {
    const finalGameId = generateId();
    await createGame(
      finalGameId,
      winners[0],
      winners[1],
      tournament.playerUsernames[winners[0]],
      tournament.playerUsernames[winners[1]],
      tournament.playerAvatars[winners[0]],
      tournament.playerAvatars[winners[1]],
      'tournament',
      tournamentId
    );

    const finalMatch: TournamentMatch = {
      matchId: generateId(),
      p1: winners[0],
      p2: winners[1],
      p1Username: tournament.playerUsernames[winners[0]],
      p2Username: tournament.playerUsernames[winners[1]],
      winner: null,
      loser: null,
      gameId: finalGameId,
    };

    let newThirdPlaceMatch: TournamentMatch | null = tournament.thirdPlaceMatch;
    if (!newThirdPlaceMatch && losers[0] && losers[1] && losers[0] !== losers[1]) {
      const thirdGameId = generateId();
      await createGame(
        thirdGameId,
        losers[0],
        losers[1],
        tournament.playerUsernames[losers[0]],
        tournament.playerUsernames[losers[1]],
        tournament.playerAvatars[losers[0]],
        tournament.playerAvatars[losers[1]],
        'tournament',
        tournamentId
      );
      newThirdPlaceMatch = {
        matchId: generateId(),
        p1: losers[0],
        p2: losers[1],
        p1Username: tournament.playerUsernames[losers[0]],
        p2Username: tournament.playerUsernames[losers[1]],
        winner: null,
        loser: null,
        gameId: thirdGameId,
      };
    }

    await updateDoc(tRef, {
      [`bracket.round${nextRound}`]: [finalMatch],
      thirdPlaceMatch: newThirdPlaceMatch,
      currentRound: nextRound,
    });
    return;
  }

  // Rondas intermedias
  const nextMatches: TournamentMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const p1 = winners[i];
    const p2 = winners[i + 1];
    if (!p1 || !p2) continue;
    const gameId = generateId();

    await createGame(
      gameId,
      p1,
      p2,
      tournament.playerUsernames[p1],
      tournament.playerUsernames[p2],
      tournament.playerAvatars[p1],
      tournament.playerAvatars[p2],
      'tournament',
      tournamentId
    );

    nextMatches.push({
      matchId: generateId(),
      p1,
      p2,
      p1Username: tournament.playerUsernames[p1],
      p2Username: tournament.playerUsernames[p2],
      winner: null,
      loser: null,
      gameId,
    });
  }

  if (nextMatches.length) {
    await updateDoc(tRef, {
      [`bracket.round${nextRound}`]: nextMatches,
      currentRound: nextRound,
    });
  }
};

// ─── advanceTournament ────────────────────────────────────────────────────────

/**
 * Avanzar el bracket tras completar todos los partidos de una ronda.
 * Si los ganadores son 2 → crean la final + partido por 3er puesto.
 * Si los ganadores son 1 → el torneo terminó (la final ya fue).
 */
export const advanceTournament = async (
  tournamentId: string,
  currentRound: number,
  completedMatches: TournamentMatch[]
): Promise<void> => {
  const tSnap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tSnap.exists()) return;
  const tournament = tSnap.data() as Tournament;

  const winners = completedMatches.map((m) => m.winner!);
  const losers  = completedMatches.map((m) => m.loser!);

  // ── Caso: 1 ganador = la final terminó ────────────────────────────────────
  if (winners.length === 1) {
    const champion = winners[0];
    // El 3er puesto ya debería estar determinado por el partido del 3er puesto
    // Si aún no hay podium completo, construirlo
    const currentPodium = tournament.podium;
    const podium: TournamentPodium = {
      first:  champion,
      second: losers[0],
      third:  currentPodium?.third ?? null,
    };

    await updateDoc(doc(db, 'tournaments', tournamentId), {
      status: 'finished',
      winner: champion,
      podium,
    });

    // Distribuir premios
    await distributePrizes(tournamentId, tournament, podium);

    // Limpiar torneo global activo
    if (tournament.type === 'global') {
      await setDoc(doc(db, 'meta', 'tournaments'), { activeGlobalTournamentId: null }, { merge: true });
    }
    return;
  }

  // ── Caso: 2 ganadores = semifinales terminadas → crear final + 3er puesto ─
  if (winners.length === 2) {
    const [sf1Loser, sf2Loser] = losers;
    const nextRound = currentRound + 1;

    // Final
    const finalGameId = generateId();
    await createGame(
      finalGameId,
      winners[0], winners[1],
      tournament.playerUsernames[winners[0]],
      tournament.playerUsernames[winners[1]],
      tournament.playerAvatars[winners[0]],
      tournament.playerAvatars[winners[1]],
      'tournament', tournamentId
    );
    const finalMatch: TournamentMatch = {
      matchId: generateId(),
      p1: winners[0], p2: winners[1],
      p1Username: tournament.playerUsernames[winners[0]],
      p2Username: tournament.playerUsernames[winners[1]],
      winner: null, loser: null,
      gameId: finalGameId,
    };

    // Partido 3er puesto (solo si hay 2 perdedores distintos)
    let thirdPlaceMatch: TournamentMatch | null = null;
    if (sf1Loser && sf2Loser && sf1Loser !== sf2Loser) {
      const thirdGameId = generateId();
      await createGame(
        thirdGameId,
        sf1Loser, sf2Loser,
        tournament.playerUsernames[sf1Loser],
        tournament.playerUsernames[sf2Loser],
        tournament.playerAvatars[sf1Loser],
        tournament.playerAvatars[sf2Loser],
        'tournament', tournamentId
      );
      thirdPlaceMatch = {
        matchId: generateId(),
        p1: sf1Loser, p2: sf2Loser,
        p1Username: tournament.playerUsernames[sf1Loser],
        p2Username: tournament.playerUsernames[sf2Loser],
        winner: null, loser: null,
        gameId: thirdGameId,
      };
    }

    await updateDoc(doc(db, 'tournaments', tournamentId), {
      [`bracket.round${nextRound}`]: [finalMatch],
      thirdPlaceMatch,
      currentRound: nextRound,
    });
    return;
  }

  // ── Caso general: más de 2 ganadores → siguiente ronda normal ─────────────
  const nextRound = currentRound + 1;
  const nextMatches: TournamentMatch[] = [];

  for (let i = 0; i < winners.length; i += 2) {
    const p1 = winners[i];
    const p2 = winners[i + 1];
    const gameId = generateId();

    await createGame(
      gameId, p1, p2,
      tournament.playerUsernames[p1],
      tournament.playerUsernames[p2],
      tournament.playerAvatars[p1],
      tournament.playerAvatars[p2],
      'tournament', tournamentId
    );

    nextMatches.push({
      matchId: generateId(), p1, p2,
      p1Username: tournament.playerUsernames[p1],
      p2Username: tournament.playerUsernames[p2],
      winner: null, loser: null,
      gameId,
    });
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    [`bracket.round${nextRound}`]: nextMatches,
    currentRound: nextRound,
  });
};

// ─── resolveThirdPlace ────────────────────────────────────────────────────────

/** Llamar cuando el partido por 3er puesto tiene ganador */
export const resolveThirdPlace = async (
  tournamentId: string,
  thirdPlaceWinner: string
): Promise<void> => {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'thirdPlaceMatch.winner': thirdPlaceWinner,
    'podium.third': thirdPlaceWinner,
  });
  // Dar premio al 3er puesto
  const tSnap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tSnap.exists()) return;
  const t = tSnap.data() as Tournament;
  if (t.prizes.third > 0) {
    await updateDoc(doc(db, 'users', thirdPlaceWinner), {
      gems: increment(t.prizes.third),
    });
  }
};

// ─── distributePrizes ─────────────────────────────────────────────────────────

async function distributePrizes(
  tournamentId: string,
  tournament: Tournament,
  podium: TournamentPodium
): Promise<void> {
  const updates: Promise<void>[] = [];

  // 1ro
  if (podium.first) {
    updates.push(
      updateDoc(doc(db, 'users', podium.first), {
        gems: increment(tournament.prizes.first),
        tournamentsWon: increment(1),
      })
    );
  }
  // 2do
  if (podium.second) {
    updates.push(
      updateDoc(doc(db, 'users', podium.second), {
        gems: increment(tournament.prizes.second),
      })
    );
  }
  // 3ro (si aún no recibió su premio via resolveThirdPlace)
  // — El 3er puesto recibe su premio en resolveThirdPlace para no duplicar.
  // Si no hubo partido de 3er puesto (torneo de 4j sin semifinales reales),
  // darlo aquí.
  if (podium.third && !tournament.thirdPlaceMatch) {
    updates.push(
      updateDoc(doc(db, 'users', podium.third), {
        gems: increment(tournament.prizes.third),
      })
    );
  }
  // Creador
  if (tournament.creatorCut > 0) {
    updates.push(
      updateDoc(doc(db, 'users', tournament.createdBy), {
        gems: increment(tournament.creatorCut),
      })
    );
  }
  // Economía global (solo global)
  if (tournament.type === 'global' && tournament.economyCut > 0) {
    updates.push(
      updateDoc(doc(db, 'economy', 'global'), {
        totalAccumulated: increment(tournament.economyCut),
        lastUpdated: serverTimestamp(),
      }).catch(() => {})
    );
  }

  await Promise.all(updates);

  // Royalty del creador: 2% del total distribuido en premios (silencioso)
  const totalPrizes = tournament.prizes.first + tournament.prizes.second + tournament.prizes.third;
  addCreatorRoyaltySafe(totalPrizes, { source: 'tournament_prize', eventId: tournamentId }).catch(() => {});
}

// ─── addSpectator ─────────────────────────────────────────────────────────────

export const addSpectator = async (tournamentId: string, uid: string): Promise<void> => {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    spectators: arrayUnion(uid),
  });
};

// ─── subscribeToTournament ────────────────────────────────────────────────────

export const subscribeToTournament = (
  tournamentId: string,
  callback: (t: Tournament) => void
): (() => void) => {
  return onSnapshot(doc(db, 'tournaments', tournamentId), (snap) => {
    if (snap.exists()) callback(snap.data() as Tournament);
  });
};

// ─── getActiveTournaments ─────────────────────────────────────────────────────

export const getActiveTournaments = async (): Promise<Tournament[]> => {
  const q = query(
    collection(db, 'tournaments'),
    where('status', 'in', ['waiting', 'active']),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Tournament);
};

// ─── getActiveGlobalTournamentId ─────────────────────────────────────────────

export const getActiveGlobalTournamentId = async (): Promise<string | null> => {
  const snap = await getDoc(doc(db, 'meta', 'tournaments'));
  return snap.exists() ? (snap.data().activeGlobalTournamentId ?? null) : null;
};

// ─── Helpers de premio para mostrar en UI ────────────────────────────────────

export const getTournamentPrizeInfo = (type: 'global' | 'local', maxPlayers: 4 | 8 | 16) => {
  if (type === 'global') {
    const p = calcGlobalPrizes(maxPlayers);
    return {
      pool: calcGlobalPool(maxPlayers),
      first: p.first,
      second: p.second,
      third: p.third,
      creator: p.creatorCut,
      entryFee: ENTRY_FEE_GLOBAL,
    };
  }
  return {
    pool: 0,
    first: LOCAL_PRIZES.first,
    second: LOCAL_PRIZES.second,
    third: LOCAL_PRIZES.third,
    creator: LOCAL_CREATOR_CUT,
    entryFee: 0,
  };
};

export { TOURNAMENT_PASS_COST, ENTRY_FEE_GLOBAL };

// ─── fillWithBots (SOLO local) ────────────────────────────────────────────────

/**
 * Rellena los espacios vacíos de un torneo local con bots de nivel medio.
 * Solo disponible para torneos locales — los bots ganados van a la economía.
 * Visible para el creador después de 5 minutos de espera.
 */
export const fillWithBots = async (
  tournamentId: string,
  creatorUid: string
): Promise<void> => {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!snap.exists()) return;
  const t = snap.data() as Tournament;

  if (t.type !== 'local') throw new Error('BOTS_ONLY_LOCAL');
  if (t.status !== 'waiting') throw new Error('TOURNAMENT_STARTED');
  if (t.createdBy !== creatorUid) throw new Error('NOT_CREATOR');

  const slotsNeeded = t.maxPlayers - t.players.length;
  if (slotsNeeded <= 0) return;

  const botUpdates: Record<string, any> = {};
  const newPlayers = [...t.players];

  for (let i = 0; i < slotsNeeded; i++) {
    const botUid = `bot_${i + 1}_${tournamentId}`;
    const botUsername = `Bot ${i + 1}`;
    const botAvatar = `avatar_${((i % 8) + 1)}`;

    newPlayers.push(botUid);
    botUpdates[`playerUsernames.${botUid}`] = botUsername;
    botUpdates[`playerAvatars.${botUid}`] = botAvatar;
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    players: newPlayers,
    ...botUpdates,
  });
};
