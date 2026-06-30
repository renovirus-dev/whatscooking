// ============================================
// FILE: src/hooks/useNotifications.js
// ============================================
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  doc, updateDoc, collection,
  addDoc, serverTimestamp,
  query, where, onSnapshot,
  orderBy, limit,
} from 'firebase/firestore';
import { db }      from '../firebase/config';
import { useAuth } from './useAuth';

// ✅ How notifications appear when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ✅ Read project ID from app.json automatically
// No more hardcoding — pulls from extra.eas.projectId
const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.manifest?.extra?.eas?.projectId  ||
  '15062ebe-c1c0-4d13-9bf4-bcce99cc9e62'; // fallback

export const useNotifications = () => {
  const { user } = useAuth();

  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const notificationListener = useRef();
  const responseListener     = useRef();

  // ─── Register for push notifications ─────
  useEffect(() => {
    registerForPushNotifications();

    // ✅ Listen for notifications while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification received:', notification);
      });

    // ✅ Listen for when user taps a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped:', response);
        handleNotificationTap(
          response.notification.request.content.data
        );
      });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current
        );
      }
    };
  }, []);

  // ─── Listen to user notifications in Firestore ──
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
        setLoading(false);
      },
      (err) => {
        console.error('Notifications listener error:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  // ─── Register device for push notifications ──
  const registerForPushNotifications = async () => {
    // ✅ Skip on simulator/emulator — push needs real device
    if (!Device.isDevice) {
      console.log(
        'ℹ️ Push notifications require a physical device'
      );
      return null;
    }

    try {
      // ✅ Check existing permission first
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;
      setPermissionStatus(existingStatus);

      // Only request if not already granted
      if (existingStatus !== 'granted') {
        const { status } =
          await Notifications.requestPermissionsAsync();
        finalStatus = status;
        setPermissionStatus(status);
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push notification permission denied');
        return null;
      }

      // ✅ Get Expo push token using project ID from app.json
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });

      const token = tokenData.data;
      setExpoPushToken(token);
      console.log('✅ Push token:', token);

      // ✅ Save token to Firestore user profile
      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken: token,
          pushEnabled:   true,
          deviceOS:      Platform.OS,
          tokenUpdatedAt: serverTimestamp(),
        });
      }

      // ✅ Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name:             'default',
          importance:       Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor:       '#FF6B35',
          sound:            'default',
        });

        // ✅ Extra channel for menu updates
        await Notifications.setNotificationChannelAsync(
          'menu-updates',
          {
            name:       'Menu Updates',
            importance: Notifications.AndroidImportance.HIGH,
            sound:      'default',
            lightColor: '#FF6B35',
          }
        );

        // ✅ Extra channel for promotions
        await Notifications.setNotificationChannelAsync(
          'promotions',
          {
            name:       'Promotions & Deals',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound:      'default',
          }
        );
      }

      return token;
    } catch (err) {
      console.error('registerForPushNotifications error:', err);
      return null;
    }
  };

  // ─── Mark single notification as read ────
  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(
        doc(db, 'notifications', notificationId),
        { isRead: true }
      );
    } catch (err) {
      console.error('markAsRead error:', err);
    }
  };

  // ─── Mark ALL notifications as read ──────
  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      if (unread.length === 0) return;

      await Promise.all(
        unread.map(n =>
          updateDoc(
            doc(db, 'notifications', n.id),
            { isRead: true }
          )
        )
      );
    } catch (err) {
      console.error('markAllAsRead error:', err);
    }
  };

  // ─── Send notification to a user ─────────
  // Called from admin or restaurant owner
  const sendNotificationToUser = async ({
    userId,
    title,
    body,
    data  = {},
    type  = 'general',
  }) => {
    try {
      // ✅ Save to Firestore — user sees it in app
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        body,
        data,
        type,
        isRead:    false,
        createdAt: serverTimestamp(),
      });

      console.log('✅ Notification saved to Firestore');
      return { success: true };
    } catch (err) {
      console.error('sendNotificationToUser error:', err);
      return { success: false, error: err.message };
    }
  };

  // ─── Send local notification (on-device) ─
  // Useful for testing or instant feedback
  const sendLocalNotification = async (title, body, data = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // show immediately
      });
    } catch (err) {
      console.error('sendLocalNotification error:', err);
    }
  };

  // ─── Handle notification tap navigation ───
  const handleNotificationTap = (data) => {
    // ✅ You can add navigation logic here
    // e.g. navigate to RestaurantDetail if data.restaurantId exists
    if (data?.screen) {
      console.log(
        '📱 Should navigate to:',
        data.screen,
        data.params
      );
    }
  };

  // ─── Delete a notification ────────────────
  const deleteNotification = async (notificationId) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      console.error('deleteNotification error:', err);
    }
  };

  return {
    expoPushToken,
    notifications,
    unreadCount,
    loading,
    permissionStatus,
    markAsRead,
    markAllAsRead,
    sendNotificationToUser,
    sendLocalNotification,
    deleteNotification,
    registerForPushNotifications,
  };
};