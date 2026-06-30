// ============================================
// FILE: src/hooks/useNotifications.js
// ============================================
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
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

// ✅ Read project ID from app.json
const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.manifest?.extra?.eas?.projectId  ||
  '15062ebe-c1c0-4d13-9bf4-bcce99cc9e62';

export const useNotifications = () => {
  const { user } = useAuth();

  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const notificationListener = useRef();
  const responseListener     = useRef();

  // ✅ Track if component is still mounted
  // Prevents setState calls after unmount (the crash)
  const isMounted = useRef(true);

  // ─── Push notification setup ──────────────
  useEffect(() => {
    isMounted.current = true;

    registerForPushNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification received:', notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped:', response);
        handleNotificationTap(
          response.notification.request.content.data
        );
      });

    return () => {
      // ✅ Mark as unmounted so no setState fires after this
      isMounted.current = false;

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

  // ─── Firestore listener ───────────────────
  useEffect(() => {
    // ✅ Reset mounted ref on each effect run
    isMounted.current = true;

    if (!user?.uid) {
      if (isMounted.current) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
      return;
    }

    // ✅ Hold reference to unsubscribe function
    let unsubscribe = null;

    const setupListener = () => {
      try {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50),
        );

        unsubscribe = onSnapshot(
          q,
          (snap) => {
            // ✅ Only update state if still mounted
            if (!isMounted.current) return;

            const data = snap.docs.map(d => ({
              id: d.id,
              ...d.data(),
            }));
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.isRead).length);
            setLoading(false);
          },
          (err) => {
            // ✅ Only update state if still mounted
            if (!isMounted.current) return;

            if (err.code === 'failed-precondition') {
              console.warn(
                '⚠️ Firestore index needed.\n' +
                'Add composite index in Firebase Console:\n' +
                'Collection: notifications\n' +
                'Fields: userId ASC, createdAt DESC'
              );
            } else {
              console.error('Notifications listener error:', err);
            }

            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Notifications setup error:', err);
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    setupListener();

    // ✅ Cleanup — called when:
    // 1. Component unmounts (navigating back)
    // 2. user.uid changes
    return () => {
      isMounted.current = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, [user?.uid]);

  // ─── Register push token ──────────────────
  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('ℹ️ Push needs a physical device');
      return null;
    }

    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (isMounted.current) {
        setPermissionStatus(existingStatus);
      }

      if (existingStatus !== 'granted') {
        const { status } =
          await Notifications.requestPermissionsAsync();
        finalStatus = status;
        if (isMounted.current) {
          setPermissionStatus(status);
        }
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push permission denied');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });

      const token = tokenData.data;

      if (isMounted.current) {
        setExpoPushToken(token);
      }

      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken:  token,
          pushEnabled:    true,
          deviceOS:       Platform.OS,
          tokenUpdatedAt: serverTimestamp(),
        });
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name:             'default',
          importance:       Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor:       '#FF6B35',
          sound:            'default',
        });

        await Notifications.setNotificationChannelAsync(
          'menu-updates',
          {
            name:       'Menu Updates',
            importance: Notifications.AndroidImportance.HIGH,
            sound:      'default',
            lightColor: '#FF6B35',
          }
        );

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
      console.error('Push registration error:', err);
      return null;
    }
  };

  // ─── Mark single as read ──────────────────
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

  // ─── Mark all as read ─────────────────────
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

  // ─── Delete notification ──────────────────
  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      console.error('deleteNotification error:', err);
    }
  };

  // ─── Send to user ─────────────────────────
  const sendNotificationToUser = async ({
    userId,
    title,
    body,
    data  = {},
    type  = 'general',
  }) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        body,
        data,
        type,
        isRead:    false,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('sendNotificationToUser error:', err);
      return { success: false, error: err.message };
    }
  };

  // ─── Send local notification ──────────────
  const sendLocalNotification = async (
    title,
    body,
    data = {}
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null,
      });
    } catch (err) {
      console.error('sendLocalNotification error:', err);
    }
  };

  // ─── Handle tap navigation ────────────────
  const handleNotificationTap = (data) => {
    if (data?.screen) {
      console.log('📱 Navigate to:', data.screen, data.params);
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
    deleteNotification,
    sendNotificationToUser,
    sendLocalNotification,
    registerForPushNotifications,
  };
};