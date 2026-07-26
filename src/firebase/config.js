// ============================================
// FILE: src/firebase/config.js
// ============================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';

// ✅ Credentials from environment variables
// Never commit real keys to Git
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  // ✅ storageBucket removed - we use Cloudinary now
  // ✅ measurementId removed - Analytics not needed
};

// ─────────────────────────────────────────────
// INITIALIZE APP
// ✅ Safe — only initializes once
// ─────────────────────────────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ─────────────────────────────────────────────
// AUTH WITH PERSISTENCE
// ✅ Web → browser persistence
// ✅ React Native → AsyncStorage persistence
// ─────────────────────────────────────────────
let auth;

if (Platform.OS === 'web') {
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
} else {
  const {
    initializeAuth,
    getReactNativePersistence,
    getAuth,
  } = require('firebase/auth');

  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // ✅ Already initialized — get existing instance
    auth = getAuth(app);
  }
}

// ─────────────────────────────────────────────
// FIRESTORE
// ✅ Web → IndexedDB offline cache
// ✅ React Native → longPolling (no IndexedDB warning)
// ─────────────────────────────────────────────
let db;

try {
  if (Platform.OS === 'web') {
    const {
      persistentLocalCache,
      CACHE_SIZE_UNLIMITED,
    } = require('firebase/firestore');

    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    });
  } else {
    // ✅ React Native — experimentalForceLongPolling
    // fixes WebSocket issues on Android/iOS
    // No IndexedDB = no console warnings
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch {
  // ✅ Already initialized — get existing instance
  db = getFirestore(app);
}

// ─────────────────────────────────────────────
// EXPORTS
// ✅ storage removed — using Cloudinary instead
// ─────────────────────────────────────────────
export { auth, db };
export default app;