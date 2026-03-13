import { initializeApp } from 'firebase/app';
// @ts-ignore — getReactNativePersistence solo está en el bundle RN de firebase
// En runtime, Expo/Metro resuelve 'firebase/auth' al bundle react-native correcto
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBRt608rbqvTf8u9pnquNq-v5j19250VPI',
  authDomain: 'tiktak-app-dd4ad.firebaseapp.com',
  databaseURL: 'https://tiktak-app-dd4ad-default-rtdb.firebaseio.com',
  projectId: 'tiktak-app-dd4ad',
  storageBucket: 'tiktak-app-dd4ad.firebasestorage.app',
  messagingSenderId: '289853645871',
  appId: '1:289853645871:android:39375439b7519c55f852da',
};

const app = initializeApp(firebaseConfig);

// Persistir la sesión con AsyncStorage para que sobreviva reinicios en Android/iOS
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export default app;
