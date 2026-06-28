// ============================================
// FILE: src/hooks/useAuth.js
// ONLY AUTH CODE IN THIS FILE - NOTHING ELSE
// ============================================
import { useState, useEffect, createContext, useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
        setUser(firebaseUser);
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const getUserProfile = async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  const register = async (
    email,
    password,
    firstName,
    lastName,
    role = 'user'
  ) => {
    try {
      const { user: firebaseUser } =
        await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`
      });

      const userDoc = {
        uid: firebaseUser.uid,
        firstName,
        lastName,
        email,
        role,
        avatar: '',
        favoriteRestaurants: [],
        dietaryPreferences: [],
        notifications: {
          pushEnabled: true,
          menuUpdates: true,
          promotions: true
        },
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
      setUserProfile(userDoc);

      return { success: true, user: firebaseUser };
    } catch (error) {
      let message = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already registered';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      }
      return { success: false, error: message };
    }
  };

  const login = async (email, password) => {
    try {
      const { user: firebaseUser } =
        await signInWithEmailAndPassword(auth, email, password);

      const profile = await getUserProfile(firebaseUser.uid);
      setUserProfile(profile);

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLogin: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      let message = 'Login failed';
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Try again later';
      }
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Could not send reset email. Check the address.'
      };
    }
  };

  const updateUserProfile = async (data) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
      const updated = await getUserProfile(user.uid);
      setUserProfile(updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    register,
    login,
    logout,
	signOut: logout,
    forgotPassword,
    updateUserProfile,
    isAdmin: userProfile?.role === 'admin',
    isOwner: userProfile?.role === 'restaurant_owner',
    isUser: userProfile?.role === 'user'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};