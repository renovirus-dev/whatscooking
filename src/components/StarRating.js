// ============================================
// FILE: src/components/StarRating.js
// ============================================
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StarRating({
  rating     = 0,
  maxStars   = 5,
  size       = 28,
  onRate,                    // if provided = interactive
  color      = '#F39C12',
  emptyColor = '#E0E0E0',
}) {
  // ✅ Clamp rating between 0 and maxStars
  // Prevents crashes from bad data e.g. rating = undefined or 6
  const safeRating = Math.min(
    maxStars,
    Math.max(0, rating || 0)
  );

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => {
        // ✅ Support half stars for display mode
        // e.g. rating 3.5 shows 3 full + 1 half + 1 empty
        const full    = i + 1 <= safeRating;
        const half    = !full &&
                        i < safeRating &&
                        safeRating - i >= 0.25 &&
                        !onRate; // half stars only in display mode

        const iconName = full
          ? 'star'
          : half
          ? 'star-half'
          : 'star-outline';

        const iconColor = (full || half) ? color : emptyColor;

        // ── Interactive mode ────────────────
        if (onRate) {
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onRate(i + 1)}
              activeOpacity={0.7}
              style={styles.starBtn}
              // ✅ Larger tap area for interactive stars
              hitSlop={{
                top: 8, bottom: 8,
                left: 4, right: 4,
              }}
            >
              <Ionicons
                name={full ? 'star' : 'star-outline'}
                size={size}
                color={full ? color : emptyColor}
              />
            </TouchableOpacity>
          );
        }

        // ── Display mode ────────────────────
        return (
          <Ionicons
            key={i}
            name={iconName}
            size={size}
            color={iconColor}
            style={styles.starDisplay}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ✅ Interactive star button
  starBtn: {
    marginHorizontal: 2,
    // ✅ Minimum touch target
    minWidth:  Math.max(28, 36),
    minHeight: Math.max(28, 36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ✅ Display-only star
  starDisplay: {
    marginHorizontal: 2,
  },
});