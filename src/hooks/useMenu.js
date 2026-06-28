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
import { db } from '../firebase/config';
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

    // ✅ Removed orderBy - no composite index needed
    // Sort in memory instead
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

        // ✅ Sort in memory by category then name
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
      let imageUrl    = '';
      let isAutoImage = false;

      if (imageUri) {
        // ✅ User picked a custom photo - upload it
        const path   = `menuItems/${restaurantId}_${Date.now()}`;
        const result = await uploadImage(imageUri, path);

        if (result.success) {
          imageUrl    = result.url;
          isAutoImage = false;
        } else {
          // Upload failed - fall back to auto image
          console.warn('Image upload failed, using auto image');
          imageUrl    = data.autoImageUrl ||
                        getAutoFoodImage(data.name, data.category, '');
          isAutoImage = true;
        }
      } else if (data.autoImageUrl) {
        // ✅ Use the pre-generated auto image URL from AddMenuItemScreen
        // This preserves the exact image the owner saw in preview
        imageUrl    = data.autoImageUrl;
        isAutoImage = true;
      } else {
        // ✅ Fallback - generate auto image here
        imageUrl    = getAutoFoodImage(
          data.name,
          data.category,
          Date.now().toString()
        );
        isAutoImage = true;
      }

      // ✅ Remove autoImageUrl from data before saving to Firestore
      const { autoImageUrl, ...cleanData } = data;

      // ✅ Use setDoc with pre-generated ref so ID is stored in document
      const newRef = doc(collection(db, 'menuItems'));

      await setDoc(newRef, {
        ...cleanData,
        id:                newRef.id,
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

      return { success: true, id: newRef.id };
    } catch (error) {
      console.error('addMenuItem error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─── Update Menu Item ─────────────────────
  const updateMenuItem = async (itemId, data, newImageUri) => {
    try {
      // ✅ Remove autoImageUrl from updates
      const { autoImageUrl, ...cleanData } = data;

      const updates = {
        ...cleanData,
        updatedAt: serverTimestamp(),
      };

      if (newImageUri) {
        // ✅ New custom photo uploaded
        const path   = `menuItems/${itemId}_${Date.now()}`;
        const result = await uploadImage(newImageUri, path);

        if (result.success) {
          updates.imageUrl    = result.url;
          updates.isAutoImage = false;
        }
      } else if (autoImageUrl) {
        // ✅ Owner clicked regenerate - save new auto image
        updates.imageUrl    = autoImageUrl;
        updates.isAutoImage = true;
      }

      await updateDoc(doc(db, 'menuItems', itemId), updates);
      return { success: true };
    } catch (error) {
      console.error('updateMenuItem error:', error);
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
  // ✅ Groups items by category for display
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

      // ✅ Check if today's menu already exists
      const q = query(
        collection(db, 'dailyMenus'),
        where('restaurantId', '==', restaurantId),
        where('date', '==', todayTimestamp)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Create new daily menu
        await addDoc(collection(db, 'dailyMenus'), menuData);
      } else {
        // Update existing
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
        where('date',         '==', Timestamp.fromDate(today)),
        where('isPublished',  '==', true)
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

  // ─── Regenerate auto image for existing item ─
  // ✅ Call this when owner wants a new auto image
  const regenerateAutoImage = async (itemId, itemName, category) => {
    try {
      const newImageUrl = getAutoFoodImage(
        itemName,
        category,
        Date.now().toString() // new seed = new image
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
    regenerateAutoImage, // ✅ NEW
  };
};