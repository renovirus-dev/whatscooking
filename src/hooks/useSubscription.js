// ============================================
// FILE: src/hooks/useSubscription.js
// ============================================
import { useState } from 'react';
import { useAuth }  from './useAuth';
import { db }       from '../firebase/config';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

// ─── Plans ────────────────────────────────────
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
    priceJMD: 1550,
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
    priceJMD: 3875,
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

// ─── PayPal Config ────────────────────────────
export const PAYPAL_CONFIG = {
  BUSINESS_EMAIL: 'renogooden@outlook.com',
  CURRENCY:       'USD',
  APP_NAME:       "What's Cooking",
  RETURN_URL:     'https://whatscooking.app/payment/success',
  CANCEL_URL:     'https://whatscooking.app/payment/cancel',
  ENVIRONMENT:    'live',
};

// ─── Bank Transfer Details ────────────────────
export const BANK_TRANSFER_DETAILS = {
  bankName:      'Scotiabank Jamaica',
  accountName:   'Sherwayne Gooden',
  accountNumber: '000942189',
  transitNumber: '50765',
  accountType:   'Chequing',
  currency:      'JMD',
  email:         'renogooden@outlook.com',
  instructions:  'Use your Order ID as the payment reference.',
  note:          'Plan activated within 24 hours of receipt confirmation.',
};

// ─── Build PayPal Checkout URL ────────────────
export const buildPayPalCheckoutURL = ({
  orderId,
  amount,
  planName,
  customerEmail,
}) => {
  const baseURL =
    PAYPAL_CONFIG.ENVIRONMENT === 'sandbox'
      ? 'https://www.sandbox.paypal.com/cgi-bin/webscr'
      : 'https://www.paypal.com/cgi-bin/webscr';

  const params = new URLSearchParams({
    cmd:           '_xclick',
    business:      PAYPAL_CONFIG.BUSINESS_EMAIL,
    item_name:     `${PAYPAL_CONFIG.APP_NAME} - ${planName} Plan`,
    item_number:   orderId,
    amount:        amount.toFixed(2),
    currency_code: PAYPAL_CONFIG.CURRENCY,
    return:        PAYPAL_CONFIG.RETURN_URL,
    cancel_return: PAYPAL_CONFIG.CANCEL_URL,
    custom:        orderId,
    no_shipping:   '1',
    no_note:       '1',
  });

  if (customerEmail) {
    params.append('email', customerEmail);
  }

  return `${baseURL}?${params.toString()}`;
};

// ─── Hook ─────────────────────────────────────
export const useSubscription = () => {
  const { userProfile } = useAuth();
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ─────────────────────────────────────────
  // PLAN HELPERS
  // ─────────────────────────────────────────

  const hasAnalytics = (restaurant) => {
    if (!restaurant) return false;
    return (
      restaurant?.subscription?.plan || 'free_trial'
    ) === 'premium';
  };

  const hasBasic = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';
    return plan === 'basic' || plan === 'premium';
  };

  // ✅ FIX: handles both Timestamp and ISO string
  const isPlanExpired = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';

    if (plan === 'free_trial') {
      const trialEnds = restaurant?.subscription?.trialEndsAt;
      if (!trialEnds) return false;
      // ✅ Handle both Firestore Timestamp and ISO string
      const trialDate = trialEnds?.toDate
        ? trialEnds.toDate()
        : new Date(trialEnds);
      return trialDate < new Date();
    }

    const expiresAt = restaurant?.subscription?.expiresAt;
    if (!expiresAt) return false;
    // ✅ Handle both Firestore Timestamp and ISO string
    const expiryDate = expiresAt?.toDate
      ? expiresAt.toDate()
      : new Date(expiresAt);
    return expiryDate < new Date();
  };

  // ✅ NEW: days remaining helper
  const getDaysRemaining = (restaurant) => {
    if (!restaurant) return 0;
    const plan = restaurant?.subscription?.plan || 'free_trial';

    const dateField = plan === 'free_trial'
      ? restaurant?.subscription?.trialEndsAt
      : restaurant?.subscription?.expiresAt;

    if (!dateField) return 0;

    const endDate = dateField?.toDate
      ? dateField.toDate()
      : new Date(dateField);

    const diff = endDate - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // ✅ NEW: expiring soon (within 7 days)
  const isExpiringSoon = (restaurant) => {
    const days = getDaysRemaining(restaurant);
    return days > 0 && days <= 7;
  };

  const getCurrentPlan = (restaurant) => {
    const planId = restaurant?.subscription?.plan || 'free_trial';
    return PLANS[planId] || PLANS.free_trial;
  };

  // ─────────────────────────────────────────
  // CREATE PAYMENT ORDER
  // Saves order BEFORE payment opens
  // Tracks payment even if user closes app
  // ─────────────────────────────────────────
  const createPaymentOrder = async (
    restaurantId,
    planId,
    userId,
    method = 'paypal'
  ) => {
    try {
      setPaymentLoading(true);
      const plan = PLANS[planId];

      // ✅ Validate plan exists
      if (!plan) {
        return { success: false, error: `Invalid plan: ${planId}` };
      }

      // ✅ Validate price > 0 (can't pay for free trial)
      if (plan.price === 0) {
        return { success: false, error: 'Cannot create order for free plan' };
      }

      const orderRef = await addDoc(collection(db, 'paymentOrders'), {
        restaurantId,
        userId,
        planId,
        planName:      plan.name,
        amount:        plan.price,
        amountJMD:     plan.priceJMD || 0,
        currency:      PAYPAL_CONFIG.CURRENCY,
        status:        'pending',
        paymentMethod: method,
        receivingBank: method === 'bank_transfer'
          ? 'Scotiabank Jamaica'
          : 'First Century Bank USA (via PayPal)',
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });

      return { success: true, orderId: orderRef.id };
    } catch (err) {
      console.error('❌ createPaymentOrder:', err);
      return { success: false, error: err.message };
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // CONFIRM PAYMENT
  // Called after PayPal WebView success redirect
  // Activates subscription automatically
  // ─────────────────────────────────────────
  const confirmPayment = async (
    orderId,
    restaurantId,
    planId,
    transactionId = `TX_${Date.now()}`
  ) => {
    try {
      setPaymentLoading(true);
      const plan = PLANS[planId];

      // ✅ Validate plan
      if (!plan) {
        return { success: false, error: `Invalid plan: ${planId}` };
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // ✅ Mark order completed
      await updateDoc(doc(db, 'paymentOrders', orderId), {
        status:        'completed',
        transactionId,
        completedAt:   serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });

      // ✅ Activate restaurant subscription
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        'subscription.plan':          planId,
        'subscription.status':        'active',
        'subscription.expiresAt':     expiresAt.toISOString(),
        'subscription.updatedAt':     serverTimestamp(),
        'subscription.price':         plan.price,
        'subscription.priceJMD':      plan.priceJMD || 0,
        'subscription.paymentMethod': 'paypal',
        'subscription.lastOrderId':   orderId,
        'subscription.transactionId': transactionId,
        updatedAt:                    serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      console.error('❌ confirmPayment:', err);
      return { success: false, error: err.message };
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // MARK BANK TRANSFER PENDING
  // Called when user says they've sent transfer
  // Admin manually verifies then activates
  // ─────────────────────────────────────────
  const markBankTransferPending = async (orderId) => {
    try {
      await updateDoc(doc(db, 'paymentOrders', orderId), {
        status:              'awaiting_confirmation',
        transferSubmittedAt: serverTimestamp(),
        updatedAt:           serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('❌ markBankTransferPending:', err);
      return { success: false, error: err.message };
    }
  };

  // ─────────────────────────────────────────
  // UPGRADE PLAN (Admin / Manual)
  // ─────────────────────────────────────────
  const upgradePlan = async (restaurantId, planId) => {
    try {
      const plan = PLANS[planId];
      if (!plan) {
        return { success: false, error: `Invalid plan: ${planId}` };
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await updateDoc(doc(db, 'restaurants', restaurantId), {
        'subscription.plan':      planId,
        'subscription.status':    'active',
        'subscription.expiresAt': expiresAt.toISOString(),
        'subscription.updatedAt': serverTimestamp(),
        'subscription.price':     plan.price,
        updatedAt:                serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('❌ upgradePlan:', err);
      return { success: false, error: err.message };
    }
  };

  // ─────────────────────────────────────────
  // CANCEL PLAN
  // ─────────────────────────────────────────
  const cancelPlan = async (restaurantId) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        'subscription.plan':      'free_trial',
        'subscription.status':    'cancelled',
        'subscription.expiresAt': null,
        'subscription.updatedAt': serverTimestamp(),
        updatedAt:                serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('❌ cancelPlan:', err);
      return { success: false, error: err.message };
    }
  };

  // ─────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────
  return {
    plans:                   PLANS,
    hasAnalytics,
    hasBasic,
    isPlanExpired,
    isExpiringSoon,          // 🆕
    getDaysRemaining,        // 🆕
    getCurrentPlan,
    upgradePlan,
    cancelPlan,
    createPaymentOrder,
    confirmPayment,
    markBankTransferPending,
    paymentLoading,
    PAYPAL_CONFIG,
    BANK_TRANSFER_DETAILS,
    buildPayPalCheckoutURL,
  };
};