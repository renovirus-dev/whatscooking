// ============================================
// FILE: functions/index.js
// ============================================
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * 🔔 Triggered automatically when a restaurant publishes/updates a Daily Menu.
 * Sends push notifications to all users who ❤️ favorited the restaurant,
 * and creates in-app notification records in Firestore.
 */
exports.onDailyMenuPublished = functions.firestore
  .document('dailyMenus/{menuId}')
  .onWrite(async (change, context) => {
    // 1. Check if the document was deleted or not published
    const menuData = change.after.exists ? change.after.data() : null;
    if (!menuData || !menuData.isPublished) {
      console.log('ℹ️ Menu not published or was deleted. Skipping notification.');
      return null;
    }

    const previousData = change.before.exists ? change.before.data() : null;

    // Avoid duplicate notifications if menu was already published and didn't change
    if (previousData && previousData.isPublished && previousData.date?.seconds === menuData.date?.seconds) {
      // Allow re-notification only if specials or message changed
      const specialsChanged = JSON.stringify(previousData.specials) !== JSON.stringify(menuData.specials);
      const itemsChanged = JSON.stringify(previousData.availableItemIds) !== JSON.stringify(menuData.availableItemIds);
      if (!specialsChanged && !itemsChanged) {
        console.log('ℹ️ Daily menu content unchanged. Skipping duplicate push.');
        return null;
      }
    }

    const restaurantId = menuData.restaurantId;
    if (!restaurantId) return null;

    try {
      // 2. Fetch Restaurant Info
      const restaurantDoc = await admin.firestore()
        .collection('restaurants')
        .doc(restaurantId)
        .get();

      if (!restaurantDoc.exists) {
        console.warn(`⚠️ Restaurant ${restaurantId} not found.`);
        return null;
      }

      const restaurantName = restaurantDoc.data()?.name || "What's Cooking";
      const specialsCount = menuData.specials?.length || 0;
      
      const notificationTitle = `🍳 ${restaurantName}`;
      const notificationBody = specialsCount > 0
        ? `Today's menu is live with ${specialsCount} special${specialsCount > 1 ? 's' : ''}! Tap to see what's cooking.`
        : `Today's menu is live! Tap to see what's cooking fresh today.`;

      // 3. Find all users who favorited this restaurant
      const usersSnap = await admin.firestore()
        .collection('users')
        .where('favoriteRestaurants', 'array-contains', restaurantId)
        .get();

      if (usersSnap.empty) {
        console.log(`ℹ️ No users have favorited ${restaurantName} yet.`);
        return null;
      }

      console.log(`🎯 Found ${usersSnap.size} followers for ${restaurantName}.`);

      const expoPushMessages = [];
      const firestoreBatch = admin.firestore().batch();

      // 4. Build Push Notifications and In-App records
      usersSnap.forEach((userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // A. In-App Notification document for every follower
        const notifRef = admin.firestore().collection('notifications').doc();
        firestoreBatch.set(notifRef, {
          userId: userId,
          title: notificationTitle,
          body: notificationBody,
          type: 'daily-menu',
          data: {
            restaurantId: restaurantId,
            restaurantName: restaurantName,
            menuId: context.params.menuId,
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // B. Expo Push Notification (for Android / iOS native apps)
        if (userData.expoPushToken && userData.pushEnabled !== false) {
          expoPushMessages.push({
            to: userData.expoPushToken,
            sound: 'default',
            title: notificationTitle,
            body: notificationBody,
            channelId: 'menu-updates',
            data: {
              type: 'daily-menu',
              restaurantId: restaurantId,
            },
          });
        }
      });

      // 5. Commit all In-App notification documents in Firestore
      await firestoreBatch.commit();
      console.log(`✅ Saved ${usersSnap.size} in-app notification records.`);

      // 6. Send Push Notifications via Expo Push Service
      if (expoPushMessages.length > 0) {
        // Expo supports batching up to 100 messages per request
        const chunks = [];
        while (expoPushMessages.length) {
          chunks.push(expoPushMessages.splice(0, 100));
        }

        for (const chunk of chunks) {
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunk),
          });

          const resData = await response.json();
          console.log('🚀 Push send response:', JSON.stringify(resData));
        }
      }

      console.log(`🎉 Daily menu notifications processed successfully for ${restaurantName}.`);
      return null;
    } catch (err) {
      console.error('❌ Error processing onDailyMenuPublished function:', err);
      return null;
    }
  });