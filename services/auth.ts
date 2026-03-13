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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';

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
}

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
    points: 0,
    gems: 0,
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

export const uploadProfilePhoto = async (uid: string, uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  // Usar timestamp para invalidar caché al cambiar la foto
  const timestamp = Date.now();
  const storageRef = ref(storage, `avatars/${uid}/profile_${timestamp}.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', uid), { photoURL: url });
  return url;
};

export const onAuthChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
