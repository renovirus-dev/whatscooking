// ============================================
// FILE: src/screens/admin/AdminDashboardScreen.js
// ============================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, ActivityIndicator,
  Alert, TextInput, KeyboardAvoidingView, Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query,
  getDocs, updateDoc, deleteDoc,
  addDoc, doc, orderBy, limit,
  serverTimestamp, getCountFromServer,
} from 'firebase/firestore';
import { db }      from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { sendPushNotificationBatch } from '../../utils/sendPushNotification';

// ─── Safe Color Fallbacks ─────────────────────
const INFO_COLOR    = COLORS.info    || '#3498DB';
const WARNING_COLOR = COLORS.warning || '#F39C12';

// ─── Subscription Plans ───────────────────────
const SUBSCRIPTION_PLANS = {
  free_trial: {
    id:    'free_trial',
    name:  'Free Trial',
    emoji: '🆓',
    price: 0,
    color: COLORS.textMuted,
  },
  basic: {
    id:    'basic',
    name:  'Basic',
    emoji: '⭐',
    price: 9.99,
    color: INFO_COLOR,
  },
  premium: {
    id:      'premium',
    name:    'Premium',
    emoji:   '👑',
    price:   24.99,
    color:   COLORS.primary,
  },
};

// ─── Tab Config (NO menu_scan) ────────────────
const TABS = [
  { id: 'overview',     label: 'Overview',  icon: 'grid-outline'          },
  { id: 'restaurants',  label: 'Restos',    icon: 'restaurant-outline'    },
  { id: 'users',        label: 'Users',     icon: 'people-outline'        },
  { id: 'reviews',      label: 'Reviews',   icon: 'star-outline'          },
  { id: 'payments',     label: 'Payments',  icon: 'cash-outline'          },
  { id: 'subscription', label: 'Plans',     icon: 'diamond-outline'       },
  { id: 'notify',       label: 'Notify',    icon: 'notifications-outline' },
];

export default function AdminDashboardScreen({ navigation }) {
  const insets     = useSafeAreaInsets();
  const { logout } = useAuth();

  // ── Core State ──────────────────────────────
  const [activeTab, setActiveTab]             = useState('overview');
  const [restaurants, setRestaurants]         = useState([]);
  const [users, setUsers]                     = useState([]);
  const [reviews, setReviews]                 = useState([]);
  const [paymentOrders, setPaymentOrders]     = useState([]);
  const [stats, setStats] = useState({
    totalRestaurants:  0,
    activeRestaurants: 0,
    totalUsers:        0,
    totalReviews:      0,
    pendingApprovals:  0,
    pendingPayments:   0,
  });

  // ── UI State ────────────────────────────────
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [signingOut, setSigningOut]             = useState(false);
  const [updatingPlan, setUpdatingPlan]         = useState(false);
  const [activatingOrder, setActivatingOrder]   = useState(null);

  // ── Search State ────────────────────────────
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [userSearch, setUserSearch]             = useState('');
  const [reviewSearch, setReviewSearch]         = useState('');

  // ── Filter State ────────────────────────────
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [userFilter, setUserFilter]             = useState('all');

  // ── Notification State ───────────────────────
  const [notifTitle, setNotifTitle]   = useState('');
  const [notifBody, setNotifBody]     = useState('');
  const [notifTarget, setNotifTarget] = useState('all');
  const [sending, setSending]         = useState(false);

  // ─────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────
  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRestaurants(),
        loadUsers(),
        loadReviews(),
        loadPaymentOrders(),
      ]);
    } catch (err) {
      console.error('loadDashboardData error:', err);
      Alert.alert('Error', 'Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  const loadRestaurants = async () => {
    const snap = await getDocs(
      query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'))
    );
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setRestaurants(data);
    setStats(prev => ({
      ...prev,
      totalRestaurants:  data.length,
      activeRestaurants: data.filter(r => r.isActive).length,
      pendingApprovals:  data.filter(r => !r.isApproved).length,
    }));
  };

  const loadUsers = async () => {
    const snap = await getDocs(
      query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    );
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setUsers(data);
    setStats(prev => ({ ...prev, totalUsers: data.length }));
  };

  const loadReviews = async () => {
    // ✅ Accurate total count (not capped by limit)
    const countSnap = await getCountFromServer(collection(db, 'reviews'));
    const snap = await getDocs(
      query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100))
    );
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setReviews(data);
    setStats(prev => ({ ...prev, totalReviews: countSnap.data().count }));
  };

  const loadPaymentOrders = async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'paymentOrders'),
          orderBy('createdAt', 'desc'),
          limit(100),
        )
      );
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPaymentOrders(data);
      setStats(prev => ({
        ...prev,
        pendingPayments: data.filter(o => o.status === 'awaiting_confirmation').length,
      }));
    } catch (err) {
      console.error('loadPaymentOrders error:', err);
    }
  };

  // ─────────────────────────────────────────────
  // MEMOIZED FILTERED DATA
  // ─────────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    let data = [...restaurants];
    if (restaurantFilter === 'active')   data = data.filter(r => r.isActive && r.isApproved);
    if (restaurantFilter === 'inactive') data = data.filter(r => !r.isActive);
    if (restaurantFilter === 'pending')  data = data.filter(r => !r.isApproved);
    if (restaurantSearch.trim()) {
      const q = restaurantSearch.toLowerCase();
      data = data.filter(r =>
        r.name?.toLowerCase().includes(q)            ||
        r.location?.city?.toLowerCase().includes(q) ||
        r.cuisineType?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [restaurants, restaurantFilter, restaurantSearch]);

  const filteredUsers = useMemo(() => {
    let data = [...users];
    if (userFilter === 'customer')         data = data.filter(u => u.role === 'customer');
    if (userFilter === 'restaurant_owner') data = data.filter(u => u.role === 'restaurant_owner');
    if (userFilter === 'banned')           data = data.filter(u => u.isBanned);
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      data = data.filter(u =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [users, userFilter, userSearch]);

  const filteredReviews = useMemo(() => {
    if (!reviewSearch.trim()) return reviews;
    const q = reviewSearch.toLowerCase();
    return reviews.filter(r =>
      r.userName?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  }, [reviews, reviewSearch]);

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }, []);

  // ─────────────────────────────────────────────
  // SIGN OUT
  // ─────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            setSigningOut(true);
            const result = await logout();
            if (!result.success) Alert.alert('Error', result.error || 'Failed to sign out');
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }, [logout]);

  // ─────────────────────────────────────────────
  // RESTAURANT ACTIONS
  // ─────────────────────────────────────────────
  const toggleRestaurantActive = useCallback(async (restaurant) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isActive: !restaurant.isActive, updatedAt: serverTimestamp(),
      });
      setRestaurants(prev =>
        prev.map(r => r.id === restaurant.id ? { ...r, isActive: !r.isActive } : r)
      );
      setStats(prev => ({
        ...prev,
        activeRestaurants: !restaurant.isActive
          ? prev.activeRestaurants + 1
          : prev.activeRestaurants - 1,
      }));
    } catch (err) { Alert.alert('Error', err.message); }
  }, []);

  const approveRestaurant = useCallback(async (restaurant) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isApproved: true, isActive: true, updatedAt: serverTimestamp(),
      });
      setRestaurants(prev =>
        prev.map(r =>
          r.id === restaurant.id ? { ...r, isApproved: true, isActive: true } : r
        )
      );
      setStats(prev => ({
        ...prev,
        activeRestaurants: prev.activeRestaurants + 1,
        pendingApprovals:  Math.max(0, prev.pendingApprovals - 1),
      }));
      // Notify owner
      const owner = users.find(u => u.id === restaurant.ownerId);
      if (owner) {
        await addDoc(collection(db, 'notifications'), {
          userId: owner.id, title: '🎉 Restaurant Approved!',
          body: `${restaurant.name} is now live on What's Cooking!`,
          type: 'system', isRead: false, createdAt: serverTimestamp(),
        });
        if (owner.expoPushToken) {
          await sendPushNotificationBatch({
            tokens: [owner.expoPushToken],
            title: '🎉 Restaurant Approved!',
            body: `${restaurant.name} is now live!`,
            data: { type: 'restaurant_approved' },
          });
        }
      }
      Alert.alert('✅ Approved', `${restaurant.name} is now live!`);
    } catch (err) { Alert.alert('Error', err.message); }
  }, [users]);

  const deleteRestaurant = useCallback(async (restaurant) => {
    Alert.alert(
      '⚠️ Delete Restaurant',
      `Permanently delete "${restaurant.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'restaurants', restaurant.id));
              setRestaurants(prev => prev.filter(r => r.id !== restaurant.id));
              setStats(prev => ({
                ...prev,
                totalRestaurants:  prev.totalRestaurants - 1,
                activeRestaurants: restaurant.isActive
                  ? prev.activeRestaurants - 1 : prev.activeRestaurants,
              }));
            } catch (err) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────────
  // USER ACTIONS
  // ─────────────────────────────────────────────
  const toggleUserRole = useCallback(async (userData, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userData.id), {
        role: newRole, updatedAt: serverTimestamp(),
      });
      setUsers(prev =>
        prev.map(u => u.id === userData.id ? { ...u, role: newRole } : u)
      );
      Alert.alert('✅ Done', `${userData.firstName} is now ${newRole}`);
    } catch (err) { Alert.alert('Error', err.message); }
  }, []);

  // ✅ Toggle ban AND unban
  const toggleBanUser = useCallback(async (userData) => {
    const isBanning = !userData.isBanned;
    Alert.alert(
      isBanning ? '⚠️ Ban User' : '✅ Unban User',
      isBanning
        ? `Ban ${userData.firstName} ${userData.lastName}? They won't be able to access the app.`
        : `Restore access for ${userData.firstName} ${userData.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBanning ? 'Ban' : 'Unban',
          style: isBanning ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userData.id), {
                isBanned: isBanning, updatedAt: serverTimestamp(),
              });
              setUsers(prev =>
                prev.map(u =>
                  u.id === userData.id ? { ...u, isBanned: isBanning } : u
                )
              );
            } catch (err) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────────
  // REVIEW ACTIONS
  // ─────────────────────────────────────────────
  const deleteReview = useCallback(async (review) => {
    Alert.alert('⚠️ Delete Review', 'Delete this review permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'reviews', review.id));
            setReviews(prev => prev.filter(r => r.id !== review.id));
          } catch (err) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  }, []);

  // ─────────────────────────────────────────────
  // PAYMENT ACTIONS
  // ─────────────────────────────────────────────
  const handleActivateBankTransfer = useCallback(async (order) => {
    Alert.alert(
      '✅ Activate Plan',
      `Confirm bank transfer received?\n\n` +
      `Plan: ${order.planName}\n` +
      `Amount: J$${order.amountJMD?.toLocaleString()} (~$${order.amount} USD)\n\n` +
      `This activates the ${order.planName} plan immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✅ Yes, Activate',
          onPress: async () => {
            setActivatingOrder(order.id);
            try {
              const plan      = SUBSCRIPTION_PLANS[order.planId];
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 1);

              await updateDoc(doc(db, 'paymentOrders', order.id), {
                status: 'completed', confirmedAt: serverTimestamp(),
                confirmedBy: 'admin', updatedAt: serverTimestamp(),
              });
              await updateDoc(doc(db, 'restaurants', order.restaurantId), {
                'subscription.plan':           order.planId,
                'subscription.status':         'active',
                'subscription.expiresAt':      expiresAt.toISOString(),
                'subscription.updatedAt':      serverTimestamp(),
                'subscription.price':          order.amount,
                'subscription.priceJMD':       order.amountJMD || 0,
                'subscription.paymentMethod':  'bank_transfer',
                'subscription.lastOrderId':    order.id,
                'subscription.updatedByAdmin': true,
                updatedAt:                     serverTimestamp(),
              });

              const owner = users.find(u => u.id === order.userId);
              if (owner?.expoPushToken) {
                await sendPushNotificationBatch({
                  tokens: [owner.expoPushToken],
                  title: `${plan?.emoji || '✅'} Plan Activated!`,
                  body: `Your ${order.planName} plan is now active. Thank you!`,
                  data: { type: 'subscription_activated' },
                });
              }
              if (owner) {
                await addDoc(collection(db, 'notifications'), {
                  userId: owner.id,
                  title: `${plan?.emoji || '✅'} ${order.planName} Plan Activated`,
                  body: `Your bank transfer has been confirmed. Enjoy ${order.planName}!`,
                  type: 'system', isRead: false, createdAt: serverTimestamp(),
                });
              }

              // ✅ Optimistic update
              setPaymentOrders(prev =>
                prev.map(o => o.id === order.id ? { ...o, status: 'completed' } : o)
              );
              setStats(prev => ({
                ...prev,
                pendingPayments: Math.max(0, prev.pendingPayments - 1),
              }));
              Alert.alert('🎉 Plan Activated!', `${order.planName} activated.\nOwner notified.`);
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setActivatingOrder(null);
            }
          },
        },
      ]
    );
  }, [users]);

  const handleRejectPayment = useCallback(async (order) => {
    Alert.alert(
      '❌ Reject Payment',
      'Reject this bank transfer? The restaurant owner will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'paymentOrders', order.id), {
                status: 'rejected', rejectedAt: serverTimestamp(),
                rejectedBy: 'admin', updatedAt: serverTimestamp(),
              });
              const owner = users.find(u => u.id === order.userId);
              if (owner) {
                await addDoc(collection(db, 'notifications'), {
                  userId: owner.id,
                  title: '❌ Payment Not Confirmed',
                  body: `We could not confirm your bank transfer for ${order.planName}. Please contact support.`,
                  type: 'system', isRead: false, createdAt: serverTimestamp(),
                });
              }
              setPaymentOrders(prev =>
                prev.map(o => o.id === order.id ? { ...o, status: 'rejected' } : o)
              );
              setStats(prev => ({
                ...prev,
                pendingPayments: Math.max(0, prev.pendingPayments - 1),
              }));
              Alert.alert('Done', 'Payment rejected. Owner notified.');
            } catch (err) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  }, [users]);

  // ─────────────────────────────────────────────
  // PLAN CHANGE
  // ─────────────────────────────────────────────
  const handleChangePlan = useCallback(async (restaurant, newPlanId) => {
    const plan    = SUBSCRIPTION_PLANS[newPlanId];
    const current = restaurant.subscription?.plan || 'free_trial';
    if (current === newPlanId) {
      Alert.alert('Already on this plan', `${restaurant.name} is already on ${plan.name}`);
      return;
    }
    const isUpgrade   = newPlanId === 'premium' ||
                        (newPlanId === 'basic' && current === 'free_trial');
    const actionLabel = isUpgrade ? `Upgrade to ${plan.name}` : `Downgrade to ${plan.name}`;

    Alert.alert(
      `${plan.emoji} ${actionLabel}`,
      `Apply ${plan.name} to ${restaurant.name}?\n\nTakes effect immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingPlan(true);
            try {
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 1);
              await updateDoc(doc(db, 'restaurants', restaurant.id), {
                'subscription.plan':           newPlanId,
                'subscription.status':         newPlanId === 'free_trial' ? 'trial' : 'active',
                'subscription.updatedAt':      serverTimestamp(),
                'subscription.expiresAt':      newPlanId !== 'free_trial'
                  ? expiresAt.toISOString() : null,
                'subscription.updatedByAdmin': true,
                'subscription.price':          plan.price,
                updatedAt:                     serverTimestamp(),
              });
              setRestaurants(prev =>
                prev.map(r =>
                  r.id === restaurant.id
                    ? { ...r, subscription: { ...r.subscription, plan: newPlanId,
                        status: newPlanId === 'free_trial' ? 'trial' : 'active' } }
                    : r
                )
              );
              const owner = users.find(u => u.id === restaurant.ownerId);
              if (owner?.expoPushToken) {
                await sendPushNotificationBatch({
                  tokens: [owner.expoPushToken],
                  title: `${plan.emoji} Plan Updated!`,
                  body: `"${restaurant.name}" updated to ${plan.name} plan.`,
                  data: { type: 'subscription_update' },
                });
              }
              if (owner) {
                await addDoc(collection(db, 'notifications'), {
                  userId: owner.id,
                  title: `${plan.emoji} Subscription Updated`,
                  body: `"${restaurant.name}" plan changed to ${plan.name}.`,
                  type: 'system', isRead: false, createdAt: serverTimestamp(),
                });
              }
              Alert.alert('✅ Plan Updated!', `${restaurant.name} → ${plan.name}`);
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setUpdatingPlan(false);
            }
          },
        },
      ]
    );
  }, [users]);

  // ─────────────────────────────────────────────
  // SEND NOTIFICATION
  // ─────────────────────────────────────────────
  const handleSendNotification = useCallback(async () => {
    if (!notifTitle.trim()) {
      Alert.alert('Error', 'Please enter a notification title'); return;
    }
    if (!notifBody.trim()) {
      Alert.alert('Error', 'Please enter a notification message'); return;
    }
    setSending(true);
    try {
      let targetUsers = users;
      if (notifTarget === 'customers') targetUsers = users.filter(u => u.role === 'customer');
      if (notifTarget === 'owners')    targetUsers = users.filter(u => u.role === 'restaurant_owner');

      const title = notifTitle.trim();
      const body  = notifBody.trim();

      await Promise.allSettled(
        targetUsers.map(u =>
          addDoc(collection(db, 'notifications'), {
            userId: u.id, title, body,
            type: 'general', isRead: false,
            createdAt: serverTimestamp(), data: { type: 'broadcast' },
          })
        )
      );
      const tokens = targetUsers.map(u => u.expoPushToken).filter(Boolean);
      let pushResult = { sent: 0 };
      if (tokens.length > 0) {
        pushResult = await sendPushNotificationBatch({
          tokens, title, body, data: { type: 'broadcast' },
        });
      }
      setNotifTitle('');
      setNotifBody('');
      Alert.alert(
        '✅ Sent!',
        `📬 ${targetUsers.length} users notified\n📱 ${pushResult.sent ?? tokens.length} devices reached`
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  }, [notifTitle, notifBody, notifTarget, users]);

  // ─────────────────────────────────────────────
  // SHARED UI COMPONENTS
  // ─────────────────────────────────────────────
  const EmptyState = ({ icon, message, subtitle }) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Ionicons name={icon} size={40} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
      {subtitle && <Text style={styles.emptySubText}>{subtitle}</Text>}
    </View>
  );

  const SearchBar = ({ value, onChangeText, placeholder }) => (
    <View style={styles.searchBar}>
      <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  const FilterChips = ({ options, selected, onSelect }) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterChipsScroll}
      contentContainerStyle={styles.filterChipsContent}
    >
      {options.map(opt => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.filterChip, selected === opt.id && styles.filterChipActive]}
          onPress={() => onSelect(opt.id)}
          activeOpacity={0.7}
        >
          {opt.color && (
            <View style={[
              styles.filterChipDot,
              { backgroundColor: selected === opt.id ? '#FFFFFF' : opt.color },
            ]} />
          )}
          <Text style={[
            styles.filterChipText,
            selected === opt.id && styles.filterChipTextActive,
          ]}>
            {opt.label}
            {opt.count !== undefined ? ` (${opt.count})` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ─────────────────────────────────────────────
  // TAB: OVERVIEW
  // ─────────────────────────────────────────────
  const renderOverview = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.md }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Stats Grid — tapping navigates to that tab */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Restaurants',      value: stats.totalRestaurants,  icon: 'restaurant-outline',       color: COLORS.primary,  tab: 'restaurants'  },
          { label: 'Active',           value: stats.activeRestaurants, icon: 'checkmark-circle-outline', color: COLORS.success,  tab: 'restaurants'  },
          { label: 'Users',            value: stats.totalUsers,        icon: 'people-outline',           color: COLORS.secondary,tab: 'users'        },
          { label: 'Reviews',          value: stats.totalReviews,      icon: 'star-outline',             color: '#FFD700',       tab: 'reviews'      },
          { label: 'Pending Approval', value: stats.pendingApprovals,  icon: 'time-outline',
            color: stats.pendingApprovals > 0 ? COLORS.error : COLORS.success, tab: 'restaurants' },
          { label: 'Pending Payments', value: stats.pendingPayments,   icon: 'cash-outline',
            color: stats.pendingPayments > 0  ? WARNING_COLOR : COLORS.success, tab: 'payments'  },
        ].map((stat, i) => (
          <TouchableOpacity
            key={i}
            style={styles.statCard}
            onPress={() => setActiveTab(stat.tab)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('ImageDownload')}
          activeOpacity={0.8}
        >
          <Text style={styles.quickActionEmoji}>🖼️</Text>
          <Text style={styles.quickActionLabel}>Image Manager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => setActiveTab('notify')}
          activeOpacity={0.8}
        >
          <Text style={styles.quickActionEmoji}>📢</Text>
          <Text style={styles.quickActionLabel}>Broadcast</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => setActiveTab('payments')}
          activeOpacity={0.8}
        >
          <Text style={styles.quickActionEmoji}>💳</Text>
          <Text style={styles.quickActionLabel}>Payments</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Payments Banner */}
      {stats.pendingPayments > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => setActiveTab('payments')}
          activeOpacity={0.8}
        >
          <View style={styles.alertBannerIcon}>
            <Ionicons name="cash-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>
              {stats.pendingPayments} Bank Transfer{stats.pendingPayments > 1 ? 's' : ''} Awaiting
            </Text>
            <Text style={styles.alertBannerSub}>Tap to review and activate subscriptions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Pending Approvals Banner */}
      {stats.pendingApprovals > 0 && (
        <TouchableOpacity
          style={[styles.alertBanner, { backgroundColor: COLORS.error }]}
          onPress={() => setActiveTab('restaurants')}
          activeOpacity={0.8}
        >
          <View style={[styles.alertBannerIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="time-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>
              {stats.pendingApprovals} Restaurant{stats.pendingApprovals > 1 ? 's' : ''} Need Approval
            </Text>
            <Text style={styles.alertBannerSub}>Tap to review</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Recent Reviews */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⭐ Recent Reviews</Text>
          <TouchableOpacity onPress={() => setActiveTab('reviews')}>
            <Text style={styles.sectionSeeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {reviews.slice(0, 3).map(r => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>{r.userName}</Text>
              <View style={styles.reviewRating}>
                {[1,2,3,4,5].map(star => (
                  <Ionicons
                    key={star}
                    name={star <= r.rating ? 'star' : 'star-outline'}
                    size={12}
                    color={star <= r.rating ? '#FFD700' : COLORS.border}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.reviewText} numberOfLines={2}>{r.comment}</Text>
            <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
          </View>
        ))}
        {reviews.length === 0 && (
          <EmptyState icon="star-outline" message="No reviews yet" />
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && { opacity: 0.7 }]}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.8}
      >
        {signingOut ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // ─────────────────────────────────────────────
  // TAB: RESTAURANTS
  // ─────────────────────────────────────────────
  const renderRestaurants = () => (
    <View style={{ flex: 1 }}>
      <SearchBar
        value={restaurantSearch}
        onChangeText={setRestaurantSearch}
        placeholder="Search by name, city, cuisine..."
      />
      <FilterChips
        selected={restaurantFilter}
        onSelect={setRestaurantFilter}
        options={[
          { id: 'all',      label: 'All',      count: restaurants.length },
          { id: 'active',   label: 'Active',   count: restaurants.filter(r => r.isActive && r.isApproved).length, color: COLORS.success },
          { id: 'inactive', label: 'Inactive', count: restaurants.filter(r => !r.isActive).length,               color: COLORS.error   },
          { id: 'pending',  label: 'Pending',  count: restaurants.filter(r => !r.isApproved).length,             color: WARNING_COLOR  },
        ]}
      />
      <FlatList
        data={filteredRestaurants}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            message={restaurantSearch ? 'No restaurants match your search' : 'No restaurants found'}
          />
        }
        renderItem={({ item }) => {
          const planId = item.subscription?.plan || 'free_trial';
          const plan   = SUBSCRIPTION_PLANS[planId];
          const isExpiringSoon = item.subscription?.expiresAt
            ? new Date(item.subscription.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : false;

          return (
            <View style={styles.listCard}>
              <View style={styles.listCardHeader}>
                <View style={styles.listCardInfo}>
                  <Text style={styles.listCardName}>{item.name}</Text>
                  <Text style={styles.listCardSub}>
                    📍 {item.location?.city || 'Unknown'} • {item.cuisineType || item.priceRange || ''}
                  </Text>
                  <View style={[styles.inlinePlanBadge, { backgroundColor: plan.color + '15' }]}>
                    <Text style={[styles.inlinePlanText, { color: plan.color }]}>
                      {plan.emoji} {plan.name}
                    </Text>
                    {isExpiringSoon && (
                      <Text style={styles.expiringText}> · Expiring soon ⚠️</Text>
                    )}
                  </View>
                </View>
                <View style={styles.listCardBadges}>
                  <View style={[styles.badge, item.isActive ? styles.badgeSuccess : styles.badgeError]}>
                    <Text style={[
                      styles.badgeText,
                      { color: item.isActive ? COLORS.success : COLORS.error },
                    ]}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                  {!item.isApproved && (
                    <View style={[styles.badge, styles.badgeWarning]}>
                      <Text style={[styles.badgeText, { color: WARNING_COLOR }]}>Pending</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.listCardActions}>
                {!item.isApproved && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSuccess]}
                    onPress={() => approveRestaurant(item)}
                  >
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, item.isActive ? styles.actionBtnWarning : styles.actionBtnSuccess]}
                  onPress={() => toggleRestaurantActive(item)}
                >
                  <Ionicons name={item.isActive ? 'pause-outline' : 'play-outline'} size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{item.isActive ? 'Disable' : 'Enable'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => deleteRestaurant(item)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );

  // ─────────────────────────────────────────────
  // TAB: USERS
  // ─────────────────────────────────────────────
  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <SearchBar
        value={userSearch}
        onChangeText={setUserSearch}
        placeholder="Search by name or email..."
      />
      <FilterChips
        selected={userFilter}
        onSelect={setUserFilter}
        options={[
          { id: 'all',              label: 'All',       count: users.length },
          { id: 'customer',         label: 'Customers', count: users.filter(u => u.role === 'customer').length,         color: COLORS.success },
          { id: 'restaurant_owner', label: 'Owners',    count: users.filter(u => u.role === 'restaurant_owner').length, color: COLORS.primary },
          { id: 'banned',           label: 'Banned',    count: users.filter(u => u.isBanned).length,                   color: COLORS.error   },
        ]}
      />
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            message={userSearch ? 'No users match your search' : 'No users found'}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.listCard, item.isBanned && styles.listCardBanned]}>
            <View style={styles.listCardHeader}>
              <View style={styles.userAvatarRow}>
                <View style={[
                  styles.userAvatar,
                  {
                    backgroundColor:
                      item.role === 'admin'            ? COLORS.primary + '20'
                    : item.role === 'restaurant_owner' ? WARNING_COLOR  + '20'
                    :                                    COLORS.success  + '20',
                  },
                ]}>
                  <Text style={styles.userAvatarText}>
                    {item.firstName?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listCardName}>
                    {item.firstName} {item.lastName}
                    {item.isBanned ? '  🚫' : ''}
                  </Text>
                  <Text style={styles.listCardSub}>{item.email}</Text>
                  <Text style={styles.listCardSub}>Joined: {formatDate(item.createdAt)}</Text>
                </View>
              </View>
              <View style={[
                styles.badge,
                item.role === 'admin'            ? styles.badgePrimary
                : item.role === 'restaurant_owner' ? styles.badgeWarning
                : styles.badgeSuccess,
              ]}>
                <Text style={[
                  styles.badgeText,
                  {
                    color:
                      item.role === 'admin'            ? COLORS.primary
                    : item.role === 'restaurant_owner' ? WARNING_COLOR
                    :                                    COLORS.success,
                  },
                ]}>
                  {item.role === 'restaurant_owner' ? 'Owner' : item.role}
                </Text>
              </View>
            </View>
            <View style={styles.listCardActions}>
              {item.role !== 'admin' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => toggleUserRole(
                    item,
                    item.role === 'restaurant_owner' ? 'customer' : 'restaurant_owner'
                  )}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>
                    {item.role === 'restaurant_owner' ? 'Make Customer' : 'Make Owner'}
                  </Text>
                </TouchableOpacity>
              )}
              {item.role !== 'admin' && (
                // ✅ Now handles BOTH ban and unban
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    item.isBanned ? styles.actionBtnSuccess : styles.actionBtnDanger,
                  ]}
                  onPress={() => toggleBanUser(item)}
                >
                  <Ionicons
                    name={item.isBanned ? 'checkmark-circle-outline' : 'ban-outline'}
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionBtnText}>
                    {item.isBanned ? 'Unban' : 'Ban'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );

  // ─────────────────────────────────────────────
  // TAB: REVIEWS
  // ─────────────────────────────────────────────
  const renderReviews = () => (
    <View style={{ flex: 1 }}>
      <SearchBar
        value={reviewSearch}
        onChangeText={setReviewSearch}
        placeholder="Search by user or content..."
      />
      <FlatList
        data={filteredReviews}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <Text style={styles.listCount}>
            Showing {filteredReviews.length} of {stats.totalReviews} total reviews
          </Text>
        }
        ListEmptyComponent={<EmptyState icon="star-outline" message="No reviews found" />}
        renderItem={({ item }) => (
          <View style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.listCardInfo}>
                <Text style={styles.listCardName}>{item.userName}</Text>
                <Text style={styles.listCardSub}>
                  {item.restaurantName || 'Unknown Restaurant'}
                </Text>
                <View style={styles.reviewRating}>
                  {[1,2,3,4,5].map(star => (
                    <Ionicons
                      key={star}
                      name={star <= item.rating ? 'star' : 'star-outline'}
                      size={14}
                      color={star <= item.rating ? '#FFD700' : COLORS.border}
                    />
                  ))}
                  <Text style={styles.reviewRatingText}> {item.rating}/5</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Text style={styles.reviewDate}>{formatDate(item.createdAt)}</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => deleteReview(item)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.reviewText}>{item.comment}</Text>
          </View>
        )}
      />
    </View>
  );

  // ─────────────────────────────────────────────
  // TAB: PAYMENTS
  // ─────────────────────────────────────────────
  const renderPayments = () => {
    const pending   = paymentOrders.filter(o => o.status === 'awaiting_confirmation');
    const completed = paymentOrders.filter(o => o.status === 'completed');
    const rejected  = paymentOrders.filter(o => o.status === 'rejected');

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.xl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Row */}
        <View style={styles.paymentSummaryRow}>
          {[
            { label: 'Pending',   value: pending.length,       color: WARNING_COLOR  },
            { label: 'Completed', value: completed.length,     color: COLORS.success },
            { label: 'Rejected',  value: rejected.length,      color: COLORS.error   },
            { label: 'Total',     value: paymentOrders.length, color: COLORS.primary },
          ].map((s, i) => (
            <View key={i} style={[styles.paymentSummaryCard, { borderColor: s.color + '40' }]}>
              <Text style={[styles.paymentSummaryValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.paymentSummaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Receiving Details */}
        <View style={styles.receivingDetailsCard}>
          <Text style={styles.receivingDetailsTitle}>🏦 Your Receiving Details</Text>
          <Text style={styles.receivingDetailsHint}>
            ℹ️ Move these to a config file — avoid hardcoding in production
          </Text>
          {[
            { label: 'Bank',     value: 'Scotiabank Jamaica'    },
            { label: 'Name',     value: 'Sherwayne Gooden'      },
            { label: 'Account', value: '••• ••• 2189'           }, // ✅ masked
            { label: 'Transit', value: '50765'                  },
            { label: 'Currency',value: 'JMD'                    },
            { label: 'PayPal',  value: 'renogooden@outlook.com' },
          ].map((item, i) => (
            <View key={i} style={styles.receivingRow}>
              <Text style={styles.receivingLabel}>{item.label}</Text>
              <Text style={styles.receivingValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Pending */}
        <Text style={styles.sectionTitle}>⏳ Awaiting Confirmation ({pending.length})</Text>
        {pending.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            message="All payments processed"
            subtitle="No pending bank transfers"
          />
        ) : (
          pending.map(order => (
            <View key={order.id} style={styles.paymentOrderCard}>
              <View style={styles.paymentOrderHeader}>
                <View style={styles.paymentOrderBadge}>
                  <Ionicons name="time-outline" size={14} color={WARNING_COLOR} />
                  <Text style={[styles.paymentOrderBadgeText, { color: WARNING_COLOR }]}>
                    Awaiting Confirmation
                  </Text>
                </View>
                <Text style={styles.paymentOrderDate}>{formatDate(order.createdAt)}</Text>
              </View>
              <View style={styles.paymentOrderDetails}>
                {[
                  { label: 'Plan',       value: `${order.planName} Plan`                      },
                  { label: 'Amount USD', value: `$${order.amount} USD`                         },
                  { label: 'Amount JMD', value: `J$${order.amountJMD?.toLocaleString() || 0}` },
                  { label: 'Method',     value: '🏦 Bank Transfer'                             },
                  { label: 'Order ID',   value: order.id.slice(0, 16) + '...'                 },
                ].map((item, i) => (
                  <View key={i} style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>{item.label}</Text>
                    <Text style={styles.paymentDetailValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.paymentOrderActions}>
                <TouchableOpacity
                  style={styles.activateBtn}
                  onPress={() => handleActivateBankTransfer(order)}
                  disabled={activatingOrder === order.id}
                  activeOpacity={0.8}
                >
                  {activatingOrder === order.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.activateBtnText}>Confirm & Activate</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleRejectPayment(order)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SIZES.md }]}>
              ✅ Completed ({completed.length})
            </Text>
            {completed.slice(0, 10).map(order => (
              <View key={order.id} style={[styles.paymentOrderCard, styles.paymentOrderCardCompleted]}>
                <View style={styles.paymentOrderHeader}>
                  <View style={[styles.paymentOrderBadge, { backgroundColor: COLORS.success + '15' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={[styles.paymentOrderBadgeText, { color: COLORS.success }]}>
                      {order.paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '💳 PayPal'}
                    </Text>
                  </View>
                  <Text style={styles.paymentOrderDate}>{formatDate(order.confirmedAt)}</Text>
                </View>
                <Text style={styles.completedOrderText}>
                  {order.planName} · ${order.amount} USD
                  {order.amountJMD ? ` · J$${order.amountJMD.toLocaleString()}` : ''}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Rejected */}
        {rejected.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SIZES.md }]}>
              ❌ Rejected ({rejected.length})
            </Text>
            {rejected.slice(0, 5).map(order => (
              <View key={order.id} style={[styles.paymentOrderCard, { borderColor: COLORS.error + '30' }]}>
                <View style={styles.paymentOrderHeader}>
                  <View style={[styles.paymentOrderBadge, { backgroundColor: COLORS.error + '15' }]}>
                    <Ionicons name="close-circle" size={14} color={COLORS.error} />
                    <Text style={[styles.paymentOrderBadgeText, { color: COLORS.error }]}>Rejected</Text>
                  </View>
                  <Text style={styles.paymentOrderDate}>{formatDate(order.rejectedAt)}</Text>
                </View>
                <Text style={styles.completedOrderText}>
                  {order.planName} · ${order.amount} USD
                </Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadPaymentOrders}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
          <Text style={styles.refreshBtnText}>Refresh Payments</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────
  // TAB: SUBSCRIPTION
  // ─────────────────────────────────────────────
  const renderSubscription = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.xl }]}
    >
      <Text style={styles.sectionTitle}>💎 Subscription Manager</Text>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.infoBannerText}>
          Manually upgrade or downgrade restaurant subscriptions after confirming payment.
        </Text>
      </View>

      {/* Plan Summary */}
      <View style={styles.planSummaryRow}>
        {Object.values(SUBSCRIPTION_PLANS).map(plan => {
          const count = restaurants.filter(
            r => (r.subscription?.plan || 'free_trial') === plan.id
          ).length;
          return (
            <View key={plan.id} style={[styles.planSummaryCard, { borderColor: plan.color + '40' }]}>
              <Text style={styles.planSummaryEmoji}>{plan.emoji}</Text>
              <Text style={[styles.planSummaryCount, { color: plan.color }]}>{count}</Text>
              <Text style={styles.planSummaryName}>{plan.name}</Text>
              <Text style={styles.planSummaryPrice}>
                {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
              </Text>
            </View>
          );
        })}
      </View>

      {restaurants.length === 0 ? (
        <EmptyState icon="restaurant-outline" message="No restaurants found" />
      ) : (
        restaurants.map(restaurant => {
          const currentPlanId  = restaurant.subscription?.plan || 'free_trial';
          const currentPlan    = SUBSCRIPTION_PLANS[currentPlanId];
          const expiresAt      = restaurant.subscription?.expiresAt;
          const payMethod      = restaurant.subscription?.paymentMethod;
          const isExpired      = expiresAt ? new Date(expiresAt) < new Date() : false;
          const isExpiringSoon = expiresAt
            ? new Date(expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && !isExpired
            : false;

          return (
            <View key={restaurant.id} style={styles.subCard}>
              <View style={styles.subCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subCardName}>{restaurant.name}</Text>
                  <Text style={styles.subCardLocation}>
                    📍 {restaurant.location?.city || 'No city'}
                  </Text>
                  {payMethod && (
                    <Text style={styles.subCardPayMethod}>
                      {payMethod === 'paypal'       ? '💳 Paid via PayPal'
                     : payMethod === 'bank_transfer' ? '🏦 Paid via Bank Transfer'
                     : ''}
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.currentPlanBadge,
                  { backgroundColor: currentPlan.color + '20', borderColor: currentPlan.color + '40' },
                ]}>
                  <Text style={[styles.currentPlanBadgeText, { color: currentPlan.color }]}>
                    {currentPlan.emoji} {currentPlan.name}
                  </Text>
                </View>
              </View>

              {/* Expiry Warnings */}
              {isExpired && (
                <View style={styles.expiryWarning}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                  <Text style={[styles.expiryWarningText, { color: COLORS.error }]}>
                    Expired on {new Date(expiresAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
              {isExpiringSoon && !isExpired && (
                <View style={[styles.expiryWarning, { backgroundColor: WARNING_COLOR + '15' }]}>
                  <Ionicons name="time-outline" size={14} color={WARNING_COLOR} />
                  <Text style={[styles.expiryWarningText, { color: WARNING_COLOR }]}>
                    Expires {new Date(expiresAt).toLocaleDateString()}
                  </Text>
                </View>
              )}

              {/* Plan Buttons */}
              <View style={styles.planBtnsRow}>
                {Object.values(SUBSCRIPTION_PLANS).map(plan => {
                  const isCurrent = currentPlanId === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.planChangeBtn,
                        { borderColor: isCurrent ? plan.color : COLORS.border },
                        isCurrent && { backgroundColor: plan.color + '15' },
                      ]}
                      onPress={() => !isCurrent && handleChangePlan(restaurant, plan.id)}
                      disabled={isCurrent || updatingPlan}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.planChangeBtnEmoji}>{plan.emoji}</Text>
                      <Text style={[
                        styles.planChangeBtnText,
                        isCurrent && { color: plan.color, fontWeight: '700' },
                      ]}>
                        {plan.name}
                      </Text>
                      {isCurrent && (
                        <Ionicons name="checkmark-circle" size={12} color={plan.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ─────────────────────────────────────────────
  // TAB: NOTIFY
  // ─────────────────────────────────────────────
  const renderNotify = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>📢 Broadcast Notification</Text>

        {/* Target */}
        <Text style={styles.fieldLabel}>Send To</Text>
        <View style={styles.targetRow}>
          {[
            { id: 'all',       label: 'Everyone',  count: users.length,                                              icon: 'people-outline'     },
            { id: 'customers', label: 'Customers', count: users.filter(u => u.role === 'customer').length,           icon: 'person-outline'     },
            { id: 'owners',    label: 'Owners',    count: users.filter(u => u.role === 'restaurant_owner').length,   icon: 'restaurant-outline' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.targetBtn, notifTarget === t.id && styles.targetBtnActive]}
              onPress={() => setNotifTarget(t.id)}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={notifTarget === t.id ? '#FFFFFF' : COLORS.textMuted}
              />
              <Text style={[styles.targetBtnText, notifTarget === t.id && styles.targetBtnTextActive]}>
                {t.label}
              </Text>
              <Text style={[
                styles.targetBtnCount,
                notifTarget === t.id && { color: 'rgba(255,255,255,0.8)' },
              ]}>
                {t.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.fieldLabel}>
          Title <Text style={{ color: COLORS.error }}>*</Text>
        </Text>
        <TextInput
          style={styles.notifInput}
          placeholder="e.g. 🎉 Special Offer Today!"
          placeholderTextColor={COLORS.textMuted}
          value={notifTitle}
          onChangeText={setNotifTitle}
          returnKeyType="next"
          maxLength={100}
        />
        <Text style={styles.charCount}>{notifTitle.length}/100</Text>

        {/* Message */}
        <Text style={styles.fieldLabel}>
          Message <Text style={{ color: COLORS.error }}>*</Text>
        </Text>
        <TextInput
          style={[styles.notifInput, styles.notifTextarea]}
          placeholder="Enter your notification message..."
          placeholderTextColor={COLORS.textMuted}
          value={notifBody}
          onChangeText={setNotifBody}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{notifBody.length}/500</Text>

        {/* Preview */}
        {(notifTitle.trim() || notifBody.trim()) && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>PREVIEW</Text>
            <View style={styles.previewNotif}>
              <View style={styles.previewNotifIcon}>
                <Ionicons name="notifications" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {notifTitle || 'Notification Title'}
                </Text>
                <Text style={styles.previewBody} numberOfLines={2}>
                  {notifBody || 'Notification message...'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Send */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && { opacity: 0.7 }]}
          onPress={handleSendNotification}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.notifStats}>
          {[
            { value: users.filter(u => u.expoPushToken).length, label: 'Push Enabled',  icon: 'phone-portrait-outline' },
            { value: users.length,                               label: 'Total Users',   icon: 'people-outline'         },
            {
              value: notifTarget === 'all'       ? users.length
                   : notifTarget === 'customers' ? users.filter(u => u.role === 'customer').length
                   : users.filter(u => u.role === 'restaurant_owner').length,
              label: 'Will Receive', icon: 'mail-outline',
            },
          ].map((s, i) => (
            <View key={i} style={styles.notifStatItem}>
              <Ionicons name={s.icon} size={18} color={COLORS.primary} />
              <Text style={styles.notifStatValue}>{s.value}</Text>
              <Text style={styles.notifStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
        <Text style={styles.loadingSubText}>Fetching restaurants, users & payments</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={[styles.adminHeader, { paddingTop: insets.top + SIZES.sm }]}>
        <View>
          <Text style={styles.adminHeaderTitle}>⚡ Admin Panel</Text>
          <Text style={styles.adminHeaderSubtitle}>
            What's Cooking · {restaurants.length} Restaurants
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerSignOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
              <Text style={styles.headerSignOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => {
          const isActive  = activeTab === tab.id;
          const showBadge = tab.id === 'payments' && stats.pendingPayments > 0;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
                {showBadge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{stats.pendingPayments}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <View style={styles.tabContent}>
        {activeTab === 'overview'     && renderOverview()}
        {activeTab === 'restaurants'  && renderRestaurants()}
        {activeTab === 'users'        && renderUsers()}
        {activeTab === 'reviews'      && renderReviews()}
        {activeTab === 'payments'     && renderPayments()}
        {activeTab === 'subscription' && renderSubscription()}
        {activeTab === 'notify'       && renderNotify()}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm },

  loadingText:    { fontSize: FONTS.lg, fontWeight: '600', color: COLORS.text, marginTop: SIZES.md },
  loadingSubText: { fontSize: FONTS.sm, color: COLORS.textMuted },

  // ── Header ────────────────────────────────
  adminHeader: {
    backgroundColor:   '#1A2332',
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.md,
  },
  adminHeaderTitle:    { fontSize: FONTS.xl, fontWeight: 'bold', color: '#FFFFFF'              },
  adminHeaderSubtitle: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2      },
  headerSignOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.error,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg,
  },
  headerSignOutText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: '700' },

  // ── Tab Bar ───────────────────────────────
  tabBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    maxHeight: 56,
  },
  tabBarContent: { paddingHorizontal: SIZES.sm, gap: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabBadge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  tabContent:   { flex: 1 },
  tabList:      { padding: SIZES.md, gap: SIZES.md },

  // ── Search ────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md, marginTop: SIZES.md, marginBottom: SIZES.xs,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    gap: SIZES.sm,
  },
  searchInput: { flex: 1, fontSize: FONTS.md, color: COLORS.text, padding: 0 },

  // ── Filter Chips ──────────────────────────
  filterChipsScroll:   { maxHeight: 44 },
  filterChipsContent:  {
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    gap: SIZES.sm, alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SIZES.md, paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  filterChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipDot:        { width: 6, height: 6, borderRadius: 3 },
  filterChipText:       { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Stats ─────────────────────────────────
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: SIZES.md, gap: SIZES.sm },
  statCard: {
    width: '47%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md,
    alignItems: 'center', gap: SIZES.xs, ...SHADOW,
  },
  statIcon:  { width: 48, height: 48, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: FONTS.xxl, fontWeight: 'bold' },
  statLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'center' },

  // ── Quick Actions ─────────────────────────
  quickActionsRow: { flexDirection: 'row', marginHorizontal: SIZES.md, marginBottom: SIZES.sm, gap: SIZES.sm },
  quickActionCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md,
    alignItems: 'center', gap: SIZES.xs,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW,
  },
  quickActionEmoji: { fontSize: 24 },
  quickActionLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },

  // ── Alert Banners ─────────────────────────
  alertBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WARNING_COLOR,
    marginHorizontal: SIZES.md, marginBottom: SIZES.sm,
    padding: SIZES.md, borderRadius: RADIUS.lg, gap: SIZES.sm,
  },
  alertBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  alertBannerTitle: { fontSize: FONTS.sm, fontWeight: 'bold', color: '#FFFFFF' },
  alertBannerSub:   { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // ── Sections ──────────────────────────────
  section: { padding: SIZES.md, gap: SIZES.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.xs },
  sectionTitle:  { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  sectionSeeAll: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },

  // ── Info Banner ───────────────────────────
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.md, padding: SIZES.md, marginBottom: SIZES.md,
    borderWidth: 1, borderColor: COLORS.primary + '20', gap: SIZES.sm,
  },
  infoBannerText: { flex: 1, fontSize: FONTS.sm, color: COLORS.textMuted, lineHeight: 20 },

  // ── List Cards ────────────────────────────
  listCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SIZES.md, gap: SIZES.sm, ...SHADOW },
  listCardBanned: { borderWidth: 1, borderColor: COLORS.error + '30', backgroundColor: COLORS.error + '05' },
  listCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardInfo:    { flex: 1, marginRight: SIZES.sm },
  listCardName:    { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  listCardSub:     { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  listCardBadges:  { flexDirection: 'row', gap: SIZES.xs, flexWrap: 'wrap', alignItems: 'flex-start' },
  listCardActions: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
  listCount:       { fontSize: FONTS.xs, color: COLORS.textMuted, marginBottom: SIZES.xs },

  // ── Inline Plan Badge ─────────────────────
  inlinePlanBadge: {
    alignSelf: 'flex-start', paddingHorizontal: SIZES.sm, paddingVertical: 3,
    borderRadius: RADIUS.round, marginTop: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  inlinePlanText: { fontSize: FONTS.xs, fontWeight: '700' },
  expiringText:   { fontSize: FONTS.xs, color: WARNING_COLOR },

  // ── User Avatar ───────────────────────────
  userAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flex: 1 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text },

  // ── Badges ────────────────────────────────
  badge:        { paddingHorizontal: SIZES.sm, paddingVertical: 3, borderRadius: RADIUS.round, backgroundColor: COLORS.border },
  badgeSuccess: { backgroundColor: COLORS.success + '15' },
  badgeError:   { backgroundColor: COLORS.error   + '15' },
  badgeWarning: { backgroundColor: WARNING_COLOR   + '15' },
  badgePrimary: { backgroundColor: COLORS.primary  + '15' },
  badgeText:    { fontSize: FONTS.xs, fontWeight: '700' },

  // ── Action Buttons ────────────────────────
  actionBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SIZES.sm, paddingVertical: 6, borderRadius: RADIUS.round },
  actionBtnSuccess: { backgroundColor: COLORS.success },
  actionBtnDanger:  { backgroundColor: COLORS.error   },
  actionBtnWarning: { backgroundColor: '#F39C12'      },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnText:    { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: '700' },

  // ── Reviews ───────────────────────────────
  reviewCard:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SIZES.md, gap: SIZES.xs, ...SHADOW },
  reviewHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUser:       { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  reviewRating:     { flexDirection: 'row', gap: 2, alignItems: 'center' },
  reviewRatingText: { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.text, marginLeft: 4 },
  reviewText:       { fontSize: FONTS.sm, color: COLORS.textLight, lineHeight: 20 },
  reviewDate:       { fontSize: FONTS.xs, color: COLORS.textMuted },

  // ── Payments ──────────────────────────────
  paymentSummaryRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  paymentSummaryCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.sm,
    alignItems: 'center', borderWidth: 1.5, ...SHADOW,
  },
  paymentSummaryValue: { fontSize: FONTS.xl, fontWeight: 'bold' },
  paymentSummaryLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },

  receivingDetailsCard: {
    backgroundColor: COLORS.primary + '06',
    borderRadius: RADIUS.lg, padding: SIZES.md, marginBottom: SIZES.md,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  receivingDetailsTitle: { fontSize: FONTS.md, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  receivingDetailsHint:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginBottom: SIZES.sm },
  receivingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  receivingLabel: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  receivingValue: { fontSize: FONTS.sm, color: COLORS.text,      fontWeight: '700' },

  paymentOrderCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SIZES.md, gap: SIZES.sm,
    borderWidth: 2, borderColor: WARNING_COLOR + '40', ...SHADOW,
  },
  paymentOrderCardCompleted: { borderColor: COLORS.success + '40' },
  paymentOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentOrderBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WARNING_COLOR + '15',
    paddingHorizontal: SIZES.sm, paddingVertical: 4,
    borderRadius: RADIUS.round, gap: 4,
  },
  paymentOrderBadgeText: { fontSize: FONTS.xs, fontWeight: '700' },
  paymentOrderDate:      { fontSize: FONTS.xs, color: COLORS.textMuted },
  paymentOrderDetails:   { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SIZES.sm, gap: 4 },
  paymentDetailRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  paymentDetailLabel:    { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '600', flex: 1 },
  paymentDetailValue:    { fontSize: FONTS.xs, color: COLORS.text,      fontWeight: '700', flex: 2, textAlign: 'right' },
  paymentOrderActions:   { flexDirection: 'row', gap: SIZES.sm },
  activateBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg, gap: SIZES.xs,
  },
  activateBtnText: { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: 'bold' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.error + '10', paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg, gap: SIZES.xs,
    borderWidth: 1, borderColor: COLORS.error + '30',
  },
  rejectBtnText:      { color: COLORS.error, fontSize: FONTS.sm, fontWeight: '600' },
  completedOrderText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary + '10', paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg, gap: SIZES.sm, marginTop: SIZES.sm,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  refreshBtnText: { color: COLORS.primary, fontSize: FONTS.md, fontWeight: '600' },

  // ── Subscription ──────────────────────────
  planSummaryRow:  { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  planSummaryCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md,
    alignItems: 'center', borderWidth: 1.5, ...SHADOW,
  },
  planSummaryEmoji: { fontSize: 22, marginBottom: 4 },
  planSummaryCount: { fontSize: FONTS.xl, fontWeight: 'bold' },
  planSummaryName:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  planSummaryPrice: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 1 },

  subCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SIZES.md, gap: SIZES.sm,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW,
  },
  subCardHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  subCardName:      { fontSize: FONTS.md, fontWeight: 'bold', color: COLORS.text },
  subCardLocation:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  subCardPayMethod: { fontSize: FONTS.xs, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  currentPlanBadge: { paddingHorizontal: SIZES.sm, paddingVertical: 4, borderRadius: RADIUS.round, borderWidth: 1 },
  currentPlanBadgeText: { fontSize: FONTS.xs, fontWeight: '700' },

  expiryWarning: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.xs,
    backgroundColor: COLORS.error + '10', padding: SIZES.sm, borderRadius: RADIUS.md,
  },
  expiryWarningText: { fontSize: FONTS.xs, fontWeight: '600' },

  planBtnsRow:   { flexDirection: 'row', gap: SIZES.sm },
  planChangeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SIZES.sm, borderRadius: RADIUS.md,
    borderWidth: 1.5, gap: 4, backgroundColor: COLORS.background,
  },
  planChangeBtnEmoji: { fontSize: 12 },
  planChangeBtnText:  { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },

  // ── Notify ────────────────────────────────
  fieldLabel: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text, marginBottom: SIZES.xs },
  targetRow:  { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  targetBtn: {
    flex: 1, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', gap: 4,
  },
  targetBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  targetBtnText:       { fontSize: FONTS.xs, color: COLORS.text,    fontWeight: '600' },
  targetBtnTextActive: { color: '#FFFFFF' },
  targetBtnCount:      { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },
  notifInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.md,
    fontSize: FONTS.md, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notifTextarea: { height: 100, textAlignVertical: 'top' },
  charCount:     { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'right', marginBottom: SIZES.sm },
  previewCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SIZES.md, marginVertical: SIZES.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  previewLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1, marginBottom: SIZES.sm },
  previewNotif: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  previewNotifIcon: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  previewTitle: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  previewBody:  { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 2 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm, backgroundColor: COLORS.primary,
    padding: SIZES.md, borderRadius: RADIUS.lg, marginTop: SIZES.sm, ...SHADOW,
  },
  sendBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: '700' },
  notifStats:  { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.lg },
  notifStatItem: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: SIZES.md,
    alignItems: 'center', gap: 4, ...SHADOW,
  },
  notifStatValue: { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.primary },
  notifStatLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'center' },

  // ── Sign Out ──────────────────────────────
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.error,
    marginHorizontal: SIZES.md, marginTop: SIZES.lg, marginBottom: SIZES.md,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg, gap: SIZES.sm, ...SHADOW,
  },
  signOutBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },

  // ── Empty State ───────────────────────────
  emptyState:     { alignItems: 'center', paddingVertical: SIZES.xl, gap: SIZES.sm },
  emptyStateIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm,
  },
  emptyText:    { fontSize: FONTS.md, color: COLORS.textMuted, fontWeight: '500' },
  emptySubText: { fontSize: FONTS.sm, color: COLORS.textMuted },
});