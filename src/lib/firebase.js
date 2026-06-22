import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyDznW5-jle9ngswGuCbwSsI9W25u8MfGQo',
  authDomain: 'cuu-ho-ha.firebaseapp.com',
  projectId: 'cuu-ho-ha',
  storageBucket: 'cuu-ho-ha.firebasestorage.app',
  messagingSenderId: '593449975603',
  appId: '1:593449975603:web:607460d34a315d9e918846',
  measurementId: 'G-1NR8KWLFMZ',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId,
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
