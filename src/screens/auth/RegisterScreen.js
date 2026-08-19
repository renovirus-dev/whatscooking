// ============================================
// FILE: src/screens/auth/RegisterScreen.js
// ============================================
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Firebase Auth Error Map ──────────────────
const getAuthError = (error) => {
  const code = error?.code || error || '';
  const map  = {
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/operation-not-allowed':   'Registration is currently disabled.',
    'auth/weak-password':           'Password is too weak. Use at least 6 characters.',
    'auth/network-request-failed':  'Network error. Check your internet connection.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
  };
  return map[code] || error?.message || 'Registration failed. Please try again.';
};

// ─── Email Validation ─────────────────────────
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ✅ Accepts custom callbacks from AppNavigator:
//    - onBack           — back to welcome
//    - onGuest          — browse as guest
//    - onSwitchToLogin  — go to login screen
// ✅ Falls back to navigation.goBack if not provided
// ─────────────────────────────────────────────
export default function RegisterScreen({
  navigation,
  onBack,
  onGuest,
  onSwitchToLogin,
}) {
  const insets       = useSafeAreaInsets();
  const { register } = useAuth();

  // ── Refs ──────────────────────────────────
  const lastNameRef        = useRef(null);
  const emailRef           = useRef(null);
  const phoneRef           = useRef(null);
  const passwordRef        = useRef(null);
  const confirmPasswordRef = useRef(null);

  // ── Form State ────────────────────────────
  const [form, setForm] = useState({
    firstName:       '',
    lastName:        '',
    email:           '',
    phone:           '',
    password:        '',
    confirmPassword: '',
    role:            'customer',
  });

  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading]                         = useState(false);

  // ─────────────────────────────────────────
  // NAVIGATION HANDLERS
  // ✅ Use callbacks if provided, else fallback
  // ─────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  }, [onBack, navigation]);

  const handleGuest = useCallback(() => {
    if (onGuest) {
      onGuest();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  }, [onGuest, navigation]);

  const handleGoToLogin = useCallback(() => {
    if (onSwitchToLogin) {
      onSwitchToLogin();
    } else if (navigation?.navigate) {
      navigation.navigate('Login');
    }
  }, [onSwitchToLogin, navigation]);

  // ─────────────────────────────────────────
  // FORM HELPERS
  // ─────────────────────────────────────────
  const updateForm = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // ─────────────────────────────────────────
  // PASSWORD STRENGTH
  // ─────────────────────────────────────────
  const passwordStrength = useMemo(() => {
    const p = form.password;
    if (!p) return null;

    let score = 0;
    if (p.length >= 6)             score++;
    if (p.length >= 10)            score++;
    if (/[A-Z]/.test(p))          score++;
    if (/[0-9]/.test(p))          score++;
    if (/[^A-Za-z0-9]/.test(p))  score++;

    if (p.length < 6) return { label: 'Too short', color: COLORS.error,   width: '10%' };
    if (score <= 2)   return { label: 'Weak',      color: '#E74C3C',      width: '30%' };
    if (score === 3)  return { label: 'Fair',      color: '#F39C12',      width: '55%' };
    if (score === 4)  return { label: 'Good',      color: COLORS.success, width: '78%' };
    return              { label: 'Strong',         color: '#27AE60',      width: '100%'};
  }, [form.password]);

  // ─────────────────────────────────────────
  // PASSWORD MATCH
  // ─────────────────────────────────────────
  const passwordMatch = useMemo(() => {
    if (!form.confirmPassword) return null;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  // ─────────────────────────────────────────
  // REGISTER HANDLER
  // ─────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    const {
      firstName, lastName, email,
      password, confirmPassword, phone, role,
    } = form;

    // ── Validation ────────────────────────
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Required', 'Please enter your last name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (!password) {
      Alert.alert('Required', 'Please create a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters'
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await register(
        email.trim().toLowerCase(),
        password,
        firstName.trim(),
        lastName.trim(),
        role,
        phone.trim() || '',
      );

      if (!result.success) {
        Alert.alert('Registration Failed', getAuthError(result.error));
      }
      // ✅ Navigation handled automatically by auth state change
    } catch (err) {
      Alert.alert('Error', getAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [form, register]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:    insets.top    + SIZES.lg,
            paddingBottom: insets.bottom + SIZES.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ────────────────────────── */}
        <View style={styles.headerSection}>
          {/* ✅ Back button — now uses onBack callback */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join the What's Cooking community
          </Text>
        </View>

        {/* ── Name Row ──────────────────────── */}
        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor={COLORS.textMuted}
              value={form.firstName}
              onChangeText={v => updateForm('firstName', v)}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <TextInput
              ref={lastNameRef}
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor={COLORS.textMuted}
              value={form.lastName}
              onChangeText={v => updateForm('lastName', v)}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>
        </View>

        {/* ── Email ─────────────────────────── */}
        <View style={[
          styles.inputContainer,
          form.email.length > 0 && !isValidEmail(form.email) &&
            styles.inputContainerError,
        ]}>
          <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={COLORS.textMuted}
            value={form.email}
            onChangeText={v => updateForm('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          {/* Email validation indicator */}
          {form.email.length > 0 && (
            <Ionicons
              name={isValidEmail(form.email) ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={isValidEmail(form.email) ? COLORS.success : COLORS.error}
            />
          )}
        </View>

        {form.email.length > 0 && !isValidEmail(form.email) && (
          <Text style={styles.inputError}>
            Please enter a valid email address
          </Text>
        )}

        {/* ── Phone ─────────────────────────── */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            ref={phoneRef}
            style={styles.input}
            placeholder="Phone number (optional)"
            placeholderTextColor={COLORS.textMuted}
            value={form.phone}
            onChangeText={v => updateForm('phone', v)}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        {/* ── Role Selection ────────────────── */}
        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>I am a:</Text>
          <View style={styles.roleButtons}>

            {/* Food Lover */}
            <TouchableOpacity
              style={[
                styles.roleBtn,
                form.role === 'customer' && styles.roleBtnActive,
              ]}
              onPress={() => updateForm('role', 'customer')}
              activeOpacity={0.8}
            >
              {form.role === 'customer' && (
                <View style={styles.roleCheck}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.roleEmoji}>👤</Text>
              <Text style={[
                styles.roleBtnLabel,
                form.role === 'customer' && styles.roleBtnLabelActive,
              ]}>
                Food Lover
              </Text>
              <Text style={[
                styles.roleBtnDesc,
                form.role === 'customer' && styles.roleBtnDescActive,
              ]}>
                Browse & discover menus
              </Text>
            </TouchableOpacity>

            {/* Restaurant Owner */}
            <TouchableOpacity
              style={[
                styles.roleBtn,
                form.role === 'restaurant_owner' && styles.roleBtnActive,
              ]}
              onPress={() => updateForm('role', 'restaurant_owner')}
              activeOpacity={0.8}
            >
              {form.role === 'restaurant_owner' && (
                <View style={styles.roleCheck}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.roleEmoji}>🍽️</Text>
              <Text style={[
                styles.roleBtnLabel,
                form.role === 'restaurant_owner' && styles.roleBtnLabelActive,
              ]}>
                Restaurant Owner
              </Text>
              <Text style={[
                styles.roleBtnDesc,
                form.role === 'restaurant_owner' && styles.roleBtnDescActive,
              ]}>
                List & manage your menu
              </Text>
            </TouchableOpacity>
          </View>

          {form.role === 'restaurant_owner' && (
            <View style={styles.ownerBenefits}>
              <Text style={styles.ownerBenefitsTitle}>
                🎉 What you get as an Owner:
              </Text>
              {[
                '14-day free trial',
                'Unlimited menu items',
                'Daily menu publishing',
                'Customer reviews & analytics',
              ].map((benefit, i) => (
                <View key={i} style={styles.ownerBenefit}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={14}
                    color={COLORS.success}
                  />
                  <Text style={styles.ownerBenefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Password ──────────────────────── */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Create password (min 6 characters)"
            placeholderTextColor={COLORS.textMuted}
            value={form.password}
            onChangeText={v => updateForm('password', v)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(v => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Password Strength Bar */}
        {passwordStrength && (
          <View style={styles.strengthRow}>
            <View style={styles.strengthBarBg}>
              <View style={[
                styles.strengthBarFill,
                {
                  backgroundColor: passwordStrength.color,
                  width:           passwordStrength.width,
                },
              ]} />
            </View>
            <Text style={[
              styles.strengthLabel,
              { color: passwordStrength.color },
            ]}>
              {passwordStrength.label}
            </Text>
          </View>
        )}

        {form.password.length > 0 && form.password.length < 10 && (
          <Text style={styles.passwordTip}>
            💡 Add uppercase, numbers or symbols for a stronger password
          </Text>
        )}

        {/* ── Confirm Password ──────────────── */}
        <View style={[
          styles.inputContainer,
          passwordMatch === false && styles.inputContainerError,
          passwordMatch === true  && styles.inputContainerSuccess,
        ]}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textMuted}
            value={form.confirmPassword}
            onChangeText={v => updateForm('confirmPassword', v)}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(v => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          {passwordMatch !== null && (
            <Ionicons
              name={passwordMatch ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={passwordMatch ? COLORS.success : COLORS.error}
            />
          )}
        </View>

        {passwordMatch === false && (
          <Text style={styles.inputError}>Passwords do not match</Text>
        )}
        {passwordMatch === true && (
          <Text style={styles.inputSuccess}>Passwords match ✓</Text>
        )}

        {/* ── Create Account Button ─────────── */}
        <TouchableOpacity
          style={[
            styles.registerBtn,
            loading && styles.registerBtnDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
              <Text style={styles.registerBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Divider ───────────────────────── */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ✅ Browse as Guest — now uses onGuest callback */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuest}
          activeOpacity={0.8}
        >
          <Ionicons
            name="compass-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.guestBtnText}>Browse as Guest</Text>
        </TouchableOpacity>

        {/* ── Terms Notice ──────────────────── */}
        <Text style={styles.termsText}>
          By creating an account you agree to our{' '}
          <Text
            style={styles.termsLink}
            onPress={() =>
              Alert.alert(
                '📄 Terms of Service',
                "By using What's Cooking, you agree to use the app responsibly and respect other users and restaurant owners."
              )
            }
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text
            style={styles.termsLink}
            onPress={() =>
              Alert.alert(
                '🔒 Privacy Policy',
                "We collect only the data needed to provide our service. We never sell your personal information."
              )
            }
          >
            Privacy Policy
          </Text>
        </Text>

        {/* ✅ Sign In Link — now uses onSwitchToLogin */}
        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Already have an account?</Text>
          <TouchableOpacity
            onPress={handleGoToLogin}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flexGrow:          1,
    paddingHorizontal: SIZES.lg,
    gap:               SIZES.md,
  },

  // ── Header ────────────────────────────────
  headerSection: {
    alignItems:      'center',
    paddingVertical: SIZES.md,
    position:        'relative',
  },
  backBtn: {
    position:        'absolute',
    left:            0,
    top:             SIZES.md,
    padding:         SIZES.xs,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.round,
    width:           40,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
    ...SHADOW,
  },
  logo: { fontSize: 50 },
  title: {
    fontSize:   FONTS.title || FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.primary,
    marginTop:  SIZES.sm,
  },
  subtitle: {
    fontSize:  FONTS.md,
    color:     COLORS.textLight,
    marginTop: SIZES.xs,
  },

  // ── Inputs ────────────────────────────────
  nameRow: { flexDirection: 'row', gap: SIZES.sm },
  inputContainer: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    gap:               SIZES.sm,
    borderWidth:       1,
    borderColor:       'transparent',
    ...SHADOW,
  },
  inputContainerError: {
    borderColor:     COLORS.error + '60',
    backgroundColor: COLORS.error + '05',
  },
  inputContainerSuccess: {
    borderColor:     COLORS.success + '60',
    backgroundColor: COLORS.success + '05',
  },
  input: { flex: 1, fontSize: FONTS.lg, color: COLORS.text },

  // ── Validation Messages ───────────────────
  inputError: {
    fontSize:   FONTS.xs,
    color:      COLORS.error,
    fontWeight: '500',
    marginTop:  -SIZES.xs,
    marginLeft: SIZES.xs,
  },
  inputSuccess: {
    fontSize:   FONTS.xs,
    color:      COLORS.success,
    fontWeight: '500',
    marginTop:  -SIZES.xs,
    marginLeft: SIZES.xs,
  },

  // ── Password Strength ─────────────────────
  strengthRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginTop:     -SIZES.xs,
  },
  strengthBarBg: {
    flex:            1,
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  strengthBarFill: {
    height:       '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize:   FONTS.xs,
    fontWeight: '600',
    minWidth:   50,
    textAlign:  'right',
  },
  passwordTip: {
    fontSize:   FONTS.xs,
    color:      COLORS.textMuted,
    marginTop:  -SIZES.xs,
    marginLeft: SIZES.xs,
  },

  // ── Role Selection ────────────────────────
  roleSection: { gap: SIZES.sm },
  roleTitle: {
    fontSize:   FONTS.lg,
    fontWeight: '600',
    color:      COLORS.text,
  },
  roleButtons: { flexDirection: 'row', gap: SIZES.md },
  roleBtn: {
    flex:            1,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     COLORS.border,
    position:        'relative',
    gap:             4,
    ...SHADOW,
  },
  roleBtnActive: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  roleEmoji:        { fontSize: 28 },
  roleBtnLabel: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  roleBtnLabelActive: { color: COLORS.primary },
  roleBtnDesc: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
  roleBtnDescActive: { color: COLORS.primary },
  roleCheck: {
    position:        'absolute',
    top:             8,
    right:           8,
    backgroundColor: COLORS.primary,
    width:           20,
    height:          20,
    borderRadius:    10,
    justifyContent:  'center',
    alignItems:      'center',
  },

  // ── Owner Benefits ────────────────────────
  ownerBenefits: {
    backgroundColor: COLORS.success + '10',
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    borderWidth:     1,
    borderColor:     COLORS.success + '30',
    gap:             SIZES.xs,
  },
  ownerBenefitsTitle: {
    fontSize:     FONTS.sm,
    fontWeight:   '700',
    color:        COLORS.text,
    marginBottom: 4,
  },
  ownerBenefit: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
  },
  ownerBenefitText: {
    fontSize: FONTS.sm,
    color:    COLORS.textLight,
  },

  // ── Register Button ───────────────────────
  registerBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primary,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    marginTop:       SIZES.sm,
    ...SHADOW,
  },
  registerBtnDisabled: { opacity: 0.7 },
  registerBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
  },

  // ── Divider ───────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
    marginTop:     SIZES.xs,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: FONTS.sm,
    color:    COLORS.textMuted,
  },

  // ── Guest Button ──────────────────────────
  guestBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primary + '10',
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    borderWidth:     1.5,
    borderColor:     COLORS.primary + '30',
  },
  guestBtnText: {
    color:      COLORS.primary,
    fontSize:   FONTS.lg,
    fontWeight: '600',
  },

  // ── Terms ─────────────────────────────────
  termsText: {
    fontSize:   FONTS.sm,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 20,
  },
  termsLink: { color: COLORS.primary, fontWeight: '600' },

  // ── Sign In Link ──────────────────────────
  loginRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    paddingBottom:  SIZES.md,
    paddingTop:     SIZES.sm,
  },
  loginLabel: { color: COLORS.textLight, fontSize: FONTS.md },
  loginLink: {
    color:      COLORS.primary,
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
});