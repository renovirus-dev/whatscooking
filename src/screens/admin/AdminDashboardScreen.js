// ============================================
// FILE: src/screens/admin/AdminDashboardScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, ActivityIndicator,
  Alert, TextInput, KeyboardAvoidingView, Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  doc,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db }      from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import {
  sendPushNotificationBatch,
} from '../../utils/sendPushNotification';

// ─── Subscription plans ───────────────────────
const SUBSCRIPTION_PLANS = {
  free_trial: {
    id:       'free_trial',
    name:     'Free Trial',
    emoji:    '🆓',
    price:    0,
    color:    COLORS.textMuted,
    features: ['Basic listing', '10 menu items', 'No analytics'],
  },
  basic: {
    id:       'basic',
    name:     'Basic',
    emoji:    '⭐',
    price:    9.99,
    color:    COLORS.info || '#3498DB',
    features: ['Unlimited menu items', 'Basic analytics', 'Priority listing'],
  },
  premium: {
    id:       'premium',
    name:     'Premium',
    emoji:    '👑',
    price:    24.99,
    color:    COLORS.primary,
    features: ['Everything in Basic', 'Full analytics', 'Push notifications', 'Featured listing'],
  },
};

// ─── Tab config ───────────────────────────────
const TABS = [
  { id: 'overview',     label: 'Overview',     icon: 'grid'          },
  { id: 'restaurants',  label: 'Restaurants',  icon: 'restaurant'    },
  { id: 'users',        label: 'Users',        icon: 'people'        },
  { id: 'reviews',      label: 'Reviews',      icon: 'star'          },
  { id: 'subscription', label: 'Plans',        icon: 'diamond'       },
  { id: 'notify',       label: 'Notify',       icon: 'notifications' },
];

export default function AdminDashboardScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { logout }  = useAuth();

  const [activeTab, setActiveTab]     = useState('overview');
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers]             = useState([]);
  const [reviews, setReviews]         = useState([]);
  const [stats, setStats]             = useState({
    totalRestaurants:  0,
    activeRestaurants: 0,
    totalUsers:        0,
    totalReviews:      0,
    pendingApprovals:  0,
  });
  const [loading, setLoading]       = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // ✅ Subscription modal state
  const [showSubModal, setShowSubModal]         = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [updatingPlan, setUpdatingPlan]         = useState(false);

  // Notification form
  const [notifTitle, setNotifTitle]   = useState('');
  const [notifBody, setNotifBody]     = useState('');
  const [notifTarget, setNotifTarget] = useState('all');
  const [sending, setSending]         = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRestaurants(),
        loadUsers(),
        loadReviews(),
      ]);
    } catch (err) {
      console.error('loadDashboardData error:', err);
    }
    setLoading(false);
  };

  const loadRestaurants = async () => {
    const snap = await getDocs(collection(db, 'restaurants'));
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
    const snap = await getDocs(collection(db, 'users'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setUsers(data);
    setStats(prev => ({ ...prev, totalUsers: data.length }));
  };

  const loadReviews = async () => {
    const snap = await getDocs(
      query(
        collection(db, 'reviews'),
        orderBy('createdAt', 'desc'),
        limit(100),
      )
    );
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setReviews(data);
    setStats(prev => ({ ...prev, totalReviews: data.length }));
  };

  // ─── Sign out ─────────────────────────────
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setSigningOut(true);
              const result = await logout();
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to sign out');
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to sign out.');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  // ─── Restaurant actions ──────────────────
  const toggleRestaurantActive = async (restaurant) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isActive:  !restaurant.isActive,
        updatedAt: serverTimestamp(),
      });
      await loadRestaurants();
      Alert.alert('✅ Done', `${restaurant.name} is now ${!restaurant.isActive ? 'active' : 'inactive'}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const approveRestaurant = async (restaurant) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isApproved: true,
        isActive:   true,
        updatedAt:  serverTimestamp(),
      });
      await loadRestaurants();
      Alert.alert('✅ Approved', `${restaurant.name} is now live!`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const deleteRestaurant = async (restaurant) => {
    Alert.alert(
      '⚠️ Delete Restaurant',
      `Are you sure you want to delete ${restaurant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'restaurants', restaurant.id));
              await loadRestaurants();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // ─── User actions ─────────────────────────
  const toggleUserRole = async (userData, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userData.id), {
        role:      newRole,
        updatedAt: serverTimestamp(),
      });
      await loadUsers();
      Alert.alert('✅ Done', `${userData.firstName} is now ${newRole}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const banUser = async (userData) => {
    Alert.alert(
      '⚠️ Ban User',
      `Ban ${userData.firstName} ${userData.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userData.id), {
                isBanned:  true,
                updatedAt: serverTimestamp(),
              });
              await loadUsers();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // ─── Review actions ───────────────────────
  const deleteReview = async (review) => {
    Alert.alert(
      '⚠️ Delete Review',
      'Delete this review permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'reviews', review.id));
              await loadReviews();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // ✅ Subscription management
  const handleOpenSubModal = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setShowSubModal(true);
  };

  const handleChangePlan = async (restaurant, newPlanId) => {
    const plan    = SUBSCRIPTION_PLANS[newPlanId];
    const current = restaurant.subscription?.plan || 'free_trial';

    if (current === newPlanId) {
      Alert.alert('Already on this plan', `${restaurant.name} is already on ${plan.name}`);
      return;
    }

    const action = newPlanId === 'free_trial'
      ? 'downgrade to Free Trial'
      : newPlanId === 'basic'
      ? current === 'premium' ? 'downgrade to Basic' : 'upgrade to Basic'
      : 'upgrade to Premium';

    Alert.alert(
      `${plan.emoji} Change Plan`,
      `${action} for ${restaurant.name}?\n\nThis takes effect immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingPlan(true);
            try {
              // ✅ Calculate expiry — 1 month from now
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 1);

              await updateDoc(
                doc(db, 'restaurants', restaurant.id),
                {
                  'subscription.plan':      newPlanId,
                  'subscription.status':    newPlanId === 'free_trial' ? 'trial' : 'active',
                  'subscription.updatedAt': serverTimestamp(),
                  'subscription.expiresAt': newPlanId !== 'free_trial'
                    ? expiresAt.toISOString()
                    : null,
                  'subscription.updatedByAdmin': true,
                  'subscription.price':     plan.price,
                  updatedAt:                serverTimestamp(),
                }
              );

              // ✅ Send notification to restaurant owner
              const owner = users.find(u => u.id === restaurant.ownerId);
              if (owner?.expoPushToken) {
                await sendPushNotificationBatch({
                  tokens: [owner.expoPushToken],
                  title:  `${plan.emoji} Plan Updated!`,
                  body:   `Your restaurant "${restaurant.name}" has been upgraded to ${plan.name} plan.`,
                  data:   { type: 'subscription_update' },
                });
              }

              // ✅ Save notification in Firestore
              if (owner) {
                await addDoc(collection(db, 'notifications'), {
                  userId:    owner.id,
                  title:     `${plan.emoji} Subscription Updated`,
                  body:      `Your "${restaurant.name}" plan has been changed to ${plan.name}.`,
                  type:      'system',
                  isRead:    false,
                  createdAt: serverTimestamp(),
                });
              }

              await loadRestaurants();
              setShowSubModal(false);

              Alert.alert(
                '✅ Plan Updated!',
                `${restaurant.name} is now on ${plan.name} plan.\n\nOwner has been notified.`
              );

            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setUpdatingPlan(false);
            }
          },
        },
      ]
    );
  };

  // ─── Send notification ────────────────────
  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }
    setSending(true);
    try {
      let targetUsers = users;
      if (notifTarget === 'customers') {
        targetUsers = users.filter(u => u.role === 'customer');
      } else if (notifTarget === 'owners') {
        targetUsers = users.filter(u => u.role === 'restaurant_owner');
      }
      const title = notifTitle.trim();
      const body  = notifBody.trim();
      const firestoreResults = await Promise.allSettled(
        targetUsers.map(u =>
          addDoc(collection(db, 'notifications'), {
            userId: u.id, title, body,
            type: 'general', isRead: false,
            createdAt: serverTimestamp(),
            data: { type: 'broadcast' },
          })
        )
      );
      const tokens = targetUsers.map(u => u.expoPushToken).filter(Boolean);
      let pushResult = { sent: 0 };
      if (tokens.length > 0) {
        pushResult = await sendPushNotificationBatch({ tokens, title, body, data: { type: 'broadcast' } });
      }
      setNotifTitle('');
      setNotifBody('');
      Alert.alert('✅ Sent!', `📬 ${targetUsers.length} users notified\n📱 ${pushResult.sent} devices reached`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setSending(false);
  };

  // ─── Tab: Overview ────────────────────────
  const renderOverview = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.md }}
    >
      <View style={styles.statsGrid}>
        {[
          { label: 'Total Restaurants', value: stats.totalRestaurants, icon: 'restaurant', color: COLORS.primary  },
          { label: 'Active',            value: stats.activeRestaurants, icon: 'checkmark-circle', color: COLORS.success },
          { label: 'Total Users',       value: stats.totalUsers,        icon: 'people',     color: COLORS.secondary },
          { label: 'Reviews',           value: stats.totalReviews,      icon: 'star',       color: '#FFD700'       },
          { label: 'Pending',           value: stats.pendingApprovals,  icon: 'time',       color: COLORS.error    },
        ].map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Image Manager button */}
      <TouchableOpacity
        style={styles.imageManagerBtn}
        onPress={() => navigation.navigate('ImageDownload')}
        activeOpacity={0.8}
      >
        <View style={styles.imageManagerIcon}>
          <Text style={{ fontSize: 24 }}>🖼️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.imageManagerTitle}>Food Image Manager</Text>
          <Text style={styles.imageManagerDesc}>Download all cuisine photos to Firebase Storage</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Pending Approvals */}
      {stats.pendingApprovals > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏳ Pending Approvals</Text>
          {restaurants.filter(r => !r.isApproved).map(r => (
            <View key={r.id} style={styles.pendingCard}>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{r.name}</Text>
                <Text style={styles.pendingCity}>{r.location?.city}</Text>
              </View>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approveRestaurant(r)}
              >
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Recent Reviews */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Recent Reviews</Text>
        {reviews.slice(0, 5).map(r => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>{r.userName}</Text>
              <View style={styles.reviewRating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.reviewRatingText}>{r.rating}</Text>
              </View>
            </View>
            <Text style={styles.reviewText} numberOfLines={2}>{r.comment}</Text>
          </View>
        ))}
        {reviews.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
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

  // ─── Tab: Restaurants ─────────────────────
  const renderRestaurants = () => (
    <FlatList
      data={restaurants}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No restaurants found</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listCardInfo}>
              <Text style={styles.listCardName}>{item.name}</Text>
              <Text style={styles.listCardSub}>
                {item.location?.city} • {item.priceRange}
              </Text>
            </View>
            <View style={styles.listCardBadges}>
              <View style={[styles.badge, item.isActive ? styles.badgeSuccess : styles.badgeError]}>
                <Text style={styles.badgeText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
              {!item.isApproved && (
                <View style={[styles.badge, styles.badgeWarning]}>
                  <Text style={styles.badgeText}>Pending</Text>
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
                <Ionicons name="checkmark" size={14} color={COLORS.textWhite} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, item.isActive ? styles.actionBtnWarning : styles.actionBtnSuccess]}
              onPress={() => toggleRestaurantActive(item)}
            >
              <Ionicons name={item.isActive ? 'pause' : 'play'} size={14} color={COLORS.textWhite} />
              <Text style={styles.actionBtnText}>{item.isActive ? 'Disable' : 'Enable'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => deleteRestaurant(item)}
            >
              <Ionicons name="trash" size={14} color={COLORS.textWhite} />
              <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );

  // ─── Tab: Users ───────────────────────────
  const renderUsers = () => (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No users found</Text></View>}
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listCardInfo}>
              <Text style={styles.listCardName}>{item.firstName} {item.lastName}</Text>
              <Text style={styles.listCardSub}>{item.email}</Text>
            </View>
            <View style={[
              styles.badge,
              item.role === 'admin' ? styles.badgePrimary
                : item.role === 'restaurant_owner' ? styles.badgeWarning
                : styles.badgeSuccess,
            ]}>
              <Text style={styles.badgeText}>{item.role}</Text>
            </View>
          </View>
          {item.isBanned && (
            <View style={styles.bannedBanner}>
              <Ionicons name="ban" size={14} color={COLORS.error} />
              <Text style={styles.bannedText}>User is banned</Text>
            </View>
          )}
          <View style={styles.listCardActions}>
            {item.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => toggleUserRole(item, item.role === 'restaurant_owner' ? 'customer' : 'restaurant_owner')}
              >
                <Ionicons name="swap-horizontal" size={14} color={COLORS.textWhite} />
                <Text style={styles.actionBtnText}>
                  {item.role === 'restaurant_owner' ? 'Make Customer' : 'Make Owner'}
                </Text>
              </TouchableOpacity>
            )}
            {!item.isBanned && item.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => banUser(item)}
              >
                <Ionicons name="ban" size={14} color={COLORS.textWhite} />
                <Text style={styles.actionBtnText}>Ban</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />
  );

  // ─── Tab: Reviews ─────────────────────────
  const renderReviews = () => (
    <FlatList
      data={reviews}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.md }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No reviews found</Text></View>}
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listCardInfo}>
              <Text style={styles.listCardName}>{item.userName}</Text>
              <View style={styles.reviewRating}>
                {[1,2,3,4,5].map(star => (
                  <Ionicons key={star} name="star" size={12} color={star <= item.rating ? '#FFD700' : COLORS.border} />
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => deleteReview(item)}
            >
              <Ionicons name="trash" size={14} color={COLORS.textWhite} />
              <Text style={styles.actionBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.reviewText} numberOfLines={3}>{item.comment}</Text>
        </View>
      )}
    />
  );

  // ✅ Tab: Subscription Management
  const renderSubscription = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.tabList,
        { paddingBottom: insets.bottom + SIZES.xl },
      ]}
    >
      <Text style={styles.sectionTitle}>
        💎 Subscription Manager
      </Text>
      <Text style={styles.subSectionDesc}>
        Manually upgrade or downgrade restaurant subscriptions.
        Use this when payment is received outside the app.
      </Text>

      {/* Plan summary cards */}
      <View style={styles.planSummaryRow}>
        {Object.values(SUBSCRIPTION_PLANS).map(plan => {
          const count = restaurants.filter(
            r => (r.subscription?.plan || 'free_trial') === plan.id
          ).length;
          return (
            <View key={plan.id} style={[
              styles.planSummaryCard,
              { borderColor: plan.color + '40' },
            ]}>
              <Text style={styles.planSummaryEmoji}>{plan.emoji}</Text>
              <Text style={[styles.planSummaryCount, { color: plan.color }]}>
                {count}
              </Text>
              <Text style={styles.planSummaryName}>{plan.name}</Text>
            </View>
          );
        })}
      </View>

      {/* Restaurant list with subscription controls */}
      {restaurants.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No restaurants found</Text>
        </View>
      ) : (
        restaurants.map(restaurant => {
          const currentPlanId = restaurant.subscription?.plan || 'free_trial';
          const currentPlan   = SUBSCRIPTION_PLANS[currentPlanId];
          const expiresAt     = restaurant.subscription?.expiresAt;

          return (
            <View key={restaurant.id} style={styles.subCard}>
              {/* Restaurant info */}
              <View style={styles.subCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subCardName}>
                    {restaurant.name}
                  </Text>
                  <Text style={styles.subCardLocation}>
                    📍 {restaurant.location?.city || 'No city'}
                  </Text>
                </View>

                {/* Current plan badge */}
                <View style={[
                  styles.currentPlanBadge,
                  { backgroundColor: currentPlan.color + '20',
                    borderColor: currentPlan.color + '40' },
                ]}>
                  <Text style={[
                    styles.currentPlanBadgeText,
                    { color: currentPlan.color },
                  ]}>
                    {currentPlan.emoji} {currentPlan.name}
                  </Text>
                </View>
              </View>

              {/* Expiry info */}
              {expiresAt && currentPlanId !== 'free_trial' && (
                <Text style={styles.subExpiryText}>
                  📅 Expires: {new Date(expiresAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              )}

              {/* Plan change buttons */}
              <View style={styles.planBtnsRow}>
                {Object.values(SUBSCRIPTION_PLANS).map(plan => {
                  const isCurrent = currentPlanId === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.planChangeBtn,
                        isCurrent && styles.planChangeBtnActive,
                        { borderColor: isCurrent ? plan.color : COLORS.border },
                        isCurrent && { backgroundColor: plan.color + '15' },
                      ]}
                      onPress={() => !isCurrent && handleChangePlan(restaurant, plan.id)}
                      disabled={isCurrent}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.planChangeBtnEmoji}>
                        {plan.emoji}
                      </Text>
                      <Text style={[
                        styles.planChangeBtnText,
                        isCurrent && { color: plan.color, fontWeight: '700' },
                      ]}>
                        {plan.name}
                      </Text>
                      {isCurrent && (
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={plan.color}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick action buttons */}
              <View style={styles.subQuickActions}>
                {currentPlanId !== 'premium' && (
                  <TouchableOpacity
                    style={styles.upgradeBtn}
                    onPress={() => handleChangePlan(restaurant, 'premium')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-up" size={14} color="#FFFFFF" />
                    <Text style={styles.upgradeBtnText}>
                      Upgrade to Premium
                    </Text>
                  </TouchableOpacity>
                )}
                {currentPlanId === 'premium' && (
                  <TouchableOpacity
                    style={styles.downgradeBtn}
                    onPress={() => handleChangePlan(restaurant, 'basic')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-down" size={14} color={COLORS.textMuted} />
                    <Text style={styles.downgradeBtnText}>
                      Downgrade to Basic
                    </Text>
                  </TouchableOpacity>
                )}
                {currentPlanId !== 'free_trial' && (
                  <TouchableOpacity
                    style={styles.cancelSubBtn}
                    onPress={() => handleChangePlan(restaurant, 'free_trial')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={14} color={COLORS.error} />
                    <Text style={styles.cancelSubBtnText}>
                      Cancel to Free
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Tab: Notify ──────────────────────────
  const renderNotify = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.tabList, { paddingBottom: insets.bottom + SIZES.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>📢 Send Broadcast Notification</Text>

        <Text style={styles.fieldLabel}>Send To</Text>
        <View style={styles.targetRow}>
          {[
            { id: 'all',       label: 'Everyone'  },
            { id: 'customers', label: 'Customers' },
            { id: 'owners',    label: 'Owners'    },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.targetBtn, notifTarget === t.id && styles.targetBtnActive]}
              onPress={() => setNotifTarget(t.id)}
            >
              <Text style={[styles.targetBtnText, notifTarget === t.id && styles.targetBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Notification Title</Text>
        <TextInput
          style={styles.notifInput}
          placeholder="e.g. 🎉 Special Offer Today!"
          placeholderTextColor={COLORS.textMuted}
          value={notifTitle}
          onChangeText={setNotifTitle}
          returnKeyType="next"
        />

        <Text style={styles.fieldLabel}>Message</Text>
        <TextInput
          style={[styles.notifInput, styles.notifTextarea]}
          placeholder="Enter your notification message..."
          placeholderTextColor={COLORS.textMuted}
          value={notifBody}
          onChangeText={setNotifBody}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="done"
        />

        {(notifTitle.trim() || notifBody.trim()) && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>PREVIEW</Text>
            <View style={styles.previewRow}>
              <Ionicons name="notifications" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle}>{notifTitle || 'Title'}</Text>
                <Text style={styles.previewBody} numberOfLines={2}>{notifBody || 'Message'}</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSendNotification}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.textWhite} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={COLORS.textWhite} />
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.notifStats}>
          <View style={styles.notifStatItem}>
            <Text style={styles.notifStatValue}>
              {users.filter(u => u.expoPushToken).length}
            </Text>
            <Text style={styles.notifStatLabel}>Push enabled</Text>
          </View>
          <View style={styles.notifStatItem}>
            <Text style={styles.notifStatValue}>{users.length}</Text>
            <Text style={styles.notifStatLabel}>Total users</Text>
          </View>
          <View style={styles.notifStatItem}>
            <Text style={styles.notifStatValue}>
              {notifTarget === 'all' ? users.length
                : notifTarget === 'customers' ? users.filter(u => u.role === 'customer').length
                : users.filter(u => u.role === 'restaurant_owner').length}
            </Text>
            <Text style={styles.notifStatLabel}>Will receive</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textMuted, marginTop: SIZES.md }}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Admin header */}
      <View style={[styles.adminHeader, { paddingTop: insets.top + SIZES.sm }]}>
        <View>
          <Text style={styles.adminHeaderTitle}>⚡ Admin Panel</Text>
          <Text style={styles.adminHeaderSubtitle}>What's Cooking</Text>
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
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.headerSignOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Horizontal tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'overview'     && renderOverview()}
        {activeTab === 'restaurants'  && renderRestaurants()}
        {activeTab === 'users'        && renderUsers()}
        {activeTab === 'reviews'      && renderReviews()}
        {activeTab === 'subscription' && renderSubscription()}
        {activeTab === 'notify'       && renderNotify()}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  adminHeader: {
    backgroundColor: '#2C3E50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.md,
  },
  adminHeaderTitle:    { fontSize: FONTS.xl, fontWeight: 'bold', color: '#FFFFFF' },
  adminHeaderSubtitle: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerSignOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.error,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg,
  },
  headerSignOutText: { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: '700' },
  tabBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    maxHeight: 56,
  },
  tabBarContent: { paddingHorizontal: SIZES.sm, gap: SIZES.xs, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round, borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabContent:    { flex: 1 },
  tabList:       { padding: SIZES.md, gap: SIZES.md },

  // Stats
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: SIZES.md, gap: SIZES.sm,
  },
  statCard: {
    width: '47%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md,
    alignItems: 'center', gap: SIZES.xs, ...SHADOW,
  },
  statIcon:  { width: 48, height: 48, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'center' },

  // Image manager button
  imageManagerBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm, padding: SIZES.md, borderRadius: RADIUS.lg,
    gap: SIZES.md, borderWidth: 1.5, borderColor: COLORS.primary + '40', ...SHADOW,
  },
  imageManagerIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  imageManagerTitle: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  imageManagerDesc:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },

  // Sections
  section:      { padding: SIZES.md, gap: SIZES.sm },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text, marginBottom: SIZES.xs },

  // Subscription styles
  subSectionDesc: {
    fontSize: FONTS.sm, color: COLORS.textMuted,
    lineHeight: 20, marginBottom: SIZES.md,
    backgroundColor: COLORS.primary + '08',
    padding: SIZES.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  planSummaryRow: {
    flexDirection: 'row', gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  planSummaryCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md,
    alignItems: 'center', borderWidth: 1.5, ...SHADOW,
  },
  planSummaryEmoji: { fontSize: 24, marginBottom: 4 },
  planSummaryCount: { fontSize: FONTS.xxl, fontWeight: 'bold' },
  planSummaryName:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },

  subCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SIZES.md,
    gap: SIZES.sm, ...SHADOW,
    borderWidth: 1, borderColor: COLORS.border,
  },
  subCardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm,
  },
  subCardName:     { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text },
  subCardLocation: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  currentPlanBadge: {
    paddingHorizontal: SIZES.sm, paddingVertical: 4,
    borderRadius: RADIUS.round, borderWidth: 1,
  },
  currentPlanBadgeText: { fontSize: FONTS.xs, fontWeight: '700' },
  subExpiryText: { fontSize: FONTS.xs, color: COLORS.textMuted },

  planBtnsRow: {
    flexDirection: 'row', gap: SIZES.sm,
    marginTop: SIZES.xs,
  },
  planChangeBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SIZES.sm, borderRadius: RADIUS.md,
    borderWidth: 1.5, gap: 4,
    backgroundColor: COLORS.background,
  },
  planChangeBtnActive: {},
  planChangeBtnEmoji:  { fontSize: 14 },
  planChangeBtnText:   { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },

  subQuickActions: {
    flexDirection: 'row', gap: SIZES.sm,
    flexWrap: 'wrap', marginTop: SIZES.xs,
  },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: '700' },
  downgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.border,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
  },
  downgradeBtnText: { color: COLORS.textMuted, fontSize: FONTS.xs, fontWeight: '600' },
  cancelSubBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.error + '30',
  },
  cancelSubBtnText: { color: COLORS.error, fontSize: FONTS.xs, fontWeight: '600' },

  // Pending cards
  pendingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SIZES.md, ...SHADOW,
  },
  pendingInfo:     { flex: 1 },
  pendingName:     { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  pendingCity:     { fontSize: FONTS.sm, color: COLORS.textMuted },
  approveBtn:      { backgroundColor: COLORS.success, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, borderRadius: RADIUS.round },
  approveBtnText:  { color: COLORS.textWhite, fontWeight: '700', fontSize: FONTS.sm },

  // List cards
  listCard:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SIZES.md, gap: SIZES.sm, ...SHADOW },
  listCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardInfo:    { flex: 1 },
  listCardName:    { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  listCardSub:     { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  listCardBadges:  { flexDirection: 'row', gap: SIZES.xs, flexWrap: 'wrap' },
  listCardActions: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },

  // Badges
  badge:        { paddingHorizontal: SIZES.sm, paddingVertical: 3, borderRadius: RADIUS.round },
  badgeSuccess: { backgroundColor: COLORS.success + '20' },
  badgeError:   { backgroundColor: COLORS.error   + '20' },
  badgeWarning: { backgroundColor: '#FFA500'       + '20' },
  badgePrimary: { backgroundColor: COLORS.primary  + '20' },
  badgeText:    { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.text },

  // Action buttons
  actionBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SIZES.sm, paddingVertical: 6, borderRadius: RADIUS.round },
  actionBtnSuccess: { backgroundColor: COLORS.success },
  actionBtnDanger:  { backgroundColor: COLORS.error   },
  actionBtnWarning: { backgroundColor: '#FFA500'      },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnText:    { color: COLORS.textWhite, fontSize: FONTS.xs, fontWeight: '700' },

  // Banned banner
  bannedBanner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.error + '15', padding: SIZES.sm, borderRadius: RADIUS.md },
  bannedText:   { fontSize: FONTS.sm, color: COLORS.error, fontWeight: '600' },

  // Review card
  reviewCard:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SIZES.md, gap: SIZES.xs, ...SHADOW },
  reviewHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUser:      { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  reviewRating:    { flexDirection: 'row', gap: 2 },
  reviewRatingText:{ fontSize: FONTS.xs, fontWeight: '700', color: COLORS.text },
  reviewText:      { fontSize: FONTS.sm, color: COLORS.textLight, lineHeight: 20 },

  // Notification form
  fieldLabel:     { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text, marginBottom: SIZES.xs, marginTop: SIZES.sm },
  targetRow:      { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  targetBtn:      { flex: 1, paddingVertical: SIZES.sm, borderRadius: RADIUS.round, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  targetBtnActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  targetBtnText:  { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600' },
  targetBtnTextActive: { color: COLORS.textWhite },
  notifInput:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SIZES.md, paddingVertical: SIZES.md, fontSize: FONTS.md, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: SIZES.sm },
  notifTextarea:  { height: 100, textAlignVertical: 'top' },
  previewCard:    { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SIZES.md, marginBottom: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
  previewLabel:   { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1, marginBottom: SIZES.sm },
  previewRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  previewTitle:   { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  previewBody:    { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 2 },
  sendBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.primary, padding: SIZES.md, borderRadius: RADIUS.lg, marginTop: SIZES.sm, ...SHADOW },
  sendBtnDisabled:{ opacity: 0.7 },
  sendBtnText:    { color: COLORS.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
  notifStats:     { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.lg },
  notifStatItem:  { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SIZES.md, alignItems: 'center', ...SHADOW },
  notifStatValue: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.primary },
  notifStatLabel: { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },

  // Sign out
  signOutBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, marginHorizontal: SIZES.md, marginTop: SIZES.lg, marginBottom: SIZES.md, paddingVertical: SIZES.md, borderRadius: RADIUS.lg, gap: SIZES.sm, ...SHADOW },
  signOutBtnDisabled: { opacity: 0.7 },
  signOutBtnText:     { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: SIZES.xl },
  emptyText:  { fontSize: FONTS.md, color: COLORS.textMuted },
});