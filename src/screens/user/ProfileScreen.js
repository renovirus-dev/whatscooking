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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile, logout } = useAuth();
  const [signingOut, setSigningOut]   = useState(false);

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

  // ── Loading ───────────────────────────────
  if (!userProfile) {
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
    >

      {/* ── Header ──────────────────────────── */}
      {/*
        ✅ paddingTop uses insets.top so the avatar/name
        never hides behind the translucent status bar.
        The tab bar provides the bottom, stack screens
        use the header — so only top inset needed here.
      */}
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

        {/* Role badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {userProfile?.role === 'restaurant_owner'
              ? '🍴 Restaurant Owner'
              : userProfile?.role === 'admin'
              ? '⚡ Admin'
              : '👤 Food Lover'}
          </Text>
        </View>

        {/* Dietary preferences */}
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

      {/* ── Stats row ───────────────────────── */}
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

      {/* ── Account section ─────────────────── */}
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
          last
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              'Notification settings coming soon!'
            )
          }
        />
      </View>

      {/* ── Support section ─────────────────── */}
      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.section}>
        <ProfileButton
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() =>
            Alert.alert(
              'Help',
              'Contact us at support@whatscooking.app'
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
              "What's Cooking v1.0.0\nMade with ❤️"
            )
          }
        />
      </View>

      {/* ── Sign out button ──────────────────── */}
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

      {/* Version */}
      <Text style={styles.version}>What's Cooking v1.0.0</Text>

      {/*
        ✅ No hardcoded spacer here — paddingBottom on
        contentContainerStyle handles the bottom clearance
      */}

    </ScrollView>
  );
}

// ─── Profile Button ───────────────────────────
function ProfileButton({
  icon,
  label,
  onPress,
  danger = false,
  last  = false,
  badge,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // ✅ paddingTop/Bottom applied dynamically via insets in JSX
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // ── Header ──────────────────────────────
  // ✅ paddingTop set dynamically via insets in JSX
  // so avatar never hides behind translucent status bar
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingBottom: SIZES.xl,
    paddingHorizontal: SIZES.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SIZES.md,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.secondary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  displayName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bio: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: SIZES.sm,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: '600',
  },
  dietaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.xs,
    marginTop: SIZES.sm,
    justifyContent: 'center',
  },
  dietaryChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  dietaryChipText: {
    fontSize: FONTS.xs,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // ── Stats row ────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
    borderRadius: RADIUS.xl,
    padding: SIZES.md,
    ...SHADOW,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },

  // ── Section label ────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginTop: SIZES.lg,
    marginBottom: SIZES.xs,
    marginHorizontal: SIZES.md,
  },

  // ── Menu card ────────────────────────────
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SIZES.sm,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text,
  },
  dangerText: {
    color: COLORS.error,
  },
  badge: {
    backgroundColor: COLORS.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.xs,
    fontWeight: 'bold',
  },

  // ── Sign out button ───────────────────────
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.lg,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },

  // ── Version ──────────────────────────────
  version: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: FONTS.xs,
    marginTop: SIZES.md,
    // ✅ No marginBottom needed — contentContainerStyle
    // paddingBottom handles the bottom clearance
  },
});