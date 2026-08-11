// ============================================
// FILE: src/screens/user/ProfileScreen.js
// ============================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator,
  Image, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker      from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Application      from 'expo-application';
import {
  collection, query, where,
  onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db }                        from '../../firebase/config';
import { useAuth }                   from '../../hooks/useAuth';
import { useNotifications }          from '../../context/NotificationContext';
import { useSubscription, PLANS }    from '../../hooks/useSubscription';
import { CLOUDINARY_CONFIG }         from '../../config/cloudinary';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ✅ Safe color fallbacks
const WARNING_COLOR = COLORS.warning || '#F39C12';
const INFO_COLOR    = COLORS.info    || '#3498DB';

// ─────────────────────────────────────────────
// UPLOAD AVATAR TO CLOUDINARY
// ✅ Uses XMLHttpRequest — fixes FormDataPart error
// ─────────────────────────────────────────────
const uploadAvatarToCloudinary = (imageUri, userId) => {
  return new Promise(async (resolve) => {
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const formData = new FormData();
      formData.append('file', {
        uri:  compressed.uri,
        type: 'image/jpeg',
        name: `avatar_${userId}_${Date.now()}.jpg`,
      });
      formData.append('upload_preset', uploadPreset);
      formData.append('folder',        folders.profiles);
      // ✅ Same public_id overwrites old avatar automatically
      formData.append('public_id',     `avatar_${userId}`);

      // ✅ XMLHttpRequest — avoids FormDataPart error
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve({ success: true, url: data.secure_url });
        } else {
          let errMsg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMsg = errData.error?.message || errMsg;
          } catch {}
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror   = () => resolve({ success: false, error: 'Network error'     });
      xhr.ontimeout = () => resolve({ success: false, error: 'Upload timed out'  });
      xhr.timeout   = 60000;

      // ✅ DO NOT set Content-Type — XHR sets it automatically
      xhr.send(formData);

    } catch (err) {
      console.error('Avatar upload error:', err);
      resolve({ success: false, error: err.message });
    }
  });
};

// ─────────────────────────────────────────────
// PROFILE BUTTON COMPONENT
// ─────────────────────────────────────────────
const ProfileButton = ({
  icon, label, onPress,
  danger = false, last = false, badge, subtitle,
}) => (
  <TouchableOpacity
    style={[styles.menuItem, last && styles.menuItemLast]}
    onPress={onPress}
    activeOpacity={0.6}
  >
    <View style={[
      styles.menuIconBg,
      { backgroundColor: (danger ? COLORS.error : COLORS.primary) + '15' },
    ]}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? COLORS.error : COLORS.primary}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.menuLabel, danger && styles.dangerText]}>
        {label}
      </Text>
      {subtitle && (
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      )}
    </View>
    {badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    )}
    <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
  </TouchableOpacity>
);

// ─────────────────────────────────────────────
// OWNER SUBSCRIPTION CARD
// ✅ Uses onSnapshot for real-time updates
// ─────────────────────────────────────────────
const OwnerSubscriptionCard = ({ navigation, userId }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setRestaurant({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setRestaurant(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('OwnerSubscriptionCard error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.subCardLoading}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }
  if (!restaurant) return null;

  const planId  = restaurant?.subscription?.plan || 'free_trial';
  const plan    = PLANS[planId] || PLANS.free_trial;
  const exp     = restaurant?.subscription?.expiresAt;

  // ✅ Handle both Firestore Timestamp and ISO string
  const expDate  = exp?.toDate ? exp.toDate() : exp ? new Date(exp) : null;
  const daysLeft = expDate
    ? Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired  = daysLeft !== null && daysLeft <= 0;
  const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
  const subStatus  = restaurant?.subscription?.status;

  const getStatusText = () => {
    if (subStatus === 'awaiting_confirmation') return '⏳ Payment Pending';
    if (isExpired)  return '⚠️ Expired';
    if (isExpiring) return `⚠️ Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    if (planId === 'free_trial') return 'Free Trial';
    return '✅ Active';
  };

  const getStatusColor = () => {
    if (subStatus === 'awaiting_confirmation') return WARNING_COLOR;
    if (isExpired)  return COLORS.error;
    if (isExpiring) return WARNING_COLOR;
    return COLORS.success;
  };

  const payMethod = restaurant?.subscription?.paymentMethod;
  const payLabel  = payMethod === 'paypal'       ? '💳 PayPal'
                  : payMethod === 'bank_transfer' ? '🏦 Bank Transfer'
                  : null;

  return (
    <>
      <Text style={styles.sectionLabel}>MY SUBSCRIPTION</Text>
      <TouchableOpacity
        style={[
          styles.subscriptionCard,
          isExpired  && { borderColor: COLORS.error   + '40' },
          isExpiring && { borderColor: WARNING_COLOR   + '40' },
        ]}
        onPress={() => navigation.navigate('Subscription', { restaurant })}
        activeOpacity={0.85}
      >
        <View style={styles.subCardLeft}>
          <View style={[
            styles.subPlanIcon,
            { backgroundColor: plan.color + '20' },
          ]}>
            <Text style={{ fontSize: 28 }}>{plan.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subPlanName}>{plan.name} Plan</Text>
            <Text style={[styles.subPlanStatus, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
            {planId !== 'free_trial' && (
              <Text style={styles.subPlanPrice}>
                ${plan.price}/mo{' '}
                <Text style={styles.subPlanPriceJMD}>
                  (≈ J${plan.priceJMD?.toLocaleString()})
                </Text>
              </Text>
            )}
            {payLabel && (
              <View style={styles.paymentMethodChip}>
                <Text style={styles.paymentMethodChipText}>{payLabel}</Text>
              </View>
            )}
          </View>
        </View>

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
      {subStatus === 'awaiting_confirmation' && (
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
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const insets                        = useSafeAreaInsets();
  const { user, userProfile, logout } = useAuth();
  const { unreadCount }               = useNotifications();
  const [signingOut, setSigningOut]         = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOwner = userProfile?.role === 'restaurant_owner';
  const isAdmin = userProfile?.role === 'admin';

  // ✅ Real-time counts via onSnapshot in useAuth
  const savedRestaurantsCount = userProfile?.favoriteRestaurants?.length || 0;
  const favDishesCount        = userProfile?.favoriteDishes?.length       || 0;
  const dietaryPrefsCount     = userProfile?.dietaryPreferences?.length   || 0;

  // ── App version ───────────────────────────
  const appVersion = Application.nativeApplicationVersion || '1.0.0';

  // ─────────────────────────────────────────
  // SIGN OUT
  // ─────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setSigningOut(true);
              const result = await logout();
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to sign out');
              }
            } catch {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  }, [logout]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ─────────────────────────────────────────
  // AVATAR UPLOAD
  // ✅ XMLHttpRequest — fixes FormDataPart error
  // ─────────────────────────────────────────
  const handleAvatarPress = useCallback(() => {
    Alert.alert(
      '📷 Profile Photo',
      'Choose how to update your photo',
      [
        { text: '📷 Take Photo',          onPress: () => pickAvatar('camera')  },
        { text: '🖼️ Choose from Library', onPress: () => pickAvatar('library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const pickAvatar = useCallback(async (source) => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect:        [1, 1],
          quality:       1,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:    ['images'],
          allowsEditing: true,
          aspect:        [1, 1],
          quality:       1,
        });
      }

      if (result.canceled) return;

      const imageUri = result.assets[0].uri;
      setAvatarUploading(true);

      // ✅ Upload via XMLHttpRequest
      const uploadResult = await uploadAvatarToCloudinary(imageUri, user.uid);

      if (!uploadResult.success) {
        Alert.alert('Upload Failed', uploadResult.error || 'Please try again');
        return;
      }

      // ✅ Save to Firestore — onSnapshot updates avatar automatically
      await updateDoc(doc(db, 'users', user.uid), {
        avatar:    uploadResult.url,
        updatedAt: serverTimestamp(),
      });

      Alert.alert('✅ Photo Updated!', 'Your profile photo has been updated.');
    } catch (err) {
      console.error('Avatar pick error:', err);
      Alert.alert('Error', 'Could not update photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }, [user]);

  // ─────────────────────────────────────────
  // GUEST STATE
  // ─────────────────────────────────────────
  if (!user) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Ionicons name="person-circle-outline" size={80} color={COLORS.textMuted} />
        <Text style={styles.guestTitle}>Not Signed In</Text>
        <Text style={styles.guestSubtitle}>
          Sign in to access your profile, favorites and more
        </Text>
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => navigation.navigate('Auth')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (!userProfile) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // BANNED STATE
  // ─────────────────────────────────────────
  if (userProfile?.isBanned) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Ionicons name="ban-outline" size={60} color={COLORS.error} />
        <Text style={[styles.guestTitle, { color: COLORS.error }]}>
          Account Suspended
        </Text>
        <Text style={styles.guestSubtitle}>
          Your account has been suspended.{'\n'}
          Contact support at renogooden@outlook.com
        </Text>
        <TouchableOpacity
          style={[styles.signInBtn, { backgroundColor: COLORS.error }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.signInBtnText}>Sign Out</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + SIZES.xl }]}>

        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleAvatarPress}
          activeOpacity={0.8}
          disabled={avatarUploading}
        >
          {avatarUploading ? (
            <View style={styles.avatarCircle}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : userProfile?.avatar ? (
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
          {!avatarUploading && (
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Name */}
        <Text style={styles.displayName}>
          {userProfile?.firstName} {userProfile?.lastName}
        </Text>

        {/* Bio */}
        {!!userProfile?.bio && (
          <Text style={styles.bio}>{userProfile.bio}</Text>
        )}

        {/* Email */}
        <Text style={styles.email}>{user?.email}</Text>

        {/* Role Badge */}
        <View style={[
          styles.roleBadge,
          isAdmin && { backgroundColor: 'rgba(255,215,0,0.3)' },
        ]}>
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

      {/* ── Stats Row ───────────────────── */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Favorites')}
          activeOpacity={0.7}
        >
          <Text style={styles.statValue}>{savedRestaurantsCount}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('FavoriteDishes')}
          activeOpacity={0.7}
        >
          <Text style={styles.statValue}>{favDishesCount}</Text>
          <Text style={styles.statLabel}>Fav Dishes</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.7}
        >
          <Text style={styles.statValue}>{dietaryPrefsCount}</Text>
          <Text style={styles.statLabel}>Diet Prefs</Text>
        </TouchableOpacity>
      </View>

      {/* ── Subscription Card (Owners Only) ── */}
      {isOwner && (
        <OwnerSubscriptionCard
          navigation={navigation}
          userId={user.uid}
        />
      )}

      {/* ── Account Section ─────────────── */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.section}>
        <ProfileButton
          icon="person-outline"
          label="Edit Profile"
          subtitle="Name, bio, dietary preferences"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ProfileButton
          icon="heart-outline"
          label="Favourite Dishes"
          badge={favDishesCount || null}
          onPress={() => navigation.navigate('FavoriteDishes')}
        />
        <ProfileButton
          icon="restaurant-outline"
          label="Saved Restaurants"
          badge={savedRestaurantsCount || null}
          onPress={() => navigation.navigate('Favorites')}
        />
        <ProfileButton
          icon="notifications-outline"
          label="Notifications"
          badge={unreadCount > 0 ? unreadCount : null}
          last={!isOwner}
          onPress={() => navigation.navigate('Notifications')}
        />
        {isOwner && (
          <ProfileButton
            icon="diamond-outline"
            label="Manage Subscription"
            subtitle="View plans and billing"
            last
            onPress={() => navigation.navigate('OwnerDashboard')}
          />
        )}
      </View>

      {/* ── Support Section ─────────────── */}
      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.section}>
        <ProfileButton
          icon="mail-outline"
          label="Contact Us"
          subtitle="Get help from our team"
          onPress={() =>
            Alert.alert(
              '📧 Contact Us',
              'General support:\nsupport@whatscooking.app\n\nPayment issues:\nrenogooden@outlook.com',
              [{ text: 'OK' }]
            )
          }
        />
        <ProfileButton
          icon="help-circle-outline"
          label="Help & FAQ"
          onPress={() =>
            Alert.alert(
              '❓ Help & Support',
              'For subscription or payment help:\nrenogooden@outlook.com\n\nFor general questions:\nsupport@whatscooking.app',
              [{ text: 'OK' }]
            )
          }
        />

        {/* ✅ Privacy Policy — navigates to full screen */}
        <ProfileButton
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => navigation.navigate('PrivacyPolicy')}
        />

        <ProfileButton
          icon="information-circle-outline"
          label="About"
          subtitle={`Version ${appVersion}`}
          last
          onPress={() =>
            Alert.alert(
              "About What's Cooking",
              `Version ${appVersion}\nMade with ❤️ in Jamaica\n\n© ${new Date().getFullYear()} What's Cooking`,
              [{ text: 'OK' }]
            )
          }
        />
      </View>

      {/* ── Sign Out ────────────────────── */}
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

      <Text style={styles.version}>
        What's Cooking v{appVersion}
      </Text>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         SIZES.xl,
    backgroundColor: COLORS.background,
    gap:             SIZES.sm,
  },

  // ── Guest / Loading / Banned ──────────────
  guestTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  guestSubtitle: {
    fontSize:   FONTS.md,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 22,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },
  signInBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.md,
  },
  signInBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  // ── Header ────────────────────────────────
  header: {
    backgroundColor:   COLORS.primary,
    alignItems:        'center',
    paddingBottom:     SIZES.xl,
    paddingHorizontal: SIZES.lg,
    gap:               SIZES.xs,
  },
  avatarContainer: { position: 'relative', marginBottom: SIZES.sm },
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
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
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
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  bio:   { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  email: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)' },
  roleBadge: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
  },
  roleText:    { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: '600' },
  dietaryRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            SIZES.xs,
    justifyContent: 'center',
  },
  dietaryChip: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  dietaryChipText: { fontSize: FONTS.xs, color: '#FFFFFF', fontWeight: '500' },

  // ── Stats Row ─────────────────────────────
  statsRow: {
    flexDirection:    'row',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SIZES.md,
    marginTop:        SIZES.md,
    borderRadius:     RADIUS.xl,
    padding:          SIZES.md,
    ...SHADOW,
  },
  statItem:    { flex: 1, alignItems: 'center', paddingVertical: SIZES.xs },
  statValue:   { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  statLabel:   { fontSize: FONTS.xs,  color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  // ── Subscription Card ─────────────────────
  subCardLoading: {
    alignItems:       'center',
    padding:          SIZES.lg,
    marginHorizontal: SIZES.md,
  },
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
  subPlanName:   { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text },
  subPlanStatus: { fontSize: FONTS.sm, marginTop: 2, fontWeight: '500' },
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
  subActionBtnText: { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: 'bold' },
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
  pendingNoteText:  { fontSize: FONTS.xs, color: COLORS.text, flex: 1, lineHeight: 18 },
  pendingNoteEmail: { fontWeight: 'bold', color: COLORS.primary },

  // ── Section Labels + Menu ─────────────────
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
    paddingVertical:   SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider || COLORS.border,
    gap:               SIZES.sm,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIconBg: {
    width:          36,
    height:         36,
    borderRadius:   RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
  },
  menuLabel:    { fontSize: FONTS.md, color: COLORS.text, fontWeight: '500' },
  menuSubtitle: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  dangerText:   { color: COLORS.error },
  badge: {
    backgroundColor:   COLORS.primary,
    minWidth:          20,
    height:            20,
    borderRadius:      10,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: 'bold' },

  // ── Sign Out ──────────────────────────────
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
  signOutText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },
  version: {
    textAlign: 'center',
    color:     COLORS.textMuted,
    fontSize:  FONTS.xs,
    marginTop: SIZES.md,
  },
});