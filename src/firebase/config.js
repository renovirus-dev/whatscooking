// ============================================
// FILE: src/firebase/config.js
// ============================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform }   from 'react-native';

const firebaseConfig = {
  apiKey:            "AIzaSyCj-h8xEa1Hnd4YoC5Wx47_sZW4ChPgP9w",
  authDomain:        "whats-cooking-5fd93.firebaseapp.com",
  projectId:         "whats-cooking-5fd93",
  storageBucket:     "whats-cooking-5fd93.firebasestorage.app",
  messagingSenderId: "287609653948",
  appId:             "1:287609653948:web:43226c2db2ae8d5e3a1eb9",
  measurementId:     "G-TX2146N6NB",
};

// ── Initialize app (safe — only once) ────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ── Auth with persistence ─────────────────────
let auth;

if (Platform.OS === 'web') {
  // Web uses default browser persistence
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
} else {
  // React Native uses AsyncStorage persistence
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
  } catch (e) {
    // Already initialized — just get the existing instance
    auth = getAuth(app);
  }
}

// ── Firestore ─────────────────────────────────
// ✅ KEY FIX:
// persistentLocalCache uses IndexedDB which does NOT
// exist in React Native — causes the warning/crash.
//
// Solution:
// - On React Native → use experimentalForceLongPolling
//   (no offline cache but stable and no warnings)
// - On Web → use persistentLocalCache (IndexedDB works fine)
let db;

try {
  if (Platform.OS === 'web') {
    // ✅ Web — use IndexedDB offline cache
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
    // ✅ React Native (Android + iOS)
    // experimentalForceLongPolling fixes WebSocket issues
    // No IndexedDB = no warning
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch (e) {
  // Already initialized — get existing instance
  db = getFirestore(app);
}

// ── Storage ───────────────────────────────────
const storage = getStorage(app);

export { auth, db, storage };
export default app;