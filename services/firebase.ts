import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export default app;
