// ============================================
// FILE: src/screens/user/NotificationsScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc }    from 'firebase/firestore';
import { db }                from '../../firebase/config';
import { useAuth }           from '../../hooks/useAuth';
import { useNotifications }  from '../../hooks/useNotifications';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Notification type config ─────────────────
const TYPE_CONFIG = {
  general:    { icon: 'notifications', color: COLORS.primary   },
  promotion:  { icon: 'pricetag',      color: COLORS.accent    },
  review:     { icon: 'star',          color: '#FFD700'         },
  order:      { icon: 'receipt',       color: COLORS.success   },
  restaurant: { icon: 'restaurant',    color: COLORS.secondary },
  system:     { icon: 'settings',      color: COLORS.textMuted },
};

// ─── Time formatter ───────────────────────────
const formatTime = (timestamp) => {
  if (!timestamp) return '';
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
    month: 'short',
    day:   'numeric',
  });
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // ✅ Notification preferences pulled from userProfile
  const [prefs, setPrefs] = useState({
    pushEnabled: userProfile?.notifications?.pushEnabled ?? true,
    menuUpdates: userProfile?.notifications?.menuUpdates ?? true,
    promotions:  userProfile?.notifications?.promotions  ?? false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── Toggle a preference and save to Firestore ──
  const handleTogglePref = async (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);

    try {
      setSavingPrefs(true);
      await updateDoc(doc(db, 'users', user.uid), {
        notifications: newPrefs,
      });
    } catch (err) {
      // Revert on error
      setPrefs(prefs);
      Alert.alert('Error', 'Could not save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ── Notification card ─────────────────────
  const renderItem = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;

    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          !item.isRead && styles.notifCardUnread,
        ]}
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.8}
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
          {/* ✅ Show type badge */}
          {item.type && item.type !== 'general' && (
            <View style={[
              styles.typeBadge,
              { backgroundColor: config.color + '15' },
            ]}>
              <Text style={[
                styles.typeBadgeText,
                { color: config.color },
              ]}>
                {item.type.charAt(0).toUpperCase() +
                  item.type.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Unread dot */}
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  // ── Loading ───────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          Loading notifications...
        </Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom + SIZES.xl,
        }}

        // ✅ Header — settings + unread bar
        ListHeaderComponent={
          <View>

            {/* ── Notification Settings ─────── */}
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
                {savingPrefs && (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={{ marginLeft: 'auto' }}
                  />
                )}
              </View>

              {/* Push notifications toggle */}
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <View style={styles.prefIconBox}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>
                      Push Notifications
                    </Text>
                    <Text style={styles.prefDesc}>
                      Receive alerts on your device
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prefs.pushEnabled}
                  onValueChange={() => handleTogglePref('pushEnabled')}
                  trackColor={{
                    false: COLORS.border,
                    true:  COLORS.primary + '80',
                  }}
                  thumbColor={
                    prefs.pushEnabled ? COLORS.primary : '#f4f3f4'
                  }
                />
              </View>

              <View style={styles.prefDivider} />

              {/* Menu updates toggle */}
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <View style={[
                    styles.prefIconBox,
                    { backgroundColor: COLORS.success + '15' },
                  ]}>
                    <Ionicons
                      name="restaurant-outline"
                      size={18}
                      color={COLORS.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>
                      Daily Menu Updates
                    </Text>
                    <Text style={styles.prefDesc}>
                      When restaurants post today's menu
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prefs.menuUpdates}
                  onValueChange={() => handleTogglePref('menuUpdates')}
                  trackColor={{
                    false: COLORS.border,
                    true:  COLORS.success + '80',
                  }}
                  thumbColor={
                    prefs.menuUpdates ? COLORS.success : '#f4f3f4'
                  }
                />
              </View>

              <View style={styles.prefDivider} />

              {/* Promotions toggle */}
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <View style={[
                    styles.prefIconBox,
                    { backgroundColor: COLORS.accent + '15' },
                  ]}>
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color={COLORS.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>
                      Promotions & Deals
                    </Text>
                    <Text style={styles.prefDesc}>
                      Special offers from restaurants
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prefs.promotions}
                  onValueChange={() => handleTogglePref('promotions')}
                  trackColor={{
                    false: COLORS.border,
                    true:  COLORS.accent + '80',
                  }}
                  thumbColor={
                    prefs.promotions ? COLORS.accent : '#f4f3f4'
                  }
                />
              </View>
            </View>

            {/* ── Unread bar ────────────────── */}
            {unreadCount > 0 && (
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
                  <Text style={styles.markAllText}>
                    Mark all as read
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Section label ─────────────── */}
            {notifications.length > 0 && (
              <Text style={styles.sectionLabel}>
                RECENT NOTIFICATIONS
              </Text>
            )}
          </View>
        }

        renderItem={renderItem}

        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}

        // ✅ Empty state
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
              No notifications yet
            </Text>
            <Text style={styles.emptySubtext}>
              We'll notify you when restaurants update their
              menu or you have new activity
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Loading ──────────────────────────────
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    marginTop: SIZES.xs,
  },

  // ── Settings card ────────────────────────
  settingsCard: {
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    marginBottom: SIZES.sm,
    borderRadius: RADIUS.xl,
    padding: SIZES.md,
    ...SHADOW,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
    paddingBottom: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingsTitle: {
    fontSize: FONTS.lg,
    fontWeight: '700',
    color: COLORS.text,
  },

  // ── Preference rows ──────────────────────
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.sm,
    gap: SIZES.sm,
  },
  prefInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    flex: 1,
  },
  prefIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  prefDesc: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  prefDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.xs,
  },

  // ── Unread bar ───────────────────────────
  unreadBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.primary + '08',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.primary + '20',
    marginBottom: SIZES.xs,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.xs,
    fontWeight: '700',
  },
  markAllText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── Section label ────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },

  // ── Notification card ────────────────────
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    gap: SIZES.md,
    ...SHADOW,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  notifTitle: {
    flex: 1,
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  notifTime: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  notifBody: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: FONTS.xs,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },

  // ── Separator ────────────────────────────
  separator: {
    height: SIZES.sm,
  },

  // ── Empty state ──────────────────────────
  empty: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    paddingHorizontal: SIZES.xl,
    gap: SIZES.md,
    marginTop: SIZES.lg,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.border + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  emptyTitle: {
    fontSize: FONTS.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});