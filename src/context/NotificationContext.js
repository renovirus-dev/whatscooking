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
import { db }          from '../firebase/config';
import { useAuth }     from '../hooks/useAuth';
import { navigate }    from '../navigation/navigationRef';

// ─────────────────────────────────────────────
// 🔔 BUILT-IN WEB AUDIO CHIME (Zero Files Needed)
// Generates a crisp 2-tone bell chime on Web
// ─────────────────────────────────────────────
const playWebChime = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: A5 (880 Hz) - Higher harmonic chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.1);
    gain2.gain.setValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.log('Web audio chime error:', err);
  }
};

let Notifications = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');

  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    });
    notificationsAvailable = true;
  }
} catch (err) {
  Notifications = null;
  notificationsAvailable = false;
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
  playNotificationSound:        () => {},
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
  const isInitialSnapshot     = useRef(true);

  // ─────────────────────────────────────────
  // TAP HANDLER (Takes user to Restaurant)
  // ─────────────────────────────────────────
  const handleNotificationTap = useCallback((response) => {
    try {
      const data = response?.notification?.request?.content?.data;
      if (data?.restaurantId) {
        navigate('RestaurantDetail', {
          restaurantId: data.restaurantId,
          name:         data.restaurantName || 'Restaurant',
        });
      }
    } catch (err) {
      console.warn('Error navigating on notification tap:', err);
    }
  }, []);

  // ─────────────────────────────────────────
  // PUSH LISTENERS (NATIVE MOBILE)
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!notificationsAvailable || Platform.OS === 'web') return;

    try {
      Notifications.setBadgeCountAsync(0).catch(() => {});

      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) handleNotificationTap(response);
      });

      notificationListener.current =
        Notifications.addNotificationReceivedListener(notification => {
          console.log('🔔 Push Received:', notification.request.content.title);
        });

      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(handleNotificationTap);

    } catch (err) {
      console.log('Notification listeners error:', err.message);
    }

    return () => {
      try {
        if (notificationListener.current)
          Notifications.removeNotificationSubscription(notificationListener.current);
        if (responseListener.current)
          Notifications.removeNotificationSubscription(responseListener.current);
      } catch {}
    };
  }, [handleNotificationTap]);

  // ─────────────────────────────────────────
  // REGISTER PUSH TOKEN
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !notificationsAvailable) return;
    if (registeredForUid.current === user.uid) return;
    registeredForUid.current = user.uid;
    registerForPushNotifications();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // FIRESTORE NOTIFICATIONS + CHIME LISTENER
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      registeredForUid.current = null;
      isInitialSnapshot.current = true;
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

        // 🔔 Play chime on Web if a brand new unread notification arrived
        if (isInitialSnapshot.current) {
          isInitialSnapshot.current = false;
        } else {
          const hasNewUnread = snap.docChanges().some(
            change => change.type === 'added' && !change.doc.data().isRead
          );
          if (hasNewUnread) {
            playWebChime();
          }
        }
      },
      (err) => {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // REGISTER FOR PUSH TOKEN
  // ─────────────────────────────────────────
  const registerForPushNotifications = useCallback(async () => {
    if (!notificationsAvailable || Platform.OS === 'web' || !Device.isDevice) {
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
        ]);
      }

      return token;
    } catch (err) {
      console.error('Push error:', err);
      return null;
    }
  }, [user?.uid]);

  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch {}
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await Promise.all(
        unread.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }))
      );
    } catch {}
  }, [notifications]);

  const deleteNotification = useCallback(async (id) => {
    const deleted = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch {}
  }, [notifications]);

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

  const sendLocalNotification = useCallback(async (title, body, data = {}) => {
    if (Platform.OS === 'web') {
      playWebChime();
      return;
    }
    if (!notificationsAvailable) return;
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
    playNotificationSound: playWebChime,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);