// ============================================
// FILE: src/components/Steam.js
// Rising steam wisps for hot food items.
// ============================================
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';

const NATIVE = Platform.OS !== 'web';

const BEVERAGE_PATTERN = /beverage|drink|juice|soda|coffee|tea|smoothie|shake|cocktail/i;

// Steam only for food: skips beverages and anything unavailable
export const shouldShowSteam = (item) => {
  if (!item || item.isAvailable === false) return false;
  const category = `${item.category ?? ''} ${item.categoryId ?? ''}`;
  return !BEVERAGE_PATTERN.test(category);
};

const WISPS = [
  { left: '28%', delay: 0,    size: 9  },
  { left: '48%', delay: 700,  size: 12 },
  { left: '66%', delay: 1400, size: 9  },
];

function Wisp({ left, delay, size, height }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2400,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        styles.wisp,
        {
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: progress.interpolate({
            inputRange: [0, 0.2, 0.7, 1],
            outputRange: [0, 0.55, 0.25, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -height * 0.9],
              }),
            },
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: [0, 4, -4, 3],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1.8],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function Steam({ height = 40 }) {
  return (
    <View pointerEvents="none" style={[styles.container, { height }]}>
      {WISPS.map((w) => (
        <Wisp key={w.left} {...w} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  wisp: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
});
