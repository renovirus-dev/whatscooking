// ============================================
// FILE: src/context/NotificationContext.js
// ============================================
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
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
import { useAuth } from '../hooks/useAuth';

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

// ─── Context default values ───────────────────
const NotificationContext = createContext({
  notifications:          [],
  unreadCount:            0,
  loading:                false,
  expoPushToken:          null,
  permissionStatus:       null,
  markAsRead:             async () => {},
  markAllAsRead:          async () => {},
  deleteNotification:     async () => {},
  sendNotificationToUser: async () => {},
  sendLocalNotification:  async () => {},
  registerForPushNotifications: async () => {},
});

// ─── Provider ─────────────────────────────────
export function NotificationProvider({ children }) {
  const { user } = useAuth();

  const [expoPushToken, setExpoPushToken]       = useState(null);
  const [notifications, setNotifications]       = useState([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [loading, setLoading]                   = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const notificationListener = useRef();
  const responseListener     = useRef();
  // ✅ Track if we already registered for this user
  // Prevents re-registering every time context re-renders
  const registeredForUid = useRef(null);

  // ── Push notification listeners ───────────
  // These run once — they don't depend on user
  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener(n => {
        console.log('🔔 Notification received:', n.request.content.title);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(r => {
        console.log(
          '👆 Notification tapped:',
          r.notification.request.content.data
        );
        // ✅ Handle navigation from notification tap here if needed
        // e.g. if data.screen === 'RestaurantDetail' → navigate
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

  // ── Register push when user logs in ───────
  // ✅ FIX: Re-register when user changes
  // Previously this only ran once on mount —
  // if user wasn't logged in yet, token wouldn't save
  useEffect(() => {
    if (!user?.uid) return;
    // ✅ Skip if already registered for this user
    if (registeredForUid.current === user.uid) return;

    registeredForUid.current = user.uid;
    registerForPushNotifications();
  }, [user?.uid]);

  // ── Firestore notification listener ───────
  // ✅ Single listener for the whole app
  // Lives at context level so never destroyed on screen navigation
  useEffect(() => {
    if (!user?.uid) {
      // ✅ Clear state when user logs out
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      registeredForUid.current = null;
      return;
    }

    setLoading(true);
    let unsubscribe = null;

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
          const data = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
          }));
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.isRead).length);
          setLoading(false);
        },
        (err) => {
          // ✅ Handle missing Firestore index gracefully
          if (err.code === 'failed-precondition') {
            console.warn(
              '⚠️ Missing Firestore index for notifications.\n' +
              'Go to Firebase Console → Firestore → Indexes\n' +
              'Add composite index:\n' +
              '  Collection: notifications\n' +
              '  Fields: userId ASC, createdAt DESC'
            );
          } else {
            console.error('Notifications listener error:', err);
          }
          // ✅ Show empty state instead of crashing
          setNotifications([]);
          setUnreadCount(0);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Notifications setup error:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // ── Register push token ────────────────────
  const registerForPushNotifications = useCallback(async () => {
    // ✅ Skip on simulator — push requires real device
    if (!Device.isDevice) {
      console.log('ℹ️ Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permission
      const { status: existing } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      setPermissionStatus(existing);

      // Request if not granted
      if (existing !== 'granted') {
        const { status } =
          await Notifications.requestPermissionsAsync();
        finalStatus = status;
        setPermissionStatus(status);
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push notification permission denied');
        return null;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      const token = tokenData.data;
      setExpoPushToken(token);

      // ✅ Save token to Firestore only if user is logged in
      if (user?.uid && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          expoPushToken:  token,
          pushEnabled:    true,
          deviceOS:       Platform.OS,
          tokenUpdatedAt: serverTimestamp(),
        }).catch(err => {
          // ✅ Don't crash if user doc doesn't exist yet
          console.warn('Could not save push token:', err.message);
        });
      }

      // ✅ Set up Android notification channels
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

      console.log('✅ Push token registered:', token);
      return token;

    } catch (err) {
      // ✅ Never crash the app if push registration fails
      console.error('Push registration error:', err);
      return null;
    }
  }, [user?.uid]);

  // ── Mark single notification as read ──────
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

  // ── Mark all as read ──────────────────────
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

  // ── Delete a notification ─────────────────
  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('deleteNotification error:', err);
    }
  };

  // ── Send notification to a user ───────────
  // ✅ Saves to Firestore — appears in Notifications screen
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

  // ── Send local notification (on-device) ───
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
        trigger: null, // show immediately
      });
    } catch (err) {
      console.error('sendLocalNotification error:', err);
    }
  };

  // ── Context value ─────────────────────────
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
export const useNotifications = () => {
  return useContext(NotificationContext);
};