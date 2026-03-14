import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  deleteUser,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, limit,
} from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, db } from './firebase';

// Tipos de comodines disponibles en el juego
export type WildcardType =
  | 'escudo'      // Bloquea el próximo movimiento del rival
  | 'turbo'       // Turno doble (juegas dos veces seguidas)
  | 'tiempo'      // Reduce el timer del rival a 10s
  | 'ciego'       // Oculta el tablero al rival por 5s
  | 'confusion'   // Invierte los controles del rival
  | 'bomba';      // Elimina 2 celdas del rival del tablero

export interface WildcardInventory {
  escudo: number;
  turbo: number;
  tiempo: number;
  ciego: number;
  confusion: number;
  bomba: number;
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
  status: 'available' | 'in_game' | 'challenged' | 'blocked';
  mode: 'global' | 'local';
  lang: string;
  createdAt: any;
  // Inventario de comodines
  wildcards: WildcardInventory;
}

// Puntos y comodines de bienvenida que recibe todo usuario nuevo
export const WELCOME_POINTS = 100;
export const WELCOME_WILDCARDS: WildcardInventory = {
  escudo: 2,
  turbo: 1,
  tiempo: 1,
  ciego: 1,
  confusion: 1,
  bomba: 0, // La bomba se compra en la tienda, no se regala
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
  // Validar username único ANTES de crear la cuenta
  const taken = await isUsernameTaken(username);
  if (taken) {
    throw new Error('Este nombre de usuario ya está en uso. Elige otro.');
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile: UserProfile = {
    uid: cred.user.uid,
    username,
    email,
    avatar,
    photoURL,
    points: WELCOME_POINTS,
    gems: 10,
    rank: 'Novato',
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    blockedUntil: null,
    challengeBlockedUntil: null,
    status: 'available',
    mode: 'global',
    lang: 'es',
    createdAt: serverTimestamp(),
    wildcards: { ...WELCOME_WILDCARDS },
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
  return cred.user;
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return snap.data() as UserProfile;
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
