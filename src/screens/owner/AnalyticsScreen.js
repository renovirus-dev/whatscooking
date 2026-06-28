// ============================================
// FILE: src/screens/owner/AnalyticsScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where,
  getDocs, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function AnalyticsScreen({ route }) {
  const { restaurant } = route.params;

  const [stats, setStats]     = useState(null);
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('week');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get restaurant analytics fields
      const analytics = restaurant.analytics || {};

      setStats({
        totalViews:         analytics.totalViews        || 0,
        weeklyViews:        analytics.weeklyViews       || 0,
        monthlyViews:       analytics.monthlyViews      || 0,
        totalCalls:         analytics.totalCalls        || 0,
        totalWhatsApp:      analytics.totalWhatsApp     || 0,
        totalDirections:    analytics.totalDirections   || 0,
        totalWebsiteClicks: analytics.totalWebsiteClicks|| 0,
        totalTimeSpent:     analytics.totalTimeSpent    || 0,
        totalSessions:      analytics.totalSessions     || 0,
        avgTimeSpent: analytics.totalSessions > 0
          ? Math.round(
              analytics.totalTimeSpent / analytics.totalSessions
            )
          : 0,
      });

      // Get recent events
      const eventsQuery = query(
        collection(db, 'analyticsEvents'),
        where('restaurantId', '==', restaurant.id),
        limit(100)
      );
      const snap = await getDocs(eventsQuery);
      const eventsData = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort by timestamp in memory
      eventsData.sort((a, b) => {
        const dateA = a.timestamp?.toDate?.() || new Date(0);
        const dateB = b.timestamp?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setEvents(eventsData);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived stats from events ─────────────
  const guestViews = events.filter(
    e => e.type === 'restaurant_view' && e.actorType === 'guest'
  ).length;

  const userViews = events.filter(
    e => e.type === 'restaurant_view' && e.actorType === 'user'
  ).length;

  const callEvents = events.filter(
    e => e.type === 'action_call'
  );

  const whatsappEvents = events.filter(
    e => e.type === 'action_whatsapp'
  );

  // Conversion rate = (calls + whatsapp) / views
  const totalContactAttempts =
    callEvents.length + whatsappEvents.length;
  const conversionRate = stats?.totalViews > 0
    ? ((totalContactAttempts / stats.totalViews) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Analytics</Text>
        <Text style={styles.headerSubtitle}>
          {restaurant.name}
        </Text>
      </View>

      {/* ── Conversion highlight ───────────── */}
      <View style={styles.conversionCard}>
        <Text style={styles.conversionRate}>{conversionRate}%</Text>
        <Text style={styles.conversionLabel}>Conversion Rate</Text>
        <Text style={styles.conversionDesc}>
          {totalContactAttempts} contact attempts from{' '}
          {stats?.totalViews || 0} views
        </Text>
      </View>

      {/* ── Views breakdown ────────────────── */}
      <Text style={styles.sectionTitle}>👁️ Views</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="eye"
          label="Total Views"
          value={stats?.totalViews || 0}
          color={COLORS.primary}
        />
        <StatCard
          icon="trending-up"
          label="This Week"
          value={stats?.weeklyViews || 0}
          color={COLORS.info}
        />
        <StatCard
          icon="person-outline"
          label="Guest Views"
          value={guestViews}
          color={COLORS.warning}
          subtitle="Not logged in"
        />
        <StatCard
          icon="person"
          label="User Views"
          value={userViews}
          color={COLORS.success}
          subtitle="Logged in users"
        />
      </View>

      {/* ── Actions breakdown ──────────────── */}
      <Text style={styles.sectionTitle}>📞 Contact Actions</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="call"
          label="Phone Calls"
          value={stats?.totalCalls || 0}
          color={COLORS.success}
        />
        <StatCard
          icon="logo-whatsapp"
          label="WhatsApp"
          value={stats?.totalWhatsApp || 0}
          color="#25D366"
        />
        <StatCard
          icon="navigate"
          label="Directions"
          value={stats?.totalDirections || 0}
          color={COLORS.info}
        />
        <StatCard
          icon="globe"
          label="Website Clicks"
          value={stats?.totalWebsiteClicks || 0}
          color={COLORS.secondary}
        />
      </View>

      {/* ── Engagement ─────────────────────── */}
      <Text style={styles.sectionTitle}>⏱️ Engagement</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="time"
          label="Avg Time Spent"
          value={`${stats?.avgTimeSpent || 0}s`}
          color={COLORS.accent}
          subtitle="Per session"
        />
        <StatCard
          icon="repeat"
          label="Total Sessions"
          value={stats?.totalSessions || 0}
          color={COLORS.primary}
        />
      </View>

      {/* ── Recent Activity ────────────────── */}
      <Text style={styles.sectionTitle}>🕐 Recent Activity</Text>
      <View style={styles.activityList}>
        {events.slice(0, 20).map(event => (
          <ActivityRow key={event.id} event={event} />
        ))}
        {events.length === 0 && (
          <View style={styles.emptyActivity}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={styles.emptyText}>
              No activity yet
            </Text>
            <Text style={styles.emptySubtext}>
              Analytics will appear as customers visit
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── Stat Card Component ──────────────────────
function StatCard({ icon, label, value, color, subtitle }) {
  return (
    <View style={styles.statCard}>
      <View style={[
        styles.statIcon,
        { backgroundColor: color + '20' },
      ]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtitle && (
        <Text style={styles.statSubtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

// ─── Activity Row Component ───────────────────
function ActivityRow({ event }) {
  const getEventInfo = (type) => {
    const map = {
      restaurant_view: { icon: 'eye',          label: 'Viewed restaurant', color: COLORS.info     },
      action_call:     { icon: 'call',          label: 'Tapped Call',       color: COLORS.success  },
      action_whatsapp: { icon: 'logo-whatsapp', label: 'Opened WhatsApp',   color: '#25D366'       },
      action_directions:{ icon: 'navigate',     label: 'Got Directions',    color: COLORS.primary  },
      action_website:  { icon: 'globe',         label: 'Visited Website',   color: COLORS.secondary},
      menu_item_view:  { icon: 'restaurant',    label: 'Viewed Menu Item',  color: COLORS.warning  },
      search:          { icon: 'search',        label: 'Searched',          color: COLORS.textMuted},
    };
    return map[type] || {
      icon: 'ellipse', label: type, color: COLORS.textMuted,
    };
  };

  const info = getEventInfo(event.type);

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <View style={styles.activityRow}>
      <View style={[
        styles.activityIcon,
        { backgroundColor: info.color + '15' },
      ]}>
        <Ionicons name={info.icon} size={16} color={info.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityLabel}>{info.label}</Text>
        <View style={styles.activityMeta}>
          {/* Guest vs User badge */}
          <View style={[
            styles.actorBadge,
            {
              backgroundColor: event.actorType === 'guest'
                ? COLORS.warning + '20'
                : COLORS.success + '20',
            },
          ]}>
            <Text style={[
              styles.actorBadgeText,
              {
                color: event.actorType === 'guest'
                  ? COLORS.warning
                  : COLORS.success,
              },
            ]}>
              {event.actorType === 'guest' ? '👤 Guest' : '✅ User'}
            </Text>
          </View>
          <Text style={styles.activityTime}>
            {formatTime(event.timestamp)}
          </Text>
        </View>
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
    flex: 1, justifyContent: 'center',
    alignItems: 'center', gap: SIZES.sm,
  },
  loadingText: {
    fontSize: FONTS.md, color: COLORS.textMuted,
  },

  // Header
  header: {
    backgroundColor: COLORS.secondary,
    padding: SIZES.lg,
    paddingTop: SIZES.xl,
  },
  headerTitle: {
    fontSize: FONTS.xxl, fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FONTS.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // Conversion card
  conversionCard: {
    backgroundColor: COLORS.primary,
    margin: SIZES.md,
    padding: SIZES.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    ...SHADOW,
  },
  conversionRate: {
    fontSize: FONTS.xxxl || 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  conversionLabel: {
    fontSize: FONTS.lg,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginTop: 4,
  },
  conversionDesc: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },

  // Section title
  sectionTitle: {
    fontSize: FONTS.lg, fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: SIZES.md,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SIZES.md, gap: SIZES.md,
    marginBottom: SIZES.sm,
  },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    alignItems: 'center',
    gap: 4,
    ...SHADOW,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONTS.xxl, fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONTS.sm, color: COLORS.textMuted,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: FONTS.xs, color: COLORS.textMuted,
  },

  // Activity list
  activityList: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SIZES.md,
  },
  activityIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  activityLabel: {
    fontSize: FONTS.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginTop: 4,
  },
  actorBadge: {
    paddingHorizontal: SIZES.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
  },
  actorBadgeText: {
    fontSize: FONTS.xs,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  emptyActivity: {
    alignItems: 'center',
    padding: SIZES.xxl,
    gap: SIZES.sm,
  },
  emptyText: {
    fontSize: FONTS.xl, fontWeight: 'bold',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: FONTS.md, color: COLORS.textMuted,
    textAlign: 'center',
  },
});