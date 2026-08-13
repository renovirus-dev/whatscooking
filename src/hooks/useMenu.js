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

// ─── Cloudinary Config ────────────────────────
const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// INTERNAL CLOUDINARY UPLOAD
// ✅ Uses XMLHttpRequest — fixes FormDataPart error
//    fetch + Content-Type: multipart/form-data
//    breaks in React Native
// ─────────────────────────────────────────────
const uploadMenuItemImage = (imageUri, itemId) => {
  return new Promise(async (resolve) => {
    try {
      // ── Step 1: Compress ──────────────────
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // ── Step 2: Build FormData ────────────
      const formData = new FormData();
      formData.append('file', {
        uri:  compressed.uri,
        type: 'image/jpeg',
        name: `menu_item_${itemId}_${Date.now()}.jpg`,
      });
      formData.append('upload_preset', uploadPreset);
      // ✅ Goes to whats_cooking/menu_items/
      formData.append('folder',     folders.menuItems);
      // ✅ Use itemId as public_id for easy management
      formData.append('public_id',  `menu_item_${itemId}`);

      // ── Step 3: Upload via XHR ────────────
      // ✅ XMLHttpRequest handles multipart correctly
      //    DO NOT set Content-Type header manually
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          console.log('✅ Menu item image uploaded:', data.secure_url);
          resolve({
            success:  true,
            url:      data.secure_url,
            publicId: data.public_id,
            width:    data.width,
            height:   data.height,
          });
        } else {
          let errMsg = 'Cloudinary upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMsg = errData.error?.message || errMsg;
          } catch {}
          console.error('❌ uploadMenuItemImage failed:', errMsg);
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror = () => {
        console.error('❌ uploadMenuItemImage network error');
        resolve({ success: false, error: 'Network error during upload' });
      };

      xhr.ontimeout = () => {
        console.error('❌ uploadMenuItemImage timed out');
        resolve({ success: false, error: 'Upload timed out' });
      };

      // ✅ 60 second timeout for large images
      xhr.timeout = 60000;

      // ✅ DO NOT set Content-Type — XHR sets it automatically
      xhr.send(formData);

    } catch (error) {
      console.error('❌ uploadMenuItemImage error:', error);
      resolve({ success: false, error: error.message });
    }
  });
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

        // ✅ Sort by category then name client-side
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

      let imageUrl           = '';
      let cloudinaryUrl      = '';
      let cloudinaryPublicId = '';
      let isAutoImage        = false;

      if (imageUri) {
        // ✅ User picked a photo → upload via XHR
        console.log('⬆️ Uploading menu item image to Cloudinary...');
        const result = await uploadMenuItemImage(imageUri, itemId);

        if (result.success) {
          imageUrl           = result.url;
          cloudinaryUrl      = result.url;
          cloudinaryPublicId = result.publicId;
          isAutoImage        = false;
        } else {
          // ✅ Upload failed → fall back to local auto image
          console.warn('⚠️ Cloudinary upload failed:', result.error);
          console.log('ℹ️ Falling back to local auto image');
          imageUrl    = '';
          isAutoImage = true;
        }
      } else {
        // ✅ No photo → use local bundled image
        imageUrl    = '';
        isAutoImage = true;
        console.log('ℹ️ Using local auto image for:', data.name);
      }

      // ── Clean data ────────────────────────
      const {
        autoImageUrl,
        imageName,
        imageCategory,
        ...cleanData
      } = data;

      // ── Save to Firestore ─────────────────
      await setDoc(newRef, {
        ...cleanData,
        id:           itemId,
        restaurantId,

        // ✅ Cloudinary fields
        imageUrl,
        cloudinaryUrl,
        cloudinaryPublicId,

        // ✅ Auto image fallback metadata
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
      const {
        autoImageUrl,
        imageName,
        imageCategory,
        ...cleanData
      } = data;

      const updates = {
        ...cleanData,
        imageName:     data.name     || '',
        imageCategory: data.category || '',
        updatedAt:     serverTimestamp(),
      };

      if (newImageUri) {
        // ✅ User picked a NEW photo → upload via XHR
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
        }
      } else if (data.imageUrl === null) {
        // ✅ User explicitly removed photo → switch to auto image
        updates.imageUrl           = '';
        updates.cloudinaryUrl      = '';
        updates.cloudinaryPublicId = '';
        updates.isAutoImage        = true;
        console.log('ℹ️ Switched to local auto image');
      } else if (data.cloudinaryUrl) {
        // ✅ Keeping existing Cloudinary image — no change
        console.log('ℹ️ Keeping existing Cloudinary image');
      }

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
  // ─────────────────────────────────────────
  const regenerateAutoImage = async (itemId, name, category) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        imageUrl:      '',
        cloudinaryUrl: '',
        isAutoImage:   true,
        imageName:     name     || '',
        imageCategory: category || '',
        updatedAt:     serverTimestamp(),
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
  // ─────────────────────────────────────────
  const addScannedMenuItems = async (scannedItems) => {
    const results = { success: [], failed: [] };

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
            isAutoImage: true,
          },
          null // ✅ No image for scanned items — use local auto image
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
    addScannedMenuItems,
  };
};