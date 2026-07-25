// ============================================
// FILE: src/screens/user/NotificationsScreen.js
// ============================================
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Switch,
  Alert, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, updateDoc, deleteDoc,
  collection, query, where,
  getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db }               from '../../firebase/config';
import { useAuth }          from '../../hooks/useAuth';
import { useNotifications } from '../../context/NotificationContext';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Safe Color Fallbacks ─────────────────────
const WARNING_COLOR = COLORS.warning || '#F39C12';

// ─── Notification Type Config ─────────────────
const TYPE_CONFIG = {
  general:    {
    icon:  'notifications-outline',
    color: COLORS.primary,
    label: 'General',
  },
  promotion:  {
    icon:  'pricetag-outline',
    color: WARNING_COLOR,
    label: 'Promotion',
  },
  review:     {
    icon:  'star-outline',
    color: '#FFD700',
    label: 'Review',
  },
  order:      {
    icon:  'receipt-outline',
    color: COLORS.success,
    label: 'Order',
  },
  restaurant: {
    icon:  'restaurant-outline',
    color: COLORS.secondary,
    label: 'Restaurant',
  },
  system:     {
    icon:  'settings-outline',
    color: COLORS.textMuted,
    label: 'System',
  },
};

// ─── Filter Tabs ──────────────────────────────
const FILTER_TABS = [
  { id: 'all',    label: 'All'    },
  { id: 'unread', label: 'Unread' },
  { id: 'system', label: 'System' },
];

// ─── Time Formatter ───────────────────────────
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date  = timestamp.toDate?.() || new Date(timestamp);
    const now   = new Date();
    const diff  = now - date;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  } catch {
    return '';
  }
};

// ─────────────────────────────────────────────
// PREFERENCE ROW COMPONENT
// ─────────────────────────────────────────────
const PrefRow = ({
  icon, iconColor, label, desc,
  value, saving, onToggle, last,
}) => (
  <View style={[styles.prefRow, !last && styles.prefRowBorder]}>
    <View style={styles.prefInfo}>
      <View style={[
        styles.prefIconBox,
        { backgroundColor: (iconColor || COLORS.primary) + '15' },
      ]}>
        <Ionicons name={icon} size={18} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDesc}>{desc}</Text>
      </View>
    </View>
    {saving ? (
      <ActivityIndicator
        size="small"
        color={COLORS.primary}
        style={{ marginRight: 4 }}
      />
    ) : (
      <Switch
        value={!!value}
        onValueChange={onToggle}
        trackColor={{
          false: COLORS.border,
          true:  COLORS.primary + '80',
        }}
        thumbColor={value ? COLORS.primary : '#f4f3f4'}
        ios_backgroundColor={COLORS.border}
      />
    )}
  </View>
);

// ─────────────────────────────────────────────
// NOTIFICATION CARD COMPONENT
// ─────────────────────────────────────────────
const NotificationCard = ({ item, onPress, onDelete }) => {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;

  return (
    <TouchableOpacity
      style={[
        styles.notifCard,
        !item.isRead && styles.notifCardUnread,
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onDelete(item)}
      activeOpacity={0.8}
      delayLongPress={500}
    >
      {/* Icon */}
      <View style={[
        styles.iconBox,
        { backgroundColor: config.color + '20' },
      ]}>
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>

      {/* Content */}
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text style={styles.notifTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifTime}>
            {formatTime(item.createdAt)}
          </Text>
        </View>

        <Text style={styles.notifBody} numberOfLines={2}>
          {item.body}
        </Text>

        {/* Type Badge */}
        {item.type && item.type !== 'general' && (
          <View style={[
            styles.typeBadge,
            { backgroundColor: config.color + '15' },
          ]}>
            <Text style={[styles.typeBadgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        )}
      </View>

      {/* Unread dot */}
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const insets            = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Filter State ──────────────────────────
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing]     = useState(false);

  // ── Preference State ──────────────────────
  // ✅ Initialized from userProfile with useEffect
  // so it updates when userProfile loads
  const [prefs, setPrefs] = useState({
    pushEnabled: true,
    menuUpdates: true,
    promotions:  false,
  });
  const [savingKey, setSavingKey] = useState(null);

  // ✅ Update prefs when userProfile loads/changes
  useEffect(() => {
    if (userProfile?.notifications) {
      setPrefs({
        pushEnabled: userProfile.notifications.pushEnabled ?? true,
        menuUpdates: userProfile.notifications.menuUpdates ?? true,
        promotions:  userProfile.notifications.promotions  ?? false,
      });
    }
  }, [userProfile?.notifications]);

  // ─────────────────────────────────────────
  // FILTERED NOTIFICATIONS
  // ✅ Memoized
  // ─────────────────────────────────────────
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter(n => !n.isRead);
      case 'system':
        return notifications.filter(n => n.type === 'system');
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // NotificationContext updates via Firestore listener
    setTimeout(() => {
      if (isMounted.current) setRefreshing(false);
    }, 1000);
  }, []);

  // ─────────────────────────────────────────
  // TOGGLE PREFERENCE
  // ─────────────────────────────────────────
  const handleTogglePref = useCallback(async (key) => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to manage notifications');
      return;
    }

    const newValue = !prefs[key];
    if (isMounted.current) {
      setPrefs(prev => ({ ...prev, [key]: newValue }));
      setSavingKey(key);
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`notifications.${key}`]: newValue,
      });
    } catch (err) {
      console.error('Toggle pref error:', err);
      if (isMounted.current) {
        setPrefs(prev => ({ ...prev, [key]: !newValue }));
        Alert.alert('Error', 'Could not save preference. Please try again.');
      }
    } finally {
      if (isMounted.current) setSavingKey(null);
    }
  }, [user, prefs]);

  // ─────────────────────────────────────────
  // NOTIFICATION TAP
  // ✅ Navigate based on notification type
  // ─────────────────────────────────────────
  const handleNotificationPress = useCallback(async (item) => {
    // Mark as read
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    // ✅ Navigate based on type and data
    try {
      const data = item.data || {};

      switch (item.type) {
        case 'restaurant':
          if (data.restaurantId) {
            navigation.navigate('RestaurantDetail', {
              restaurantId: data.restaurantId,
              name:         data.restaurantName || 'Restaurant',
            });
          }
          break;

        case 'review':
          if (data.restaurantId) {
            navigation.navigate('RestaurantDetail', {
              restaurantId: data.restaurantId,
            });
          }
          break;

        case 'order':
          // Navigate to order screen if you have one
          break;

        case 'system':
          // Check for subscription_activated type
          if (
            data.type === 'subscription_activated' ||
            data.type === 'subscription_update'
          ) {
            navigation.navigate('OwnerDashboard');
          }
          break;

        default:
          // General notifications - no navigation
          break;
      }
    } catch (err) {
      console.error('Notification navigation error:', err);
    }
  }, [markAsRead, navigation]);

  // ─────────────────────────────────────────
  // DELETE SINGLE NOTIFICATION
  // ─────────────────────────────────────────
  const handleDeleteNotification = useCallback((item) => {
    Alert.alert(
      'Delete Notification',
      'Remove this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'notifications', item.id));
            } catch (err) {
              console.error('Delete notification error:', err);
              Alert.alert('Error', 'Could not delete notification');
            }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────
  // CLEAR ALL NOTIFICATIONS
  // ─────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    if (!user?.uid || notifications.length === 0) return;

    Alert.alert(
      'Clear All Notifications',
      `Delete all ${notifications.length} notification${
        notifications.length !== 1 ? 's' : ''
      }? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // ✅ Delete all notifications for this user
              const q = query(
                collection(db, 'notifications'),
                where('userId', '==', user.uid)
              );
              const snap = await getDocs(q);
              await Promise.allSettled(
                snap.docs.map(d => deleteDoc(d.ref))
              );
            } catch (err) {
              console.error('Clear all error:', err);
              Alert.alert('Error', 'Could not clear notifications');
            }
          },
        },
      ]
    );
  }, [user, notifications.length]);

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom + SIZES.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Settings Card ────────────── */}
            <View style={styles.settingsCard}>
              <View style={styles.settingsHeader}>
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.settingsTitle}>
                  Notification Settings
                </Text>
              </View>

              <PrefRow
                icon="phone-portrait-outline"
                iconColor={COLORS.primary}
                label="Push Notifications"
                desc="Receive alerts on your device"
                value={prefs.pushEnabled}
                saving={savingKey === 'pushEnabled'}
                onToggle={() => handleTogglePref('pushEnabled')}
              />
              <PrefRow
                icon="restaurant-outline"
                iconColor={COLORS.success}
                label="Daily Menu Updates"
                desc="When restaurants post today's menu"
                value={prefs.menuUpdates}
                saving={savingKey === 'menuUpdates'}
                onToggle={() => handleTogglePref('menuUpdates')}
              />
              <PrefRow
                icon="pricetag-outline"
                iconColor={WARNING_COLOR}
                label="Promotions & Deals"
                desc="Special offers from restaurants"
                value={prefs.promotions}
                saving={savingKey === 'promotions'}
                onToggle={() => handleTogglePref('promotions')}
                last
              />
            </View>

            {/* ── Filter Tabs ───────────────── */}
            <View style={styles.filterTabs}>
              {FILTER_TABS.map(tab => {
                const count = tab.id === 'unread'
                  ? unreadCount
                  : tab.id === 'system'
                  ? notifications.filter(n => n.type === 'system').length
                  : notifications.length;

                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.filterTab,
                      activeFilter === tab.id && styles.filterTabActive,
                    ]}
                    onPress={() => setActiveFilter(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.filterTabText,
                      activeFilter === tab.id && styles.filterTabTextActive,
                    ]}>
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <View style={[
                        styles.filterTabBadge,
                        activeFilter === tab.id && {
                          backgroundColor: '#FFFFFF',
                        },
                      ]}>
                        <Text style={[
                          styles.filterTabBadgeText,
                          activeFilter === tab.id && {
                            color: COLORS.primary,
                          },
                        ]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Unread Bar ────────────────── */}
            {unreadCount > 0 && activeFilter !== 'system' && (
              <View style={styles.unreadBar}>
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount} unread
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={markAllAsRead}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Section Header ────────────── */}
            {filteredNotifications.length > 0 && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>
                  {activeFilter === 'all'    ? 'RECENT'
                   : activeFilter === 'unread' ? 'UNREAD'
                   : 'SYSTEM'}
                </Text>
                {notifications.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClearAll}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        }

        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            onPress={handleNotificationPress}
            onDelete={handleDeleteNotification}
          />
        )}

        ItemSeparatorComponent={() => <View style={styles.separator} />}

        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBg}>
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={COLORS.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'unread'
                ? 'All caught up!'
                : activeFilter === 'system'
                ? 'No system notifications'
                : 'No notifications yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'unread'
                ? 'You have no unread notifications'
                : activeFilter === 'system'
                ? 'System alerts will appear here'
                : 'We\'ll notify you when restaurants update their menu or you have new activity'}
            </Text>
            {activeFilter !== 'all' && (
              <TouchableOpacity
                style={styles.showAllBtn}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={styles.showAllBtnText}>Show All</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ✅ Long press hint - shown briefly */}
      {filteredNotifications.length > 0 && (
        <View style={[
          styles.hintBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : SIZES.sm },
        ]}>
          <Ionicons
            name="hand-left-outline"
            size={12}
            color={COLORS.textMuted}
          />
          <Text style={styles.hintText}>
            Long press to delete a notification
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            SIZES.sm,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Settings Card ─────────────────────────
  settingsCard: {
    backgroundColor: COLORS.surface,
    margin:          SIZES.md,
    marginBottom:    SIZES.sm,
    borderRadius:    RADIUS.xl,
    padding:         SIZES.md,
    ...SHADOW,
  },
  settingsHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    marginBottom:      SIZES.md,
    paddingBottom:     SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingsTitle: {
    fontSize:   FONTS.lg,
    fontWeight: '700',
    color:      COLORS.text,
  },

  // ── Pref Rows ─────────────────────────────
  prefRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.sm,
    gap:            SIZES.sm,
    minHeight:      56,
  },
  prefRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  prefInfo: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
    flex:          1,
  },
  prefIconBox: {
    width:          36,
    height:         36,
    borderRadius:   RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
  },
  prefLabel: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text  },
  prefDesc:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2  },

  // ── Filter Tabs ───────────────────────────
  filterTabs: {
    flexDirection:     'row',
    marginHorizontal:  SIZES.md,
    marginBottom:      SIZES.sm,
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.lg,
    padding:           4,
    gap:               4,
    ...SHADOW,
  },
  filterTab: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: SIZES.sm,
    borderRadius:    RADIUS.md,
    gap:             6,
  },
  filterTabActive:     { backgroundColor: COLORS.primary },
  filterTabText:       { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: '#FFFFFF' },
  filterTabBadge: {
    backgroundColor:   COLORS.primary + '20',
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      8,
    minWidth:          18,
    alignItems:        'center',
  },
  filterTabBadgeText: {
    fontSize:   9,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },

  // ── Unread Bar ────────────────────────────
  unreadBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    backgroundColor:   COLORS.primary + '08',
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       COLORS.primary + '20',
    marginBottom:      SIZES.xs,
  },
  unreadBadge: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: '700' },
  markAllText:     { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },

  // ── Section Row ───────────────────────────
  sectionRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
  },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         COLORS.textMuted,
    letterSpacing: 1.2,
  },
  clearAllText: {
    fontSize:   FONTS.sm,
    color:      COLORS.error,
    fontWeight: '600',
  },

  // ── Notification Card ─────────────────────
  notifCard: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius:     RADIUS.lg,
    padding:          SIZES.md,
    gap:              SIZES.md,
    ...SHADOW,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  iconBox: {
    width:          44,
    height:         44,
    borderRadius:   RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
  },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            SIZES.sm,
  },
  notifTitle: {
    flex:       1,
    fontSize:   FONTS.md,
    fontWeight: '700',
    color:      COLORS.text,
  },
  notifTime:  { fontSize: FONTS.xs, color: COLORS.textMuted },
  notifBody: {
    fontSize:   FONTS.sm,
    color:      COLORS.textLight,
    lineHeight: 20,
  },
  typeBadge: {
    alignSelf:         'flex-start',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    marginTop:         4,
  },
  typeBadgeText: { fontSize: FONTS.xs, fontWeight: '600' },
  unreadDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop:    6,
  },

  // ── Separator ─────────────────────────────
  separator: { height: SIZES.sm },

  // ── Empty State ───────────────────────────
  empty: {
    alignItems:        'center',
    paddingVertical:   SIZES.xl,
    paddingHorizontal: SIZES.xl,
    gap:               SIZES.md,
    marginTop:         SIZES.lg,
  },
  emptyIconBg: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: COLORS.border + '50',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SIZES.sm,
  },
  emptyTitle:   { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  showAllBtn: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.sm,
  },
  showAllBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  // ── Hint Bar ──────────────────────────────
  hintBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SIZES.xs,
    paddingTop:        SIZES.xs,
    backgroundColor:   COLORS.surface,
    borderTopWidth:    1,
    borderTopColor:    COLORS.border,
  },
  hintText: { fontSize: FONTS.xs, color: COLORS.textMuted },
});