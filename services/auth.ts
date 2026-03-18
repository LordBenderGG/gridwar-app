import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  deleteUser,
} from 'firebase/auth';
import { registerCreatorIfNeeded } from './creator';
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, limit,
} from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, db } from './firebase';

// Tipos de comodines disponibles en el juego
export type WildcardType =
  | 'turbo'
  | 'time_reduce'
  | 'teleport'
  | 'shield'
  | 'confusion'
  | 'sabotage'
  | 'freeze'
  | 'earthquake';

export interface WildcardInventory {
  turbo: number;
  time_reduce: number;
  teleport: number;
  shield: number;
  confusion: number;
  sabotage: number;
  freeze: number;
  earthquake: number;
}

export interface UserInventory {
  profile_frame?: string | null | boolean;
  board_theme?: string | null | boolean;
  name_color?: string | null | boolean;
  avatar_premium?: boolean;
  name_change?: number;
  point_shield?: boolean;
  streak_shield?: boolean;
  double_xp?: boolean;
  double_xp_remaining?: number;
  history_extended?: boolean;
  active_frame?: string | null;
  active_theme?: string | null;
  active_name_color?: string | null;
  tournament_pass?: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatar: string;
  photoURL: string | null;
  points: number;
  gems: number;
  rank: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  blockedUntil: number | null;
  challengeBlockedUntil: number | null;
  activeChallengeId?: string | null;
  status: 'available' | 'in_game' | 'challenged' | 'blocked';
  mode: 'global' | 'local';
  lang: string;
  createdAt: any;
  // Inventario de comodines
  wildcards: WildcardInventory;
  // Inventario de items de personalización y ventajas
  inventory?: UserInventory;
  // XP y nivel (Fase 2A)
  xp: number;
  level: number;
  // Gemas diarias (Fase 1A)
  lastLoginReward?: string;   // fecha ISO "YYYY-MM-DD"
  // Torneos ganados (Fase 4)
  tournamentsWon?: number;
  // Racha de victorias actual
  currentWinStreak?: number;
}

const LEGACY_WILDCARD_ALIASES: Record<string, WildcardType> = {
  tiempo: 'time_reduce',
  escudo: 'shield',
  bomba: 'sabotage',
  ciego: 'earthquake',
};

export const normalizeWildcardInventory = (raw: any): WildcardInventory => {
  const source = raw || {};
  const read = (key: WildcardType): number => {
    const direct = source[key];
    if (typeof direct === 'number') return Math.max(0, Math.floor(direct));
    const aliasKey = Object.keys(LEGACY_WILDCARD_ALIASES).find((k) => LEGACY_WILDCARD_ALIASES[k] === key);
    const aliasValue = aliasKey ? source[aliasKey] : undefined;
    const n = Number(aliasValue);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };

  return {
    turbo: read('turbo'),
    time_reduce: read('time_reduce'),
    teleport: read('teleport'),
    shield: read('shield'),
    confusion: read('confusion'),
    sabotage: read('sabotage'),
    freeze: read('freeze'),
    earthquake: read('earthquake'),
  };
};

export const normalizeUserProfile = (raw: any, fallbackUid?: string): UserProfile => {
  return {
    ...raw,
    uid: raw?.uid || fallbackUid || '',
    activeChallengeId: raw?.activeChallengeId ?? null,
    wildcards: normalizeWildcardInventory(raw?.wildcards),
  } as UserProfile;
};

// Puntos y comodines de bienvenida que recibe todo usuario nuevo
export const WELCOME_POINTS = 100;
export const WELCOME_WILDCARDS: WildcardInventory = {
  turbo: 3,
  time_reduce: 3,
  teleport: 3,
  shield: 3,
  confusion: 3,
  sabotage: 3,
  freeze: 3,
  earthquake: 3,
};

export const isUsernameTaken = async (username: string): Promise<boolean> => {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username.trim()),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
};

export const registerUser = async (
  email: string,
  password: string,
  username: string,
  avatar: string,
  photoURL: string | null = null
): Promise<UserProfile> => {
  // 1. Crear cuenta en Auth primero — así la query de username tiene auth != null
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // 2. Validar username único con sesión activa (regla segura: auth != null)
  let taken = false;
  try {
    taken = await isUsernameTaken(username);
  } catch {
    await deleteUser(cred.user).catch(() => {});
    throw new Error('No se pudo verificar el nombre de usuario. Intenta de nuevo.');
  }
  if (taken) {
    await deleteUser(cred.user).catch(() => {});
    throw new Error('Este nombre de usuario ya está en uso. Elige otro.');
  }
  const profile: UserProfile = {
    uid: cred.user.uid,
    username,
    email,
    avatar,
    photoURL,
    points: WELCOME_POINTS,
    gems: 100,
    rank: 'Novato',
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    blockedUntil: null,
    challengeBlockedUntil: null,
    activeChallengeId: null,
    status: 'available',
    mode: 'global',
    lang: 'es',
    createdAt: serverTimestamp(),
    wildcards: { ...WELCOME_WILDCARDS },
    xp: 0,
    level: 1,
    lastLoginReward: '',
    tournamentsWon: 0,
    currentWinStreak: 0,
  };

  try {
    await setDoc(doc(db, 'users', cred.user.uid), profile);
  } catch (err) {
    // Rollback: eliminar cuenta de Auth si no se pudo guardar el perfil
    await deleteUser(cred.user).catch(() => {});
    throw err;
  }

  return profile;
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Registrar silenciosamente si es el creador de la app
  registerCreatorIfNeeded(cred.user.uid, email).catch(() => {});
  return cred.user;
};

export const ensureUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
  const uid = firebaseUser.uid;
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return normalizeUserProfile(snap.data(), uid);

  const email = firebaseUser.email || '';
  const emailBase = email.split('@')[0] || 'Jugador';
  const safeBase = emailBase.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12) || 'Jugador';
  const recoveredUsername = `${safeBase}_${uid.slice(0, 4)}`;

  const profile: UserProfile = {
    uid,
    username: recoveredUsername,
    email,
    avatar: 'avatar_1',
    photoURL: null,
    points: WELCOME_POINTS,
    gems: 100,
    rank: 'Novato',
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    blockedUntil: null,
    challengeBlockedUntil: null,
    activeChallengeId: null,
    status: 'available',
    mode: 'global',
    lang: 'es',
    createdAt: serverTimestamp(),
    wildcards: { ...WELCOME_WILDCARDS },
    xp: 0,
    level: 1,
    lastLoginReward: '',
    tournamentsWon: 0,
    currentWinStreak: 0,
  };

  await setDoc(doc(db, 'users', uid), profile);
  return profile;
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return normalizeUserProfile(snap.data(), uid);
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), data as any);
};

/**
 * Optimiza y guarda la foto de perfil como base64 en el documento de Firestore.
 * Recibe el uri local que devuelve expo-image-picker.
 *
 * Pipeline de optimización:
 *   1. Redimensiona a 256×256 px (suficiente para avatar circular)
 *   2. Convierte a JPEG con calidad 0.6
 *   3. Exporta como base64
 * Resultado típico: ~15-40 KB — muy por debajo del límite de 1MB de Firestore.
 */
export const uploadProfilePhoto = async (uid: string, uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 256, height: 256 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!result.base64) throw new Error('No se pudo procesar la imagen');

  const photoURL = `data:image/jpeg;base64,${result.base64}`;
  await updateDoc(doc(db, 'users', uid), { photoURL });
  return photoURL;
};

export const onAuthChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
