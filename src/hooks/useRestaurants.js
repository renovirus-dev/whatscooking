// ============================================
// FILE: src/hooks/useRestaurants.js
// ============================================
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  uploadImage,
  getAutoFoodImage
} from '../utils/imageUpload';

export { getAutoFoodImage };

export const useRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Removed orderBy to avoid needing composite index
    // Add index in Firebase console if you want sorting back
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // ✅ Sort in memory instead - no index needed
      data.sort((a, b) =>
        (b.averageRating || 0) - (a.averageRating || 0)
      );

      setRestaurants(data);
      setLoading(false);
    }, (error) => {
      // ✅ Handle query errors gracefully
      console.error('Restaurant query error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────
  // CREATE RESTAURANT
  // ✅ Fixed: checks for existing restaurant
  //          before creating to prevent duplicates
  // ─────────────────────────────────────────
  const createRestaurant = async (data, logoUri, coverUri) => {
    try {
      // ✅ Step 1 - Check if owner already has a restaurant
      const existingQuery = query(
        collection(db, 'restaurants'),
        where('ownerId', '==', data.ownerId)
      );
      const existingSnap = await getDocs(existingQuery);

      // ✅ Step 2 - If restaurant exists, UPDATE instead of CREATE
      if (!existingSnap.empty) {
        console.log('Restaurant already exists, updating instead...');
        const existingId = existingSnap.docs[0].id;
        return updateRestaurant(
          existingId,
          data,
          logoUri,
          coverUri
        );
      }

      // ✅ Step 3 - Upload images
      let logoUrl = '';
      let coverUrl = '';
      let logoPath = '';
      let coverPath = '';

      if (logoUri) {
        logoPath =
          `restaurants/logos/${data.ownerId}_${Date.now()}`;
        const result = await uploadImage(logoUri, logoPath);
        if (result.success) logoUrl = result.url;
      }

      if (coverUri) {
        coverPath =
          `restaurants/covers/${data.ownerId}_${Date.now()}`;
        const result = await uploadImage(coverUri, coverPath);
        if (result.success) coverUrl = result.url;
      }

      // ✅ Step 4 - Generate ID manually with doc()
      // so we can store it inside the document itself
      const newRef = doc(collection(db, 'restaurants'));

      const restaurantData = {
        ...data,
        id: newRef.id,          // ✅ Store id inside document
        logoUrl,
        coverUrl,
        logoPath,
        coverPath,
        averageRating: 0,
        totalReviews: 0,
        totalFavorites: 0,
        isActive: true,
        isCurrentlyOpen: false,
        isVerified: false,
        subscription: {
          plan: 'free_trial',
          status: 'active',
          trialEndsAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          )
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // ✅ Step 5 - Use setDoc instead of addDoc
      // setDoc with a specific ref = predictable, no duplicates
      await setDoc(newRef, restaurantData);

      console.log('✅ Restaurant created:', newRef.id);
      return { success: true, id: newRef.id };

    } catch (error) {
      console.error('❌ createRestaurant error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // UPDATE RESTAURANT
  // ─────────────────────────────────────────
  const updateRestaurant = async (
    restaurantId,
    data,
    newLogoUri,
    newCoverUri
  ) => {
    try {
      const updates = {
        ...data,
        updatedAt: serverTimestamp()
      };

      if (newLogoUri) {
        const logoPath =
          `restaurants/logos/${restaurantId}_${Date.now()}`;
        const result = await uploadImage(newLogoUri, logoPath);
        if (result.success) {
          updates.logoUrl = result.url;
          updates.logoPath = logoPath;
        }
      }

      if (newCoverUri) {
        const coverPath =
          `restaurants/covers/${restaurantId}_${Date.now()}`;
        const result = await uploadImage(
          newCoverUri,
          coverPath
        );
        if (result.success) {
          updates.coverUrl = result.url;
          updates.coverPath = coverPath;
        }
      }

      await updateDoc(
        doc(db, 'restaurants', restaurantId),
        updates
      );

      console.log('✅ Restaurant updated:', restaurantId);
      return { success: true };

    } catch (error) {
      console.error('❌ updateRestaurant error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE OPEN STATUS
  // ─────────────────────────────────────────
  const toggleOpenStatus = async (restaurantId, isOpen) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        isCurrentlyOpen: isOpen,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE FAVORITE
  // ✅ Fixed: guard against null userId (guest mode)
  // ─────────────────────────────────────────
  const toggleFavorite = async (
    userId,
    restaurantId,
    isFavorited
  ) => {
    // ✅ Guard - guests can't favorite
    if (!userId) {
      return {
        success: false,
        error: 'Must be logged in to favorite'
      };
    }

    try {
      const userRef = doc(db, 'users', userId);
      const restaurantRef = doc(
        db, 'restaurants', restaurantId
      );

      if (isFavorited) {
        await updateDoc(userRef, {
          favoriteRestaurants: arrayRemove(restaurantId)
        });
        await updateDoc(restaurantRef, {
          totalFavorites: increment(-1)
        });
      } else {
        await updateDoc(userRef, {
          favoriteRestaurants: arrayUnion(restaurantId)
        });
        await updateDoc(restaurantRef, {
          totalFavorites: increment(1)
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // ADD REVIEW
  // ✅ Fixed: guard against null userId
  // ─────────────────────────────────────────
  const addReview = async (
    restaurantId,
    userId,
    rating,
    comment
  ) => {
    // ✅ Guard - guests can't review
    if (!userId) {
      return {
        success: false,
        error: 'Must be logged in to review'
      };
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        restaurantId,
        userId,
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      await updateDoc(
        doc(db, 'restaurants', restaurantId), {
          totalReviews: increment(1)
        }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    restaurants,
    loading,
    createRestaurant,
    updateRestaurant,
    toggleOpenStatus,
    toggleFavorite,
    addReview
  };
};