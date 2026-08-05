// ============================================
// FILE: src/components/RestaurantCard.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, Image,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';
import { getThumbUrl, getBannerUrl } from '../utils/uploadToCloudinary';

// ─── Safe Color Fallbacks ─────────────────────
const STAR_COLOR   = COLORS.star   || '#F39C12';
const ACCENT_COLOR = COLORS.accent || COLORS.primary;

// ─── Local Placeholder ───────────────────────
const PLACEHOLDER = require('../assets/images/restaurant_placeholder.png');

// ─────────────────────────────────────────────
// GET OPTIMIZED IMAGE URL
// ─────────────────────────────────────────────
const getCoverImage = (restaurant, isSmall = false) => {
  const url = restaurant?.coverUrl || restaurant?.logoUrl;
  if (url?.includes('cloudinary')) {
    return { uri: isSmall ? getThumbUrl(url, 300, 200) : getBannerUrl(url) };
  }
  if (url) return { uri: url };
  return PLACEHOLDER;
};

// ─────────────────────────────────────────────
// PLAN BADGE
// ─────────────────────────────────────────────
const PlanBadge = ({ plan }) => {
  if (!plan || plan === 'free_trial') return null;
  return (
    <View style={[
      styles.planBadge,
      { backgroundColor: plan === 'premium' ? '#FFD700' + '30' : COLORS.primary + '20' },
    ]}>
      <Text style={[
        styles.planBadgeText,
        { color: plan === 'premium' ? '#B8860B' : COLORS.primary },
      ]}>
        {plan === 'premium' ? '👑' : '⭐'}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function RestaurantCard({
  restaurant,
  onPress,
  style,
  horizontal = false,
  distance,
}) {
  const [imageError, setImageError] = useState(false);

  const plan     = restaurant?.subscription?.plan || 'free_trial';
  const coverSrc = imageError
    ? PLACEHOLDER
    : getCoverImage(restaurant, horizontal);

  // ─────────────────────────────────────────
  // HORIZONTAL CARD
  // ─────────────────────────────────────────
  if (horizontal) {
    return (
      <TouchableOpacity
        style={[styles.hCard, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Cover Image */}
        <View style={styles.hImageWrapper}>
          <Image
            source={coverSrc}
            style={styles.hImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          {/* Open/Closed dot */}
          <View style={[
            styles.hStatusDot,
            {
              backgroundColor: restaurant.isCurrentlyOpen
                ? COLORS.success
                : COLORS.error,
            },
          ]} />
        </View>

        {/* Info */}
        <View style={styles.hInfo}>

          {/* Name + Verified + Plan */}
          <View style={styles.hNameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {restaurant.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
            )}
            <PlanBadge plan={plan} />
          </View>

          {/* Rating + Price */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color={STAR_COLOR} />
            <Text style={styles.rating}>
              {restaurant.averageRating?.toFixed(1) || 'New'}
            </Text>
            {restaurant.totalReviews > 0 && (
              <Text style={styles.reviewCount}>
                ({restaurant.totalReviews})
              </Text>
            )}
            <Text style={styles.dot}>·</Text>
            <Text style={styles.price}>
              {restaurant.priceRange || '$$'}
            </Text>
          </View>

          {/* Cuisine */}
          {restaurant.cuisineTypes?.length > 0 && (
            <Text style={styles.cuisineText} numberOfLines={1}>
              {restaurant.cuisineTypes
                .slice(0, 2)
                .map(c => c.charAt(0).toUpperCase() + c.slice(1))
                .join(' · ')}
            </Text>
          )}

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {restaurant.location?.city || 'Location'}
            </Text>
          </View>

          {/* Distance */}
          {!!distance && (
            <View style={styles.distanceRow}>
              <Ionicons name="navigate-outline" size={12} color={COLORS.primary} />
              <Text style={styles.distanceText}>{distance} away</Text>
            </View>
          )}

          {/* Bottom: Status + Services */}
          <View style={styles.hBottomRow}>
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: restaurant.isCurrentlyOpen
                  ? COLORS.success + '20'
                  : COLORS.error   + '20',
              },
            ]}>
              <Text style={[
                styles.statusText,
                {
                  color: restaurant.isCurrentlyOpen
                    ? COLORS.success
                    : COLORS.error,
                },
              ]}>
                {restaurant.isCurrentlyOpen ? '🟢 Open' : '🔴 Closed'}
              </Text>
            </View>

            <View style={styles.servicesRow}>
              {restaurant.hasDelivery && <Text style={styles.serviceIcon}>🛵</Text>}
              {restaurant.hasTakeout  && <Text style={styles.serviceIcon}>🥡</Text>}
              {restaurant.hasDineIn   && <Text style={styles.serviceIcon}>🪑</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ─────────────────────────────────────────
  // VERTICAL CARD (Featured)
  // ─────────────────────────────────────────
  return (
    <TouchableOpacity
      style={[styles.vCard, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Cover Image */}
      <Image
        source={coverSrc}
        style={styles.vImage}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />

      {/* Top Badges */}
      <View style={styles.vTopBadges}>
        {!!distance && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={11} color={COLORS.primary} />
            <Text style={styles.distanceBadgeText}>{distance}</Text>
          </View>
        )}
        {restaurant.isCurrentlyOpen && (
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openBadgeText}>Open</Text>
          </View>
        )}
      </View>

      {/* Plan badge */}
      {plan !== 'free_trial' && (
        <View style={styles.vPlanBadge}>
          <Text style={styles.vPlanBadgeText}>
            {plan === 'premium' ? '👑' : '⭐'}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.vInfo}>
        <View style={styles.hNameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {restaurant.isVerified && (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          )}
        </View>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={13} color={STAR_COLOR} />
          <Text style={styles.rating}>
            {restaurant.averageRating?.toFixed(1) || 'New'}
          </Text>
          {restaurant.totalReviews > 0 && (
            <Text style={styles.reviewCount}>
              ({restaurant.totalReviews})
            </Text>
          )}
          <Text style={styles.dot}>·</Text>
          <Text style={styles.cuisineText}>
            {restaurant.cuisineTypes?.[0]
              ? restaurant.cuisineTypes[0].charAt(0).toUpperCase() +
                restaurant.cuisineTypes[0].slice(1)
              : 'Restaurant'}
          </Text>
        </View>

        {!!restaurant.location?.city && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {restaurant.location.city}
            </Text>
          </View>
        )}

        <View style={styles.servicesRow}>
          {restaurant.hasDelivery && <Text style={styles.serviceIcon}>🛵</Text>}
          {restaurant.hasTakeout  && <Text style={styles.serviceIcon}>🥡</Text>}
          {restaurant.hasDineIn   && <Text style={styles.serviceIcon}>🪑</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Vertical Card ─────────────────────────
  vCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    overflow:        'hidden',
    ...SHADOW,
  },
  vImage: {
    width:  '100%',
    height: 150,
  },
  vTopBadges: {
    position:      'absolute',
    top:           SIZES.sm,
    left:          SIZES.sm,
    right:         SIZES.sm,
    flexDirection: 'row',
    gap:           SIZES.xs,
  },
  vPlanBadge: {
    position:        'absolute',
    top:             SIZES.sm,
    right:           SIZES.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius:    RADIUS.round,
    width:           28,
    height:          28,
    justifyContent:  'center',
    alignItems:      'center',
  },
  vPlanBadgeText: { fontSize: 14 },
  vInfo: {
    padding: SIZES.md,
    gap:     4,
  },

  // ── Open Badge ────────────────────────────
  openBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.success,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
    gap:               4,
  },
  openDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#FFFFFF',
  },
  openBadgeText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xs,
    fontWeight: 'bold',
  },

  // ── Distance Badge ────────────────────────
  distanceBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
    ...SHADOW,
  },
  distanceBadgeText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '700',
  },

  // ── Plan Badge ────────────────────────────
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  planBadgeText: { fontSize: 12 },

  // ── Horizontal Card ───────────────────────
  hCard: {
    flexDirection:   'row',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    overflow:        'hidden',
    height:          140,
    ...SHADOW,
  },
  hImageWrapper: {
    width:  110,
    height: 140,
  },
  hImage: {
    width:  110,
    height: 140,
  },
  hStatusDot: {
    position:     'absolute',
    bottom:       SIZES.sm,
    left:         SIZES.sm,
    width:        10,
    height:       10,
    borderRadius: 5,
    borderWidth:  1.5,
    borderColor:  '#FFFFFF',
  },
  hInfo: {
    flex:           1,
    padding:        SIZES.sm,
    paddingLeft:    SIZES.md,
    justifyContent: 'space-between',
    gap:            2,
  },
  hNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
    flexWrap:      'wrap',
  },
  hBottomRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  // ── Shared ────────────────────────────────
  name: {
    flex:       1,
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  rating: {
    fontSize:   FONTS.xs,
    fontWeight: '600',
    color:      COLORS.text,
  },
  reviewCount: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },
  dot:   { color: COLORS.textMuted, fontSize: FONTS.xs },
  price: { fontSize: FONTS.xs, color: ACCENT_COLOR, fontWeight: '600' },
  cuisineText: {
    fontSize:      FONTS.xs,
    color:         COLORS.textLight,
    textTransform: 'capitalize',
    flexShrink:    1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  location: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
    flex:     1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  distanceText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf:         'flex-start',
    paddingHorizontal: SIZES.xs,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  statusText: {
    fontSize:   10,
    fontWeight: '600',
  },
  servicesRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  serviceIcon: { fontSize: 12 },
});