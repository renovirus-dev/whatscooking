// ============================================
// FILE: src/components/EliteGate.js
// Wraps owner screens that need the Elite plan
// ============================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../theme';
import { useOwnerRestaurant } from '../hooks/useEliteData';
import { isEliteRestaurant } from '../utils/eliteService';
import { Loader, PrimaryButton } from './ui';

export default function EliteGate({ navigation, children, feature }) {
  const { restaurant, loading } = useOwnerRestaurant();

  if (loading) return <Loader />;

  if (!restaurant) {
    return (
      <View style={s.box}>
        <Text style={s.emoji}>🍽️</Text>
        <Text style={s.title}>Set up your restaurant first</Text>
        <PrimaryButton
          label="Set up restaurant"
          onPress={() => navigation.navigate('RestaurantSetup')}
        />
      </View>
    );
  }

  if (!isEliteRestaurant(restaurant)) {
    return (
      <View style={s.box}>
        <Text style={s.emoji}>💎</Text>
        <Text style={s.title}>{feature} is an Elite feature</Text>
        <Text style={s.sub}>
          Upgrade to the Elite plan to unlock reservations, pre-orders,
          promotions, multiple locations and customer insights.
        </Text>
        <PrimaryButton
          label="View plans"
          color="#8E44AD"
          onPress={() => navigation.navigate('Subscription', { restaurant })}
        />
      </View>
    );
  }

  return children(restaurant);
}

const s = StyleSheet.create({
  box: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SIZES.lg, gap: SIZES.md, backgroundColor: COLORS.background,
  },
  emoji: { fontSize: 56 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sub:   { fontSize: FONTS.md, color: COLORS.textLight, textAlign: 'center', maxWidth: 420 },
});
