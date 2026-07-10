// ============================================
// FILE: src/screens/owner/AnalyticsScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db }                from '../../firebase/config';
import { useSubscription }   from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Safe color fallbacks
const INFO_COLOR    = COLORS.info    || '#3498DB';
const WARNING_COLOR = COLORS.warning || '#F39C12';
const ACCENT_COLOR  = COLORS.accent  || '#9B59B6';
const DIVIDER_COLOR = COLORS.divider || COLORS.border || '#E0E0E0';

// ─── Period filter options ─────────────────────
const PERIODS = [
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time'   },
];

export default function AnalyticsScreen({ route, navigation }) {
  const insets       = useSafeAreaInsets();
  const { restaurant } = route.params;
  const { hasAnalytics } = useSubscription();

  const [stats, setStats]     = useState(null);
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('week');

  // ── Subscription gate ──────────────────────
  // Redirect to Subscription screen if not Premium
  useEffect(() => {
    if (!hasAnalytics(restaurant)) {
      navigation.replace('Subscription', { restaurant });
    }
  }, [restaurant]);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const analytics = restaurant.analytics || {};

      setStats({
        totalViews:         analytics.totalViews         || 0,
        weeklyViews:        analytics.weeklyViews        || 0,
        monthlyViews:       analytics.monthlyViews       || 0,
        totalCalls:         analytics.totalCalls         || 0,
        totalWhatsApp:      analytics.totalWhatsApp      || 0,
        totalDirections:    analytics.totalDirections    || 0,
        totalWebsiteClicks: analytics.totalWebsiteClicks || 0,
        totalTimeSpent:     analytics.totalTimeSpent     || 0,
        totalSessions:      analytics.totalSessions      || 0,
        avgTimeSpent: analytics.totalSessions > 0
          ? Math.round(analytics.totalTimeSpent / analytics.totalSessions)
          : 0,
      });

      // ── Fetch events with period filter ─────
      let eventsQuery = query(
        collection(db, 'analyticsEvents'),
        where('restaurantId', '==', restaurant.id),
        limit(200),
      );

      const snap = await getDocs(eventsQuery);
      let eventsData = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      // ── Filter by period ─────────────────────
      const now = new Date();
      eventsData = eventsData.filter(e => {
        if (period === 'all') return true;
        const eventDate = e.timestamp?.toDate?.();
        if (!eventDate) return false;
        if (period === 'week') {
          const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
          return eventDate >= weekAgo;
        }
        if (period === 'month') {
          const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
          return eventDate >= monthAgo;
        }
        return true;
      });

      // Sort newest first
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

  // ── Derived stats ──────────────────────────
  const guestViews = events.filter(
    e => e.type === 'restaurant_view' && e.actorType === 'guest'
  ).length;

  const userViews = events.filter(
    e => e.type === 'restaurant_view' && e.actorType === 'user'
  ).length;

  const totalEventViews      = guestViews + userViews;
  const guestPercent         = totalEventViews > 0
    ? Math.round((guestViews / totalEventViews) * 100) : 0;
  const userPercent          = totalEventViews > 0
    ? Math.round((userViews  / totalEventViews) * 100) : 0;

  const callEvents           = events.filter(e => e.type === 'action_call');
  const whatsappEvents       = events.filter(e => e.type === 'action_whatsapp');
  const totalContactAttempts = callEvents.length + whatsappEvents.length;

  const conversionRate = stats?.totalViews > 0
    ? ((totalContactAttempts / stats.totalViews) * 100).toFixed(1)
    : '0.0';

  // ── Period views selector ──────────────────
  const getPeriodViews = () => {
    if (period === 'week')  return stats?.weeklyViews  || 0;
    if (period === 'month') return stats?.monthlyViews || 0;
    return stats?.totalViews || 0;
  };

  // ── Loading state ──────────────────────────
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
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  // ──────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
    >
      {/* ── Header Banner ─────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>📊 Analytics</Text>
            <Text style={styles.headerSubtitle}>{restaurant.name}</Text>
          </View>
          <View style={styles.premiumBadge}>
            <Ionicons name="diamond" size={12} color="#FFFFFF" />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        </View>
      </View>

      {/* ── Period Filter ─────────────────── */}
      <View style={styles.periodContainer}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.periodBtn,
              period === p.key && styles.periodBtnActive,
            ]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.periodBtnText,
              period === p.key && styles.periodBtnTextActive,
            ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Conversion Highlight ──────────── */}
      <View style={styles.conversionCard}>
        <View style={styles.conversionMain}>
          <Text style={styles.conversionRate}>{conversionRate}%</Text>
          <Text style={styles.conversionLabel}>Conversion Rate</Text>
          <Text style={styles.conversionDesc}>
            {totalContactAttempts} contact attempts from{' '}
            {getPeriodViews()} views
          </Text>
        </View>

        {/* Guest vs User Breakdown */}
        <View style={styles.conversionDivider} />
        <View style={styles.viewerBreakdown}>
          <Text style={styles.viewerBreakdownTitle}>
            Viewer Breakdown
          </Text>

          {/* Progress Bar */}
          <View style={styles.breakdownBar}>
            <View style={[
              styles.breakdownGuest,
              { flex: guestPercent || 1 },
            ]} />
            <View style={[
              styles.breakdownUser,
              { flex: userPercent || 1 },
            ]} />
          </View>

          <View style={styles.breakdownLegend}>
            <View style={styles.legendItem}>
              <View style={[
                styles.legendDot,
                { backgroundColor: WARNING_COLOR },
              ]} />
              <Text style={styles.legendText}>
                Guests: {guestViews} ({guestPercent}%)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[
                styles.legendDot,
                { backgroundColor: COLORS.success },
              ]} />
              <Text style={styles.legendText}>
                Users: {userViews} ({userPercent}%)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Views Breakdown ───────────────── */}
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
          label={period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
          value={getPeriodViews()}
          color={INFO_COLOR}
        />
        <StatCard
          icon="person-outline"
          label="Guest Views"
          value={guestViews}
          color={WARNING_COLOR}
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

      {/* ── Contact Actions ───────────────── */}
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
          color={INFO_COLOR}
        />
        <StatCard
          icon="globe"
          label="Website Clicks"
          value={stats?.totalWebsiteClicks || 0}
          color={COLORS.secondary}
        />
      </View>

      {/* ── Engagement ────────────────────── */}
      <Text style={styles.sectionTitle}>⏱️ Engagement</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon="time"
          label="Avg Time Spent"
          value={`${stats?.avgTimeSpent || 0}s`}
          color={ACCENT_COLOR}
          subtitle="Per session"
        />
        <StatCard
          icon="repeat"
          label="Total Sessions"
          value={stats?.totalSessions || 0}
          color={COLORS.primary}
        />
      </View>

      {/* ── Top Actions Summary ───────────── */}
      <Text style={styles.sectionTitle}>🏆 Top Actions</Text>
      <View style={styles.topActionsCard}>
        {[
          {
            icon:  'call',
            label: 'Phone Calls',
            value: callEvents.length,
            color: COLORS.success,
          },
          {
            icon:  'logo-whatsapp',
            label: 'WhatsApp Taps',
            value: whatsappEvents.length,
            color: '#25D366',
          },
          {
            icon:  'navigate',
            label: 'Directions',
            value: events.filter(e => e.type === 'action_directions').length,
            color: INFO_COLOR,
          },
          {
            icon:  'globe',
            label: 'Website',
            value: events.filter(e => e.type === 'action_website').length,
            color: COLORS.secondary,
          },
        ].map((item, i) => {
          const maxVal = Math.max(
            callEvents.length,
            whatsappEvents.length,
            1
          );
          const barWidth = Math.max(
            (item.value / maxVal) * 100, 5
          );
          return (
            <View key={i} style={styles.topActionRow}>
              <Ionicons name={item.icon} size={18} color={item.color} />
              <Text style={styles.topActionLabel}>{item.label}</Text>
              <View style={styles.topActionBarContainer}>
                <View style={[
                  styles.topActionBar,
                  {
                    width:           `${barWidth}%`,
                    backgroundColor: item.color,
                  },
                ]} />
              </View>
              <Text style={[
                styles.topActionValue,
                { color: item.color },
              ]}>
                {item.value}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Recent Activity ───────────────── */}
      <Text style={styles.sectionTitle}>🕐 Recent Activity</Text>
      <View style={styles.activityList}>
        {events.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>
              Analytics will appear as customers visit
            </Text>
          </View>
        ) : (
          events.slice(0, 20).map(event => (
            <ActivityRow key={event.id} event={event} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Stat Card ────────────────────────────────
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

// ─── Activity Row ─────────────────────────────
function ActivityRow({ event }) {
  const getEventInfo = (type) => {
    const map = {
      restaurant_view:   { icon: 'eye',          label: 'Viewed restaurant', color: INFO_COLOR       },
      action_call:       { icon: 'call',          label: 'Tapped Call',       color: COLORS.success   },
      action_whatsapp:   { icon: 'logo-whatsapp', label: 'Opened WhatsApp',   color: '#25D366'        },
      action_directions: { icon: 'navigate',      label: 'Got Directions',    color: COLORS.primary   },
      action_website:    { icon: 'globe',          label: 'Visited Website',   color: COLORS.secondary },
      menu_item_view:    { icon: 'restaurant',     label: 'Viewed Menu Item',  color: WARNING_COLOR    },
      search:            { icon: 'search',         label: 'Searched',          color: COLORS.textMuted },
    };
    return map[type] || {
      icon: 'ellipse', label: type, color: COLORS.textMuted,
    };
  };

  const info = getEventInfo(event.type);

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleString('en-US', {
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
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
          <View style={[
            styles.actorBadge,
            {
              backgroundColor: event.actorType === 'guest'
                ? WARNING_COLOR + '20'
                : COLORS.success + '20',
            },
          ]}>
            <Text style={[
              styles.actorBadgeText,
              {
                color: event.actorType === 'guest'
                  ? WARNING_COLOR
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

// ──────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },

  // ── Loading ──────────────────────────────
  centered: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            SIZES.sm,
  },
  loadingText: {
    fontSize: FONTS.md,
    color:    COLORS.textMuted,
  },

  // ── Header ───────────────────────────────
  header: {
    backgroundColor: COLORS.secondary,
    padding:         SIZES.lg,
    paddingTop:      SIZES.xl,
  },
  headerTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  headerTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  headerSubtitle: {
    fontSize:  FONTS.md,
    color:     'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  premiumBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    gap:               4,
  },
  premiumBadgeText: {
    fontSize:   FONTS.xs,
    color:      '#FFFFFF',
    fontWeight: '700',
  },

  // ── Period Filter ─────────────────────────
  periodContainer: {
    flexDirection:     'row',
    margin:            SIZES.md,
    marginBottom:      0,
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.lg,
    padding:           4,
    gap:               4,
    ...SHADOW,
  },
  periodBtn: {
    flex:            1,
    paddingVertical: SIZES.sm,
    borderRadius:    RADIUS.md,
    alignItems:      'center',
  },
  periodBtnActive: {
    backgroundColor: COLORS.primary,
  },
  periodBtnText: {
    fontSize:   FONTS.sm,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },

  // ── Conversion Card ───────────────────────
  conversionCard: {
    backgroundColor: COLORS.primary,
    margin:          SIZES.md,
    borderRadius:    RADIUS.xl,
    overflow:        'hidden',
    ...SHADOW,
  },
  conversionMain: {
    padding:    SIZES.lg,
    alignItems: 'center',
  },
  conversionRate: {
    fontSize:   48,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  conversionLabel: {
    fontSize:   FONTS.lg,
    color:      'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginTop:  4,
  },
  conversionDesc: {
    fontSize:  FONTS.sm,
    color:     'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
  conversionDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SIZES.lg,
  },

  // ── Viewer Breakdown ──────────────────────
  viewerBreakdown: {
    padding: SIZES.lg,
    gap:     SIZES.sm,
  },
  viewerBreakdownTitle: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      '#FFFFFF',
    marginBottom: 4,
  },
  breakdownBar: {
    flexDirection: 'row',
    height:        10,
    borderRadius:  RADIUS.round,
    overflow:      'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  breakdownGuest: {
    backgroundColor: WARNING_COLOR,
    height:          '100%',
  },
  breakdownUser: {
    backgroundColor: COLORS.success,
    height:          '100%',
  },
  breakdownLegend: {
    flexDirection: 'row',
    gap:           SIZES.lg,
    marginTop:     SIZES.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  legendDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: FONTS.sm,
    color:    'rgba(255,255,255,0.9)',
  },

  // ── Section Title ─────────────────────────
  sectionTitle: {
    fontSize:          FONTS.lg,
    fontWeight:        'bold',
    color:             COLORS.text,
    paddingHorizontal: SIZES.md,
    marginTop:         SIZES.md,
    marginBottom:      SIZES.sm,
  },

  // ── Stats Grid ────────────────────────────
  statsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: SIZES.md,
    gap:               SIZES.md,
    marginBottom:      SIZES.sm,
  },
  statCard: {
    flex:            1,
    minWidth:        '45%',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    alignItems:      'center',
    gap:             4,
    ...SHADOW,
  },
  statIcon: {
    width:          44,
    height:         44,
    borderRadius:   22,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   4,
  },
  statValue: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  statLabel: {
    fontSize:  FONTS.sm,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },

  // ── Top Actions Card ──────────────────────
  topActionsCard: {
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.sm,
    borderRadius:     RADIUS.lg,
    padding:          SIZES.md,
    gap:              SIZES.md,
    ...SHADOW,
  },
  topActionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  topActionLabel: {
    fontSize:  FONTS.sm,
    color:     COLORS.text,
    fontWeight: '500',
    width:      90,
  },
  topActionBarContainer: {
    flex:            1,
    height:          8,
    backgroundColor: COLORS.border,
    borderRadius:    RADIUS.round,
    overflow:        'hidden',
  },
  topActionBar: {
    height:       '100%',
    borderRadius: RADIUS.round,
  },
  topActionValue: {
    fontSize:   FONTS.sm,
    fontWeight: 'bold',
    width:      28,
    textAlign:  'right',
  },

  // ── Activity List ─────────────────────────
  activityList: {
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius:     RADIUS.lg,
    overflow:         'hidden',
    marginBottom:     SIZES.md,
    ...SHADOW,
  },
  activityRow: {
    flexDirection:     'row',
    alignItems:        'center',
    padding:           SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER_COLOR,
    gap:               SIZES.md,
  },
  activityIcon: {
    width:          36,
    height:         36,
    borderRadius:   18,
    justifyContent: 'center',
    alignItems:     'center',
  },
  activityLabel: {
    fontSize:   FONTS.md,
    color:      COLORS.text,
    fontWeight: '500',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginTop:     4,
  },
  actorBadge: {
    paddingHorizontal: SIZES.xs,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  actorBadgeText: {
    fontSize:   FONTS.xs,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },

  // ── Empty State ───────────────────────────
  emptyActivity: {
    alignItems: 'center',
    padding:    SIZES.xxl,
    gap:        SIZES.sm,
  },
  emptyText: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  emptySubtext: {
    fontSize:  FONTS.md,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
});