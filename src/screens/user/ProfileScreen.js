// ============================================
// FILE: src/screens/user/ProfileScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../hooks/useAuth';
import { useNotifications }  from '../../context/NotificationContext';
import { useSubscription, PLANS } from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Safe color fallback
const WARNING_COLOR = COLORS.warning || '#F39C12';

export default function ProfileScreen({ navigation }) {
  const insets                        = useSafeAreaInsets();
  const { user, userProfile, logout } = useAuth();
  const { unreadCount }               = useNotifications();
  const { getCurrentPlan, isPlanExpired } = useSubscription();
  const [signingOut, setSigningOut]   = useState(false);

  // ── Sign Out ───────────────────────────────
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setSigningOut(true);
              const result = await logout();
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to sign out');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  // ── Subscription helpers (owners only) ────
  const isOwner      = userProfile?.role === 'restaurant_owner';
  const isAdmin      = userProfile?.role === 'admin';

  // Loading state
  if (!userProfile) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
      {/* ── Header ────────────────────────── */}
      <View style={[
        styles.header,
        { paddingTop: insets.top + SIZES.xl },
      ]}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          {userProfile?.avatar ? (
            <Image
              source={{ uri: userProfile.avatar }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userProfile?.firstName?.[0]?.toUpperCase() || '👤'}
              </Text>
            </View>
          )}
          <View style={styles.editAvatarBadge}>
            <Ionicons name="camera" size={12} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Name */}
        <Text style={styles.displayName}>
          {userProfile?.firstName} {userProfile?.lastName}
        </Text>

        {/* Bio */}
        {userProfile?.bio ? (
          <Text style={styles.bio}>{userProfile.bio}</Text>
        ) : null}

        {/* Email */}
        <Text style={styles.email}>{user?.email}</Text>

        {/* Role Badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {isOwner ? '🍴 Restaurant Owner'
              : isAdmin ? '⚡ Admin'
              : '👤 Food Lover'}
          </Text>
        </View>

        {/* Dietary Preferences */}
        {userProfile?.dietaryPreferences?.length > 0 && (
          <View style={styles.dietaryRow}>
            {userProfile.dietaryPreferences.slice(0, 3).map((pref, i) => (
              <View key={i} style={styles.dietaryChip}>
                <Text style={styles.dietaryChipText}>{pref}</Text>
              </View>
            ))}
            {userProfile.dietaryPreferences.length > 3 && (
              <View style={styles.dietaryChip}>
                <Text style={styles.dietaryChipText}>
                  +{userProfile.dietaryPreferences.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Stats Row ─────────────────────── */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {userProfile?.favoriteRestaurants?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {userProfile?.favoriteDishes?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Fav Dishes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {userProfile?.dietaryPreferences?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Diet Prefs</Text>
        </View>
      </View>

      {/* ── Subscription Card (Owners Only) ── */}
      {isOwner && (
        <OwnerSubscriptionCard navigation={navigation} />
      )}

      {/* ── Account Section ───────────────── */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.section}>
        <ProfileButton
          icon="person-outline"
          label="Edit Profile"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ProfileButton
          icon="heart-outline"
          label="Favourite Dishes"
          badge={userProfile?.favoriteDishes?.length || null}
          onPress={() => navigation.navigate('FavoriteDishes')}
        />
        <ProfileButton
          icon="restaurant-outline"
          label="Saved Restaurants"
          badge={userProfile?.favoriteRestaurants?.length || null}
          onPress={() => navigation.navigate('Favorites')}
        />
        <ProfileButton
          icon="notifications-outline"
          label="Notifications"
          badge={unreadCount > 0 ? unreadCount : null}
          last={!isOwner}
          onPress={() => navigation.navigate('Notifications')}
        />
        {/* Owner only — go to their dashboard */}
        {isOwner && (
          <ProfileButton
            icon="diamond-outline"
            label="Manage Subscription"
            last
            onPress={() => navigation.navigate('OwnerDashboard')}
          />
        )}
      </View>

      {/* ── Support Section ───────────────── */}
      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.section}>
        <ProfileButton
          icon="mail-outline"
          label="Contact Us"
          onPress={() =>
            Alert.alert(
              'Contact Us',
              'Email us at:\nsupport@whatscooking.app\n\nFor payment issues:\nrenogooden@outlook.com'
            )
          }
        />
        <ProfileButton
          icon="help-circle-outline"
          label="Help & FAQ"
          onPress={() =>
            Alert.alert(
              'Help & Support',
              'For subscription or payment help,\ncontact: renogooden@outlook.com'
            )
          }
        />
        <ProfileButton
          icon="information-circle-outline"
          label="About"
          last
          onPress={() =>
            Alert.alert(
              'About',
              "What's Cooking v1.0.0\nMade with ❤️ in Jamaica"
            )
          }
        />
      </View>

      {/* ── Sign Out ──────────────────────── */}
      <TouchableOpacity
        style={[
          styles.signOutButton,
          signingOut && styles.signOutButtonDisabled,
        ]}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.8}
      >
        {signingOut ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.version}>What's Cooking v1.0.0</Text>
    </ScrollView>
  );
}

// ──────────────────────────────────────────────
// Owner Subscription Card
// Shows current plan + quick upgrade button
// Only visible to restaurant owners
// ──────────────────────────────────────────────
function OwnerSubscriptionCard({ navigation }) {
  const { user }       = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loaded, setLoaded]         = useState(false);

  // Lazy load restaurant data
  React.useEffect(() => {
    const loadRestaurant = async () => {
      try {
        const { db }        = require('../../firebase/config');
        const { collection, query, where, getDocs } =
          require('firebase/firestore');

        const q    = query(
          collection(db, 'restaurants'),
          where('ownerId', '==', user?.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRestaurant({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        console.error('ProfileScreen restaurant load:', err);
      } finally {
        setLoaded(true);
      }
    };

    if (user?.uid) loadRestaurant();
  }, [user?.uid]);

  if (!loaded) return null;
  if (!restaurant) return null;

  const planId  = restaurant?.subscription?.plan || 'free_trial';
  const plan    = PLANS[planId] || PLANS.free_trial;

  // Expiry info
  const expiresAt = restaurant?.subscription?.expiresAt;
  const daysLeft  = expiresAt
    ? Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired  = daysLeft !== null && daysLeft <= 0;
  const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;

  // Status text
  const getStatusText = () => {
    const status = restaurant?.subscription?.status;
    if (status === 'awaiting_confirmation') return '⏳ Payment Pending';
    if (isExpired)  return '⚠️ Expired';
    if (isExpiring) return `⚠️ Expires in ${daysLeft} days`;
    if (planId === 'free_trial') return 'Free Trial';
    return '✅ Active';
  };

  const getStatusColor = () => {
    const status = restaurant?.subscription?.status;
    if (status === 'awaiting_confirmation') return WARNING_COLOR;
    if (isExpired)  return COLORS.error;
    if (isExpiring) return WARNING_COLOR;
    return COLORS.success;
  };

  // Payment method label
  const payMethod = restaurant?.subscription?.paymentMethod;
  const getPaymentLabel = () => {
    if (payMethod === 'paypal')        return '💳 PayPal';
    if (payMethod === 'bank_transfer') return '🏦 Bank Transfer';
    return null;
  };

  return (
    <>
      <Text style={styles.sectionLabel}>MY SUBSCRIPTION</Text>
      <TouchableOpacity
        style={styles.subscriptionCard}
        onPress={() => restaurant && navigation.navigate('Subscription', { restaurant })}
        activeOpacity={0.85}
      >
        {/* Plan Icon + Info */}
        <View style={styles.subCardLeft}>
          <View style={[
            styles.subPlanIcon,
            { backgroundColor: plan.color + '20' },
          ]}>
            <Text style={{ fontSize: 28 }}>{plan.emoji}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.subPlanName}>{plan.name} Plan</Text>
            <Text style={[
              styles.subPlanStatus,
              { color: getStatusColor() },
            ]}>
              {getStatusText()}
            </Text>

            {/* Price */}
            {planId !== 'free_trial' && (
              <Text style={styles.subPlanPrice}>
                ${plan.price}/mo
                {'  '}
                <Text style={styles.subPlanPriceJMD}>
                  (≈ J${plan.priceJMD?.toLocaleString()})
                </Text>
              </Text>
            )}

            {/* Payment method */}
            {getPaymentLabel() && (
              <View style={styles.paymentMethodChip}>
                <Text style={styles.paymentMethodChipText}>
                  {getPaymentLabel()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Upgrade / Manage Button */}
        <View style={[
          styles.subActionBtn,
          planId === 'premium' && { backgroundColor: COLORS.secondary },
        ]}>
          <Text style={styles.subActionBtnText}>
            {planId === 'premium' ? 'Manage' : 'Upgrade'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Payment Pending Note */}
      {restaurant?.subscription?.status === 'awaiting_confirmation' && (
        <View style={styles.pendingNote}>
          <Ionicons name="time-outline" size={16} color={WARNING_COLOR} />
          <Text style={styles.pendingNoteText}>
            Your bank transfer is being verified.{'\n'}
            Email receipt to{' '}
            <Text style={styles.pendingNoteEmail}>
              renogooden@outlook.com
            </Text>
          </Text>
        </View>
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Profile Button Component
// ──────────────────────────────────────────────
function ProfileButton({
  icon, label, onPress,
  danger = false, last = false, badge,
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, last && styles.menuItemLast]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Ionicons
        name={icon}
        size={22}
        color={danger ? COLORS.error : COLORS.primary}
      />
      <Text style={[styles.menuLabel, danger && styles.dangerText]}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
    </TouchableOpacity>
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
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: COLORS.background,
  },

  // ── Header ──────────────────────────────
  header: {
    backgroundColor:   COLORS.primary,
    alignItems:        'center',
    paddingBottom:     SIZES.xl,
    paddingHorizontal: SIZES.lg,
  },
  avatarContainer: {
    position:     'relative',
    marginBottom: SIZES.md,
  },
  avatarImage: {
    width:        90,
    height:       90,
    borderRadius: 45,
    borderWidth:  3,
    borderColor:  '#FFFFFF',
  },
  avatarCircle: {
    width:           90,
    height:          90,
    borderRadius:    45,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     3,
    borderColor:     'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize:   36,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  editAvatarBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    backgroundColor: COLORS.secondary,
    width:           26,
    height:          26,
    borderRadius:    13,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     '#FFFFFF',
  },
  displayName: {
    fontSize:     FONTS.xxl,
    fontWeight:   'bold',
    color:        '#FFFFFF',
    marginBottom: 4,
  },
  bio: {
    fontSize:     FONTS.sm,
    color:        'rgba(255,255,255,0.8)',
    textAlign:    'center',
    marginBottom: 4,
  },
  email: {
    fontSize:     FONTS.sm,
    color:        'rgba(255,255,255,0.85)',
    marginBottom: SIZES.sm,
  },
  roleBadge: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
  },
  roleText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: '600',
  },
  dietaryRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            SIZES.xs,
    marginTop:      SIZES.sm,
    justifyContent: 'center',
  },
  dietaryChip: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  dietaryChipText: {
    fontSize:   FONTS.xs,
    color:      '#FFFFFF',
    fontWeight: '500',
  },

  // ── Stats Row ────────────────────────────
  statsRow: {
    flexDirection:    'row',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    marginTop:        SIZES.md,
    borderRadius:     RADIUS.xl,
    padding:          SIZES.md,
    ...SHADOW,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  statLabel:   { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  // ── Subscription Card ────────────────────
  subscriptionCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    padding:          SIZES.md,
    borderRadius:     RADIUS.xl,
    gap:              SIZES.md,
    borderWidth:      1,
    borderColor:      COLORS.border,
    ...SHADOW,
  },
  subCardLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
  },
  subPlanIcon: {
    width:          56,
    height:         56,
    borderRadius:   RADIUS.lg,
    justifyContent: 'center',
    alignItems:     'center',
  },
  subPlanName: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  subPlanStatus: {
    fontSize:  FONTS.sm,
    marginTop: 2,
    fontWeight: '500',
  },
  subPlanPrice: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
    marginTop:  2,
  },
  subPlanPriceJMD: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    fontWeight: 'normal',
    fontStyle:  'italic',
  },
  paymentMethodChip: {
    backgroundColor:   COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    marginTop:         4,
    alignSelf:         'flex-start',
    borderWidth:       1,
    borderColor:       COLORS.primary + '30',
  },
  paymentMethodChipText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  subActionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.lg,
    gap:               4,
  },
  subActionBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: 'bold',
  },

  // ── Pending Note ─────────────────────────
  pendingNote: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  WARNING_COLOR + '15',
    marginHorizontal: SIZES.md,
    marginTop:        SIZES.xs,
    padding:          SIZES.sm,
    borderRadius:     RADIUS.md,
    gap:              SIZES.sm,
    borderWidth:      1,
    borderColor:      WARNING_COLOR + '30',
  },
  pendingNoteText: {
    fontSize:   FONTS.xs,
    color:      COLORS.text,
    flex:       1,
    lineHeight: 18,
  },
  pendingNoteEmail: {
    fontWeight: 'bold',
    color:      COLORS.primary,
  },

  // ── Section Labels ───────────────────────
  sectionLabel: {
    fontSize:         11,
    fontWeight:       '700',
    color:            COLORS.textMuted,
    letterSpacing:    1.2,
    marginTop:        SIZES.lg,
    marginBottom:     SIZES.xs,
    marginHorizontal: SIZES.md,
  },
  section: {
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius:     RADIUS.lg,
    overflow:         'hidden',
    ...SHADOW,
  },
  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider || COLORS.border,
    gap:               SIZES.sm,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuLabel: {
    flex:     1,
    fontSize: FONTS.lg,
    color:    COLORS.text,
  },
  dangerText: { color: COLORS.error },
  badge: {
    backgroundColor:   COLORS.primary,
    minWidth:          20,
    height:            20,
    borderRadius:      10,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xs,
    fontWeight: 'bold',
  },

  // ── Sign Out ─────────────────────────────
  signOutButton: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  COLORS.error,
    marginHorizontal: SIZES.md,
    marginTop:        SIZES.lg,
    paddingVertical:  SIZES.md,
    borderRadius:     RADIUS.lg,
    gap:              SIZES.sm,
    ...SHADOW,
  },
  signOutButtonDisabled: { opacity: 0.7 },
  signOutText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    color:     COLORS.textMuted,
    fontSize:  FONTS.xs,
    marginTop: SIZES.md,
  },
});