// ============================================
// FILE: src/components/StarRating.js
// ============================================
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StarRating({
  rating = 0,
  maxStars = 5,
  size = 28,
  onRate,           // if provided = interactive
  color = '#F39C12',
  emptyColor = '#E0E0E0',
}) {
  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < rating;
        const StarIcon = filled ? 'star' : 'star-outline';

        if (onRate) {
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onRate(i + 1)}
              activeOpacity={0.7}
              style={styles.star}
            >
              <Ionicons
                name={StarIcon}
                size={size}
                color={filled ? color : emptyColor}
              />
            </TouchableOpacity>
          );
        }

        return (
          <Ionicons
            key={i}
            name={StarIcon}
            size={size}
            color={filled ? color : emptyColor}
            style={styles.star}
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
  star: {
    marginHorizontal: 2,
  },
});