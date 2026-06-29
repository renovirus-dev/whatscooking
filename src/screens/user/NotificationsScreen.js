// ============================================
// FILE: src/screens/user/NotificationsScreen.js
// ============================================
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/useNotifications';
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
  return date.toLocaleDateString();
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // ── Loading ───────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        {
          // ✅ Respect system bars on loading state
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

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
        </View>

        {/* Unread dot */}
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  // ── Main render ───────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Unread header ───────────────────── */}
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.unreadText}>
            {unreadCount} unread
          </Text>
          <TouchableOpacity
            onPress={markAllAsRead}
            activeOpacity={0.7}
            // ✅ Larger tap target
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Notifications list ───────────────── */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          {
            // ✅ Last notification card clears Android nav bar
            paddingBottom: insets.bottom + SIZES.xl,
          },
        ]}
        ListEmptyComponent={
          <View style={[
            styles.empty,
            // ✅ Centre vertically accounting for header
            { paddingBottom: insets.bottom + SIZES.xl },
          ]}>
            <Ionicons
              name="notifications-off-outline"
              size={64}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyTitle}>
              No notifications yet
            </Text>
            <Text style={styles.emptySubtext}>
              We'll notify you about promotions and updates
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
  // paddingTop/Bottom applied dynamically via insets
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

  // ── Unread header ────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  unreadText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  markAllText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── List ─────────────────────────────────
  // ✅ paddingBottom set dynamically via insets
  list: {
    padding: SIZES.md,
    gap: SIZES.sm,
    flexGrow: 1,
  },

  // ── Notification card ────────────────────
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    gap: SIZES.md,
    ...SHADOW,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },

  // ── Empty state ──────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SIZES.md,
  },
  emptyTitle: {
    fontSize: FONTS.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SIZES.xl,
  },
});