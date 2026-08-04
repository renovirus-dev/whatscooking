// ============================================
// FILE: src/context/NotificationContext.js
// ============================================
import React, {
  createContext, useContext, useState,
  useEffect, useRef, useCallback,
} from 'react';
import * as Device   from 'expo-device';
import Constants     from 'expo-constants';
import { Platform }  from 'react-native';
import {
  doc, updateDoc, deleteDoc,
  collection, addDoc, serverTimestamp,
  query, where, onSnapshot, orderBy, limit,
} from 'firebase/firestore';
import { db }      from '../firebase/config';
import { useAuth } from '../hooks/useAuth';

// ✅ Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// ✅ Safely import expo-notifications
// Completely skip in Expo Go to prevent crash
let Notifications = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    });
  } catch (err) {
    console.log('expo-notifications not available:', err.message);
  }
}

const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  '15062ebe-c1c0-4d13-9bf4-bcce99cc9e62';

const NotificationContext = createContext({
  notifications:                [],
  unreadCount:                  0,
  loading:                      false,
  expoPushToken:                null,
  permissionStatus:             null,
  markAsRead:                   async () => {},
  markAllAsRead:                async () => {},
  deleteNotification:           async () => {},
  sendNotificationToUser:       async () => {},
  sendLocalNotification:        async () => {},
  registerForPushNotifications: async () => {},
});

export function NotificationProvider({ children }) {
  const { user } = useAuth();

  const [expoPushToken, setExpoPushToken]       = useState(null);
  const [notifications, setNotifications]       = useState([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [loading, setLoading]                   = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const notificationListener  = useRef();
  const responseListener      = useRef();
  const registeredForUid      = useRef(null);
  const androidChannelsSetup  = useRef(false);

  // ─────────────────────────────────────────
  // PUSH LISTENERS — Skip in Expo Go
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!Notifications || isExpoGo || Platform.OS === 'web') return;

    try {
      Notifications.setBadgeCountAsync(0).catch(() => {});

      notificationListener.current =
        Notifications.addNotificationReceivedListener(notification => {
          console.log('🔔 Received:', notification.request.content.title);
        });

      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(response => {
          console.log('👆 Tapped:', response.notification.request.content.data);
        });
    } catch (err) {
      console.log('Notification listeners skipped:', err.message);
    }

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch {}
    };
  }, []);

  // ─────────────────────────────────────────
  // REGISTER PUSH — Skip in Expo Go
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || isExpoGo || !Notifications) return;
    if (registeredForUid.current === user.uid) return;
    registeredForUid.current = user.uid;
    registerForPushNotifications();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENER (works everywhere)
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      registeredForUid.current = null;
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
        setLoading(false);
      },
      (err) => {
        if (err.code === 'failed-precondition') {
          console.warn(
            '⚠️ Missing Firestore index for notifications.\n' +
            'Add: userId ASC, createdAt DESC'
          );
        } else {
          console.error('Notifications error:', err);
        }
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // REGISTER PUSH
  // ─────────────────────────────────────────
  const registerForPushNotifications = useCallback(async () => {
    if (isExpoGo || !Notifications || Platform.OS === 'web' || !Device.isDevice) {
      console.log('ℹ️ Push not available in this environment');
      return null;
    }

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      setPermissionStatus(existing);

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        setPermissionStatus(status);
      }

      if (finalStatus !== 'granted') return null;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      const token = tokenData.data;
      setExpoPushToken(token);

      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken:  token,
          pushEnabled:    true,
          deviceOS:       Platform.OS,
          tokenUpdatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      if (Platform.OS === 'android' && !androidChannelsSetup.current) {
        androidChannelsSetup.current = true;
        await Promise.all([
          Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
          }),
          Notifications.setNotificationChannelAsync('menu-updates', {
            name: 'Menu Updates',
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: '#FF6B35',
          }),
          Notifications.setNotificationChannelAsync('promotions', {
            name: 'Promotions & Deals',
            importance: Notifications.AndroidImportance.DEFAULT,
          }),
          Notifications.setNotificationChannelAsync('system', {
            name: 'System Alerts',
            importance: Notifications.AndroidImportance.HIGH,
          }),
        ]);
      }

      console.log('✅ Push token:', token);
      return token;
    } catch (err) {
      console.error('Push error:', err);
      return null;
    }
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // MARK AS READ
  // ─────────────────────────────────────────
  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (err) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n)
      );
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  // ─────────────────────────────────────────
  // MARK ALL AS READ
  // ─────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await Promise.all(
        unread.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }))
      );
    } catch (err) {
      setNotifications(prev =>
        prev.map(n => {
          const wasUnread = unread.find(u => u.id === n.id);
          return wasUnread ? { ...n, isRead: false } : n;
        })
      );
      setUnreadCount(unread.length);
    }
  }, [notifications]);

  // ─────────────────────────────────────────
  // DELETE NOTIFICATION
  // ─────────────────────────────────────────
  const deleteNotification = useCallback(async (id) => {
    const deleted = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      if (deleted) {
        setNotifications(prev => [deleted, ...prev]);
        if (!deleted.isRead) setUnreadCount(prev => prev + 1);
      }
    }
  }, [notifications]);

  // ─────────────────────────────────────────
  // SEND TO USER (Firestore — works everywhere)
  // ─────────────────────────────────────────
  const sendNotificationToUser = useCallback(async ({
    userId, title, body, data = {}, type = 'general',
  }) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId, title, body, data, type,
        isRead: false, createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ─────────────────────────────────────────
  // LOCAL NOTIFICATION — Skip in Expo Go
  // ─────────────────────────────────────────
  const sendLocalNotification = useCallback(async (
    title, body, data = {}
  ) => {
    if (isExpoGo || !Notifications) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null,
      });
    } catch {}
  }, []);

  const value = {
    notifications, unreadCount, loading,
    expoPushToken, permissionStatus,
    markAsRead, markAllAsRead, deleteNotification,
    sendNotificationToUser, sendLocalNotification,
    registerForPushNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);