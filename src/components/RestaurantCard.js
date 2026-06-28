// ============================================
// FILE: src/components/RestaurantCard.js
// ============================================
import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';

export default function RestaurantCard({
  restaurant,
  onPress,
  style,
  horizontal,
  distance,   // ✅ NEW: e.g. "1.2km" or "800m"
}) {

  // ─── Horizontal Card ─────────────────────
  if (horizontal) {
    return (
      <TouchableOpacity
        style={[styles.hCard, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Image
          source={{
            uri: restaurant.coverUrl || restaurant.logoUrl ||
              'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300'
          }}
          style={styles.hImage}
        />
        <View style={styles.hInfo}>

          {/* Name */}
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>

          {/* Rating + Price */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={COLORS.star} />
            <Text style={styles.rating}>
              {restaurant.averageRating?.toFixed(1) || 'New'}
            </Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.price}>
              {restaurant.priceRange || '$$'}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons
              name="location"
              size={12}
              color={COLORS.textMuted}
            />
            <Text style={styles.location} numberOfLines={1}>
              {restaurant.location?.city || 'Location'}
            </Text>
          </View>

          {/* ✅ NEW: Distance badge row */}
          {distance && (
            <View style={styles.distanceRow}>
              <Ionicons
                name="navigate"
                size={12}
                color={COLORS.primary}
              />
              <Text style={styles.distanceText}>
                {distance} away
              </Text>
            </View>
          )}

          {/* Open / Closed status */}
          <View style={[
            styles.statusDot,
            {
              backgroundColor: restaurant.isCurrentlyOpen
                ? COLORS.success
                : COLORS.error,
            },
          ]}>
            <Text style={styles.statusText}>
              {restaurant.isCurrentlyOpen ? 'Open' : 'Closed'}
            </Text>
          </View>

        </View>
      </TouchableOpacity>
    );
  }

  // ─── Vertical Card (Featured) ─────────────
  return (
    <TouchableOpacity
      style={[styles.vCard, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image
        source={{
          uri: restaurant.coverUrl ||
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'
        }}
        style={styles.vImage}
      />

      {/* Open badge */}
      {restaurant.isCurrentlyOpen && (
        <View style={styles.openBadge}>
          <Text style={styles.openBadgeText}>Open</Text>
        </View>
      )}

      {/* ✅ NEW: Distance badge on image */}
      {distance && (
        <View style={styles.distanceBadge}>
          <Ionicons name="navigate" size={11} color={COLORS.primary} />
          <Text style={styles.distanceBadgeText}>{distance}</Text>
        </View>
      )}

      <View style={styles.vInfo}>

        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        {/* Rating + Cuisine */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={COLORS.star} />
          <Text style={styles.rating}>
            {restaurant.averageRating?.toFixed(1) || 'New'}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.cuisineText}>
            {restaurant.cuisineTypes?.[0] || 'Restaurant'}
          </Text>
        </View>

        {/* ✅ NEW: Distance row inside card info */}
        {distance && (
          <View style={styles.distanceRow}>
            <Ionicons
              name="navigate"
              size={12}
              color={COLORS.primary}
            />
            <Text style={styles.distanceText}>
              {distance} away
            </Text>
          </View>
        )}

      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({

  // ── Vertical card ──────────────────────────
  vCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW,
  },
  vImage: {
    width: '100%',
    height: 140,
  },
  vInfo: {
    padding: SIZES.md,
    gap: 4,
  },
  openBadge: {
    position: 'absolute',
    top: SIZES.sm,
    right: SIZES.sm,
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
  },
  openBadgeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: 'bold',
  },

  // ✅ NEW: Distance badge on image (vertical card)
  distanceBadge: {
    position: 'absolute',
    top: SIZES.sm,
    left: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
    ...SHADOW,
  },
  distanceBadgeText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── Horizontal card ────────────────────────
  hCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW,
  },
  hImage: {
    width: 110,
    height: 130,
  },
  hInfo: {
    flex: 1,
    padding: SIZES.md,
    justifyContent: 'space-evenly',
  },

  // ── Shared ─────────────────────────────────
  name: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: FONTS.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  dot: {
    color: COLORS.textMuted,
  },
  price: {
    fontSize: FONTS.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  cuisineText: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    textTransform: 'capitalize',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    flex: 1,
  },

  // ✅ NEW: Distance row (both cards)
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Status badge
  statusDot: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    marginTop: 4,
  },
  statusText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xs,
    fontWeight: '600',
  },
});