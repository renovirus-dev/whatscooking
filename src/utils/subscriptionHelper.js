// ============================================
// FILE: src/utils/subscriptionHelper.js
// ============================================

/**
 * Checks if a restaurant is currently active, expired, or suspended.
 * @param {object} restaurant
 * @returns {{
 *   isValid: boolean,
 *   status: 'active' | 'expired' | 'suspended' | 'pending' | 'none',
 *   message: string,
 *   daysLeft: number | null
 * }}
 */
export const checkSubscriptionStatus = (restaurant) => {
  if (!restaurant) {
    return { isValid: false, status: 'none', message: 'No restaurant found', daysLeft: 0 };
  }

  // 1. Check Admin Suspension
  if (restaurant.isSuspended || restaurant.isBanned || restaurant.isActive === false) {
    return {
      isValid: false,
      status: 'suspended',
      message: 'Account Suspended by Admin. Contact support to reactivate.',
      daysLeft: 0,
    };
  }

  const sub = restaurant.subscription || {};

  // 2. Check Pending Bank Transfer
  if (sub.status === 'awaiting_confirmation') {
    return {
      isValid: false,
      status: 'pending',
      message: 'Payment verification pending. Admin will approve shortly.',
      daysLeft: 0,
    };
  }

  // 3. Check Explicit Status
  if (sub.status === 'suspended' || sub.status === 'inactive' || sub.status === 'expired') {
    return {
      isValid: false,
      status: 'expired',
      message: 'Subscription expired. Please renew your plan to unlock features.',
      daysLeft: 0,
    };
  }

  // 4. Check Expiration Date (for both Trial and Paid Plans)
  const exp = sub.expiresAt || sub.trialEndsAt;
  if (exp) {
    const expDate = exp.toDate ? exp.toDate() : new Date(exp);
    const now = new Date();
    const diffMs = expDate - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return {
        isValid: false,
        status: 'expired',
        message: 'Your plan has expired. Renew today to keep your daily menu online.',
        daysLeft: 0,
      };
    }

    return {
      isValid: true,
      status: 'active',
      message: sub.plan === 'free_trial' ? `Free Trial (${daysLeft}d left)` : 'Active Plan',
      daysLeft,
    };
  }

  // If no expiration date exists on a free trial, treat as expired
  return {
    isValid: false,
    status: 'expired',
    message: 'Subscription expired. Please choose a plan.',
    daysLeft: 0,
  };
};