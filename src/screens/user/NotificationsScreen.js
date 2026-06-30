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
  general:    { icon: 'notifications', color: COLORS.primary              },
  promotion:  { icon: 'pricetag',      color: COLORS.warning || '#F39C12' },
  review:     { icon: 'star',          color: '#FFD700'                    },
  order:      { icon: 'receipt',       color: COLORS.success              },
  restaurant: { icon: 'restaurant',    color: COLORS.secondary            },
  system:     { icon: 'settings',      color: COLORS.textMuted            },
};

// ─── Time formatter ───────────────────────────
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
      month: 'short',
      day:   'numeric',
    });
  } catch {
    return '';
  }
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  // ✅ Get user safely
  const { user, userProfile } = useAuth();

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // ✅ Safe defaults — fall back to false if undefined
  const [prefs, setPrefs] = useState({
    pushEnabled: userProfile?.notifications?.pushEnabled ?? true,
    menuUpdates: userProfile?.notifications?.menuUpdates ?? true,
    promotions:  userProfile?.notifications?.promotions  ?? false,
  });

  // ✅ Track which pref is currently saving
  const [savingKey, setSavingKey] = useState(null);

  // ── Toggle preference ─────────────────────
  const handleTogglePref = async (key) => {
    // ✅ Guard — do nothing if no user
    if (!user?.uid) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to manage notifications'
      );
      return;
    }

    // ✅ Optimistic update — update UI immediately
    const newValue = !prefs[key];
    const newPrefs = { ...prefs, [key]: newValue };
    setPrefs(newPrefs);
    setSavingKey(key);

    try {
      // ✅ Only save this specific key — not the whole object
      // Prevents overwriting other notification settings
      await updateDoc(doc(db, 'users', user.uid), {
        [`notifications.${key}`]: newValue,
      });
    } catch (err) {
      console.error('Toggle pref error:', err);
      // ✅ Revert on failure
      setPrefs(prev => ({ ...prev, [key]: !newValue }));
      Alert.alert(
        'Error',
        'Could not save preference. Please try again.'
      );
    } finally {
      setSavingKey(null);
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
          <Ionicons
            name={config.icon}
            size={22}
            color={config.color}
          />
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

          {/* Type badge */}
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

        ListHeaderComponent={
          <View>

            {/* ── Settings card ─────────────── */}
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

              {/* Push notifications */}
              <PrefRow
                icon="phone-portrait-outline"
                iconColor={COLORS.primary}
                label="Push Notifications"
                desc="Receive alerts on your device"
                value={prefs.pushEnabled}
                saving={savingKey === 'pushEnabled'}
                onToggle={() => handleTogglePref('pushEnabled')}
              />

              <View style={styles.prefDivider} />

              {/* Menu updates */}
              <PrefRow
                icon="restaurant-outline"
                iconColor={COLORS.success}
                label="Daily Menu Updates"
                desc="When restaurants post today's menu"
                value={prefs.menuUpdates}
                saving={savingKey === 'menuUpdates'}
                onToggle={() => handleTogglePref('menuUpdates')}
              />

              <View style={styles.prefDivider} />

              {/* Promotions */}
              <PrefRow
                icon="pricetag-outline"
                iconColor={COLORS.warning || '#F39C12'}
                label="Promotions & Deals"
                desc="Special offers from restaurants"
                value={prefs.promotions}
                saving={savingKey === 'promotions'}
                onToggle={() => handleTogglePref('promotions')}
              />
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

            {/* Section label */}
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
              We'll notify you when restaurants update
              their menu or you have new activity
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Preference Row Component ─────────────────
// ✅ Extracted to its own component to prevent
// re-render crashes when toggling
function PrefRow({
  icon,
  iconColor,
  label,
  desc,
  value,
  saving,
  onToggle,
}) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefInfo}>
        <View style={[
          styles.prefIconBox,
          { backgroundColor: iconColor + '15' },
        ]}>
          <Ionicons
            name={icon}
            size={18}
            color={iconColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.prefLabel}>{label}</Text>
          <Text style={styles.prefDesc}>{desc}</Text>
        </View>
      </View>

      {/* ✅ Show spinner while saving, switch when done */}
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
          // ✅ ios_backgroundColor prevents grey bg on iOS
          ios_backgroundColor={COLORS.border}
        />
      )}
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
    minHeight: 56,
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