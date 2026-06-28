// ============================================
// FILE: src/firebase/config.js  ← CLEAN VERSION
// ============================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCj-h8xEa1Hnd4YoC5Wx47_sZW4ChPgP9w",
  authDomain: "whats-cooking-5fd93.firebaseapp.com",
  projectId: "whats-cooking-5fd93",
  storageBucket: "whats-cooking-5fd93.firebasestorage.app",
  messagingSenderId: "287609653948",
  appId: "1:287609653948:web:43226c2db2ae8d5e3a1eb9",
  measurementId: "G-TX2146N6NB"
};

// ✅ Safe initialization - prevents duplicate app error on hot reload
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ✅ Auth with persistence
let auth;

if (Platform.OS === 'web') {
  // Web - uses IndexedDB automatically
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);

} else {
  // Native - needs AsyncStorage
  const {
    initializeAuth,
    getReactNativePersistence,
    getAuth,
  } = require('firebase/auth');

  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;

  try {
    // First time - initialize with persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Hot reload hit this - just get existing instance
    auth = getAuth(app);
  }
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;