// ============================================
// FILE: src/components/StarRating.js
// ============================================
import React, { useState, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────
// SINGLE STAR
// ✅ Animated press feedback for interactive mode
// ─────────────────────────────────────────────
function AnimatedStar({ name, size, color, onPress }) {
  const scale = useState(new Animated.Value(1))[0];

  const handlePress = useCallback(() => {
    // ✅ Quick scale animation on tap
    Animated.sequence([
      Animated.spring(scale, {
        toValue:         1.3,
        useNativeDriver: true,
        speed:           50,
        bounciness:      8,
      }),
      Animated.spring(scale, {
        toValue:         1,
        useNativeDriver: true,
        speed:           50,
      }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.starBtn}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`Rate ${name === 'star' ? 'full' : 'empty'} star`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function StarRating({
  rating     = 0,
  maxStars   = 5,
  size       = 28,
  onRate,               // if provided → interactive mode
  color      = '#F39C12',
  emptyColor = '#E0E0E0',
  gap        = 2,       // space between stars
}) {
  // ✅ Clamp rating 0 → maxStars
  const safeRating = Math.min(
    maxStars,
    Math.max(0, rating || 0)
  );

  return (
    <View
      style={[styles.container, { gap }]}
      accessibilityRole={onRate ? 'adjustable' : 'none'}
      accessibilityLabel={`Rating: ${safeRating} out of ${maxStars} stars`}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const full      = starValue <= safeRating;

        // ✅ Fixed threshold: half star only when >= 0.5
        // e.g. 3.5 → 3 full + 1 half + 1 empty
        // e.g. 3.2 → 3 full + 2 empty (not half)
        const half = !full &&
                     !onRate && // half stars only in display mode
                     safeRating - i >= 0.5;

        const iconName  = full ? 'star' : half ? 'star-half' : 'star-outline';
        const iconColor = (full || half) ? color : emptyColor;

        // ── Interactive mode ────────────────
        if (onRate) {
          return (
            <AnimatedStar
              key={i}
              name={full ? 'star' : 'star-outline'}
              size={size}
              color={full ? color : emptyColor}
              onPress={() => onRate(starValue)}
            />
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
            accessibilityLabel={
              full ? 'full star' : half ? 'half star' : 'empty star'
            }
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems:    'center',
  },

  // ✅ Interactive star — uses size prop for touch target
  starBtn: {
    minWidth:       36,
    minHeight:      36,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ✅ Display-only star
  starDisplay: {
    marginHorizontal: 1,
  },
});