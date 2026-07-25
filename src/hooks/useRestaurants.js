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
import * as ImageManipulator from 'expo-image-manipulator';
import { db }                from '../firebase/config';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

// ─── Cloudinary Config ────────────────────────
const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// INTERNAL UPLOAD HELPERS
// ─────────────────────────────────────────────

/**
 * Upload a restaurant image to Cloudinary
 * @param {string} imageUri    - local image URI
 * @param {string} restaurantId
 * @param {string} type        - 'logo' | 'cover'
 * @returns {Promise<{success, url, publicId}>}
 */
const uploadRestaurantImage = async (imageUri, restaurantId, type) => {
  try {
    // ── Step 1: Compress ──────────────────────
    const isLogo = type === 'logo';
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: isLogo ? 400 : 1200 } }],
      {
        compress: 0.8,
        format:   ImageManipulator.SaveFormat.JPEG,
      }
    );

    // ── Step 2: Build FormData ────────────────
    const formData = new FormData();
    formData.append('file', {
      uri:  compressed.uri,
      type: 'image/jpeg',
      name: `restaurant_${type}_${restaurantId}_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', uploadPreset);
    // ✅ Goes to whats_cooking/restaurants/
    formData.append('folder', folders.restaurants);
    // ✅ Consistent public_id for easy management
    formData.append('public_id', `${type}_${restaurantId}`);

    // ── Step 3: Upload ────────────────────────
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method:  'POST',
        body:    formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Cloudinary upload failed');
    }

    const data = await response.json();

    return {
      success:  true,
      url:      data.secure_url,
      publicId: data.public_id,
      width:    data.width,
      height:   data.height,
    };
  } catch (error) {
    console.error(`❌ uploadRestaurantImage (${type}) error:`, error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────
export const useRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);

  // ─── Real-time listener ───────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        // ✅ Sort by rating in memory — no composite index needed
        data.sort((a, b) =>
          (b.averageRating || 0) - (a.averageRating || 0)
        );
        setRestaurants(data);
        setLoading(false);
      },
      (error) => {
        console.error('Restaurant query error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────
  // CREATE RESTAURANT
  // ─────────────────────────────────────────
  const createRestaurant = async (data, logoUri, coverUri) => {
    try {
      // ✅ Check if owner already has a restaurant
      const existingQuery = query(
        collection(db, 'restaurants'),
        where('ownerId', '==', data.ownerId)
      );
      const existingSnap = await getDocs(existingQuery);

      // ✅ If exists — update instead of creating duplicate
      if (!existingSnap.empty) {
        console.log('Restaurant exists — updating instead');
        const existingId = existingSnap.docs[0].id;
        return updateRestaurant(existingId, data, logoUri, coverUri);
      }

      // ✅ Generate ID FIRST so we can use it in Cloudinary public_id
      const newRef       = doc(collection(db, 'restaurants'));
      const restaurantId = newRef.id;

      // ── Upload Logo ───────────────────────
      let logoUrl           = '';
      let logoPublicId      = '';
      let coverUrl          = '';
      let coverPublicId     = '';

      if (logoUri) {
        console.log('⬆️ Uploading restaurant logo to Cloudinary...');
        const result = await uploadRestaurantImage(
          logoUri, restaurantId, 'logo'
        );
        if (result.success) {
          logoUrl      = result.url;
          logoPublicId = result.publicId;
          console.log('✅ Logo uploaded:', result.url);
        } else {
          console.error('❌ Logo upload failed:', result.error);
          // Continue without logo — not a blocking error
        }
      }

      // ── Upload Cover ──────────────────────
      if (coverUri) {
        console.log('⬆️ Uploading restaurant cover to Cloudinary...');
        const result = await uploadRestaurantImage(
          coverUri, restaurantId, 'cover'
        );
        if (result.success) {
          coverUrl      = result.url;
          coverPublicId = result.publicId;
          console.log('✅ Cover uploaded:', result.url);
        } else {
          console.error('❌ Cover upload failed:', result.error);
          // Continue without cover — not a blocking error
        }
      }

      // ── Save to Firestore ─────────────────
      const restaurantData = {
        ...data,
        id: restaurantId,

        // ✅ Cloudinary image fields
        // Replaces: logoUrl, coverUrl, logoPath, coverPath
        logoUrl,
        logoPublicId,           // for future management
        coverUrl,
        coverPublicId,          // for future management

        // ✅ Keep cloudinaryUrl aliases for consistency
        logoCloudinaryUrl:  logoUrl,
        coverCloudinaryUrl: coverUrl,

        // ✅ Default stats
        averageRating:   0,
        totalReviews:    0,
        totalFavorites:  0,

        // ✅ Default status
        isActive:        true,
        isCurrentlyOpen: false,
        isVerified:      false,
        isApproved:      false,

        // ✅ Default subscription
        subscription: {
          plan:        'free_trial',
          status:      'active',
          trialEndsAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(newRef, restaurantData);

      console.log('✅ Restaurant created:', restaurantId);
      return {
        success: true,
        id:      restaurantId,
        logoUrl,
        coverUrl,
      };

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
    newCoverUri,
  ) => {
    try {
      const updates = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      // ── Update Logo ───────────────────────
      if (newLogoUri) {
        console.log('⬆️ Updating restaurant logo on Cloudinary...');
        const result = await uploadRestaurantImage(
          newLogoUri, restaurantId, 'logo'
        );
        if (result.success) {
          updates.logoUrl            = result.url;
          updates.logoPublicId       = result.publicId;
          updates.logoCloudinaryUrl  = result.url;
          console.log('✅ Logo updated:', result.url);
        } else {
          // ✅ Keep existing logo — don't break the update
          console.error('❌ Logo update failed:', result.error);
        }
      }

      // ── Update Cover ──────────────────────
      if (newCoverUri) {
        console.log('⬆️ Updating restaurant cover on Cloudinary...');
        const result = await uploadRestaurantImage(
          newCoverUri, restaurantId, 'cover'
        );
        if (result.success) {
          updates.coverUrl            = result.url;
          updates.coverPublicId       = result.publicId;
          updates.coverCloudinaryUrl  = result.url;
          console.log('✅ Cover updated:', result.url);
        } else {
          // ✅ Keep existing cover — don't break the update
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

  // ─────────────────────────────────────────
  // TOGGLE OPEN STATUS
  // ─────────────────────────────────────────
  const toggleOpenStatus = async (restaurantId, isOpen) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        isCurrentlyOpen: isOpen,
        updatedAt:       serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('❌ toggleOpenStatus error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE FAVORITE
  // ─────────────────────────────────────────
  const toggleFavorite = async (userId, restaurantId, isFavorited) => {
    // ✅ Guard — guests cannot favorite
    if (!userId) {
      return { success: false, error: 'Must be logged in to favorite' };
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
      console.error('❌ toggleFavorite error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // ADD REVIEW
  // ─────────────────────────────────────────
  const addReview = async (restaurantId, userId, rating, comment) => {
    // ✅ Guard — guests cannot review
    if (!userId) {
      return { success: false, error: 'Must be logged in to review' };
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        restaurantId,
        userId,
        rating,
        comment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        totalReviews: increment(1),
      });
      return { success: true };
    } catch (error) {
      console.error('❌ addReview error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────
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