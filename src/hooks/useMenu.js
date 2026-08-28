// ============================================
// FILE: src/hooks/useMenu.js
// ============================================
import { useState, useEffect } from 'react';
import { Platform }            from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import { db }                from '../firebase/config';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// INTERNAL CLOUDINARY UPLOAD
// ─────────────────────────────────────────────
const uploadMenuItemImage = (imageUri, itemId) => {
  return new Promise(async (resolve) => {
    try {
      let finalUri = imageUri;
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = compressed.uri;
      } catch (manipError) {
        console.warn('ImageManipulator bypassed:', manipError.message);
      }

      const formData = new FormData();
      const fileName = `menu_item_${itemId}_${Date.now()}.jpg`;

      if (Platform.OS === 'web') {
        const response = await fetch(finalUri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', {
          uri:  finalUri,
          type: 'image/jpeg',
          name: fileName,
        });
      }

      formData.append('upload_preset', uploadPreset);
      formData.append('folder',        folders.menuItems);
      formData.append('public_id',     `menu_item_${itemId}`);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
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
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror = () => resolve({ success: false, error: 'Network error during upload' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Upload timed out' });
      xhr.timeout = 60000;
      xhr.send(formData);

    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
};

// ─────────────────────────────────────────────
// 🔔 DIRECT CLIENT-SIDE PUSH DISPATCHER (100% FREE)
// ─────────────────────────────────────────────
const notifyFollowersOfDailyMenu = async (restaurantId, specialsCount = 0) => {
  try {
    // 1. Get Restaurant details
    const restDoc = await getDoc(doc(db, 'restaurants', restaurantId));
    const restaurantName = restDoc.exists() ? restDoc.data()?.name : "What's Cooking";

    const notifTitle = `🍳 ${restaurantName}`;
    const notifBody = specialsCount > 0
      ? `Today's menu is live with ${specialsCount} special${specialsCount > 1 ? 's' : ''}! Tap to see what's fresh.`
      : `Today's menu is live! Tap to see what's cooking today.`;

    // 2. Find all customers who favorited this restaurant
    const usersQuery = query(
      collection(db, 'users'),
      where('favoriteRestaurants', 'array-contains', restaurantId)
    );
    const usersSnap = await getDocs(usersQuery);

    if (usersSnap.empty) {
      console.log(`ℹ️ No followers found for ${restaurantName} yet.`);
      return;
    }

    const expoPushTokens = [];
    const batch = writeBatch(db);

    usersSnap.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // In-app notification document
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId,
        title: notifTitle,
        body: notifBody,
        type: 'daily-menu',
        data: { restaurantId, restaurantName },
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // Collect Push Token for native Android phones
      if (userData.expoPushToken && userData.pushEnabled !== false) {
        expoPushTokens.push(userData.expoPushToken);
      }
    });

    // Save all in-app notifications at once
    await batch.commit();
    console.log(`✅ Saved in-app notifications for ${usersSnap.size} followers.`);

    // Send Expo push alerts to phones
    if (expoPushTokens.length > 0) {
      const messages = expoPushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: notifTitle,
        body: notifBody,
        channelId: 'menu-updates',
        data: { type: 'daily-menu', restaurantId },
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      console.log(`🚀 Sent push notifications to ${expoPushTokens.length} devices.`);
    }
  } catch (err) {
    console.warn('⚠️ Error sending daily menu notifications:', err.message);
  }
};

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────
export const useMenu = (restaurantId) => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]     = useState(true);

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
          const catCompare = (a.category || '').localeCompare(b.category || '');
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

  const addMenuItem = async (data, imageUri) => {
    try {
      const newRef = doc(collection(db, 'menuItems'));
      const itemId = newRef.id;

      let imageUrl           = '';
      let cloudinaryUrl      = '';
      let cloudinaryPublicId = '';
      let isAutoImage        = false;

      if (imageUri) {
        const result = await uploadMenuItemImage(imageUri, itemId);
        if (result.success) {
          imageUrl           = result.url;
          cloudinaryUrl      = result.url;
          cloudinaryPublicId = result.publicId;
          isAutoImage        = false;
        } else {
          imageUrl    = '';
          isAutoImage = true;
        }
      } else {
        imageUrl    = '';
        isAutoImage = true;
      }

      const { autoImageUrl, imageName, imageCategory, ...cleanData } = data;

      await setDoc(newRef, {
        ...cleanData,
        id: itemId,
        restaurantId,
        imageUrl,
        cloudinaryUrl,
        cloudinaryPublicId,
        isAutoImage,
        imageName:     data.name     || '',
        imageCategory: data.category || '',
        isAvailable:       true,
        isSpecialOfTheDay: false,
        totalFavorites:    0,
        orderCount:        0,
        viewCount:         0,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });

      return { success: true, id: itemId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateMenuItem = async (itemId, data, newImageUri) => {
    try {
      const { autoImageUrl, imageName, imageCategory, ...cleanData } = data;

      const updates = {
        ...cleanData,
        imageName:     data.name     || '',
        imageCategory: data.category || '',
        updatedAt:     serverTimestamp(),
      };

      if (newImageUri) {
        const result = await uploadMenuItemImage(newImageUri, itemId);
        if (result.success) {
          updates.imageUrl           = result.url;
          updates.cloudinaryUrl      = result.url;
          updates.cloudinaryPublicId = result.publicId;
          updates.isAutoImage        = false;
        }
      } else if (data.imageUrl === null) {
        updates.imageUrl           = '';
        updates.cloudinaryUrl      = '';
        updates.cloudinaryPublicId = '';
        updates.isAutoImage        = true;
      }

      await updateDoc(doc(db, 'menuItems', itemId), updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

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

  const deleteMenuItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const getGroupedMenu = () => {
    return menuItems.reduce((groups, item) => {
      const category = item.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  };

  // ─────────────────────────────────────────
  // SET DAILY MENU + NOTIFY FOLLOWERS
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

      // ✅ Trigger free push notifications to all followers
      notifyFollowersOfDailyMenu(restaurantId, specials?.length || 0);

      return { success: true };
    } catch (error) {
      console.error('❌ setDailyMenu error:', error);
      return { success: false, error: error.message };
    }
  };

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
      return null;
    }
  };

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
      return null;
    }
  };

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
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

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
          null
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
    return results;
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
    addScannedMenuItems,
  };
};