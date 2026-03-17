/**
 * services/missions.ts
 * Misiones diarias (Fase 3)
 *
 * Documento: /users/$uid/dailyMissions/$fecha
 * { missions: DailyMission[], date: string }
 */
import {
  doc, getDoc, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface DailyMission {
  id: string;
  label: string;
  description: string;
  target: number;      // cantidad requerida
  progress: number;    // progreso actual
  reward: number;      // gemas de recompensa
  completed: boolean;
  type: 'wins' | 'wildcards' | 'games' | 'chat';
}

const MISSION_TEMPLATES: Omit<DailyMission, 'progress' | 'completed'>[] = [
  { id: 'win_1',       label: 'Victorioso',      description: 'Gana 1 partida hoy',          target: 1,  reward: 15, type: 'wins' },
  { id: 'win_3',       label: 'Dominador',        description: 'Gana 3 partidas hoy',         target: 3,  reward: 30, type: 'wins' },
  { id: 'play_3',      label: 'Activo',           description: 'Juega 3 partidas hoy',        target: 3,  reward: 20, type: 'games' },
  { id: 'play_5',      label: 'Guerrero',         description: 'Juega 5 partidas hoy',        target: 5,  reward: 35, type: 'games' },
  { id: 'wildcard_3',  label: 'Estratega',        description: 'Usa 3 comodines hoy',         target: 3,  reward: 20, type: 'wildcards' },
  { id: 'wildcard_5',  label: 'Comodinero',       description: 'Usa 5 comodines hoy',         target: 5,  reward: 30, type: 'wildcards' },
  { id: 'chat_1',      label: 'Provocador',       description: 'Envía 1 emoji de burla',      target: 1,  reward: 15, type: 'chat' },
  { id: 'chat_5',      label: 'Troll Pro',        description: 'Envía 5 emojis de burla',     target: 5,  reward: 25, type: 'chat' },
  { id: 'win_2',       label: 'En Racha',         description: 'Gana 2 partidas seguidas',    target: 2,  reward: 40, type: 'wins' },
];

/** Elige 3 misiones aleatorias distintas */
function pickRandomMissions(): DailyMission[] {
  const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((t) => ({
    ...t,
    progress: 0,
    completed: false,
  }));
}

export const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

/**
 * Obtiene (o genera) las 3 misiones del día para el usuario.
 */
export const getDailyMissions = async (uid: string): Promise<DailyMission[]> => {
  const today = getTodayKey();
  const ref = doc(db, 'users', uid, 'dailyMissions', today);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().missions as DailyMission[];
  }
  const missions = pickRandomMissions();
  await setDoc(ref, { missions, date: today });
  return missions;
};

/**
 * Incrementa el progreso de un tipo de misión y otorga gems si se completa.
 * Devuelve las gems otorgadas (0 si ya estaban completadas o no hay cambio).
 */
export const updateMissionProgress = async (
  uid: string,
  type: DailyMission['type'],
  amount: number = 1
): Promise<number> => {
  const today = getTodayKey();
  const missionRef = doc(db, 'users', uid, 'dailyMissions', today);
  const snap = await getDoc(missionRef);
  if (!snap.exists()) return 0;

  const data = snap.data();
  const missions: DailyMission[] = data.missions;
  let gemsEarned = 0;
  let changed = false;

  for (const mission of missions) {
    if (mission.type !== type) continue;
    if (mission.completed) continue;
    mission.progress = Math.min(mission.target, mission.progress + amount);
    if (mission.progress >= mission.target) {
      mission.completed = true;
      gemsEarned += mission.reward;
    }
    changed = true;
  }

  if (changed) {
    await setDoc(missionRef, { missions, date: today });
  }

  return gemsEarned;
};
