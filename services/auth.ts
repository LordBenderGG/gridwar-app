import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

export const registerUser = async (
  email: string,
  password: string,
  username: string,
  avatar: string,
  photoURL: string | null = null
): Promise<UserProfile> => {
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
  await setDoc(doc(db, 'users', cred.user.uid), profile);
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
  const storageRef = ref(storage, `avatars/${uid}/profile.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', uid), { photoURL: url });
  return url;
};

export const onAuthChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
