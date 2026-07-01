// ============================================
// FILE: src/hooks/useMenu.js
// ============================================
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db }              from '../firebase/config';
import {
  uploadImage,
  getAutoFoodImage,
} from '../utils/imageUpload';

export const useMenu = (restaurantId) => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]     = useState(true);

  // ─── Real-time listener ───────────────────
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        items.sort((a, b) => {
          const catCompare =
            (a.category || '').localeCompare(b.category || '');
          if (catCompare !== 0) return catCompare;
          return (a.name || '').localeCompare(b.name || '');
        });
        setMenuItems(items);
        setLoading(false);
      },
      (error) => {
        console.error('useMenu listener error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  // ─── Add Menu Item ────────────────────────
  const addMenuItem = async (data, imageUri) => {
    try {
      // ✅ Generate the doc ref FIRST
      // so we can use itemId in the Storage path
      const newRef = doc(collection(db, 'menuItems'));
      const itemId = newRef.id;

      let imageUrl    = '';
      let isAutoImage = false;

      if (imageUri) {
        // ✅ FIXED: path now matches Storage rule
        // menuItems/{itemId}/... is allowed
        const path   = `menuItems/${itemId}/image_${Date.now()}`;
        const result = await uploadImage(imageUri, path);

        if (result.success) {
          imageUrl    = result.url;
          isAutoImage = false;
          console.log('✅ Menu item image uploaded:', imageUrl);
        } else {
          console.warn('Image upload failed:', result.error);
          // Fall back to auto image
          imageUrl    = data.autoImageUrl ||
                        getAutoFoodImage(
                          data.name,
                          data.category,
                          `${data.name}-${data.category}-0`
                        );
          isAutoImage = true;
        }
      } else if (data.autoImageUrl) {
        // ✅ Use pre-generated auto image URL
        imageUrl    = data.autoImageUrl;
        isAutoImage = true;
      } else {
        // ✅ Generate auto image as fallback
        imageUrl    = getAutoFoodImage(
          data.name,
          data.category,
          `${data.name}-${data.category}-0`
        );
        isAutoImage = true;
      }

      // Remove autoImageUrl from Firestore data
      const { autoImageUrl, ...cleanData } = data;

      await setDoc(newRef, {
        ...cleanData,
        id:                itemId,
        restaurantId,
        imageUrl,
        isAutoImage,
        isAvailable:       true,
        isSpecialOfTheDay: false,
        totalFavorites:    0,
        orderCount:        0,
        viewCount:         0,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });

      console.log('✅ Menu item created:', itemId);
      return { success: true, id: itemId };

    } catch (error) {
      console.error('❌ addMenuItem error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─── Update Menu Item ─────────────────────
  const updateMenuItem = async (itemId, data, newImageUri) => {
    try {
      const { autoImageUrl, ...cleanData } = data;

      const updates = {
        ...cleanData,
        updatedAt: serverTimestamp(),
      };

      if (newImageUri) {
        // ✅ FIXED: path now matches Storage rule
        // menuItems/{itemId}/... is allowed
        const path   = `menuItems/${itemId}/image_${Date.now()}`;
        const result = await uploadImage(newImageUri, path);

        if (result.success) {
          updates.imageUrl    = result.url;
          updates.isAutoImage = false;
          console.log('✅ Menu item image updated:', result.url);
        } else {
          console.warn('Image update failed:', result.error);
        }
      } else if (autoImageUrl) {
        // Owner chose a new auto image
        updates.imageUrl    = autoImageUrl;
        updates.isAutoImage = true;
      }

      await updateDoc(doc(db, 'menuItems', itemId), updates);
      console.log('✅ Menu item updated:', itemId);
      return { success: true };

    } catch (error) {
      console.error('❌ updateMenuItem error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─── Toggle Availability ──────────────────
  const toggleAvailability = async (itemId, currentState) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !currentState,
        updatedAt:   serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── Toggle Special of the Day ────────────
  const toggleSpecial = async (itemId, currentState) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isSpecialOfTheDay: !currentState,
        updatedAt:         serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── Delete Menu Item ─────────────────────
  const deleteMenuItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── Get Grouped Menu ─────────────────────
  const getGroupedMenu = () => {
    return menuItems.reduce((groups, item) => {
      const category = item.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  };

  // ─── Set Daily Menu ───────────────────────
  const setDailyMenu = async (
    availableItemIds,
    specials,
    message
  ) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      const menuData = {
        restaurantId,
        date:             todayTimestamp,
        availableItemIds: availableItemIds || [],
        specials:         specials         || [],
        chefMessage:      message          || '',
        isPublished:      true,
        publishedAt:      serverTimestamp(),
      };

      const q = query(
        collection(db, 'dailyMenus'),
        where('restaurantId', '==', restaurantId),
        where('date', '==', todayTimestamp)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(collection(db, 'dailyMenus'), menuData);
      } else {
        await updateDoc(snapshot.docs[0].ref, menuData);
      }

      return { success: true };
    } catch (error) {
      console.error('setDailyMenu error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─── Get Today's Menu ─────────────────────
  const getTodaysMenu = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'dailyMenus'),
        where('restaurantId', '==', restaurantId),
        where('date',        '==', Timestamp.fromDate(today)),
        where('isPublished', '==', true)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      };
    } catch (error) {
      console.error('getTodaysMenu error:', error);
      return null;
    }
  };

  // ─── Get User's Review ────────────────────
  const getUserReview = async (userId) => {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', restaurantId),
        where('userId',       '==', userId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
      console.error('getUserReview error:', error);
      return null;
    }
  };

  // ─── Regenerate Auto Image ────────────────
  const regenerateAutoImage = async (
    itemId,
    itemName,
    category
  ) => {
    try {
      const newImageUrl = getAutoFoodImage(
        itemName,
        category,
        `${itemName}-${category}-${Date.now()}`
      );

      await updateDoc(doc(db, 'menuItems', itemId), {
        imageUrl:    newImageUrl,
        isAutoImage: true,
        updatedAt:   serverTimestamp(),
      });

      return { success: true, imageUrl: newImageUrl };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    menuItems,
    loading,
    addMenuItem,
    updateMenuItem,
    toggleAvailability,
    toggleSpecial,
    deleteMenuItem,
    getGroupedMenu,
    setDailyMenu,
    getTodaysMenu,
    getUserReview,
    regenerateAutoImage,
  };
};