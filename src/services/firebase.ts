import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {} as any;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyBO6NZZ6xfV8DlZ-88zcvipIFfs3wzH-24",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "gvd-new.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "gvd-new",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "gvd-new.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "898665457671",
  appId: env.VITE_FIREBASE_APP_ID || "1:898665457671:web:ae8dec7806001ac26ba2a2"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable local emulator connection if configured
if (env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

export default app;
