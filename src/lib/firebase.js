import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export const isFirebaseConfigured = requiredKeys.every(key => Boolean(firebaseConfig[key]));

export const firebaseApp = isFirebaseConfigured
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

if (firebaseAuth) {
  firebaseAuth.languageCode = 'vi';
}

export function requireFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.'
    );
  }
  return firebaseAuth;
}

export function getFirebaseConfigStatus() {
  return {
    configured: isFirebaseConfigured,
    missing: requiredKeys
      .filter(key => !firebaseConfig[key])
      .map(key => `VITE_FIREBASE_${key.replace(/[A-Z]/g, match => `_${match}`).toUpperCase()}`),
  };
}
