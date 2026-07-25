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
import * as ImageManipulator from 'expo-image-manipulator';
import { db }                from '../firebase/config';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';
import { getLocalFoodImage } from '../utils/localFoodImages';

// ─── Cloudinary Config ────────────────────────
const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// INTERNAL CLOUDINARY UPLOAD
// Used only inside this hook
// ─────────────────────────────────────────────
const uploadMenuItemImage = async (imageUri, itemId) => {
  try {
    // ── Step 1: Compress ──────────────────────
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1200 } }],
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
      name: `menu_item_${itemId}_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', uploadPreset);
    // ✅ Goes to whats_cooking/menu_items/
    formData.append('folder', folders.menuItems);
    // ✅ Use itemId as public_id for easy management
    formData.append('public_id', `menu_item_${itemId}`);

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
      success:   true,
      url:       data.secure_url,   // ← save to Firestore as imageUrl
      publicId:  data.public_id,    // ← save for future reference
      width:     data.width,
      height:    data.height,
    };
  } catch (error) {
    console.error('❌ uploadMenuItemImage error:', error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────
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

        // Sort by category then name
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

  // ─────────────────────────────────────────
  // ADD MENU ITEM
  // ─────────────────────────────────────────
  const addMenuItem = async (data, imageUri) => {
    try {
      // ✅ Generate doc ref FIRST so itemId is available
      // before upload so we can use it as public_id
      const newRef = doc(collection(db, 'menuItems'));
      const itemId = newRef.id;

      // ── Image handling ────────────────────
      let imageUrl           = '';
      let cloudinaryUrl      = '';
      let cloudinaryPublicId = '';
      let isAutoImage        = false;

      if (imageUri) {
        // ✅ User picked a photo → upload to Cloudinary
        console.log('⬆️ Uploading menu item image to Cloudinary...');
        const result = await uploadMenuItemImage(imageUri, itemId);

        if (result.success) {
          imageUrl           = result.url;
          cloudinaryUrl      = result.url;
          cloudinaryPublicId = result.publicId;
          isAutoImage        = false;
          console.log('✅ Image uploaded to Cloudinary:', result.url);
        } else {
          // ✅ Upload failed → fall back to local image
          console.warn('⚠️ Cloudinary upload failed:', result.error);
          console.log('ℹ️ Falling back to local auto image');
          imageUrl    = '';
          isAutoImage = true;
        }
      } else {
        // ✅ No photo → use local bundled image
        // getLocalFoodImage(name, category) generates at display time
        // Zero storage cost, works offline
        imageUrl    = '';
        isAutoImage = true;
        console.log('ℹ️ Using local auto image for:', data.name);
      }

      // ── Clean data ────────────────────────
      // Remove fields that shouldn't go to Firestore directly
      const {
        autoImageUrl,    // old Firebase field — remove
        imageName,       // we recalculate from name
        imageCategory,   // we recalculate from category
        ...cleanData
      } = data;

      // ── Save to Firestore ─────────────────
      await setDoc(newRef, {
        ...cleanData,
        id:           itemId,
        restaurantId,

        // ✅ Cloudinary fields
        imageUrl,              // primary image URL (Cloudinary or '')
        cloudinaryUrl,         // same as imageUrl — explicit Cloudinary ref
        cloudinaryPublicId,    // for future management/deletion

        // ✅ Auto image fallback metadata
        // UI uses these to call getLocalFoodImage(name, category)
        isAutoImage,
        imageName:     data.name     || '',
        imageCategory: data.category || '',

        // ✅ Default fields
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

  // ─────────────────────────────────────────
  // UPDATE MENU ITEM
  // ─────────────────────────────────────────
  const updateMenuItem = async (itemId, data, newImageUri) => {
    try {
      // ── Clean data ────────────────────────
      const {
        autoImageUrl,
        imageName,
        imageCategory,
        ...cleanData
      } = data;

      const updates = {
        ...cleanData,
        // ✅ Always update auto image metadata
        // in case name or category changed
        imageName:     data.name     || '',
        imageCategory: data.category || '',
        updatedAt:     serverTimestamp(),
      };

      // ── Handle image update ───────────────
      if (newImageUri) {
        // ✅ User picked a NEW photo → upload to Cloudinary
        console.log('⬆️ Updating menu item image on Cloudinary...');
        const result = await uploadMenuItemImage(newImageUri, itemId);

        if (result.success) {
          updates.imageUrl           = result.url;
          updates.cloudinaryUrl      = result.url;
          updates.cloudinaryPublicId = result.publicId;
          updates.isAutoImage        = false;
          console.log('✅ Image updated on Cloudinary:', result.url);
        } else {
          // ✅ Upload failed → keep existing image
          console.warn('⚠️ Image update failed — keeping existing image');
          console.warn('Error:', result.error);
          // Don't update imageUrl — keep whatever was there
        }
      } else if (data.imageUrl === null) {
        // ✅ User explicitly removed photo → switch to local auto image
        updates.imageUrl           = '';
        updates.cloudinaryUrl      = '';
        updates.cloudinaryPublicId = '';
        updates.isAutoImage        = true;
        console.log('ℹ️ Switched to local auto image');
      } else if (data.cloudinaryUrl) {
        // ✅ Keeping existing Cloudinary image — no changes needed
        console.log('ℹ️ Keeping existing Cloudinary image');
      }
      // else: no image change at all — cleanData already has imageUrl

      await updateDoc(doc(db, 'menuItems', itemId), updates);
      console.log('✅ Menu item updated:', itemId);
      return { success: true };

    } catch (error) {
      console.error('❌ updateMenuItem error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE AVAILABILITY
  // ─────────────────────────────────────────
  const toggleAvailability = async (itemId, currentState) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !currentState,
        updatedAt:   serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('❌ toggleAvailability error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE SPECIAL OF THE DAY
  // ─────────────────────────────────────────
  const toggleSpecial = async (itemId, currentState) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isSpecialOfTheDay: !currentState,
        updatedAt:         serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('❌ toggleSpecial error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // DELETE MENU ITEM
  // ─────────────────────────────────────────
  const deleteMenuItem = async (itemId) => {
    try {
      // ⚠️ Note: Cloudinary image stays in storage
      // To delete from Cloudinary you need a Cloud Function
      // The publicId is saved as cloudinaryPublicId in Firestore
      // TODO: Call Cloud Function to delete from Cloudinary
      await deleteDoc(doc(db, 'menuItems', itemId));
      console.log('✅ Menu item deleted:', itemId);
      console.log('⚠️ Cloudinary image not deleted — needs Cloud Function');
      return { success: true };
    } catch (error) {
      console.error('❌ deleteMenuItem error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // GET GROUPED MENU
  // ─────────────────────────────────────────
  const getGroupedMenu = () => {
    return menuItems.reduce((groups, item) => {
      const category = item.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  };

  // ─────────────────────────────────────────
  // SET DAILY MENU
  // ─────────────────────────────────────────
  const setDailyMenu = async (availableItemIds, specials, message) => {
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
        where('date',         '==', todayTimestamp)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(collection(db, 'dailyMenus'), menuData);
      } else {
        await updateDoc(snapshot.docs[0].ref, menuData);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ setDailyMenu error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // GET TODAY'S MENU
  // ─────────────────────────────────────────
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
      console.error('❌ getTodaysMenu error:', error);
      return null;
    }
  };

  // ─────────────────────────────────────────
  // GET USER REVIEW
  // ─────────────────────────────────────────
  const getUserReview = async (userId) => {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', restaurantId),
        where('userId',       '==', userId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      };
    } catch (error) {
      console.error('❌ getUserReview error:', error);
      return null;
    }
  };

  // ─────────────────────────────────────────
  // REGENERATE AUTO IMAGE
  // ✅ With Cloudinary — just clear the URL
  // Local image generates from name + category at display time
  // ─────────────────────────────────────────
  const regenerateAutoImage = async (itemId, name, category) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        imageUrl:          '',   // ✅ Empty = use local image
        cloudinaryUrl:     '',
        isAutoImage:       true,
        // ✅ Update metadata in case name/category changed
        imageName:         name     || '',
        imageCategory:     category || '',
        updatedAt:         serverTimestamp(),
      });
      console.log('✅ Switched to auto image for item:', itemId);
      return { success: true };
    } catch (error) {
      console.error('❌ regenerateAutoImage error:', error);
      return { success: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────
  // ADD SCANNED MENU ITEMS (BULK)
  // For the MenuScanner feature
  // Adds multiple items at once from OCR scan
  // ─────────────────────────────────────────
  const addScannedMenuItems = async (scannedItems) => {
    const results = {
      success: [],
      failed:  [],
    };

    for (const item of scannedItems) {
      try {
        const result = await addMenuItem(
          {
            name:        item.name        || 'Unknown Item',
            description: item.description || '',
            price:       item.price       || 0,
            category:    item.category    || 'main_course',
            dietaryInfo: item.dietaryInfo || {},
            tags:        item.tags        || [],
            servingSize: item.servingSize || '',
            // ✅ No image for scanned items — use local auto image
            isAutoImage: true,
          },
          null // no imageUri for scanned items
        );

        if (result.success) {
          results.success.push({ name: item.name, id: result.id });
        } else {
          results.failed.push({ name: item.name, error: result.error });
        }
      } catch (err) {
        results.failed.push({ name: item.name, error: err.message });
      }
    }

    console.log(
      `✅ Scanned items: ${results.success.length} added,`,
      `${results.failed.length} failed`
    );
    return results;
  };

  // ─────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────
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
    addScannedMenuItems,   // 🆕 for MenuScanner
  };
};