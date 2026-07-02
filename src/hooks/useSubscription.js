// ============================================
// FILE: src/hooks/useSubscription.js
// ============================================
import { useAuth } from './useAuth';

// ✅ Plans must match AdminDashboardScreen SUBSCRIPTION_PLANS
export const PLANS = {
  free_trial: {
    id:       'free_trial',
    name:     'Free Trial',
    emoji:    '🆓',
    price:    0,
    duration: 'trial',
    color:    '#95A5A6',
    features: [
      'Basic restaurant listing',
      'Up to 10 menu items',
      'Customer reviews',
      'Standard support',
    ],
  },
  basic: {
    id:       'basic',
    name:     'Basic',
    emoji:    '⭐',
    price:    9.99,
    duration: 'month',
    color:    '#3498DB',
    features: [
      'Unlimited menu items',
      'Basic analytics',
      'Priority listing',
      'Customer reviews',
      'Email support',
    ],
  },
  premium: {
    id:       'premium',
    name:     'Premium',
    emoji:    '👑',
    price:    24.99,
    duration: 'month',
    color:    '#FF6B35',
    features: [
      'Everything in Basic',
      'Full analytics dashboard',
      'Push notifications to followers',
      'Featured listing',
      'Guest vs user breakdown',
      'Priority support',
    ],
  },
};

export const useSubscription = () => {
  const { userProfile } = useAuth();

  // ✅ Check if restaurant has analytics access
  const hasAnalytics = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';
    return plan === 'premium';
  };

  // ✅ Check if restaurant has basic access
  const hasBasic = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';
    return plan === 'basic' || plan === 'premium';
  };

  // ✅ Check if plan is expired
  const isPlanExpired = (restaurant) => {
    if (!restaurant) return false;
    const plan      = restaurant?.subscription?.plan || 'free_trial';
    const expiresAt = restaurant?.subscription?.expiresAt;

    if (plan === 'free_trial') {
      const trialEnds = restaurant?.subscription?.trialEndsAt;
      if (!trialEnds) return false;
      return new Date(trialEnds) < new Date();
    }

    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // ✅ Get current plan object
  const getCurrentPlan = (restaurant) => {
    const planId = restaurant?.subscription?.plan || 'free_trial';
    return PLANS[planId] || PLANS.free_trial;
  };

  // ✅ Upgrade plan (called from SubscriptionScreen)
  const upgradePlan = async (restaurantId, planId) => {
    try {
      const { doc, updateDoc, serverTimestamp } =
        require('firebase/firestore');
      const { db } = require('../firebase/config');

      const plan      = PLANS[planId];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await updateDoc(
        doc(db, 'restaurants', restaurantId),
        {
          'subscription.plan':      planId,
          'subscription.status':    'active',
          'subscription.expiresAt': expiresAt.toISOString(),
          'subscription.updatedAt': serverTimestamp(),
          'subscription.price':     plan.price,
          updatedAt:                serverTimestamp(),
        }
      );
      return { success: true };
    } catch (err) {
      console.error('upgradePlan error:', err);
      return { success: false, error: err.message };
    }
  };

  // ✅ Cancel plan (called from SubscriptionScreen)
  const cancelPlan = async (restaurantId) => {
    try {
      const { doc, updateDoc, serverTimestamp } =
        require('firebase/firestore');
      const { db } = require('../firebase/config');

      await updateDoc(
        doc(db, 'restaurants', restaurantId),
        {
          'subscription.plan':      'free_trial',
          'subscription.status':    'cancelled',
          'subscription.expiresAt': null,
          'subscription.updatedAt': serverTimestamp(),
          updatedAt:                serverTimestamp(),
        }
      );
      return { success: true };
    } catch (err) {
      console.error('cancelPlan error:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    plans:          PLANS,
    hasAnalytics,
    hasBasic,
    isPlanExpired,
    getCurrentPlan,
    upgradePlan,
    cancelPlan,
  };
};