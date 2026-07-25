// ============================================
// FILE: src/screens/auth/LoginScreen.js
// ============================================
import React, {
  useState, useRef, useCallback,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Safe fallback for FONTS.title
const TITLE_SIZE = FONTS.title || FONTS.xxl || 28;

// ─── Firebase Auth Error Map ──────────────────
const getAuthError = (error) => {
  const code = error?.code || error || '';
  const map  = {
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-disabled':          'This account has been disabled.',
    'auth/too-many-requests':      'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/operation-not-allowed':  'Sign in is currently unavailable.',
  };
  return map[code] || 'Sign in failed. Please check your credentials.';
};

// ─── Email Validation ─────────────────────────
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const insets                        = useSafeAreaInsets();
  const { login, forgotPassword }     = useAuth();

  // ── Refs ──────────────────────────────────
  const passwordRef = useRef(null);

  // ── State ─────────────────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // ─────────────────────────────────────────
  // LOGIN HANDLER
  // ─────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    // ── Validation ────────────────────────
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (!result.success) {
        Alert.alert('Sign In Failed', getAuthError(result.error));
      }
      // ✅ Navigation handled automatically by auth state change
    } catch (err) {
      Alert.alert('Sign In Failed', getAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  // ─────────────────────────────────────────
  // FORGOT PASSWORD HANDLER
  // ─────────────────────────────────────────
  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address first, then tap Forgot Password.'
      );
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await forgotPassword(email.trim().toLowerCase());
      if (result.success) {
        Alert.alert(
          '📧 Email Sent',
          `Password reset instructions sent to:\n${email.trim().toLowerCase()}\n\nCheck your inbox (and spam folder).`
        );
      } else {
        Alert.alert('Error', getAuthError(result.error));
      }
    } catch (err) {
      Alert.alert('Error', getAuthError(err));
    }
  }, [email, forgotPassword]);

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

        {/* ── Back Button ───────────────────── */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* ── Header ────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* ── Form ──────────────────────────── */}
        <View style={styles.form}>

          {/* Email */}
          <View style={[
            styles.inputContainer,
            email.length > 0 && !isValidEmail(email) &&
              styles.inputContainerError,
          ]}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              returnKeyType="next"
              // ✅ Focus password on next
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {/* ✅ Email validation indicator */}
            {email.length > 0 && (
              <Ionicons
                name={isValidEmail(email)
                  ? 'checkmark-circle'
                  : 'close-circle'}
                size={18}
                color={isValidEmail(email) ? COLORS.success : COLORS.error}
              />
            )}
          </View>

          {/* Email error hint */}
          {email.length > 0 && !isValidEmail(email) && (
            <Text style={styles.inputError}>
              Please enter a valid email address
            </Text>
          )}

          {/* Password */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.textMuted}
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[
              styles.loginBtn,
              loading && styles.loginBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.loginText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ✅ Browse as Guest */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons
              name="compass-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.guestBtnText}>Browse as Guest</Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerLabel}>
              Don't have an account?
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}> Sign Up</Text>
            </TouchableOpacity>
          </View>

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
    justifyContent:    'center',
  },

  // ── Back Button ───────────────────────────
  backBtn: {
    position: 'absolute',
    top:      SIZES.lg,
    left:     SIZES.lg,
    padding:  SIZES.xs,
    zIndex:   10,
  },

  // ── Header ────────────────────────────────
  header: {
    alignItems:   'center',
    marginBottom: SIZES.xxl,
  },
  logo: { fontSize: 60 },
  title: {
    fontSize:   TITLE_SIZE,
    fontWeight: 'bold',
    color:      COLORS.primary,
    marginTop:  SIZES.sm,
  },
  subtitle: {
    fontSize:  FONTS.lg,
    color:     COLORS.textLight,
    marginTop: SIZES.xs,
  },

  // ── Form ──────────────────────────────────
  form: { gap: SIZES.md },

  // ── Inputs ────────────────────────────────
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
  input: { flex: 1, fontSize: FONTS.lg, color: COLORS.text },

  // ── Validation ────────────────────────────
  inputError: {
    fontSize:   FONTS.xs,
    color:      COLORS.error,
    fontWeight: '500',
    marginTop:  -SIZES.xs,
    marginLeft: SIZES.xs,
  },

  // ── Forgot Password ───────────────────────
  forgotBtn: {
    alignSelf:         'flex-end',
    paddingVertical:   SIZES.xs,
    paddingHorizontal: SIZES.xs,
  },
  forgotText: {
    color:      COLORS.primary,
    fontSize:   FONTS.md,
    fontWeight: '600',
  },

  // ── Login Button ──────────────────────────
  loginBtn: {
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
  loginBtnDisabled: { opacity: 0.7 },
  loginText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
  },

  // ── Divider ───────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
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

  // ── Register Row ──────────────────────────
  registerRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    paddingBottom:  SIZES.md,
  },
  registerLabel: { color: COLORS.textLight, fontSize: FONTS.md },
  registerLink: {
    color:      COLORS.primary,
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
});