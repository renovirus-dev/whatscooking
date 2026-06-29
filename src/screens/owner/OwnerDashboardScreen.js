// ============================================
// FILE: src/screens/owner/OwnerDashboardScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, onSnapshot,
  getCountFromServer, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db }                    from '../../firebase/config';
import { useAuth }               from '../../hooks/useAuth';
import { PLANS, useSubscription } from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function OwnerDashboardScreen({ navigation }) {
  const insets            = useSafeAreaInsets();
  const { user }          = useAuth();
  const { hasAnalytics }  = useSubscription();

  const [restaurant, setRestaurant] = useState(null);
  const [stats, setStats]           = useState({
    menuItems: 0, reviews: 0, favorites: 0,
  });
  const [isOpen, setIsOpen]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Firestore listener ────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const rest = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        };
        setRestaurant(rest);
        setIsOpen(rest.isCurrentlyOpen || false);
        try {
          const [menuSnap, reviewSnap] = await Promise.all([
            getCountFromServer(query(
              collection(db, 'menuItems'),
              where('restaurantId', '==', rest.id)
            )),
            getCountFromServer(query(
              collection(db, 'reviews'),
              where('restaurantId', '==', rest.id)
            )),
          ]);
          setStats({
            menuItems: menuSnap.data().count,
            reviews:   reviewSnap.data().count,
            favorites: rest.totalFavorites || 0,
          });
        } catch (err) {
          console.error('Stats fetch error:', err);
        }
      } else {
        setRestaurant(null);
      }
    }, (err) => {
      console.error('Dashboard listener error:', err);
    });
    return unsubscribe;
  }, [user]);

  const handleToggleOpen = async (value) => {
    if (!restaurant) return;
    setIsOpen(value);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isCurrentlyOpen: value,
        updatedAt:       serverTimestamp(),
      });
    } catch (err) {
      setIsOpen(!value);
      Alert.alert('Error', 'Could not update status');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // ── Subscription helpers ──────────────────
  const currentPlanId    = restaurant?.subscription?.plan || 'free_trial';
  const currentPlan      = PLANS[currentPlanId] || PLANS.free_trial;
  const analyticsEnabled = hasAnalytics(restaurant);

  const getSubscriptionStatus = () => {
    if (currentPlanId === 'free_trial') {
      const trialEnd = restaurant?.subscription?.trialEndsAt;
      if (trialEnd) {
        const daysLeft = Math.ceil(
          (new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 0) return '⚠️ Trial expired';
        if (daysLeft <= 3) return `⚠️ ${daysLeft} days left`;
        return `${daysLeft} days remaining`;
      }
      return '14 day trial';
    }
    const exp = restaurant?.subscription?.expiresAt;
    if (exp) {
      return `Renews ${new Date(exp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })}`;
    }
    return '✅ Active';
  };

  // ── Stats cards ───────────────────────────
  const STATS = [
    { label: 'Menu Items', value: stats.menuItems, icon: 'restaurant', color: COLORS.primary },
    { label: 'Reviews',    value: stats.reviews,   icon: 'star',       color: COLORS.warning },
    { label: 'Favorites',  value: stats.favorites, icon: 'heart',      color: COLORS.error   },
    {
      label: 'Rating',
      value: restaurant?.averageRating?.toFixed(1) || '—',
      icon:  'trending-up',
      color: COLORS.success,
    },
  ];

  // ── Quick actions ─────────────────────────
  const QUICK_ACTIONS = [
    {
      label:   'Add Menu Item',
      icon:    'add-circle',
      color:   COLORS.primary,
      onPress: () => navigation.navigate('AddMenuItem', {
        restaurantId: restaurant?.id,
      }),
    },
    {
      label:   "Today's Menu",
      icon:    'today',
      color:   COLORS.info,
      onPress: () => navigation.navigate('Daily'),
    },
    {
      label:   'Edit Restaurant',
      icon:    'pencil',
      color:   COLORS.success,
      onPress: () => navigation.navigate('RestaurantSetup', { restaurant }),
    },
    {
      label:   'View as Customer',
      icon:    'eye',
      color:   COLORS.secondary,
      onPress: () => restaurant && navigation.navigate(
        'RestaurantDetail',
        { restaurantId: restaurant.id, name: restaurant.name }
      ),
    },
    ...(analyticsEnabled ? [{
      label:   'Analytics',
      icon:    'bar-chart',
      color:   COLORS.info,
      onPress: () => navigation.navigate('Analytics', { restaurant }),
    }] : []),
    {
      label:   'Subscription',
      icon:    'diamond',
      color:   COLORS.warning,
      onPress: () => navigation.navigate('Subscription', { restaurant }),
    },
  ];

  // ── No restaurant state ───────────────────
  if (!restaurant) {
    return (
      <View style={[
        styles.noRestaurant,
        {
          // ✅ Respect system bars on the empty state too
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={{ fontSize: 60 }}>🍽️</Text>
        <Text style={styles.noRestaurantTitle}>No Restaurant Yet</Text>
        <Text style={styles.noRestaurantText}>
          Create your restaurant profile to get started
        </Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('RestaurantSetup')}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>
            Create Restaurant Profile
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        // ✅ Bottom padding clears Android nav bar
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
    >

      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.planRow}>
            <Text style={styles.planEmoji}>{currentPlan.emoji}</Text>
            <Text style={styles.planName}>{currentPlan.name} Plan</Text>
            {restaurant.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Open / Closed toggle */}
        <View style={styles.openToggle}>
          <Text style={[
            styles.openLabel,
            { color: isOpen ? '#7AFF8A' : '#FFB3B3' },
          ]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
          <Switch
            value={isOpen}
            onValueChange={handleToggleOpen}
            trackColor={{
              false: 'rgba(255,255,255,0.3)',
              true:  '#7AFF8A80',
            }}
            thumbColor={isOpen ? '#7AFF8A' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* ── Subscription card ───────────────── */}
      <View style={styles.subscriptionCard}>
        <View style={styles.subscriptionLeft}>
          <View style={[
            styles.subscriptionIconBg,
            { backgroundColor: currentPlan.color + '20' },
          ]}>
            <Text style={{ fontSize: 26 }}>{currentPlan.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subscriptionPlanName}>
              {currentPlan.name} Plan
            </Text>
            <Text style={[
              styles.subscriptionStatus,
              getSubscriptionStatus().includes('⚠️') && {
                color: COLORS.warning,
              },
            ]}>
              {getSubscriptionStatus()}
            </Text>
            {currentPlanId !== 'free_trial' && (
              <Text style={styles.subscriptionPrice}>
                ${currentPlan.price}/month
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.upgradeBtn,
            currentPlanId === 'premium' && styles.upgradeBtnManage,
          ]}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Text style={styles.upgradeBtnText}>
            {currentPlanId === 'premium' ? 'Manage' : 'Upgrade'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Feature preview (free trial only) ── */}
      {currentPlanId === 'free_trial' && (
        <View style={styles.featuresPreview}>
          <Text style={styles.featuresPreviewTitle}>
            🚀 Unlock with Premium:
          </Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: 'bar-chart',     label: 'Analytics'      },
              { icon: 'notifications', label: 'Push Alerts'    },
              { icon: 'star',          label: 'Featured'       },
              { icon: 'infinite',      label: 'Unlimited Menu' },
            ].map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Ionicons name={f.icon} size={18} color={COLORS.primary} />
                <Text style={styles.featureItemLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.seeAllPlansBtn}
            onPress={() => navigation.navigate('Subscription', { restaurant })}
            activeOpacity={0.7}
          >
            <Text style={styles.seeAllPlansBtnText}>See All Plans →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Analytics — Premium unlocked ──────── */}
      {analyticsEnabled && (
        <TouchableOpacity
          style={styles.analyticsCard}
          onPress={() => navigation.navigate('Analytics', { restaurant })}
          activeOpacity={0.85}
        >
          <View style={styles.analyticsCardHeader}>
            <View style={styles.analyticsCardTitle}>
              <Ionicons name="bar-chart" size={20} color={COLORS.secondary} />
              <Text style={styles.analyticsCardTitleText}>
                Analytics Overview
              </Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>👑 Premium</Text>
              </View>
            </View>
            <View style={styles.analyticsViewAll}>
              <Text style={styles.analyticsViewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.analyticsMiniGrid}>
            {[
              {
                icon:  'eye',
                value: restaurant?.analytics?.totalViews    || 0,
                label: 'Views',
                color: COLORS.info,
              },
              {
                icon:  'call',
                value: restaurant?.analytics?.totalCalls    || 0,
                label: 'Calls',
                color: COLORS.success,
              },
              {
                icon:  'logo-whatsapp',
                value: restaurant?.analytics?.totalWhatsApp || 0,
                label: 'WhatsApp',
                color: '#25D366',
              },
              {
                icon:  'trending-up',
                value: (() => {
                  const views = restaurant?.analytics?.totalViews    || 0;
                  const calls = restaurant?.analytics?.totalCalls    || 0;
                  const wa    = restaurant?.analytics?.totalWhatsApp || 0;
                  return views > 0
                    ? `${(((calls + wa) / views) * 100).toFixed(1)}%`
                    : '0%';
                })(),
                label: 'Conversion',
                color: COLORS.primary,
              },
            ].map((stat, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.analyticsMinDivider} />}
                <View style={styles.analyticsMiniStat}>
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                  <Text style={[
                    styles.analyticsMiniValue,
                    { color: i === 3 ? COLORS.primary : COLORS.text },
                  ]}>
                    {stat.value}
                  </Text>
                  <Text style={styles.analyticsMiniLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={styles.viewerBreakdown}>
            <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.viewerBreakdownText}>
              {restaurant?.analytics?.weeklyViews || 0} views this week
              · Tap to see guest vs user breakdown →
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Analytics — Basic locked ───────────── */}
      {currentPlanId === 'basic' && (
        <TouchableOpacity
          style={styles.analyticsLockedCard}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.85}
        >
          <View style={styles.analyticsLockedMock}>
            {['Views', 'Calls', 'WhatsApp', 'Conversion'].map((l, i) => (
              <View key={i} style={styles.analyticsMockStat}>
                <Text style={styles.analyticsMockValue}>
                  {i === 3 ? '??%' : '???'}
                </Text>
                <Text style={styles.analyticsMockLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={styles.analyticsLockOverlay}>
            <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
            <Text style={styles.analyticsLockTitle}>
              Analytics — Premium Only
            </Text>
            <Text style={styles.analyticsLockDesc}>
              See who's viewing your restaurant, calling, and ordering.
              Upgrade to Premium to unlock.
            </Text>
            <View style={styles.analyticsUpgradeChip}>
              <Text style={styles.analyticsUpgradeChipText}>
                👑 Upgrade to Premium →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Analytics — Free trial locked ─────── */}
      {currentPlanId === 'free_trial' && (
        <TouchableOpacity
          style={styles.analyticsLockedCard}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.85}
        >
          <View style={styles.analyticsLockedMock}>
            {['Views', 'Calls', 'WhatsApp', 'Conversion'].map((l, i) => (
              <View key={i} style={styles.analyticsMockStat}>
                <Text style={styles.analyticsMockValue}>
                  {i === 3 ? '??%' : '???'}
                </Text>
                <Text style={styles.analyticsMockLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={styles.analyticsLockOverlay}>
            <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
            <Text style={styles.analyticsLockTitle}>
              Analytics — Premium Only
            </Text>
            <Text style={styles.analyticsLockDesc}>
              Track views, calls and orders from guests and users.
              Available on the Premium plan.
            </Text>
            <View style={styles.analyticsUpgradeChip}>
              <Text style={styles.analyticsUpgradeChipText}>
                👑 Upgrade to Premium — $24.99/mo →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Stats grid ──────────────────────── */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        {STATS.map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[
              styles.statIcon,
              { backgroundColor: stat.color + '20' },
            ]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Quick actions ────────────────────── */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.actionCard}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.actionIcon,
              { backgroundColor: action.color + '20' },
            ]}>
              <Ionicons name={action.icon} size={28} color={action.color} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Locked premium features ──────────── */}
      {currentPlanId !== 'premium' && (
        <View style={styles.lockedSection}>
          <Text style={styles.sectionTitle}>🔒 Premium Features</Text>
          {[
            {
              icon:  'bar-chart',
              title: 'Analytics Dashboard',
              desc:  'Track views, calls, WhatsApp & conversion rate',
            },
            {
              icon:  'notifications',
              title: 'Push Notifications',
              desc:  'Alert followers when you post daily specials',
            },
            {
              icon:  'ribbon',
              title: 'Featured Listing',
              desc:  'Appear at the top of search results',
            },
          ].map((feat, i) => (
            <TouchableOpacity
              key={i}
              style={styles.lockedFeature}
              onPress={() =>
                navigation.navigate('Subscription', { restaurant })
              }
              activeOpacity={0.8}
            >
              <View style={styles.lockedIconBg}>
                <Ionicons name={feat.icon} size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedTitle}>{feat.title}</Text>
                <Text style={styles.lockedDesc}>{feat.desc}</Text>
              </View>
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.upgradeCTA}
            onPress={() =>
              navigation.navigate('Subscription', { restaurant })
            }
            activeOpacity={0.85}
          >
            <Ionicons name="rocket" size={20} color="#FFFFFF" />
            <Text style={styles.upgradeCTAText}>
              Upgrade to Premium — $24.99/mo
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── No restaurant ────────────────────────
  noRestaurant: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.background,
    // ✅ paddingTop/Bottom set dynamically from insets in JSX
  },
  noRestaurantTitle: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.lg,
  },
  noRestaurantText: {
    fontSize: FONTS.lg,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.sm,
    marginBottom: SIZES.xl,
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
  },
  createBtnText: {
    color: COLORS.textWhite,
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },

  // ── Header ──────────────────────────────
  // Stack navigator provides the top inset/header
  // so no extra paddingTop needed on the orange header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.lg,
    paddingTop: SIZES.xl,
  },
  restaurantName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  planEmoji: { fontSize: 14 },
  planName: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    gap: 3,
  },
  verifiedText: {
    fontSize: FONTS.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  openToggle: { alignItems: 'center', gap: 4 },
  openLabel:  { fontSize: FONTS.sm, fontWeight: 'bold' },

  // ── Subscription card ────────────────────
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    padding: SIZES.md,
    borderRadius: RADIUS.xl,
    gap: SIZES.md,
    ...SHADOW,
  },
  subscriptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  subscriptionIconBg: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionPlanName: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subscriptionStatus: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  subscriptionPrice: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  upgradeBtnManage: { backgroundColor: COLORS.secondary },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: 'bold',
  },

  // ── Feature preview ──────────────────────
  featuresPreview: {
    backgroundColor: COLORS.primary + '08',
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    padding: SIZES.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  featuresPreviewTitle: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: RADIUS.round,
    gap: 6,
    ...SHADOW,
  },
  featureItemLabel: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  seeAllPlansBtn:     { alignSelf: 'flex-end' },
  seeAllPlansBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: FONTS.sm,
  },

  // ── Analytics card (Premium) ─────────────
  analyticsCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    borderRadius: RADIUS.xl,
    padding: SIZES.md,
    gap: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  analyticsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analyticsCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  analyticsCardTitleText: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  premiumBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  premiumBadgeText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  analyticsViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  analyticsViewAllText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  analyticsMiniGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
  },
  analyticsMiniStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  analyticsMiniValue: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  analyticsMiniLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  analyticsMinDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  viewerBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    paddingTop: SIZES.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  viewerBreakdownText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },

  // ── Analytics locked card ────────────────
  analyticsLockedCard: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  analyticsLockedMock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
  },
  analyticsMockStat: {
    alignItems: 'center',
    gap: 4,
  },
  analyticsMockValue: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.border,
  },
  analyticsMockLabel: {
    fontSize: FONTS.xs,
    color: COLORS.border,
  },
  analyticsLockOverlay: {
    backgroundColor: 'rgba(44,62,80,0.92)',
    padding: SIZES.lg,
    alignItems: 'center',
    gap: SIZES.sm,
  },
  analyticsLockTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  analyticsLockDesc: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  analyticsUpgradeChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    marginTop: SIZES.xs,
  },
  analyticsUpgradeChipText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: FONTS.sm,
  },

  // ── Stats grid ───────────────────────────
  sectionTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.md,
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    alignItems: 'center',
    ...SHADOW,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },

  // ── Quick actions ────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.md,
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.lg,
    alignItems: 'center',
    ...SHADOW,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  actionLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },

  // ── Locked features ──────────────────────
  lockedSection: {
    marginHorizontal: SIZES.md,
  },
  lockedFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    marginBottom: SIZES.sm,
    gap: SIZES.md,
    ...SHADOW,
  },
  lockedIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedTitle: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  lockedDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.sm,
    marginBottom: SIZES.md,
    ...SHADOW,
  },
  upgradeCTAText: {
    color: '#FFFFFF',
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
});