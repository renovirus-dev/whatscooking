// ============================================
// FILE: src/hooks/useAuth.js
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
  onSnapshot,        // ✅ ADD THIS
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let profileUnsubscribe = null; // ✅ holds the Firestore listener

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // ✅ Clean up previous profile listener whenever auth changes
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);

        // ✅ Real-time listener on the user doc
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        profileUnsubscribe = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data());
            } else {
              setUserProfile(null);
            }
            setLoading(false); // ✅ only stop loading once we have profile data
          },
          (error) => {
            console.error('Profile snapshot error:', error);
            setUserProfile(null);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    // ✅ Cleanup both listeners on unmount
    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  // getUserProfile kept for internal use in register/login
  const getUserProfile = async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  const register = async (email, password, firstName, lastName, role = 'user') => {
    try {
      const { user: firebaseUser } =
        await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`
      });

      const userDoc = {
        uid:                 firebaseUser.uid,
        firstName,
        lastName,
        email,
        role,
        avatar:              '',
        favoriteRestaurants: [],
        favoriteDishes:      [], // ✅ initialise so it always exists
        dietaryPreferences:  [],
        notifications: {
          pushEnabled: true,
          menuUpdates: true,
          promotions:  true
        },
        isActive:  true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
      // ✅ No need to setUserProfile here — onSnapshot will fire automatically

      return { success: true, user: firebaseUser };
    } catch (error) {
      let message = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') message = 'Email already registered';
      else if (error.code === 'auth/weak-password')   message = 'Password must be at least 6 characters';
      else if (error.code === 'auth/invalid-email')   message = 'Invalid email address';
      return { success: false, error: message };
    }
  };

  const login = async (email, password) => {
    try {
      const { user: firebaseUser } =
        await signInWithEmailAndPassword(auth, email, password);

      // ✅ No need to setUserProfile here — onSnapshot fires automatically
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLogin: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      let message = 'Login failed';
      if (
        error.code === 'auth/user-not-found'    ||
        error.code === 'auth/wrong-password'    ||
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
      // ✅ onAuthStateChanged handles clearing user + userProfile
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
      return { success: false, error: 'Could not send reset email. Check the address.' };
    }
  };

  const updateUserProfile = async (data) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
      // ✅ No need to re-fetch — onSnapshot updates userProfile automatically
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
    signOut:           logout,
    forgotPassword,
    updateUserProfile,
    isAdmin:  userProfile?.role === 'admin',
    isOwner:  userProfile?.role === 'restaurant_owner',
    isUser:   userProfile?.role === 'user'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};