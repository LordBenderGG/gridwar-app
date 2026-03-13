import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';
import { createGame } from './game';
import { v4 as uuidv4 } from 'uuid';

export interface TournamentMatch {
  matchId: string;
  p1: string;
  p2: string;
  p1Username: string;
  p2Username: string;
  winner: string | null;
  gameId: string | null;
}

export interface Tournament {
  tournamentId: string;
  name: string;
  createdBy: string;
  maxPlayers: 4 | 8 | 16;
  players: string[];
  playerUsernames: Record<string, string>;
  playerAvatars: Record<string, string>;
  bracket: Record<string, TournamentMatch[]>;
  currentRound: number;
  status: 'waiting' | 'active' | 'finished';
  prize: number;
  winner: string | null;
  createdAt: any;
}

const PRIZES: Record<number, number> = {
  4: 200,
  8: 500,
  16: 1000,
};

export const createTournament = async (
  name: string,
  createdBy: string,
  maxPlayers: 4 | 8 | 16
): Promise<string> => {
  const tournamentId = uuidv4();
  const tournament: Tournament = {
    tournamentId,
    name,
    createdBy,
    maxPlayers,
    players: [createdBy],
    playerUsernames: {},
    playerAvatars: {},
    bracket: {},
    currentRound: 0,
    status: 'waiting',
    prize: PRIZES[maxPlayers],
    winner: null,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'tournaments', tournamentId), tournament);
  return tournamentId;
};

export const joinTournament = async (
  tournamentId: string,
  uid: string,
  username: string,
  avatar: string
): Promise<void> => {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    players: arrayUnion(uid),
    [`playerUsernames.${uid}`]: username,
    [`playerAvatars.${uid}`]: avatar,
  });
};

const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const startTournament = async (tournamentId: string): Promise<void> => {
  const snap = await getDocs(
    query(collection(db, 'tournaments'), where('tournamentId', '==', tournamentId))
  );
  if (snap.empty) return;
  const tournament = snap.docs[0].data() as Tournament;

  const shuffledPlayers = shuffle(tournament.players);
  const round1: TournamentMatch[] = [];

  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const p1 = shuffledPlayers[i];
    const p2 = shuffledPlayers[i + 1];
    const matchId = uuidv4();
    const gameId = uuidv4();

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

    round1.push({
      matchId,
      p1,
      p2,
      p1Username: tournament.playerUsernames[p1],
      p2Username: tournament.playerUsernames[p2],
      winner: null,
      gameId,
    });
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    'bracket.round1': round1,
    currentRound: 1,
    status: 'active',
  });
};

export const advanceTournament = async (
  tournamentId: string,
  currentRound: number,
  completedMatches: TournamentMatch[]
): Promise<void> => {
  const winners = completedMatches.map((m) => m.winner!);
  const tournament = (
    await getDocs(query(collection(db, 'tournaments'), where('tournamentId', '==', tournamentId)))
  ).docs[0].data() as Tournament;

  if (winners.length === 1) {
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      status: 'finished',
      winner: winners[0],
    });
    await updateDoc(doc(db, 'users', winners[0]), {
      gems: (tournament.playerAvatars[winners[0]] ? 0 : 0),
    });
    return;
  }

  const nextRound = currentRound + 1;
  const nextMatches: TournamentMatch[] = [];

  for (let i = 0; i < winners.length; i += 2) {
    const p1 = winners[i];
    const p2 = winners[i + 1];
    const matchId = uuidv4();
    const gameId = uuidv4();

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
      matchId,
      p1,
      p2,
      p1Username: tournament.playerUsernames[p1],
      p2Username: tournament.playerUsernames[p2],
      winner: null,
      gameId,
    });
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), {
    [`bracket.round${nextRound}`]: nextMatches,
    currentRound: nextRound,
  });
};

export const subscribeToTournament = (
  tournamentId: string,
  callback: (t: Tournament) => void
): (() => void) => {
  return onSnapshot(doc(db, 'tournaments', tournamentId), (snap) => {
    if (snap.exists()) callback(snap.data() as Tournament);
  });
};

export const getActiveTournaments = async (): Promise<Tournament[]> => {
  const q = query(collection(db, 'tournaments'), where('status', '!=', 'finished'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Tournament);
};
