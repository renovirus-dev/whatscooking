// ============================================
// FILE: src/screens/admin/AdminDashboardScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, ActivityIndicator,
  Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where,
  getDocs, updateDoc, deleteDoc,
  doc, onSnapshot, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Tab config ───────────────────────────────
const TABS = [
  { id: 'overview',     label: 'Overview',     icon: 'grid'            },
  { id: 'restaurants',  label: 'Restaurants',  icon: 'restaurant'      },
  { id: 'users',        label: 'Users',        icon: 'people'          },
  { id: 'reviews',      label: 'Reviews',      icon: 'star'            },
  { id: 'notify',       label: 'Notify',       icon: 'notifications'   },
];

export default function AdminDashboardScreen({ navigation }) {
  const [activeTab, setActiveTab]       = useState('overview');
  const [restaurants, setRestaurants]   = useState([]);
  const [users, setUsers]               = useState([]);
  const [reviews, setReviews]           = useState([]);
  const [stats, setStats]               = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalUsers: 0,
    totalReviews: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading]           = useState(true);

  // Notification form
  const [notifTitle, setNotifTitle]     = useState('');
  const [notifBody, setNotifBody]       = useState('');
  const [notifTarget, setNotifTarget]   = useState('all');
  const [sending, setSending]           = useState(false);

  // ─── Load all data ───────────────────────
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

  // ─── Restaurant actions ──────────────────
  const toggleRestaurantActive = async (restaurant) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isActive:  !restaurant.isActive,
        updatedAt: serverTimestamp(),
      });
      await loadRestaurants();
      Alert.alert(
        '✅ Done',
        `${restaurant.name} is now ${!restaurant.isActive ? 'active' : 'inactive'}`
      );
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
      `Are you sure you want to delete ${restaurant.name}? This cannot be undone.`,
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
  const toggleUserRole = async (user, newRole) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        role:      newRole,
        updatedAt: serverTimestamp(),
      });
      await loadUsers();
      Alert.alert('✅ Done', `${user.firstName} is now ${newRole}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const banUser = async (user) => {
    Alert.alert(
      '⚠️ Ban User',
      `Ban ${user.firstName} ${user.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.id), {
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

  // ─── Send broadcast notification ──────────
  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }

    setSending(true);
    try {
      // Get target users
      let targetUsers = users;
      if (notifTarget === 'customers') {
        targetUsers = users.filter(u => u.role === 'customer');
      } else if (notifTarget === 'owners') {
        targetUsers = users.filter(u => u.role === 'restaurant_owner');
      }

      // Save notification for each user in Firestore
      await Promise.all(
        targetUsers.map(u =>
          fetch('https://exp.host/--/api/v2/push/send', {
            method:  'POST',
            headers: {
              Accept:         'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to:    u.expoPushToken,
              title: notifTitle.trim(),
              body:  notifBody.trim(),
              sound: 'default',
              data:  { type: 'broadcast' },
            }),
          }).catch(() => null) // Skip users without tokens
        )
      );

      setNotifTitle('');
      setNotifBody('');
      Alert.alert(
        '✅ Sent!',
        `Notification sent to ${targetUsers.length} users`
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setSending(false);
  };

  // ─── Render tabs ─────────────────────────
  const renderOverview = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {[
          {
            label: 'Total Restaurants',
            value: stats.totalRestaurants,
            icon:  'restaurant',
            color: COLORS.primary,
          },
          {
            label: 'Active',
            value: stats.activeRestaurants,
            icon:  'checkmark-circle',
            color: COLORS.success,
          },
          {
            label: 'Total Users',
            value: stats.totalUsers,
            icon:  'people',
            color: COLORS.secondary,
          },
          {
            label: 'Reviews',
            value: stats.totalReviews,
            icon:  'star',
            color: '#FFD700',
          },
          {
            label: 'Pending',
            value: stats.pendingApprovals,
            icon:  'time',
            color: COLORS.error,
          },
        ].map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[
              styles.statIcon,
              { backgroundColor: stat.color + '20' },
            ]}>
              <Ionicons
                name={stat.icon}
                size={24}
                color={stat.color}
              />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Pending Approvals */}
      {stats.pendingApprovals > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            ⏳ Pending Approvals
          </Text>
          {restaurants
            .filter(r => !r.isApproved)
            .map(r => (
              <View key={r.id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName}>{r.name}</Text>
                  <Text style={styles.pendingCity}>
                    {r.location?.city}
                  </Text>
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
                <Text style={styles.reviewRatingText}>
                  {r.rating}
                </Text>
              </View>
            </View>
            <Text style={styles.reviewText} numberOfLines={2}>
              {r.comment}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderRestaurants = () => (
    <FlatList
      data={restaurants}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabList}
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
              <View style={[
                styles.badge,
                item.isActive
                  ? styles.badgeSuccess
                  : styles.badgeError,
              ]}>
                <Text style={styles.badgeText}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              {!item.isApproved && (
                <View style={[styles.badge, styles.badgeWarning]}>
                  <Text style={styles.badgeText}>Pending</Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.listCardActions}>
            {!item.isApproved && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSuccess]}
                onPress={() => approveRestaurant(item)}
              >
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={COLORS.textWhite}
                />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.actionBtn,
                item.isActive
                  ? styles.actionBtnWarning
                  : styles.actionBtnSuccess,
              ]}
              onPress={() => toggleRestaurantActive(item)}
            >
              <Ionicons
                name={item.isActive ? 'pause' : 'play'}
                size={14}
                color={COLORS.textWhite}
              />
              <Text style={styles.actionBtnText}>
                {item.isActive ? 'Disable' : 'Enable'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => deleteRestaurant(item)}
            >
              <Ionicons
                name="trash"
                size={14}
                color={COLORS.textWhite}
              />
              <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );

  const renderUsers = () => (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabList}
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listCardInfo}>
              <Text style={styles.listCardName}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={styles.listCardSub}>{item.email}</Text>
            </View>
            <View style={[
              styles.badge,
              item.role === 'admin'
                ? styles.badgePrimary
                : item.role === 'restaurant_owner'
                ? styles.badgeWarning
                : styles.badgeSuccess,
            ]}>
              <Text style={styles.badgeText}>{item.role}</Text>
            </View>
          </View>

          {item.isBanned && (
            <View style={styles.bannedBanner}>
              <Ionicons
                name="ban"
                size={14}
                color={COLORS.error}
              />
              <Text style={styles.bannedText}>User is banned</Text>
            </View>
          )}

          <View style={styles.listCardActions}>
            {item.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() =>
                  toggleUserRole(
                    item,
                    item.role === 'restaurant_owner'
                      ? 'customer'
                      : 'restaurant_owner'
                  )
                }
              >
                <Ionicons
                  name="swap-horizontal"
                  size={14}
                  color={COLORS.textWhite}
                />
                <Text style={styles.actionBtnText}>
                  {item.role === 'restaurant_owner'
                    ? 'Make Customer'
                    : 'Make Owner'}
                </Text>
              </TouchableOpacity>
            )}

            {!item.isBanned && item.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => banUser(item)}
              >
                <Ionicons
                  name="ban"
                  size={14}
                  color={COLORS.textWhite}
                />
                <Text style={styles.actionBtnText}>Ban</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />
  );

  const renderReviews = () => (
    <FlatList
      data={reviews}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabList}
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listCardInfo}>
              <Text style={styles.listCardName}>{item.userName}</Text>
              <View style={styles.reviewRating}>
                {[1,2,3,4,5].map(star => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={12}
                    color={star <= item.rating ? '#FFD700' : COLORS.border}
                  />
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => deleteReview(item)}
            >
              <Ionicons
                name="trash"
                size={14}
                color={COLORS.textWhite}
              />
              <Text style={styles.actionBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.reviewText} numberOfLines={3}>
            {item.comment}
          </Text>
        </View>
      )}
    />
  );

  const renderNotify = () => (
    <ScrollView
      contentContainerStyle={styles.tabList}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>
        📢 Send Broadcast Notification
      </Text>

      {/* Target audience */}
      <Text style={styles.fieldLabel}>Send To</Text>
      <View style={styles.targetRow}>
        {[
          { id: 'all',       label: 'Everyone'  },
          { id: 'customers', label: 'Customers' },
          { id: 'owners',    label: 'Owners'    },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.targetBtn,
              notifTarget === t.id && styles.targetBtnActive,
            ]}
            onPress={() => setNotifTarget(t.id)}
          >
            <Text style={[
              styles.targetBtnText,
              notifTarget === t.id && styles.targetBtnTextActive,
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.fieldLabel}>Notification Title</Text>
      <TextInput
        style={styles.notifInput}
        placeholder="e.g. 🎉 Special Offer Today!"
        placeholderTextColor={COLORS.textMuted}
        value={notifTitle}
        onChangeText={setNotifTitle}
      />

      {/* Message */}
      <Text style={styles.fieldLabel}>Message</Text>
      <TextInput
        style={[styles.notifInput, styles.notifTextarea]}
        placeholder="Enter your notification message..."
        placeholderTextColor={COLORS.textMuted}
        value={notifBody}
        onChangeText={setNotifBody}
        multiline
        numberOfLines={4}
      />

      {/* Preview */}
      {(notifTitle || notifBody) && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <View style={styles.previewNotif}>
            <Ionicons
              name="notifications"
              size={20}
              color={COLORS.primary}
            />
            <View style={styles.previewContent}>
              <Text style={styles.previewTitle}>
                {notifTitle || 'Title'}
              </Text>
              <Text style={styles.previewBody} numberOfLines={2}>
                {notifBody || 'Message'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Send button */}
      <TouchableOpacity
        style={[
          styles.sendBtn,
          sending && styles.sendBtnDisabled,
        ]}
        onPress={handleSendNotification}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={COLORS.textWhite} />
        ) : (
          <>
            <Ionicons
              name="send"
              size={20}
              color={COLORS.textWhite}
            />
            <Text style={styles.sendBtnText}>
              Send Notification
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.notifStats}>
        <View style={styles.notifStatItem}>
          <Text style={styles.notifStatValue}>
            {users.filter(u => u.expoPushToken).length}
          </Text>
          <Text style={styles.notifStatLabel}>
            Users with push enabled
          </Text>
        </View>
        <View style={styles.notifStatItem}>
          <Text style={styles.notifStatValue}>{users.length}</Text>
          <Text style={styles.notifStatLabel}>Total users</Text>
        </View>
      </View>
    </ScrollView>
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

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={
                activeTab === tab.id
                  ? COLORS.primary
                  : COLORS.textMuted
              }
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'overview'    && renderOverview()}
        {activeTab === 'restaurants' && renderRestaurants()}
        {activeTab === 'users'       && renderUsers()}
        {activeTab === 'reviews'     && renderReviews()}
        {activeTab === 'notify'      && renderNotify()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab bar
  tabBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 56,
  },
  tabBarContent: {
    paddingHorizontal: SIZES.sm,
    gap: SIZES.xs,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  tabList: {
    padding: SIZES.md,
    gap: SIZES.md,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    alignItems: 'center',
    gap: SIZES.xs,
    ...SHADOW,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Section
  section: {
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },

  // Pending cards
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SIZES.md,
    ...SHADOW,
  },
  pendingInfo: { flex: 1 },
  pendingName: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  pendingCity: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
  },
  approveBtnText: {
    color: COLORS.textWhite,
    fontWeight: '700',
    fontSize: FONTS.sm,
  },

  // List cards
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listCardInfo:  { flex: 1 },
  listCardName: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  listCardSub: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  listCardBadges: {
    flexDirection: 'row',
    gap: SIZES.xs,
    flexWrap: 'wrap',
  },
  listCardActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    flexWrap: 'wrap',
  },

  // Badges
  badge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  badgeSuccess: { backgroundColor: COLORS.success + '20' },
  badgeError:   { backgroundColor: COLORS.error   + '20' },
  badgeWarning: { backgroundColor: '#FFA500'       + '20' },
  badgePrimary: { backgroundColor: COLORS.primary  + '20' },
  badgeText: {
    fontSize: FONTS.xs,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Action buttons
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },
  actionBtnSuccess: { backgroundColor: COLORS.success  },
  actionBtnDanger:  { backgroundColor: COLORS.error    },
  actionBtnWarning: { backgroundColor: '#FFA500'       },
  actionBtnPrimary: { backgroundColor: COLORS.primary  },
  actionBtnText: {
    color:      COLORS.textWhite,
    fontSize:   FONTS.xs,
    fontWeight: '700',
  },

  // Banned banner
  bannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    backgroundColor: COLORS.error + '15',
    padding: SIZES.sm,
    borderRadius: RADIUS.md,
  },
  bannedText: {
    fontSize: FONTS.sm,
    color: COLORS.error,
    fontWeight: '600',
  },

  // Review card
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SIZES.md,
    gap: SIZES.xs,
    ...SHADOW,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewRatingText: {
    fontSize: FONTS.xs,
    fontWeight: '700',
    color: COLORS.text,
  },
  reviewText: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    lineHeight: 20,
  },

  // Notification form
  fieldLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
    marginTop: SIZES.sm,
  },
  targetRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  targetBtn: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  targetBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  targetBtnText: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '600',
  },
  targetBtnTextActive: {
    color: COLORS.textWhite,
  },
  notifInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  notifTextarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: SIZES.sm,
    textTransform: 'uppercase',
  },
  previewNotif: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.sm,
  },
  previewContent: { flex: 1 },
  previewTitle: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewBody: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    marginTop: 2,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    marginTop: SIZES.sm,
    ...SHADOW,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: {
    color:      COLORS.textWhite,
    fontSize:   FONTS.lg,
    fontWeight: '700',
  },
  notifStats: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginTop: SIZES.lg,
  },
  notifStatItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SIZES.md,
    alignItems: 'center',
    ...SHADOW,
  },
  notifStatValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  notifStatLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});