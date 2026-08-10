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
// INTERNAL UPLOAD HELPER
// ✅ Uses XMLHttpRequest instead of fetch
//    fetch + FormData causes "unsupported FormDataPart
//    implementation" error in React Native
// ─────────────────────────────────────────────
const uploadRestaurantImage = (imageUri, restaurantId, type) => {
  return new Promise(async (resolve) => {
    try {
      // ── Step 1: Compress ──────────────────
      const isLogo     = type === 'logo';
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: isLogo ? 400 : 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // ── Step 2: Build FormData ────────────
      // ✅ React Native accepts plain objects in FormData
      //    as long as they have uri, type, name
      const formData = new FormData();
      formData.append('file', {
        uri:  compressed.uri,
        type: 'image/jpeg',
        name: `${type}_${restaurantId}_${Date.now()}.jpg`,
      });
      formData.append('upload_preset', uploadPreset);
      formData.append('folder',        folders.restaurants);
      formData.append('public_id',     `${type}_${restaurantId}`);

      // ── Step 3: Upload via XHR ────────────
      // ✅ XMLHttpRequest handles multipart/form-data
      //    correctly in React Native — fetch does not
      const xhr = new XMLHttpRequest();

      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          console.log(`✅ ${type} uploaded:`, data.secure_url);
          resolve({
            success:  true,
            url:      data.secure_url,
            publicId: data.public_id,
            width:    data.width,
            height:   data.height,
          });
        } else {
          let errMsg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMsg = errData.error?.message || errMsg;
          } catch {}
          console.error(`❌ ${type} upload failed:`, errMsg);
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror = () => {
        console.error(`❌ ${type} upload network error`);
        resolve({ success: false, error: 'Network error during upload' });
      };

      xhr.ontimeout = () => {
        console.error(`❌ ${type} upload timed out`);
        resolve({ success: false, error: 'Upload timed out' });
      };

      // ✅ 60 second timeout for large images
      xhr.timeout = 60000;

      // ✅ DO NOT set Content-Type header manually
      //    XHR sets it automatically with the correct boundary
      xhr.send(formData);

    } catch (error) {
      console.error(`❌ uploadRestaurantImage (${type}) error:`, error);
      resolve({ success: false, error: error.message });
    }
  });
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
        // ✅ Sort by rating client-side — no composite index needed
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

      // ✅ Generate ID first so we can use it in Cloudinary public_id
      const newRef       = doc(collection(db, 'restaurants'));
      const restaurantId = newRef.id;

      let logoUrl       = '';
      let logoPublicId  = '';
      let coverUrl      = '';
      let coverPublicId = '';

      // ── Upload Logo ───────────────────────
      if (logoUri) {
        console.log('⬆️ Uploading logo...');
        const result = await uploadRestaurantImage(
          logoUri, restaurantId, 'logo'
        );
        if (result.success) {
          logoUrl      = result.url;
          logoPublicId = result.publicId;
        } else {
          // ✅ Non-blocking — continue without logo
          console.warn('Logo upload failed, continuing without it');
        }
      }

      // ── Upload Cover ──────────────────────
      if (coverUri) {
        console.log('⬆️ Uploading cover...');
        const result = await uploadRestaurantImage(
          coverUri, restaurantId, 'cover'
        );
        if (result.success) {
          coverUrl      = result.url;
          coverPublicId = result.publicId;
        } else {
          // ✅ Non-blocking — continue without cover
          console.warn('Cover upload failed, continuing without it');
        }
      }

      // ── Save to Firestore ─────────────────
      const restaurantData = {
        ...data,
        id: restaurantId,

        // ✅ Cloudinary image fields
        logoUrl,
        logoPublicId,
        coverUrl,
        coverPublicId,

        // ✅ Aliases for consistency
        logoCloudinaryUrl:  logoUrl,
        coverCloudinaryUrl: coverUrl,

        // ✅ Default stats
        averageRating:  0,
        totalReviews:   0,
        totalFavorites: 0,

        // ✅ Default status
        isActive:        true,
        isCurrentlyOpen: false,
        isVerified:      false,
        isApproved:      false,

        // ✅ Default subscription — 14 day free trial
        subscription: {
          plan:        'free_trial',
          status:      'active',
          trialEndsAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },

        analytics: {
          totalViews:         0,
          weeklyViews:        0,
          monthlyViews:       0,
          totalCalls:         0,
          totalWhatsApp:      0,
          totalDirections:    0,
          totalWebsiteClicks: 0,
          totalTimeSpent:     0,
          totalSessions:      0,
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
        console.log('⬆️ Updating logo...');
        const result = await uploadRestaurantImage(
          newLogoUri, restaurantId, 'logo'
        );
        if (result.success) {
          updates.logoUrl           = result.url;
          updates.logoPublicId      = result.publicId;
          updates.logoCloudinaryUrl = result.url;
        } else {
          // ✅ Keep existing logo — don't fail the whole update
          console.warn('Logo update failed:', result.error);
          return {
            success: false,
            error:   `Logo update failed: ${result.error}`,
          };
        }
      }

      // ── Update Cover ──────────────────────
      if (newCoverUri) {
        console.log('⬆️ Updating cover...');
        const result = await uploadRestaurantImage(
          newCoverUri, restaurantId, 'cover'
        );
        if (result.success) {
          updates.coverUrl            = result.url;
          updates.coverPublicId       = result.publicId;
          updates.coverCloudinaryUrl  = result.url;
        } else {
          // ✅ Keep existing cover — don't fail the whole update
          console.warn('Cover update failed:', result.error);
          return {
            success: false,
            error:   `Cover update failed: ${result.error}`,
          };
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
    if (!userId) {
      return { success: false, error: 'Must be logged in to favourite' };
    }

    try {
      const userRef       = doc(db, 'users',       userId);
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