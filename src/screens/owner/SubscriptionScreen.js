// ============================================
// FILE: src/screens/owner/SubscriptionScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription, PLANS } from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function SubscriptionScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const { upgradePlan, cancelPlan } = useSubscription();
  const [loading, setLoading] = useState(null); // stores planId being processed

  const currentPlan = restaurant?.subscription?.plan || 'free_trial';

  const handleUpgrade = (planId) => {
    const plan = PLANS[planId];

    if (planId === currentPlan) {
      Alert.alert('Current Plan', 'You are already on this plan');
      return;
    }

    Alert.alert(
      `Upgrade to ${plan.name}`,
      `${plan.emoji} ${plan.name} Plan\n$${plan.price}/month\n\nThis is a demo upgrade. In production, this would connect to Stripe for payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Upgrade',
          onPress: async () => {
            setLoading(planId);
            const result = await upgradePlan(restaurant.id, planId);
            setLoading(null);

            if (result.success) {
              Alert.alert(
                '🎉 Plan Upgraded!',
                `You are now on the ${plan.name} plan!`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? You will lose access to premium features.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelPlan(restaurant.id);
            if (result.success) {
              Alert.alert('Cancelled', 'Your subscription has been cancelled');
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <Text style={styles.headerSubtitle}>
          Grow your restaurant with the right features
        </Text>

        {/* Current plan badge */}
        <View style={styles.currentPlanBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
          <Text style={styles.currentPlanText}>
            Current: {PLANS[currentPlan]?.name || 'Free Trial'}
          </Text>
        </View>
      </View>

      {/* ── Plan Cards ─────────────────────── */}
      {Object.values(PLANS)
        .filter(p => p.id !== 'free_trial')
        .map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isLoading = loading === plan.id;
          const isPremium = plan.id === 'premium';

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                isCurrent && styles.planCardActive,
                isPremium && styles.planCardPremium,
              ]}
            >
              {/* Popular badge */}
              {isPremium && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>⭐ MOST POPULAR</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={[
                  styles.planEmojiContainer,
                  { backgroundColor: plan.color + '20' },
                ]}>
                  <Text style={styles.planEmoji}>{plan.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.planName,
                    isPremium && styles.planNamePremium,
                  ]}>
                    {plan.name}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={[
                      styles.planPrice,
                      { color: plan.color },
                    ]}>
                      ${plan.price}
                    </Text>
                    <Text style={styles.planDuration}>
                      /{plan.duration}
                    </Text>
                  </View>
                </View>
                {isCurrent && (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Active</Text>
                  </View>
                )}
              </View>

              {/* Features list */}
              <View style={styles.featuresList}>
                {plan.features.map((feature, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={plan.color}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[
                  styles.upgradeBtn,
                  { backgroundColor: isCurrent ? COLORS.border : plan.color },
                  isCurrent && styles.upgradeBtnCurrent,
                ]}
                onPress={() => handleUpgrade(plan.id)}
                disabled={isCurrent || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={isCurrent ? 'checkmark' : 'arrow-up-circle'}
                      size={20}
                      color={isCurrent ? COLORS.textMuted : '#FFFFFF'}
                    />
                    <Text style={[
                      styles.upgradeBtnText,
                      isCurrent && styles.upgradeBtnTextCurrent,
                    ]}>
                      {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

      {/* ── Free Trial Info ─────────────────── */}
      <View style={styles.freeTrialCard}>
        <Text style={styles.freeTrialTitle}>🆓 Free Trial Includes:</Text>
        {PLANS.free_trial.features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark" size={16} color={COLORS.textMuted} />
            <Text style={styles.freeTrialFeature}>{f}</Text>
          </View>
        ))}
      </View>

      {/* ── Cancel subscription ─────────────── */}
      {currentPlan !== 'free_trial' && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
        >
          <Text style={styles.cancelBtnText}>
            Cancel Current Subscription
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Payment note ────────────────────── */}
      <View style={styles.paymentNote}>
        <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
        <Text style={styles.paymentNoteText}>
          Secure payments powered by Stripe.{'\n'}
          Cancel anytime. No hidden fees.
        </Text>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    padding: SIZES.xl,
    paddingTop: SIZES.xxl,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.xxxl || 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: FONTS.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: SIZES.xs,
    marginBottom: SIZES.md,
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: RADIUS.round,
    gap: SIZES.xs,
  },
  currentPlanText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: '600',
  },

  // Plan cards
  planCard: {
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    marginBottom: 0,
    borderRadius: RADIUS.xl,
    padding: SIZES.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW,
  },
  planCardActive: {
    borderColor: COLORS.success,
  },
  planCardPremium: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  popularBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    alignSelf: 'flex-start',
    marginBottom: SIZES.md,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: FONTS.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  planEmojiContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planEmoji: {
    fontSize: 28,
  },
  planName: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  planNamePremium: {
    color: COLORS.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  planPrice: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
  },
  planDuration: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },
  activeTag: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  activeTagText: {
    fontSize: FONTS.xs,
    color: COLORS.success,
    fontWeight: '700',
  },

  // Features
  featuresList: {
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  featureText: {
    fontSize: FONTS.md,
    color: COLORS.text,
    flex: 1,
  },

  // Upgrade button
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
  },
  upgradeBtnCurrent: {
    backgroundColor: COLORS.border,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
  upgradeBtnTextCurrent: {
    color: COLORS.textMuted,
  },

  // Free trial card
  freeTrialCard: {
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    padding: SIZES.lg,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  freeTrialTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  freeTrialFeature: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    flex: 1,
  },

  // Cancel
  cancelBtn: {
    marginHorizontal: SIZES.md,
    marginTop: SIZES.sm,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.error,
    fontSize: FONTS.md,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Payment note
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    margin: SIZES.md,
    padding: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
  },
  paymentNoteText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});