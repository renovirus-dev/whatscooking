// ============================================
// FILE: src/screens/owner/OwnerDashboardScreen.js
// ============================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, onSnapshot,
  getCountFromServer, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db }                from '../../firebase/config';
import { useAuth }           from '../../hooks/useAuth';
import {
  PLANS,
  useSubscription,
} from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Safe color fallbacks
const WARNING_COLOR = COLORS.warning || '#F39C12';
const INFO_COLOR    = COLORS.info    || '#3498DB';
const DIVIDER_COLOR = COLORS.divider || COLORS.border || '#E0E0E0';

export default function OwnerDashboardScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    hasAnalytics,
    isExpiringSoon,
    getDaysRemaining,
  } = useSubscription();

  const isMounted = useRef(true);

  // ── State ─────────────────────────────────
  const [restaurant, setRestaurant]     = useState(null);
  const [stats, setStats]               = useState({
    menuItems: 0,
    reviews:   0,
    favorites: 0,
  });
  const [isOpen, setIsOpen]             = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Mounted lifecycle ──────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─────────────────────────────────────────
  // LOAD STATS
  // ✅ Extracted so we can call on refresh
  // ─────────────────────────────────────────
  const loadStats = useCallback(async (restaurantId, restaurantData) => {
    if (!restaurantId || !isMounted.current) return;
    try {
      setStatsLoading(true);
      const [menuSnap, reviewSnap] = await Promise.all([
        getCountFromServer(query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurantId)
        )),
        getCountFromServer(query(
          collection(db, 'reviews'),
          where('restaurantId', '==', restaurantId)
        )),
      ]);
      if (isMounted.current) {
        setStats({
          menuItems: menuSnap.data().count,
          reviews:   reviewSnap.data().count,
          favorites: restaurantData?.totalFavorites || 0,
        });
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      if (isMounted.current) setStatsLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENER
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!isMounted.current) return;

        if (!snapshot.empty) {
          const rest = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          };
          setRestaurant(rest);
          setIsOpen(rest.isCurrentlyOpen || false);
          // ✅ Load stats whenever restaurant data changes
          await loadStats(rest.id, rest);
        } else {
          if (isMounted.current) setRestaurant(null);
        }
      },
      (err) => {
        if (!isMounted.current) return;
        console.error('Dashboard listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [user, loadStats]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ✅ Actually reloads stats now
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!restaurant) return;
    setRefreshing(true);
    await loadStats(restaurant.id, restaurant);
    setRefreshing(false);
  }, [restaurant, loadStats]);

  // ─────────────────────────────────────────
  // TOGGLE OPEN / CLOSED
  // ─────────────────────────────────────────
  const handleToggleOpen = useCallback(async (value) => {
    if (!restaurant) return;
    if (isMounted.current) setIsOpen(value);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isCurrentlyOpen: value,
        updatedAt:       serverTimestamp(),
      });
    } catch (err) {
      if (isMounted.current) setIsOpen(!value);
      Alert.alert('Error', 'Could not update status. Please try again.');
    }
  }, [restaurant]);

  // ─────────────────────────────────────────
  // SUBSCRIPTION HELPERS
  // ─────────────────────────────────────────
  const currentPlanId    = restaurant?.subscription?.plan || 'free_trial';
  const currentPlan      = PLANS[currentPlanId] || PLANS.free_trial;
  const analyticsEnabled = hasAnalytics(restaurant);
  const daysRemaining    = getDaysRemaining(restaurant);
  const expiringSoon     = isExpiringSoon(restaurant);

  const getPaymentMethodLabel = useCallback(() => {
    const method = restaurant?.subscription?.paymentMethod;
    if (method === 'paypal')        return '💳 PayPal';
    if (method === 'bank_transfer') return '🏦 Bank Transfer';
    return null;
  }, [restaurant]);

  // ✅ Fixed logic bug - was missing parentheses around && condition
  const getSubscriptionStatus = useCallback(() => {
    const subStatus = restaurant?.subscription?.status;
    const subMethod = restaurant?.subscription?.paymentMethod;

    // ── Bank transfer awaiting ───────────────
    if (
      subStatus === 'awaiting_confirmation' ||
      (subMethod === 'bank_transfer' && subStatus === 'pending')
    ) {
      return {
        text:  '⏳ Awaiting Payment Confirmation',
        color: WARNING_COLOR,
        isWarning: true,
      };
    }

    // ── Free trial ───────────────────────────
    if (currentPlanId === 'free_trial') {
      const trialEnd = restaurant?.subscription?.trialEndsAt;
      if (trialEnd) {
        const trialDate = trialEnd?.toDate
          ? trialEnd.toDate()
          : new Date(trialEnd);
        const daysLeft = Math.ceil(
          (trialDate - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 0) return {
          text: '⚠️ Trial expired',
          color: COLORS.error,
          isError: true,
        };
        if (daysLeft <= 3) return {
          text: `⚠️ ${daysLeft} days left`,
          color: WARNING_COLOR,
          isWarning: true,
        };
        return {
          text:  `${daysLeft} days remaining`,
          color: COLORS.success,
        };
      }
      return { text: '14 day trial', color: COLORS.textMuted };
    }

    // ── Paid plans ───────────────────────────
    const exp = restaurant?.subscription?.expiresAt;
    if (exp) {
      // ✅ Handle both Timestamp and ISO string
      const expDate  = exp?.toDate ? exp.toDate() : new Date(exp);
      const daysLeft = Math.ceil(
        (expDate - new Date()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 0) return {
        text:    '⚠️ Subscription expired',
        color:   COLORS.error,
        isError: true,
      };
      if (daysLeft <= 7) return {
        text:      `⚠️ Expires in ${daysLeft}d`,
        color:     WARNING_COLOR,
        isWarning: true,
      };
      return {
        text: `Renews ${expDate.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}`,
        color: COLORS.success,
      };
    }

    return { text: '✅ Active', color: COLORS.success };
  }, [restaurant, currentPlanId]);

  const subStatus = getSubscriptionStatus();

  // ─────────────────────────────────────────
  // STATS CARDS
  // ─────────────────────────────────────────
  const STATS = [
    {
      label:   'Menu Items',
      value:   statsLoading ? '...' : stats.menuItems,
      icon:    'restaurant-outline',
      color:   COLORS.primary,
      onPress: () => navigation.navigate('Menu', { restaurantId: restaurant?.id }),
    },
    {
      label:   'Reviews',
      value:   statsLoading ? '...' : stats.reviews,
      icon:    'star-outline',
      color:   WARNING_COLOR,
      onPress: null,
    },
    {
      label:   'Favorites',
      value:   statsLoading ? '...' : stats.favorites,
      icon:    'heart-outline',
      color:   COLORS.error,
      onPress: null,
    },
    {
      label:   'Rating',
      value:   restaurant?.averageRating?.toFixed(1) || '—',
      icon:    'trending-up-outline',
      color:   COLORS.success,
      onPress: null,
    },
  ];

  // ─────────────────────────────────────────
  // QUICK ACTIONS
  // ✅ Added Scan Menu action
  // ─────────────────────────────────────────
  const QUICK_ACTIONS = [
    {
      label:   'Add Menu Item',
      icon:    'add-circle-outline',
      color:   COLORS.primary,
      onPress: () => navigation.navigate('AddMenuItem', {
        restaurantId: restaurant?.id,
      }),
    },
    {
      label:   'Scan Menu',
      icon:    'scan-outline',
      color:   INFO_COLOR,
      onPress: () => navigation.navigate('MenuScanner', {
        restaurantId: restaurant?.id,
        restaurant,
      }),
    },
    {
      label:   "Today's Menu",
      icon:    'today-outline',
      color:   COLORS.success,
      onPress: () => navigation.navigate('Daily'),
    },
    {
      label:   'Edit Restaurant',
      icon:    'pencil-outline',
      color:   COLORS.secondary,
      onPress: () => navigation.navigate('RestaurantSetup', { restaurant }),
    },
    {
      label:   'View as Customer',
      icon:    'eye-outline',
      color:   '#8E44AD',
      onPress: () => restaurant && navigation.navigate(
        'RestaurantDetail',
        { restaurantId: restaurant.id, name: restaurant.name }
      ),
    },
    ...(analyticsEnabled ? [{
      label:   'Analytics',
      icon:    'bar-chart-outline',
      color:   INFO_COLOR,
      onPress: () => navigation.navigate('Analytics', { restaurant }),
    }] : []),
    {
      label:   'Subscription',
      icon:    'diamond-outline',
      color:   WARNING_COLOR,
      onPress: () => navigation.navigate('Subscription', { restaurant }),
    },
  ];

  // ─────────────────────────────────────────
  // NO RESTAURANT STATE
  // ─────────────────────────────────────────
  if (!restaurant) {
    return (
      <View style={[
        styles.noRestaurant,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={{ fontSize: 60 }}>🍽️</Text>
        <Text style={styles.noRestaurantTitle}>No Restaurant Yet</Text>
        <Text style={styles.noRestaurantText}>
          Create your restaurant profile to start{'\n'}
          receiving customers
        </Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('RestaurantSetup')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create Restaurant Profile</Text>
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* ── Header ──────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.planRow}>
            <Text style={styles.planEmoji}>{currentPlan.emoji}</Text>
            <Text style={styles.planName}>{currentPlan.name} Plan</Text>
            {/* ✅ Approval status */}
            {restaurant.isApproved ? (
              restaurant.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )
            ) : (
              <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(255,165,0,0.4)' }]}>
                <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                <Text style={styles.verifiedText}>Pending Approval</Text>
              </View>
            )}
          </View>
        </View>

        {/* ✅ Notification Bell + Open Toggle */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.openToggle}>
            <Text style={[
              styles.openLabel,
              { color: isOpen ? '#7AFF8A' : '#FFB3B3' },
            ]}>
              {isOpen ? 'Open' : 'Closed'}
            </Text>
            <Switch
              value={!!isOpen}
              onValueChange={handleToggleOpen}
              trackColor={{
                false: 'rgba(255,255,255,0.3)',
                true:  '#7AFF8A80',
              }}
              thumbColor={isOpen ? '#7AFF8A' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* ── Pending Approval Banner ─────── */}
      {!restaurant.isApproved && (
        <View style={styles.approvalBanner}>
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.approvalBannerTitle}>
              Awaiting Admin Approval
            </Text>
            <Text style={styles.approvalBannerText}>
              Your restaurant is under review. You'll be notified once approved.
            </Text>
          </View>
        </View>
      )}

      {/* ── Bank Transfer Pending Banner ─── */}
      {restaurant?.subscription?.status === 'awaiting_confirmation' && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingBannerTitle}>
              Bank Transfer Pending
            </Text>
            <Text style={styles.pendingBannerText}>
              Send your receipt to renogooden@outlook.com to activate.
              Tap for details.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ── Subscription Expired Banner ──── */}
      {subStatus.isError && currentPlanId !== 'free_trial' && (
        <TouchableOpacity
          style={styles.expiredBanner}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.expiredBannerTitle}>Subscription Expired</Text>
            <Text style={styles.expiredBannerText}>
              Renew now to keep your premium features.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ── Expiring Soon Banner ─────────── */}
      {subStatus.isWarning && !subStatus.isError &&
       currentPlanId !== 'free_trial' &&
       restaurant?.subscription?.status !== 'awaiting_confirmation' && (
        <TouchableOpacity
          style={styles.expiringBanner}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingBannerTitle}>
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} until renewal
            </Text>
            <Text style={styles.pendingBannerText}>
              Tap to renew your {currentPlan.name} plan.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ── Subscription Card ───────────── */}
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
              { color: subStatus.color },
            ]}>
              {subStatus.text}
            </Text>
            {currentPlanId !== 'free_trial' && (
              <View style={styles.subscriptionMeta}>
                <Text style={styles.subscriptionPrice}>
                  ${currentPlan.price}/mo{' '}
                  <Text style={styles.subscriptionPriceJMD}>
                    (≈ J${currentPlan.priceJMD?.toLocaleString()})
                  </Text>
                </Text>
                {getPaymentMethodLabel() && (
                  <View style={styles.paymentMethodBadge}>
                    <Text style={styles.paymentMethodBadgeText}>
                      {getPaymentMethodLabel()}
                    </Text>
                  </View>
                )}
              </View>
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

      {/* ── Feature Preview (Free Trial) ─── */}
      {currentPlanId === 'free_trial' && (
        <View style={styles.featuresPreview}>
          <Text style={styles.featuresPreviewTitle}>
            🚀 Unlock with Premium:
          </Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: 'bar-chart-outline',     label: 'Analytics'      },
              { icon: 'notifications-outline', label: 'Push Alerts'    },
              { icon: 'star-outline',          label: 'Featured'       },
              { icon: 'scan-outline',          label: 'Menu Scanner'   },
            ].map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Ionicons name={f.icon} size={18} color={COLORS.primary} />
                <Text style={styles.featureItemLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.paymentOptionsRow}>
            <Text style={styles.paymentOptionsLabel}>Pay with:</Text>
            <View style={styles.paymentOptionTag}>
              <Ionicons name="logo-paypal" size={13} color="#003087" />
              <Text style={styles.paymentOptionTagText}>PayPal</Text>
            </View>
            <View style={styles.paymentOptionTag}>
              <Ionicons name="business-outline" size={13} color={COLORS.primary} />
              <Text style={styles.paymentOptionTagText}>Scotiabank Transfer</Text>
            </View>
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

      {/* ── Analytics Card (Premium) ──────── */}
      {analyticsEnabled && (
        <TouchableOpacity
          style={styles.analyticsCard}
          onPress={() => navigation.navigate('Analytics', { restaurant })}
          activeOpacity={0.85}
        >
          <View style={styles.analyticsCardHeader}>
            <View style={styles.analyticsCardTitle}>
              <Ionicons name="bar-chart" size={20} color={COLORS.secondary} />
              <Text style={styles.analyticsCardTitleText}>Analytics</Text>
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
                icon:  'eye-outline',
                value: restaurant?.analytics?.totalViews    || 0,
                label: 'Views',
                color: INFO_COLOR,
              },
              {
                icon:  'call-outline',
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
                icon:  'trending-up-outline',
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
              · Tap to see full breakdown →
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Analytics Locked ─────────────── */}
      {!analyticsEnabled && (
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
              Track views, calls, WhatsApp contacts and conversion rate.
              Upgrade to Premium to unlock.
            </Text>
            <View style={styles.analyticsUpgradeChip}>
              <Text style={styles.analyticsUpgradeChipText}>
                👑 Upgrade to Premium — $24.99/mo →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Stats Grid ──────────────────── */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        {STATS.map((stat, i) => (
          <TouchableOpacity
            key={i}
            style={styles.statCard}
            onPress={stat.onPress || undefined}
            activeOpacity={stat.onPress ? 0.7 : 1}
          >
            <View style={[
              styles.statIcon,
              { backgroundColor: stat.color + '20' },
            ]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Quick Actions ────────────────── */}
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

      {/* ── Locked Premium Features ──────── */}
      {currentPlanId !== 'premium' && (
        <View style={styles.lockedSection}>
          <Text style={styles.sectionTitle}>🔒 Premium Features</Text>
          {[
            {
              icon:  'bar-chart-outline',
              title: 'Analytics Dashboard',
              desc:  'Track views, calls, WhatsApp & conversion rate',
            },
            {
              icon:  'notifications-outline',
              title: 'Push Notifications',
              desc:  'Alert followers when you post daily specials',
            },
            {
              icon:  'ribbon-outline',
              title: 'Featured Listing',
              desc:  'Appear at the top of search results',
            },
            {
              icon:  'scan-outline',
              title: 'Menu Scanner',
              desc:  'Scan physical menus to auto-add items',
            },
          ].map((feat, i) => (
            <TouchableOpacity
              key={i}
              style={styles.lockedFeature}
              onPress={() => navigation.navigate('Subscription', { restaurant })}
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
            onPress={() => navigation.navigate('Subscription', { restaurant })}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeCTAText}>
                Upgrade to Premium — $24.99/mo
              </Text>
              <Text style={styles.upgradeCTASubtext}>
                Pay with PayPal or Scotiabank Transfer
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── No Restaurant ─────────────────────────
  noRestaurant: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         SIZES.xl,
    backgroundColor: COLORS.background,
    gap:             SIZES.sm,
  },
  noRestaurantTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
    marginTop:  SIZES.lg,
  },
  noRestaurantText: {
    fontSize:     FONTS.lg,
    color:        COLORS.textLight,
    textAlign:    'center',
    marginBottom: SIZES.xl,
    lineHeight:   24,
  },
  createBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
  },
  createBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
  },

  // ── Header ────────────────────────────────
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: COLORS.primary,
    padding:         SIZES.lg,
  },
  restaurantName: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  planRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
    flexWrap:      'wrap',
  },
  planEmoji: { fontSize: 14 },
  planName: {
    fontSize:   FONTS.sm,
    color:      'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    gap:               3,
  },
  verifiedText: {
    fontSize:   FONTS.xs,
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  notifBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  openToggle: { alignItems: 'center', gap: 4 },
  openLabel:  { fontSize: FONTS.sm, fontWeight: 'bold' },

  // ── Banners ───────────────────────────────
  approvalBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#8E44AD',
    margin:          SIZES.md,
    marginBottom:    0,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
  },
  approvalBannerTitle: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  approvalBannerText: {
    fontSize:   FONTS.xs,
    color:      'rgba(255,255,255,0.9)',
    lineHeight: 16,
    marginTop:  2,
  },
  pendingBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: WARNING_COLOR,
    margin:          SIZES.md,
    marginBottom:    0,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
  },
  pendingBannerTitle: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  pendingBannerText: {
    fontSize:   FONTS.xs,
    color:      'rgba(255,255,255,0.9)',
    lineHeight: 16,
    marginTop:  2,
  },
  expiredBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.error,
    margin:          SIZES.md,
    marginBottom:    0,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
  },
  expiredBannerTitle: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  expiredBannerText: {
    fontSize:   FONTS.xs,
    color:      'rgba(255,255,255,0.9)',
    lineHeight: 16,
    marginTop:  2,
  },
  expiringBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#E67E22',
    margin:          SIZES.md,
    marginBottom:    0,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
  },

  // ── Subscription Card ─────────────────────
  subscriptionCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    margin:          SIZES.md,
    padding:         SIZES.md,
    borderRadius:    RADIUS.xl,
    gap:             SIZES.md,
    ...SHADOW,
  },
  subscriptionLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
  },
  subscriptionIconBg: {
    width:          52,
    height:         52,
    borderRadius:   RADIUS.lg,
    justifyContent: 'center',
    alignItems:     'center',
  },
  subscriptionPlanName: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  subscriptionStatus: { fontSize: FONTS.sm, marginTop: 2 },
  subscriptionMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginTop:     4,
    flexWrap:      'wrap',
  },
  subscriptionPrice: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  subscriptionPriceJMD: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    fontWeight: 'normal',
    fontStyle:  'italic',
  },
  paymentMethodBadge: {
    backgroundColor:   COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       COLORS.primary + '30',
  },
  paymentMethodBadgeText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  upgradeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.lg,
    gap:               4,
  },
  upgradeBtnManage: { backgroundColor: COLORS.secondary },
  upgradeBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: 'bold',
  },

  // ── Feature Preview ───────────────────────
  featuresPreview: {
    backgroundColor:  COLORS.primary + '08',
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.md,
    padding:          SIZES.md,
    borderRadius:     RADIUS.xl,
    borderWidth:      1,
    borderColor:      COLORS.primary + '20',
  },
  featuresPreviewTitle: {
    fontSize:     FONTS.md,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginBottom: SIZES.sm,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SIZES.sm,
    marginBottom:  SIZES.sm,
  },
  featureItem: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    gap:               6,
    ...SHADOW,
  },
  featureItemLabel: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '500',
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginBottom:  SIZES.sm,
    flexWrap:      'wrap',
  },
  paymentOptionsLabel: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  paymentOptionTag: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
    gap:               4,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  paymentOptionTagText: {
    fontSize:   FONTS.xs,
    color:      COLORS.text,
    fontWeight: '600',
  },
  seeAllPlansBtn:     { alignSelf: 'flex-end' },
  seeAllPlansBtnText: {
    color:      COLORS.primary,
    fontWeight: 'bold',
    fontSize:   FONTS.sm,
  },

  // ── Analytics Card ────────────────────────
  analyticsCard: {
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.md,
    borderRadius:     RADIUS.xl,
    padding:          SIZES.md,
    gap:              SIZES.sm,
    borderWidth:      1,
    borderColor:      COLORS.border,
    ...SHADOW,
  },
  analyticsCardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  analyticsCardTitle: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  analyticsCardTitleText: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  premiumBadge: {
    backgroundColor:   COLORS.primary + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       COLORS.primary + '40',
  },
  premiumBadgeText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '700',
  },
  analyticsViewAll: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  analyticsViewAllText: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  analyticsMiniGrid: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
  },
  analyticsMiniStat: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  analyticsMiniValue: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  analyticsMiniLabel: { fontSize: FONTS.xs, color: COLORS.textMuted },
  analyticsMinDivider: {
    width:           1,
    height:          40,
    backgroundColor: COLORS.border,
  },
  viewerBreakdown: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SIZES.xs,
    paddingTop:     SIZES.xs,
    borderTopWidth: 1,
    borderTopColor: DIVIDER_COLOR,
  },
  viewerBreakdownText: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
    flex:      1,
  },

  // ── Analytics Locked ──────────────────────
  analyticsLockedCard: {
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.md,
    borderRadius:     RADIUS.xl,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      COLORS.border,
    ...SHADOW,
  },
  analyticsLockedMock: {
    flexDirection:   'row',
    justifyContent:  'space-around',
    backgroundColor: COLORS.surface,
    padding:         SIZES.lg,
  },
  analyticsMockStat:  { alignItems: 'center', gap: 4 },
  analyticsMockValue: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.border,
  },
  analyticsMockLabel: { fontSize: FONTS.xs, color: COLORS.border },
  analyticsLockOverlay: {
    backgroundColor: 'rgba(44,62,80,0.92)',
    padding:         SIZES.lg,
    alignItems:      'center',
    gap:             SIZES.sm,
  },
  analyticsLockTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      '#FFFFFF',
    textAlign:  'center',
  },
  analyticsLockDesc: {
    fontSize:   FONTS.sm,
    color:      'rgba(255,255,255,0.8)',
    textAlign:  'center',
    lineHeight: 20,
  },
  analyticsUpgradeChip: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    marginTop:         SIZES.xs,
  },
  analyticsUpgradeChipText: {
    color:      '#FFFFFF',
    fontWeight: 'bold',
    fontSize:   FONTS.sm,
  },

  // ── Stats Grid ────────────────────────────
  sectionTitle: {
    fontSize:          FONTS.xl,
    fontWeight:        'bold',
    color:             COLORS.text,
    paddingHorizontal: SIZES.md,
    paddingTop:        SIZES.sm,
    marginBottom:      SIZES.sm,
  },
  statsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: SIZES.md,
    gap:               SIZES.md,
    marginBottom:      SIZES.md,
  },
  statCard: {
    flex:            1,
    minWidth:        '45%',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    alignItems:      'center',
    ...SHADOW,
  },
  statIcon: {
    width:          48,
    height:         48,
    borderRadius:   24,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   SIZES.sm,
  },
  statValue: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: FONTS.sm,  color: COLORS.textMuted                },

  // ── Quick Actions ─────────────────────────
  actionsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: SIZES.md,
    gap:               SIZES.md,
    marginBottom:      SIZES.md,
  },
  actionCard: {
    flex:            1,
    minWidth:        '45%',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.lg,
    alignItems:      'center',
    ...SHADOW,
  },
  actionIcon: {
    width:          56,
    height:         56,
    borderRadius:   RADIUS.lg,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   SIZES.sm,
  },
  actionLabel: {
    fontSize:   FONTS.md,
    fontWeight: '600',
    color:      COLORS.text,
    textAlign:  'center',
  },

  // ── Locked Features ───────────────────────
  lockedSection: { marginHorizontal: SIZES.md },
  lockedFeature: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    marginBottom:    SIZES.sm,
    gap:             SIZES.md,
    ...SHADOW,
  },
  lockedIconBg: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
  },
  lockedTitle: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  lockedDesc:  { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  lockBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  upgradeCTA: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.primary,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    marginTop:       SIZES.sm,
    marginBottom:    SIZES.md,
    ...SHADOW,
  },
  upgradeCTAText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
  upgradeCTASubtext: {
    color:     'rgba(255,255,255,0.8)',
    fontSize:  FONTS.xs,
    marginTop: 2,
  },
});