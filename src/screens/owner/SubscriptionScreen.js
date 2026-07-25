// ============================================
// FILE: src/screens/owner/SubscriptionScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as Clipboard        from 'expo-clipboard';  // ✅ Not deprecated
import { WebView }           from 'react-native-webview';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../hooks/useAuth';
import {
  useSubscription,
  PLANS,
  buildPayPalCheckoutURL,
  BANK_TRANSFER_DETAILS,
} from '../../hooks/useSubscription';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function SubscriptionScreen({ route, navigation }) {
  const insets                = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const { restaurant }        = route.params;

  const {
    cancelPlan,
    createPaymentOrder,
    confirmPayment,
    markBankTransferPending,
    isPlanExpired,
    isExpiringSoon,
    getDaysRemaining,
  } = useSubscription();

  // ── State ─────────────────────────────────
  const [loading, setLoading]                 = useState(null);
  const [cancelLoading, setCancelLoading]     = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentURL, setPaymentURL]           = useState('');
  const [selectedPlan, setSelectedPlan]       = useState(null);
  const [currentOrderId, setCurrentOrderId]   = useState(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [webViewLoading, setWebViewLoading]   = useState(true);
  const [bankConfirmed, setBankConfirmed]     = useState(false);

  // ── Current Plan Info ─────────────────────
  const currentPlan     = restaurant?.subscription?.plan || 'free_trial';
  const currentPlanData = PLANS[currentPlan] || PLANS.free_trial;
  const daysRemaining   = getDaysRemaining(restaurant);
  const expired         = isPlanExpired(restaurant);
  const expiringSoon    = isExpiringSoon(restaurant);

  // ─────────────────────────────────────────
  // COPY TO CLIPBOARD
  // ✅ Uses expo-clipboard (not deprecated)
  // ─────────────────────────────────────────
  const copyToClipboard = async (value, label) => {
    await Clipboard.setStringAsync(String(value));
    Alert.alert('✅ Copied!', `${label} copied to clipboard.`);
  };

  // ─────────────────────────────────────────
  // PAYPAL PAYMENT
  // ─────────────────────────────────────────
  const handlePayPalPayment = async (plan) => {
    setLoading(plan.id);
    try {
      const orderResult = await createPaymentOrder(
        restaurant.id,
        plan.id,
        user.uid,
        'paypal'
      );

      if (!orderResult.success) {
        Alert.alert('❌ Error', orderResult.error);
        return;
      }

      setCurrentOrderId(orderResult.orderId);
      setSelectedPlan(plan);

      const checkoutURL = buildPayPalCheckoutURL({
        orderId:       orderResult.orderId,
        amount:        plan.price,
        planName:      plan.name,
        customerEmail: user.email || '',
      });

      setPaymentURL(checkoutURL);
      setWebViewLoading(true);
      setShowPaymentModal(true);
    } catch (err) {
      console.error('❌ PayPal payment error:', err);
      Alert.alert('Error', 'Failed to start payment. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // ─────────────────────────────────────────
  // BANK TRANSFER
  // ─────────────────────────────────────────
  const handleBankTransfer = async (plan) => {
    setLoading(plan.id);
    try {
      const orderResult = await createPaymentOrder(
        restaurant.id,
        plan.id,
        user.uid,
        'bank_transfer'
      );

      if (!orderResult.success) {
        Alert.alert('❌ Error', orderResult.error);
        return;
      }

      setCurrentOrderId(orderResult.orderId);
      setSelectedPlan(plan);
      setBankConfirmed(false); // ✅ Reset confirmation state
      setShowBankDetails(true);
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // ─────────────────────────────────────────
  // WEBVIEW NAVIGATION
  // ─────────────────────────────────────────
  const handleWebViewNavigation = async (navState) => {
    const { url } = navState;
    if (!url) return;

    const lowerUrl  = url.toLowerCase();
    const isSuccess = lowerUrl.includes('payment/success');
    const isCancelled = lowerUrl.includes('payment/cancel');

    if (isSuccess && currentOrderId && selectedPlan) {
      setShowPaymentModal(false);

      // Extract PayPal transaction ID
      let txId = `PAYPAL_${Date.now()}`;
      try {
        const urlObj = new URL(url);
        txId =
          urlObj.searchParams.get('tx')             ||
          urlObj.searchParams.get('transaction_id') ||
          urlObj.searchParams.get('paymentId')      ||
          txId;
      } catch (_) {}

      const result = await confirmPayment(
        currentOrderId,
        restaurant.id,
        selectedPlan.id,
        txId
      );

      if (result.success) {
        Alert.alert(
          '🎉 Payment Successful!',
          `Welcome to the ${selectedPlan.name} plan!\n\n` +
          'Your restaurant now has all features unlocked.',
          [{ text: '🚀 Let\'s Go!', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          '⚠️ Activation Issue',
          'Payment received but activation failed.\n\n' +
          `Please contact: renogooden@outlook.com\n` +
          `Order ID: ${currentOrderId}`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (isCancelled) {
      setShowPaymentModal(false);
      Alert.alert(
        'Payment Cancelled',
        `No worries! Your order is saved.\n\n` +
        `Order ID: ${currentOrderId}\n\n` +
        'You can complete payment anytime.',
        [{ text: 'OK' }]
      );
    }
  };

  // ─────────────────────────────────────────
  // WEBVIEW ERROR
  // ─────────────────────────────────────────
  const handleWebViewError = () => {
    setShowPaymentModal(false);
    Alert.alert(
      '❌ Connection Error',
      'Could not load PayPal payment page.\n\n' +
      'Check your internet or use Bank Transfer instead.',
      [
        {
          text: 'Use Bank Transfer',
          onPress: () => selectedPlan && handleBankTransfer(selectedPlan),
        },
        {
          text: 'Try Again',
          onPress: () => {
            setWebViewLoading(true);
            setShowPaymentModal(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ─────────────────────────────────────────
  // CANCEL SUBSCRIPTION
  // ─────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      '⚠️ Cancel Subscription',
      `Are you sure you want to cancel your ${currentPlanData.name} plan?\n\nYou will lose access to all premium features immediately.`,
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            const result = await cancelPlan(restaurant.id);
            setCancelLoading(false);
            if (result.success) {
              Alert.alert(
                'Subscription Cancelled',
                'You are now on the Free Trial plan.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } else {
              Alert.alert('Error', 'Failed to cancel. Please try again.');
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────
  // BANK TRANSFER CONFIRMED
  // ─────────────────────────────────────────
  const handleBankTransferDone = async () => {
    if (!currentOrderId) return;

    // ✅ Must confirm they actually sent the transfer
    Alert.alert(
      '✅ Confirm Transfer Sent',
      'Have you completed the Scotiabank bank transfer?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, I Sent It',
          onPress: async () => {
            await markBankTransferPending(currentOrderId);
            setBankConfirmed(true);
            setShowBankDetails(false);
            Alert.alert(
              '✅ Transfer Noted!',
              `Thank you! Once we confirm your payment, your ${selectedPlan?.name} plan will be activated.\n\n` +
              `📧 Email receipt to: renogooden@outlook.com\n` +
              `📋 Order ID: ${currentOrderId}\n\n` +
              `⏱️ Activation within 24 hours.`,
              [{ text: 'Got it!', onPress: () => navigation.goBack() }]
            );
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────
  // BANK DETAIL ROWS
  // ─────────────────────────────────────────
  const getBankRows = () => [
    {
      label:    'Bank Name',
      value:    BANK_TRANSFER_DETAILS.bankName,
      copyable: false,
    },
    {
      label:    'Account Name',
      value:    BANK_TRANSFER_DETAILS.accountName,
      copyable: true,
    },
    {
      label:    'Account Number',
      value:    BANK_TRANSFER_DETAILS.accountNumber,
      copyable: true,
    },
    {
      label:    'Transit / Branch',
      value:    BANK_TRANSFER_DETAILS.transitNumber,
      copyable: true,
    },
    {
      label:    'Account Type',
      value:    BANK_TRANSFER_DETAILS.accountType,
      copyable: false,
    },
    {
      label:    'Currency',
      value:    'JMD (Jamaican Dollar)',
      copyable: false,
    },
    {
      label:    'Amount (JMD)',
      value:    `J$${selectedPlan?.priceJMD?.toLocaleString() || '0'}`,
      copyable: true,
    },
    {
      label:    'Reference / Note',
      value:    currentOrderId || 'Your Order ID',
      copyable: true,
    },
  ];

  // ─────────────────────────────────────────
  // RENDER SUBSCRIPTION STATUS BANNER
  // ─────────────────────────────────────────
  const renderStatusBanner = () => {
    if (expired && currentPlan !== 'free_trial') {
      return (
        <View style={[styles.statusBanner, styles.statusBannerError]}>
          <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusBannerTitle}>
              Subscription Expired
            </Text>
            <Text style={styles.statusBannerSub}>
              Renew your {currentPlanData.name} plan to restore features
            </Text>
          </View>
        </View>
      );
    }

    if (expiringSoon && currentPlan !== 'free_trial') {
      return (
        <View style={[styles.statusBanner, styles.statusBannerWarning]}>
          <Ionicons name="time" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusBannerTitle}>
              Expiring in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.statusBannerSub}>
              Renew now to keep your {currentPlanData.name} features
            </Text>
          </View>
        </View>
      );
    }

    if (currentPlan !== 'free_trial') {
      return (
        <View style={[styles.statusBanner, styles.statusBannerSuccess]}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusBannerTitle}>
              {currentPlanData.name} Plan Active
            </Text>
            <Text style={styles.statusBannerSub}>
              {daysRemaining > 0
                ? `${daysRemaining} days remaining`
                : 'Active subscription'}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      >

        {/* ── Header ──────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>
            Grow your restaurant with the right features
          </Text>

          {/* Current Plan Badge */}
          <View style={styles.currentPlanBadge}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.currentPlanText}>
              Current: {currentPlanData.name}
              {daysRemaining > 0 && currentPlan !== 'free_trial'
                ? ` · ${daysRemaining}d left`
                : ''}
            </Text>
          </View>

          {/* Payment Methods */}
          <View style={styles.paymentMethodsRow}>
            <View style={styles.paymentMethodTag}>
              <Ionicons name="logo-paypal" size={14} color="#003087" />
              <Text style={styles.paymentMethodTagText}>PayPal</Text>
            </View>
            <View style={styles.paymentMethodTag}>
              <Ionicons name="business-outline" size={14} color="#003087" />
              <Text style={styles.paymentMethodTagText}>Bank Transfer</Text>
            </View>
          </View>
        </View>

        {/* ── Status Banner ────────────────── */}
        {renderStatusBanner()}

        {/* ── Plan Cards ──────────────────── */}
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
                  isPremium && !isCurrent && styles.planCardPremium,
                  expired && isCurrent && styles.planCardExpired,
                ]}
              >
                {/* Popular Badge */}
                {isPremium && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>⭐ MOST POPULAR</Text>
                  </View>
                )}

                {/* Plan Header */}
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
                      isPremium && { color: COLORS.primary },
                    ]}>
                      {plan.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.planPrice, { color: plan.color }]}>
                        ${plan.price}
                      </Text>
                      <Text style={styles.planDuration}>
                        USD/{plan.duration}
                      </Text>
                    </View>
                    <Text style={styles.priceJMD}>
                      ≈ J${plan.priceJMD?.toLocaleString()}/month
                    </Text>
                  </View>

                  {/* Active / Expired Badge */}
                  {isCurrent && (
                    <View style={[
                      styles.activeTag,
                      expired && styles.activeTagExpired,
                    ]}>
                      <Text style={[
                        styles.activeTagText,
                        expired && { color: COLORS.error },
                      ]}>
                        {expired ? 'Expired' : 'Active'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Features */}
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

                {/* Action Buttons */}
                {!isCurrent || expired ? (
                  <View style={styles.paymentButtons}>
                    {/* PayPal */}
                    <TouchableOpacity
                      style={[styles.paypalBtn, isLoading && { opacity: 0.7 }]}
                      onPress={() => handlePayPalPayment(plan)}
                      disabled={!!loading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#003087" size="small" />
                      ) : (
                        <>
                          <Ionicons name="logo-paypal" size={20} color="#003087" />
                          <Text style={styles.paypalBtnText}>
                            Pay with PayPal
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Bank Transfer */}
                    <TouchableOpacity
                      style={[
                        styles.bankBtn,
                        { borderColor: plan.color },
                        isLoading && { opacity: 0.7 },
                      ]}
                      onPress={() => handleBankTransfer(plan)}
                      disabled={!!loading}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="business-outline"
                        size={18}
                        color={plan.color}
                      />
                      <Text style={[styles.bankBtnText, { color: plan.color }]}>
                        Bank Transfer (Scotiabank JMD)
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Currently active plan
                  <View style={styles.currentBadgeRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.success}
                    />
                    <Text style={styles.currentBadgeText}>
                      Current Plan · {daysRemaining > 0
                        ? `${daysRemaining} days remaining`
                        : 'Active'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

        {/* ── Free Trial Info ──────────────── */}
        {currentPlan === 'free_trial' && (
          <View style={styles.freeTrialCard}>
            <Text style={styles.freeTrialTitle}>🆓 Free Trial Includes:</Text>
            {PLANS.free_trial.features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark" size={16} color={COLORS.textMuted} />
                <Text style={styles.freeTrialFeature}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Cancel Subscription ──────────── */}
        {currentPlan !== 'free_trial' && !expired && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelLoading && { opacity: 0.6 }]}
            onPress={handleCancel}
            disabled={cancelLoading}
            activeOpacity={0.7}
          >
            {cancelLoading ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Text style={styles.cancelBtnText}>
                Cancel Current Subscription
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Security Note ────────────────── */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
          <Text style={styles.securityNoteText}>
            Online payments secured by PayPal.{'\n'}
            Bank transfers processed within 24 hours.{'\n'}
            Cancel anytime. No hidden fees.
          </Text>
        </View>
      </ScrollView>

      {/* ════════════════════════════════════
          PayPal WebView Modal
      ════════════════════════════════════ */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Leave Payment?',
            'Your order is saved. You can complete payment anytime.',
            [
              { text: 'Stay',  style: 'cancel'                           },
              { text: 'Leave', onPress: () => setShowPaymentModal(false) },
            ]
          );
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Header */}
          <View style={[
            styles.webViewHeader,
            { paddingTop: insets.top + 8 },
          ]}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Leave Payment?',
                  'Your order is saved. Complete payment anytime.',
                  [
                    { text: 'Stay',  style: 'cancel'                           },
                    { text: 'Leave', onPress: () => setShowPaymentModal(false) },
                  ]
                );
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>

            <View style={styles.webViewTitleRow}>
              <Ionicons name="lock-closed" size={16} color={COLORS.success} />
              <Text style={styles.webViewTitle}>PayPal Checkout</Text>
            </View>

            <View style={{ width: 26 }} />
          </View>

          {/* Order Bar */}
          <View style={styles.orderBar}>
            <Text style={styles.orderBarPlan}>
              {selectedPlan?.emoji} {selectedPlan?.name} Plan
            </Text>
            <Text style={styles.orderBarAmount}>
              ${selectedPlan?.price} USD
            </Text>
          </View>

          {/* WebView */}
          <WebView
            source={{ uri: paymentURL }}
            onNavigationStateChange={handleWebViewNavigation}
            onError={handleWebViewError}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#003087" />
                <Text style={styles.webViewLoadingText}>Loading PayPal...</Text>
                <Text style={styles.webViewLoadingSubtext}>
                  Please wait, do not close this window
                </Text>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* ════════════════════════════════════
          Bank Transfer Modal
      ════════════════════════════════════ */}
      <Modal
        visible={showBankDetails}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBankDetails(false)}
      >
        <View style={styles.bankModalOverlay}>
          <ScrollView
            style={styles.bankModal}
            contentContainerStyle={{
              padding:       SIZES.lg,
              paddingBottom: insets.bottom + SIZES.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.bankModalHandle} />
            <Text style={styles.bankModalTitle}>🏦 Bank Transfer Details</Text>
            <Text style={styles.bankModalSubtitle}>
              {selectedPlan?.emoji} {selectedPlan?.name} Plan ·{' '}
              J${selectedPlan?.priceJMD?.toLocaleString()}
            </Text>

            {/* Steps */}
            <View style={styles.bankSteps}>
              {[
                { step: '1', text: 'Copy the details below'              },
                { step: '2', text: 'Transfer via Scotiabank Jamaica'      },
                { step: '3', text: 'Use Order ID as reference'           },
                { step: '4', text: 'Email receipt to confirm'            },
                { step: '5', text: 'Plan activated within 24 hours'      },
              ].map((s, i) => (
                <View key={i} style={styles.bankStep}>
                  <View style={styles.bankStepNum}>
                    <Text style={styles.bankStepNumText}>{s.step}</Text>
                  </View>
                  <Text style={styles.bankStepText}>{s.text}</Text>
                </View>
              ))}
            </View>

            {/* Detail Rows */}
            {getBankRows().map((item, i) => (
              <View key={i} style={styles.bankRow}>
                <Text style={styles.bankLabel}>{item.label}</Text>
                <View style={styles.bankValueRow}>
                  <Text style={styles.bankValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                  {item.copyable && (
                    <TouchableOpacity
                      onPress={() => copyToClipboard(item.value, item.label)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.copyBtn}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={18}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Note */}
            <View style={styles.bankNote}>
              <Ionicons
                name="information-circle"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.bankNoteText}>
                After transferring, email your receipt to:{'\n'}
                <Text style={styles.bankNoteEmail}>
                  renogooden@outlook.com
                </Text>
                {'\n\n'}
                Use your{' '}
                <Text style={{ fontWeight: 'bold' }}>Order ID</Text>
                {' '}as the payment reference.{'\n'}
                Your plan activates within{' '}
                <Text style={{ fontWeight: 'bold' }}>24 hours</Text>.
              </Text>
            </View>

            {/* ✅ I've Transferred Button */}
            <TouchableOpacity
              style={styles.bankDoneBtn}
              onPress={handleBankTransferDone}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.bankDoneBtnText}>
                I've Completed the Transfer
              </Text>
            </TouchableOpacity>

            {/* Close */}
            <TouchableOpacity
              style={styles.bankCancelBtn}
              onPress={() => setShowBankDetails(false)}
            >
              <Text style={styles.bankCancelBtnText}>
                Close — I'll do it later
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Header ────────────────────────────────
  header: {
    backgroundColor: COLORS.primary,
    padding:         SIZES.xl,
    paddingTop:      SIZES.xxl,
    alignItems:      'center',
    gap:             SIZES.sm,
  },
  headerTitle: {
    fontSize:   28,
    fontWeight: 'bold',
    color:      '#FFFFFF',
    textAlign:  'center',
  },
  headerSubtitle: {
    fontSize:  FONTS.md,
    color:     'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  currentPlanBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.2)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    gap:               SIZES.xs,
  },
  currentPlanText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: '600',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap:           SIZES.sm,
    marginTop:     SIZES.xs,
  },
  paymentMethodTag: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    gap:               6,
  },
  paymentMethodTagText: {
    fontSize:   FONTS.xs,
    fontWeight: '700',
    color:      '#003087',
  },

  // ── Status Banner ─────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems:    'center',
    margin:        SIZES.md,
    marginBottom:  0,
    padding:       SIZES.md,
    borderRadius:  RADIUS.lg,
    gap:           SIZES.sm,
  },
  statusBannerError:   { backgroundColor: COLORS.error   },
  statusBannerWarning: { backgroundColor: '#F39C12'      },
  statusBannerSuccess: { backgroundColor: COLORS.success },
  statusBannerTitle: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  statusBannerSub: {
    fontSize:  FONTS.xs,
    color:     'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // ── Plan Cards ────────────────────────────
  planCard: {
    backgroundColor: COLORS.surface,
    margin:          SIZES.md,
    marginBottom:    0,
    borderRadius:    RADIUS.xl,
    padding:         SIZES.lg,
    borderWidth:     2,
    borderColor:     'transparent',
    ...SHADOW,
  },
  planCardActive:  { borderColor: COLORS.success              },
  planCardPremium: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  planCardExpired: {
    borderColor:     COLORS.error,
    backgroundColor: COLORS.error + '05',
  },
  popularBadge: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    alignSelf:         'flex-start',
    marginBottom:      SIZES.md,
  },
  popularText: {
    color:         '#FFFFFF',
    fontSize:      FONTS.xs,
    fontWeight:    '800',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
    marginBottom:  SIZES.md,
  },
  planEmojiContainer: {
    width:          56,
    height:         56,
    borderRadius:   RADIUS.lg,
    justifyContent: 'center',
    alignItems:     'center',
  },
  planEmoji:    { fontSize: 28 },
  planName: {
    fontSize:     FONTS.xl,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  planPrice:    { fontSize: FONTS.xxl, fontWeight: 'bold'              },
  planDuration: { fontSize: FONTS.sm,  color: COLORS.textMuted         },
  priceJMD:     { fontSize: FONTS.xs,  color: COLORS.textMuted, fontStyle: 'italic' },

  activeTag: {
    backgroundColor:   COLORS.success + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       COLORS.success + '40',
  },
  activeTagExpired: {
    backgroundColor: COLORS.error + '20',
    borderColor:     COLORS.error + '40',
  },
  activeTagText: {
    fontSize:   FONTS.xs,
    color:      COLORS.success,
    fontWeight: '700',
  },

  featuresList: { gap: SIZES.sm, marginBottom: SIZES.lg },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  featureText:  { fontSize: FONTS.md, color: COLORS.text, flex: 1 },

  // ── Payment Buttons ───────────────────────
  paymentButtons: { gap: SIZES.sm },
  paypalBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: '#FFC439',
    gap:             SIZES.sm,
    borderWidth:     1,
    borderColor:     '#F0B429',
  },
  paypalBtnText: {
    color:      '#003087',
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
  bankBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    gap:             SIZES.sm,
  },
  bankBtnText:    { fontSize: FONTS.md, fontWeight: 'bold'             },
  currentBadgeRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SIZES.sm,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.success + '10',
    borderRadius:    RADIUS.lg,
  },
  currentBadgeText: {
    color:      COLORS.success,
    fontWeight: '700',
    fontSize:   FONTS.md,
  },

  // ── Free Trial Card ───────────────────────
  freeTrialCard: {
    backgroundColor: COLORS.surface,
    margin:          SIZES.md,
    padding:         SIZES.lg,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    ...SHADOW,
  },
  freeTrialTitle: {
    fontSize:     FONTS.lg,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginBottom: SIZES.xs,
  },
  freeTrialFeature: {
    fontSize: FONTS.md,
    color:    COLORS.textMuted,
    flex:     1,
  },

  // ── Cancel ────────────────────────────────
  cancelBtn: {
    marginHorizontal: SIZES.md,
    paddingVertical:  SIZES.md,
    alignItems:       'center',
  },
  cancelBtnText: {
    color:              COLORS.error,
    fontSize:           FONTS.md,
    fontWeight:         '600',
    textDecorationLine: 'underline',
  },

  // ── Security Note ─────────────────────────
  securityNote: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SIZES.sm,
    margin:          SIZES.md,
    padding:         SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
  },
  securityNoteText: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    flex:       1,
    lineHeight: 18,
  },

  // ── WebView ───────────────────────────────
  webViewHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.lg,
    paddingBottom:     SIZES.md,
    backgroundColor:   '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  webViewTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
  },
  webViewTitle: {
    fontSize:   FONTS.lg,
    fontWeight: '700',
    color:      '#003087',
  },
  orderBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    backgroundColor:   '#FFC439' + '30',
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FFC439' + '60',
  },
  orderBarPlan:   { fontSize: FONTS.md, fontWeight: '700', color: '#003087' },
  orderBarAmount: { fontSize: FONTS.md, fontWeight: 'bold', color: '#003087' },
  webViewLoading: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: '#fff',
    gap:             SIZES.md,
  },
  webViewLoadingText:    { fontSize: FONTS.md, color: '#003087', fontWeight: '600' },
  webViewLoadingSubtext: { fontSize: FONTS.sm, color: COLORS.textMuted             },

  // ── Bank Modal ────────────────────────────
  bankModalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
  },
  bankModal: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    maxHeight:            '92%',
  },
  bankModalHandle: {
    width:           40,
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    SIZES.md,
  },
  bankModalTitle: {
    fontSize:     FONTS.xxl,
    fontWeight:   'bold',
    color:        COLORS.text,
    textAlign:    'center',
    marginBottom: SIZES.xs,
  },
  bankModalSubtitle: {
    fontSize:     FONTS.md,
    color:        COLORS.primary,
    textAlign:    'center',
    fontWeight:   '600',
    marginBottom: SIZES.md,
  },

  // ── Bank Steps ────────────────────────────
  bankSteps: {
    backgroundColor: COLORS.primary + '08',
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    marginBottom:    SIZES.md,
    gap:             SIZES.sm,
  },
  bankStep: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  bankStepNum: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: COLORS.primary,
    justifyContent:  'center',
    alignItems:      'center',
  },
  bankStepNumText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: 'bold' },
  bankStepText:    { fontSize: FONTS.sm, color: COLORS.text, flex: 1         },

  bankRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bankLabel:    { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600', flex: 1 },
  bankValueRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SIZES.sm,
    flex:           1,
    justifyContent: 'flex-end',
  },
  bankValue: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '700',
    textAlign:  'right',
    flexShrink: 1,
  },
  copyBtn: {
    padding:         4,
    backgroundColor: COLORS.primary + '10',
    borderRadius:    RADIUS.sm,
  },
  bankNote: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SIZES.sm,
    backgroundColor: COLORS.primary + '10',
    padding:       SIZES.md,
    borderRadius:  RADIUS.md,
    marginTop:     SIZES.md,
  },
  bankNoteText:  { fontSize: FONTS.sm, color: COLORS.text, flex: 1, lineHeight: 22 },
  bankNoteEmail: { fontWeight: 'bold', color: COLORS.primary                       },

  bankDoneBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    alignItems:      'center',
    marginTop:       SIZES.lg,
    gap:             SIZES.sm,
  },
  bankDoneBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },
  bankCancelBtn: {
    alignItems:      'center',
    paddingVertical: SIZES.md,
    marginTop:       SIZES.xs,
  },
  bankCancelBtnText: { color: COLORS.textMuted, fontSize: FONTS.md },
});