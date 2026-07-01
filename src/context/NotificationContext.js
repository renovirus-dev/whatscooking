// ============================================
// FILE: src/context/NotificationContext.js
// ============================================
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
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

// ✅ Show notifications when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.manifest?.extra?.eas?.projectId  ||
  '15062ebe-c1c0-4d13-9bf4-bcce99cc9e62';

// ─── Create context ───────────────────────────
const NotificationContext = createContext({
  notifications:   [],
  unreadCount:     0,
  loading:         false,
  expoPushToken:   null,
  permissionStatus: null,
  markAsRead:            async () => {},
  markAllAsRead:         async () => {},
  deleteNotification:    async () => {},
  sendNotificationToUser: async () => {},
  sendLocalNotification:  async () => {},
});

// ─── Provider ─────────────────────────────────
export function NotificationProvider({ children }) {
  const { user } = useAuth();

  const [expoPushToken, setExpoPushToken]   = useState(null);
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const notificationListener = useRef();
  const responseListener     = useRef();

  // ── Push notification setup ───────────────
  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(n => {
        console.log('🔔 Notification received:', n);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(r => {
        console.log('👆 Notification tapped:', r);
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

  // ── Firestore listener ────────────────────
  // ✅ Only ONE listener for the whole app
  // Lives here at context level — never unmounts
  // until user logs out
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
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
          if (err.code === 'failed-precondition') {
            console.warn(
              '⚠️ Add Firestore index:\n' +
              'Collection: notifications\n' +
              'Fields: userId ASC, createdAt DESC'
            );
          } else {
            console.error('Notifications error:', err);
          }
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Notifications setup error:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  // ── Register push ─────────────────────────
  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return null;

    try {
      const { status: existing } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      setPermissionStatus(existing);

      if (existing !== 'granted') {
        const { status } =
          await Notifications.requestPermissionsAsync();
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

  // ── Actions ───────────────────────────────
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

  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('deleteNotification error:', err);
    }
  };

  const sendNotificationToUser = async ({
    userId, title, body, data = {}, type = 'general',
  }) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId, title, body, data, type,
        isRead: false, createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('sendNotificationToUser error:', err);
      return { success: false, error: err.message };
    }
  };

  const sendLocalNotification = async (title, body, data = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: 'default' },
        trigger: null,
      });
    } catch (err) {
      console.error('sendLocalNotification error:', err);
    }
  };

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

// ─── Hook to use anywhere ─────────────────────
export const useNotifications = () => {
  return useContext(NotificationContext);
};