// ============================================
// FILE: src/screens/owner/AnalyticsScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where,
  getDocs, limit, orderBy,
} from 'firebase/firestore';
import { db }              from '../../firebase/config';
import { useSubscription } from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const INFO_COLOR    = COLORS.info    || '#3498DB';
const WARNING_COLOR = COLORS.warning || '#F39C12';
const ACCENT_COLOR  = COLORS.accent  || '#9B59B6';
const DIVIDER_COLOR = COLORS.divider || COLORS.border || '#E0E0E0';

const PERIODS = [
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time'   },
];

const EVENT_INFO = {
  restaurant_view:   { icon: 'eye-outline',       label: 'Viewed restaurant', color: INFO_COLOR       },
  action_call:       { icon: 'call-outline',       label: 'Tapped Call',       color: COLORS.success   },
  action_whatsapp:   { icon: 'logo-whatsapp',      label: 'Opened WhatsApp',   color: '#25D366'        },
  action_directions: { icon: 'navigate-outline',   label: 'Got Directions',    color: COLORS.primary   },
  action_website:    { icon: 'globe-outline',      label: 'Visited Website',   color: COLORS.secondary },
  menu_item_view:    { icon: 'restaurant-outline', label: 'Viewed Menu Item',  color: WARNING_COLOR    },
  search:            { icon: 'search-outline',     label: 'Searched',          color: COLORS.textMuted },
};

const formatTime = (timestamp) => {
  if (!timestamp?.toDate) return '';
  try {
    return timestamp.toDate().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const StatCard = ({ icon, label, value, color, subtitle }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

const ActivityRow = ({ event, isLast }) => {
  const info = EVENT_INFO[event.type] || {
    icon: 'ellipse-outline', label: event.type, color: COLORS.textMuted,
  };
  return (
    <View style={[styles.activityRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={[styles.activityIcon, { backgroundColor: info.color + '15' }]}>
        <Ionicons name={info.icon} size={16} color={info.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityLabel}>{info.label}</Text>
        <View style={styles.activityMeta}>
          <View style={[
            styles.actorBadge,
            { backgroundColor: (event.actorType === 'guest' ? WARNING_COLOR : COLORS.success) + '20' },
          ]}>
            <Text style={[
              styles.actorBadgeText,
              { color: event.actorType === 'guest' ? WARNING_COLOR : COLORS.success },
            ]}>
              {event.actorType === 'guest' ? '👤 Guest' : '✅ User'}
            </Text>
          </View>
          <Text style={styles.activityTime}>{formatTime(event.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function AnalyticsScreen({ route, navigation }) {
  const insets         = useSafeAreaInsets();
  const { restaurant } = route.params || {};
  const { hasAnalytics, isExpiringSoon, getDaysRemaining } = useSubscription();

  // ─────────────────────────────────────────
  // ✅ ALL HOOKS FIRST — before any return
  // ─────────────────────────────────────────
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [period, setPeriod]         = useState('week');

  const fetchAnalytics = useCallback(async () => {
    if (!restaurant?.id) {
      setError('No restaurant data');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const eventsQuery = query(
        collection(db, 'analyticsEvents'),
        where('restaurantId', '==', restaurant.id),
        orderBy('timestamp', 'desc'),
        limit(200),
      );

      const snap = await getDocs(eventsQuery);
      let eventsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const now = new Date();
      const startDate = period === 'week'
        ? new Date(now - 7 * 24 * 60 * 60 * 1000)
        : period === 'month'
        ? new Date(now - 30 * 24 * 60 * 60 * 1000)
        : null;

      if (startDate) {
        eventsData = eventsData.filter(e => {
          const eventDate = e.timestamp?.toDate?.();
          return eventDate && eventDate >= startDate;
        });
      }

      setEvents(eventsData);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics.');
    }
  }, [period, restaurant?.id]);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics().finally(() => setLoading(false));
  }, [fetchAnalytics]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  }, [fetchAnalytics]);

  const analytics = restaurant?.analytics || {};

  const derived = useMemo(() => {
    const base = {
      totalViews:         analytics.totalViews         || 0,
      weeklyViews:        analytics.weeklyViews        || 0,
      monthlyViews:       analytics.monthlyViews       || 0,
      totalCalls:         analytics.totalCalls         || 0,
      totalWhatsApp:      analytics.totalWhatsApp      || 0,
      totalDirections:    analytics.totalDirections    || 0,
      totalWebsiteClicks: analytics.totalWebsiteClicks || 0,
      totalTimeSpent:     analytics.totalTimeSpent     || 0,
      totalSessions:      analytics.totalSessions      || 0,
    };
    base.avgTimeSpent = base.totalSessions > 0
      ? Math.round(base.totalTimeSpent / base.totalSessions) : 0;

    const viewEvents     = events.filter(e => e.type === 'restaurant_view');
    const guestViews     = viewEvents.filter(e => e.actorType === 'guest').length;
    const userViews      = viewEvents.filter(e => e.actorType === 'user').length;
    const totalEvViews   = guestViews + userViews;
    const callEvents     = events.filter(e => e.type === 'action_call');
    const whatsappEvents = events.filter(e => e.type === 'action_whatsapp');
    const dirEvents      = events.filter(e => e.type === 'action_directions');
    const webEvents      = events.filter(e => e.type === 'action_website');
    const totalContacts  = callEvents.length + whatsappEvents.length;
    const guestPct       = totalEvViews > 0 ? Math.round((guestViews / totalEvViews) * 100) : 0;
    const userPct        = totalEvViews > 0 ? Math.round((userViews / totalEvViews) * 100) : 0;
    const periodViews    = period === 'week' ? base.weeklyViews
                         : period === 'month' ? base.monthlyViews : base.totalViews;
    const convRate       = base.totalViews > 0
      ? ((totalContacts / base.totalViews) * 100).toFixed(1) : '0.0';
    const maxBar = Math.max(callEvents.length, whatsappEvents.length, 1);

    return {
      ...base, guestViews, userViews, totalEvViews, guestPct, userPct,
      callEvents, whatsappEvents, dirEvents, webEvents,
      totalContacts, periodViews, convRate, maxBar,
    };
  }, [events, analytics, period]);

  const expiringSoon  = isExpiringSoon ? isExpiringSoon(restaurant) : false;
  const daysRemaining = getDaysRemaining ? getDaysRemaining(restaurant) : 0;

  // ─────────────────────────────────────────
  // ✅ NOW safe to do early returns
  // All hooks are above this line
  // ─────────────────────────────────────────

  if (!restaurant) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="alert-circle-outline" size={50} color={COLORS.error} />
        <Text style={styles.errorTitle}>No Restaurant Data</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasAnalytics(restaurant)) {
    return (
      <View style={[styles.lockedContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="lock-closed" size={60} color={COLORS.textMuted} />
        <Text style={styles.lockedTitle}>Analytics — Premium Only</Text>
        <Text style={styles.lockedDesc}>
          Track who views your restaurant, how they contact you,
          and your conversion rate.
        </Text>
        <TouchableOpacity
          style={styles.lockedUpgradeBtn}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Ionicons name="diamond-outline" size={20} color="#FFFFFF" />
          <Text style={styles.lockedUpgradeBtnText}>Upgrade to Premium — $24.99/mo</Text>
        </TouchableOpacity>
        <Text style={styles.lockedPaymentText}>PayPal or Scotiabank Bank Transfer</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="alert-circle-outline" size={50} color={COLORS.error} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); fetchAnalytics().finally(() => setLoading(false)); }}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
          colors={[COLORS.primary]} tintColor={COLORS.primary} />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>📊 Analytics</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{restaurant.name}</Text>
          </View>
          <View style={styles.premiumBadge}>
            <Ionicons name="diamond-outline" size={12} color="#FFFFFF" />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        </View>
        {expiringSoon && (
          <View style={styles.expiryWarning}>
            <Ionicons name="time-outline" size={14} color={WARNING_COLOR} />
            <Text style={styles.expiryWarningText}>
              Premium expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Period Filter */}
      <View style={styles.periodContainer}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conversion Card */}
      <View style={styles.conversionCard}>
        <View style={styles.conversionMain}>
          <Text style={styles.conversionRate}>{derived.convRate}%</Text>
          <Text style={styles.conversionLabel}>Conversion Rate</Text>
          <Text style={styles.conversionDesc}>
            {derived.totalContacts} contact{derived.totalContacts !== 1 ? 's' : ''} from {derived.periodViews} view{derived.periodViews !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.conversionDivider} />
        <View style={styles.viewerBreakdown}>
          <Text style={styles.viewerBreakdownTitle}>
            Viewer Breakdown ({period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'})
          </Text>
          {derived.totalEvViews === 0 ? (
            <Text style={styles.noDataText}>No view data for this period</Text>
          ) : (
            <>
              <View style={styles.breakdownBar}>
                <View style={[styles.breakdownGuest, { flex: derived.guestPct || 1 }]} />
                <View style={[styles.breakdownUser, { flex: derived.userPct || 1 }]} />
              </View>
              <View style={styles.breakdownLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: WARNING_COLOR }]} />
                  <Text style={styles.legendText}>Guests: {derived.guestViews} ({derived.guestPct}%)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.legendText}>Users: {derived.userViews} ({derived.userPct}%)</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Views */}
      <Text style={styles.sectionTitle}>👁️ Views</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="eye-outline" label="Total Views" value={derived.totalViews} color={COLORS.primary} />
        <StatCard icon="trending-up-outline"
          label={period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
          value={derived.periodViews} color={INFO_COLOR} />
        <StatCard icon="person-outline" label="Guest Views" value={derived.guestViews}
          color={WARNING_COLOR} subtitle="Not logged in" />
        <StatCard icon="person-circle-outline" label="User Views" value={derived.userViews}
          color={COLORS.success} subtitle="Logged in" />
      </View>

      {/* Contact Actions */}
      <Text style={styles.sectionTitle}>📞 Contact Actions</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="call-outline" label="Phone Calls" value={derived.totalCalls} color={COLORS.success} />
        <StatCard icon="logo-whatsapp" label="WhatsApp" value={derived.totalWhatsApp} color="#25D366" />
        <StatCard icon="navigate-outline" label="Directions" value={derived.totalDirections} color={INFO_COLOR} />
        <StatCard icon="globe-outline" label="Website" value={derived.totalWebsiteClicks} color={COLORS.secondary} />
      </View>

      {/* Engagement */}
      <Text style={styles.sectionTitle}>⏱️ Engagement</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="time-outline" label="Avg Time" value={`${derived.avgTimeSpent}s`}
          color={ACCENT_COLOR} subtitle="Per session" />
        <StatCard icon="repeat-outline" label="Sessions" value={derived.totalSessions} color={COLORS.primary} />
      </View>

      {/* Top Actions */}
      <Text style={styles.sectionTitle}>🏆 Top Actions</Text>
      <View style={styles.topActionsCard}>
        {[
          { icon: 'call-outline', label: 'Calls', value: derived.callEvents.length, color: COLORS.success },
          { icon: 'logo-whatsapp', label: 'WhatsApp', value: derived.whatsappEvents.length, color: '#25D366' },
          { icon: 'navigate-outline', label: 'Directions', value: derived.dirEvents.length, color: INFO_COLOR },
          { icon: 'globe-outline', label: 'Website', value: derived.webEvents.length, color: COLORS.secondary },
        ].map((item, i) => (
          <View key={i} style={styles.topActionRow}>
            <Ionicons name={item.icon} size={18} color={item.color} />
            <Text style={styles.topActionLabel}>{item.label}</Text>
            <View style={styles.topActionBarContainer}>
              <View style={[styles.topActionBar, {
                width: `${Math.max((item.value / derived.maxBar) * 100, 4)}%`,
                backgroundColor: item.color,
              }]} />
            </View>
            <Text style={[styles.topActionValue, { color: item.color }]}>{item.value}</Text>
          </View>
        ))}
        {derived.callEvents.length === 0 && derived.whatsappEvents.length === 0 && (
          <Text style={styles.noActionsText}>No contact actions for this period</Text>
        )}
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>🕐 Recent Activity</Text>
      <View style={styles.activityList}>
        {events.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>Analytics appear as customers visit</Text>
          </View>
        ) : (
          events.slice(0, 20).map((event, idx) => (
            <ActivityRow key={event.id} event={event}
              isLast={idx === Math.min(events.length, 20) - 1} />
          ))
        )}
      </View>
      {events.length > 20 && (
        <Text style={styles.moreEventsText}>
          Showing 20 of {events.length} events
        </Text>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SIZES.xl, gap: SIZES.sm, backgroundColor: COLORS.background,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },
  errorTitle:  { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  errorText:   { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg, marginTop: SIZES.sm,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  lockedContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SIZES.xl, backgroundColor: COLORS.background, gap: SIZES.md,
  },
  lockedTitle:    { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  lockedDesc:     { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  lockedUpgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg, marginTop: SIZES.sm,
  },
  lockedUpgradeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },
  lockedPaymentText:    { fontSize: FONTS.sm, color: COLORS.textMuted },

  header: {
    backgroundColor: COLORS.secondary, padding: SIZES.lg, paddingBottom: SIZES.md, gap: SIZES.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle:    { fontSize: FONTS.xxl, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: FONTS.md, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.sm, paddingVertical: 4,
    borderRadius: RADIUS.round, gap: 4,
  },
  premiumBadgeText: { fontSize: FONTS.xs, color: '#FFFFFF', fontWeight: '700' },
  expiryWarning: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.xs,
    backgroundColor: WARNING_COLOR + '30', padding: SIZES.sm, borderRadius: RADIUS.md,
  },
  expiryWarningText: { fontSize: FONTS.xs, color: '#FFFFFF', fontWeight: '600', flex: 1 },

  periodContainer: {
    flexDirection: 'row', margin: SIZES.md, marginBottom: 0,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: 4, gap: 4, ...SHADOW,
  },
  periodBtn: { flex: 1, paddingVertical: SIZES.sm, borderRadius: RADIUS.md, alignItems: 'center' },
  periodBtnActive:     { backgroundColor: COLORS.primary },
  periodBtnText:       { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  periodBtnTextActive: { color: '#FFFFFF' },

  conversionCard: {
    backgroundColor: COLORS.primary, margin: SIZES.md,
    borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOW,
  },
  conversionMain:  { padding: SIZES.lg, alignItems: 'center' },
  conversionRate:  { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF' },
  conversionLabel: { fontSize: FONTS.lg, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 4 },
  conversionDesc:  { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  conversionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: SIZES.lg },

  viewerBreakdown:      { padding: SIZES.lg, gap: SIZES.sm },
  viewerBreakdownTitle: { fontSize: FONTS.md, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  noDataText:           { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: SIZES.sm },
  breakdownBar: {
    flexDirection: 'row', height: 10, borderRadius: RADIUS.round,
    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)',
  },
  breakdownGuest: { backgroundColor: WARNING_COLOR, height: '100%' },
  breakdownUser:  { backgroundColor: COLORS.success, height: '100%' },
  breakdownLegend: { flexDirection: 'row', gap: SIZES.lg, marginTop: SIZES.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.9)' },

  sectionTitle: {
    fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text,
    paddingHorizontal: SIZES.md, marginTop: SIZES.md, marginBottom: SIZES.sm,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SIZES.md, gap: SIZES.md, marginBottom: SIZES.sm,
  },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SIZES.md, alignItems: 'center',
    gap: 4, ...SHADOW,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  statValue:    { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  statLabel:    { fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center' },
  statSubtitle: { fontSize: FONTS.xs, color: COLORS.textMuted },

  topActionsCard: {
    backgroundColor: COLORS.surface, marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm, borderRadius: RADIUS.lg,
    padding: SIZES.md, gap: SIZES.md, ...SHADOW,
  },
  topActionRow:   { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  topActionLabel: { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500', width: 80 },
  topActionBarContainer: {
    flex: 1, height: 8, backgroundColor: COLORS.border,
    borderRadius: RADIUS.round, overflow: 'hidden',
  },
  topActionBar:   { height: '100%', borderRadius: RADIUS.round },
  topActionValue: { fontSize: FONTS.sm, fontWeight: 'bold', width: 28, textAlign: 'right' },
  noActionsText:  { fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center', padding: SIZES.sm },

  activityList: {
    backgroundColor: COLORS.surface, marginHorizontal: SIZES.md,
    borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SIZES.sm, ...SHADOW,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', padding: SIZES.md,
    borderBottomWidth: 1, borderBottomColor: DIVIDER_COLOR, gap: SIZES.md,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  activityLabel: { fontSize: FONTS.md, color: COLORS.text, fontWeight: '500' },
  activityMeta:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: 4 },
  actorBadge:    { paddingHorizontal: SIZES.xs, paddingVertical: 2, borderRadius: RADIUS.round },
  actorBadgeText: { fontSize: FONTS.xs, fontWeight: '600' },
  activityTime:   { fontSize: FONTS.xs, color: COLORS.textMuted },

  emptyActivity: { alignItems: 'center', padding: SIZES.xxl, gap: SIZES.sm },
  emptyText:     { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  emptySubtext:  { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  moreEventsText: {
    fontSize: FONTS.sm, color: COLORS.textMuted,
    textAlign: 'center', paddingHorizontal: SIZES.md, paddingBottom: SIZES.sm,
  },
});