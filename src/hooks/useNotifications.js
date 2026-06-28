// ============================================
// FILE: src/hooks/useNotifications.js
// ============================================
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  doc, updateDoc, collection,
  addDoc, serverTimestamp,
  query, where, onSnapshot,
  orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

// ✅ How notifications appear when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export const useNotifications = () => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);

  const notificationListener = useRef();
  const responseListener     = useRef();

  // ─── Register for push notifications ─────
  useEffect(() => {
    registerForPushNotifications();

    // Listen for notifications while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification received:', notification);
      });

    // Listen for when user taps notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped:', response);
        // Handle navigation based on notification data
        handleNotificationTap(response.notification.request.content.data);
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
      Notifications.removeNotificationSubscription(
        responseListener.current
      );
    };
  }, []);

  // ─── Listen to user notifications ─────────
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

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
      setLoading(false);
    }, (err) => {
      console.error('Notifications listener error:', err);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  // ─── Register device for push notifications
  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return;
    }

    try {
      // Check existing permission
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      // Request if not granted
      if (existingStatus !== 'granted') {
        const { status } =
          await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'YOUR_EXPO_PROJECT_ID', // From app.json or EAS
      });

      const token = tokenData.data;
      setExpoPushToken(token);

      // ✅ Save token to Firestore user profile
      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken: token,
          pushEnabled:   true,
          deviceOS:      Platform.OS,
        });
      }

      // Android channel setup
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name:            'default',
          importance:      Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor:      '#FF6B35',
        });
      }

      return token;
    } catch (err) {
      console.error('registerForPushNotifications error:', err);
    }
  };

  // ─── Mark notification as read ────────────
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

  // ─── Mark all as read ──────────────────────
  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(
        unread.map(n =>
          updateDoc(doc(db, 'notifications', n.id), {
            isRead: true,
          })
        )
      );
    } catch (err) {
      console.error('markAllAsRead error:', err);
    }
  };

  // ─── Send notification to a user ──────────
  // Called from admin or restaurant owner
  const sendNotificationToUser = async ({
    userId,
    title,
    body,
    data = {},
    type = 'general',
  }) => {
    try {
      // Save to Firestore
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        body,
        data,
        type,
        isRead:    false,
        createdAt: serverTimestamp(),
      });

      // Get user push token
      // (you would fetch from Firestore or pass it in)
      console.log('✅ Notification saved to Firestore');
      return { success: true };
    } catch (err) {
      console.error('sendNotificationToUser error:', err);
      return { success: false, error: err.message };
    }
  };

  // ─── Handle notification tap navigation ───
  const handleNotificationTap = (data) => {
    // Handle different notification types
    // Navigation happens in your root navigator
    if (data?.screen) {
      console.log('Navigate to:', data.screen, data.params);
    }
  };

  return {
    expoPushToken,
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    sendNotificationToUser,
    registerForPushNotifications,
  };
};