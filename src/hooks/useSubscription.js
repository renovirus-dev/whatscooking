// ============================================
// FILE: src/hooks/useSubscription.js
// ============================================
import { useState } from 'react';
import { useAuth } from './useAuth';
import { db } from '../firebase/config';
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
  // ✅ PayPal email (linked to First Century Bank USA)
  BUSINESS_EMAIL: 'renogooden@outlook.com',

  // ✅ Currency
  CURRENCY: 'USD',

  // ✅ App name shown on PayPal checkout
  APP_NAME: "What's Cooking",

  // ✅ Return URLs detected by WebView after payment
  RETURN_URL:  'https://whatscooking.app/payment/success',
  CANCEL_URL:  'https://whatscooking.app/payment/cancel',

  // ✅ Environment — change to 'sandbox' for testing
  ENVIRONMENT: 'live',
};

// ─── Bank Transfer Details ────────────────────
// Shown to users who choose Bank Transfer option
// They send JMD directly to your Scotiabank account
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
// Builds PayPal hosted checkout URL
// Opens in WebView — user pays securely
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

  // Pre-fill customer email if available
  if (customerEmail) {
    params.append('email', customerEmail);
  }

  return `${baseURL}?${params.toString()}`;
};

// ─── Hook ─────────────────────────────────────
export const useSubscription = () => {
  const { userProfile } = useAuth();
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ─── Plan Helpers ────────────────────────
  const hasAnalytics = (restaurant) => {
    if (!restaurant) return false;
    return (restaurant?.subscription?.plan || 'free_trial') === 'premium';
  };

  const hasBasic = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';
    return plan === 'basic' || plan === 'premium';
  };

  const isPlanExpired = (restaurant) => {
    if (!restaurant) return false;
    const plan = restaurant?.subscription?.plan || 'free_trial';
    if (plan === 'free_trial') {
      const trialEnds = restaurant?.subscription?.trialEndsAt;
      if (!trialEnds) return false;
      return new Date(trialEnds) < new Date();
    }
    const expiresAt = restaurant?.subscription?.expiresAt;
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getCurrentPlan = (restaurant) => {
    const planId = restaurant?.subscription?.plan || 'free_trial';
    return PLANS[planId] || PLANS.free_trial;
  };

  // ─── Create Payment Order ────────────────
  // Saves order to Firestore BEFORE payment opens
  // Tracks payment even if user closes app mid-payment
  const createPaymentOrder = async (
    restaurantId,
    planId,
    userId,
    method = 'paypal'
  ) => {
    try {
      setPaymentLoading(true);
      const plan = PLANS[planId];

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

  // ─── Confirm Payment ─────────────────────
  // Called after PayPal WebView redirects to success URL
  // Activates the restaurant subscription automatically
  const confirmPayment = async (
    orderId,
    restaurantId,
    planId,
    transactionId = `TX_${Date.now()}`
  ) => {
    try {
      setPaymentLoading(true);
      const plan      = PLANS[planId];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // ✅ Mark order as completed
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

  // ─── Mark Bank Transfer Pending ──────────
  // Called when user says they've done the bank transfer
  // You then manually verify and activate their plan
  const markBankTransferPending = async (orderId) => {
    try {
      await updateDoc(doc(db, 'paymentOrders', orderId), {
        status:    'awaiting_confirmation',
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('❌ markBankTransferPending:', err);
      return { success: false, error: err.message };
    }
  };

  // ─── Upgrade Plan (Admin / Manual) ───────
  const upgradePlan = async (restaurantId, planId) => {
    try {
      const plan      = PLANS[planId];
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

  // ─── Cancel Plan ─────────────────────────
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

  return {
    plans:                   PLANS,
    hasAnalytics,
    hasBasic,
    isPlanExpired,
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