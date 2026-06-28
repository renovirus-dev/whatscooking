// ============================================
// FILE: src/hooks/useSubscription.js
// ============================================
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const PLANS = {
  free_trial: {
    id:       'free_trial',
    name:     'Free Trial',
    price:    0,
    emoji:    '🆓',
    color:    '#95A5A6',
    duration: '14 days',
    features: [
      '1 restaurant listing',
      'Up to 10 menu items',
      'Customer reviews',
      'Basic profile page',
    ],
    limits: {
      menuItems:     10,
      featured:      false,
      analytics:     false,   // ❌ no analytics
      notifications: false,
      priority:      false,
    },
  },

  basic: {
    id:       'basic',
    name:     'Basic',
    price:    9.99,
    emoji:    '⭐',
    color:    '#3498DB',
    duration: 'per month',
    features: [
      'Unlimited menu items',
      'Featured in search results',
      'Daily menu specials',
      'Customer reviews',
      'WhatsApp integration',
    ],
    limits: {
      menuItems:     -1,      // unlimited
      featured:      true,
      analytics:     false,   // ❌ no analytics on basic
      notifications: false,
      priority:      false,
    },
  },

  premium: {
    id:       'premium',
    name:     'Premium',
    price:    24.99,
    emoji:    '👑',
    color:    '#FF6B35',
    duration: 'per month',
    features: [
      'Everything in Basic',
      'Full Analytics Dashboard',
      'Guest & user tracking',
      'Conversion rate insights',
      'Push notifications to followers',
      'Promotional banners',
      'Priority customer support',
      'Top of search results',
      'Custom restaurant URL',
      'Unlimited photos',
    ],
    limits: {
      menuItems:     -1,
      featured:      true,
      analytics:     true,    // ✅ analytics ONLY on premium
      notifications: true,
      priority:      true,
    },
  },
};

export const useSubscription = () => {

  // ─── Check if plan has a feature ───────────
  const canAccess = (restaurant, feature) => {
    const planId = restaurant?.subscription?.plan || 'free_trial';
    const plan   = PLANS[planId];
    return plan?.limits?.[feature] === true;
  };

  // ✅ Specific check for analytics access
  const hasAnalytics = (restaurant) => {
    return canAccess(restaurant, 'analytics');
  };

  // ─── Upgrade plan ───────────────────────────
  const upgradePlan = async (restaurantId, planId) => {
    try {
      const plan = PLANS[planId];
      if (!plan) {
        return { success: false, error: 'Invalid plan' };
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await updateDoc(doc(db, 'restaurants', restaurantId), {
        subscription: {
          plan:      planId,
          status:    'active',
          startedAt: serverTimestamp(),
          expiresAt,
          price:     plan.price,
        },
        // ✅ Premium gets featured automatically
        isFeatured: planId === 'premium',
        updatedAt:  serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─── Cancel plan ────────────────────────────
  const cancelPlan = async (restaurantId) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        'subscription.status': 'cancelled',
        isFeatured:            false,
        updatedAt:             serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const getPlanDetails = (planId) => {
    return PLANS[planId] || PLANS.free_trial;
  };

  return {
    plans: PLANS,
    upgradePlan,
    cancelPlan,
    getPlanDetails,
    canAccess,
    hasAnalytics,   // ✅ exported for easy use
  };
};