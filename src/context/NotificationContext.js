// ============================================
// FILE: src/context/NotificationContext.js
// ============================================
import React, {
  createContext, useContext, useState,
  useEffect, useRef, useCallback,
} from 'react';
import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';
import {
  doc, updateDoc, deleteDoc,
  collection, addDoc, serverTimestamp,
  query, where, onSnapshot, orderBy, limit,
} from 'firebase/firestore';
import { db }      from '../firebase/config';
import { useAuth } from '../hooks/useAuth';

// ─── Notification Handler ─────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Expo Project ID ──────────────────────────
const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.manifest?.extra?.eas?.projectId  ||
  '15062ebe-c1c0-4d13-9bf4-bcce99cc9e62';

// ─── Context ──────────────────────────────────
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

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const { user } = useAuth();

  // ── State ─────────────────────────────────
  const [expoPushToken, setExpoPushToken]       = useState(null);
  const [notifications, setNotifications]       = useState([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [loading, setLoading]                   = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);

  // ── Refs ──────────────────────────────────
  const notificationListener  = useRef();
  const responseListener      = useRef();
  const registeredForUid      = useRef(null);
  const androidChannelsSetup  = useRef(false);

  // ─────────────────────────────────────────
  // PUSH NOTIFICATION LISTENERS
  // ─────────────────────────────────────────
  useEffect(() => {
    // ✅ Skip on web
    if (Platform.OS === 'web') return;

    Notifications.setBadgeCountAsync(0).catch(() => {});

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Received:', notification.request.content.title);
        Notifications.setBadgeCountAsync(
          (notification.request.content.badge || 0) + 1
        ).catch(() => {});
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log('👆 Tapped notification:', data);
        // Handle navigation here if needed
      });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // ─────────────────────────────────────────
  // REGISTER PUSH WHEN USER LOGS IN
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    if (registeredForUid.current === user.uid) return;
    registeredForUid.current = user.uid;
    registerForPushNotifications();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // FIRESTORE NOTIFICATIONS LISTENER
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
      where('userId',   '==', user.uid),
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
            'Firebase Console → Firestore → Indexes → Add:\n' +
            '  Collection: notifications\n' +
            '  Fields: userId ASC, createdAt DESC'
          );
        } else {
          console.error('Notifications listener error:', err);
        }
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // REGISTER FOR PUSH NOTIFICATIONS
  // ─────────────────────────────────────────
  const registerForPushNotifications = useCallback(async () => {
    // ✅ Skip on web
    if (Platform.OS === 'web') {
      console.log('ℹ️ Push notifications not supported on web');
      return null;
    }

    // ✅ Skip on simulator
    if (!Device.isDevice) {
      console.log('ℹ️ Push notifications require a physical device');
      return null;
    }

    try {
      // ── Check / request permission ────────
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      setPermissionStatus(existing);

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        setPermissionStatus(status);
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push notification permission denied');
        return null;
      }

      // ── Get push token ────────────────────
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      const token = tokenData.data;
      setExpoPushToken(token);

      // ── Save token to Firestore ───────────
      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken:  token,
          pushEnabled:    true,
          deviceOS:       Platform.OS,
          tokenUpdatedAt: serverTimestamp(),
        }).catch(err => {
          console.warn('Could not save push token:', err.message);
        });
      }

      // ── Android notification channels ─────
      // ✅ Remove sound: 'default' — not bundled in app
      // ✅ Only set up once per app session
      if (Platform.OS === 'android' && !androidChannelsSetup.current) {
        androidChannelsSetup.current = true;
        await Promise.all([
          Notifications.setNotificationChannelAsync('default', {
            name:             'General',
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor:       '#FF6B35',
            // ✅ No sound field - uses system default
          }),
          Notifications.setNotificationChannelAsync('menu-updates', {
            name:       'Menu Updates',
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: '#FF6B35',
            // ✅ No sound field
          }),
          Notifications.setNotificationChannelAsync('promotions', {
            name:       'Promotions & Deals',
            importance: Notifications.AndroidImportance.DEFAULT,
            // ✅ No sound field
          }),
          Notifications.setNotificationChannelAsync('system', {
            name:       'System Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            // ✅ No sound field
          }),
        ]);
      }

      console.log('✅ Push token registered:', token);
      return token;

    } catch (err) {
      console.error('Push registration error:', err);
      return null;
    }
  }, [user?.uid]);

  // ─────────────────────────────────────────
  // MARK SINGLE AS READ
  // ─────────────────────────────────────────
  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
      });
    } catch (err) {
      console.error('markAsRead error:', err);
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
        unread.map(n =>
          updateDoc(doc(db, 'notifications', n.id), { isRead: true })
        )
      );
    } catch (err) {
      console.error('markAllAsRead error:', err);
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
      console.error('deleteNotification error:', err);
      if (deleted) {
        setNotifications(prev => [deleted, ...prev]);
        if (!deleted.isRead) setUnreadCount(prev => prev + 1);
      }
    }
  }, [notifications]);

  // ─────────────────────────────────────────
  // SEND NOTIFICATION TO USER
  // ─────────────────────────────────────────
  const sendNotificationToUser = useCallback(async ({
    userId, title, body, data = {}, type = 'general',
  }) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId, title, body, data, type,
        isRead:    false,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('sendNotificationToUser error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // ─────────────────────────────────────────
  // SEND LOCAL NOTIFICATION
  // ✅ Removed sound: 'default' - not bundled
  // ─────────────────────────────────────────
  const sendLocalNotification = useCallback(async (
    title, body, data = {}
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          // ✅ No sound field - uses channel default
        },
        trigger: null,
      });
    } catch (err) {
      console.error('sendLocalNotification error:', err);
    }
  }, []);

  // ─────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────
  const value = {
    notifications,
    unreadCount,
    loading,
    expoPushToken,
    permissionStatus,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendNotificationToUser,
    sendLocalNotification,
    registerForPushNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────
export const useNotifications = () => useContext(NotificationContext);