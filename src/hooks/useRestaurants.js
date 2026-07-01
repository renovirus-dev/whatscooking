// ============================================
// FILE: src/hooks/useRestaurants.js
// ============================================
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
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
  increment,
} from 'firebase/firestore';
import { db }              from '../firebase/config';
import {
  uploadImage,
  getAutoFoodImage,
} from '../utils/imageUpload';

export { getAutoFoodImage };

export const useRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      data.sort((a, b) =>
        (b.averageRating || 0) - (a.averageRating || 0)
      );
      setRestaurants(data);
      setLoading(false);
    }, (error) => {
      console.error('Restaurant query error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ─── CREATE RESTAURANT ───────────────────
  const createRestaurant = async (data, logoUri, coverUri) => {
    try {
      // Check if owner already has a restaurant
      const existingQuery = query(
        collection(db, 'restaurants'),
        where('ownerId', '==', data.ownerId)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        console.log('Restaurant exists — updating instead');
        const existingId = existingSnap.docs[0].id;
        return updateRestaurant(
          existingId, data, logoUri, coverUri
        );
      }

      // ✅ Generate ID first so path uses restaurantId
      const newRef       = doc(collection(db, 'restaurants'));
      const restaurantId = newRef.id;

      let logoUrl   = '';
      let coverUrl  = '';
      let logoPath  = '';
      let coverPath = '';

      if (logoUri) {
        // ✅ FIXED: restaurants/{restaurantId}/... matches rule
        logoPath  = `restaurants/${restaurantId}/logo_${Date.now()}`;
        const result = await uploadImage(logoUri, logoPath);
        if (result.success) {
          logoUrl = result.url;
          console.log('✅ Logo uploaded:', logoUrl);
        } else {
          console.error('❌ Logo upload failed:', result.error);
        }
      }

      if (coverUri) {
        // ✅ FIXED: restaurants/{restaurantId}/... matches rule
        coverPath = `restaurants/${restaurantId}/cover_${Date.now()}`;
        const result = await uploadImage(coverUri, coverPath);
        if (result.success) {
          coverUrl = result.url;
          console.log('✅ Cover uploaded:', coverUrl);
        } else {
          console.error('❌ Cover upload failed:', result.error);
        }
      }

      const restaurantData = {
        ...data,
        id:              restaurantId,
        logoUrl,
        coverUrl,
        logoPath,
        coverPath,
        averageRating:   0,
        totalReviews:    0,
        totalFavorites:  0,
        isActive:        true,
        isCurrentlyOpen: false,
        isVerified:      false,
        isApproved:      false,
        subscription: {
          plan:        'free_trial',
          status:      'active',
          trialEndsAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(newRef, restaurantData);

      console.log('✅ Restaurant created:', restaurantId);
      return { success: true, id: restaurantId };

    } catch (error) {
      console.error('❌ createRestaurant error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─── UPDATE RESTAURANT ───────────────────
  const updateRestaurant = async (
    restaurantId,
    data,
    newLogoUri,
    newCoverUri
  ) => {
    try {
      const updates = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      if (newLogoUri) {
        // ✅ FIXED: restaurants/{restaurantId}/... matches rule
        const logoPath =
          `restaurants/${restaurantId}/logo_${Date.now()}`;
        const result = await uploadImage(newLogoUri, logoPath);
        if (result.success) {
          updates.logoUrl  = result.url;
          updates.logoPath = logoPath;
          console.log('✅ Logo updated');
        } else {
          console.error('❌ Logo update failed:', result.error);
        }
      }

      if (newCoverUri) {
        // ✅ FIXED: restaurants/{restaurantId}/... matches rule
        const coverPath =
          `restaurants/${restaurantId}/cover_${Date.now()}`;
        const result = await uploadImage(newCoverUri, coverPath);
        if (result.success) {
          updates.coverUrl  = result.url;
          updates.coverPath = coverPath;
          console.log('✅ Cover updated');
        } else {
          console.error('❌ Cover update failed:', result.error);
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

  // ─── TOGGLE OPEN STATUS ──────────────────
  const toggleOpenStatus = async (restaurantId, isOpen) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        isCurrentlyOpen: isOpen,
        updatedAt:       serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── TOGGLE FAVORITE ─────────────────────
  const toggleFavorite = async (
    userId,
    restaurantId,
    isFavorited
  ) => {
    if (!userId) {
      return {
        success: false,
        error: 'Must be logged in to favorite',
      };
    }

    try {
      const userRef       = doc(db, 'users', userId);
      const restaurantRef = doc(db, 'restaurants', restaurantId);

      if (isFavorited) {
        await updateDoc(userRef, {
          favoriteRestaurants: arrayRemove(restaurantId),
        });
        await updateDoc(restaurantRef, {
          totalFavorites: increment(-1),
        });
      } else {
        await updateDoc(userRef, {
          favoriteRestaurants: arrayUnion(restaurantId),
        });
        await updateDoc(restaurantRef, {
          totalFavorites: increment(1),
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── ADD REVIEW ──────────────────────────
  const addReview = async (
    restaurantId,
    userId,
    rating,
    comment
  ) => {
    if (!userId) {
      return {
        success: false,
        error: 'Must be logged in to review',
      };
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        restaurantId,
        userId,
        rating,
        comment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(
        doc(db, 'restaurants', restaurantId),
        { totalReviews: increment(1) }
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
    addReview,
  };
};