// ============================================
// FILE: src/screens/auth/LoginScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login, forgotPassword } = useAuth();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
    // Navigation happens automatically via auth state change
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Info', 'Enter your email address first');
      return;
    }
    const result = await forgotPassword(email.trim());
    if (result.success) {
      Alert.alert(
        'Email Sent ✅',
        'Check your email for password reset instructions'
      );
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    // ✅ KeyboardAvoidingView — outermost wrapper
    // 'padding' on iOS pushes content up
    // 'height' on Android shrinks the view so inputs stay visible
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // ✅ On Android with translucent status bar,
      // offset by insets.top so keyboard aligns correctly
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            // ✅ Top padding respects status bar
            paddingTop: insets.top + SIZES.lg,
            // ✅ Bottom padding clears Android nav bar
            // and gives breathing room above keyboard
            paddingBottom: insets.bottom + SIZES.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>What's Cooking</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>

          {/* Email input */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.textMuted}
              style={styles.inputIcon}
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
            />
          </View>

          {/* Password input */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
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
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign in button */}
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
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.loginText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ✅ flexGrow: 1 ensures content centres vertically
  // when there is empty space (short content on tall screens)
  content: {
    flexGrow: 1,
    paddingHorizontal: SIZES.lg,
    justifyContent: 'center',
    // paddingTop and paddingBottom set dynamically via insets
  },

  // ── Header ─────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: SIZES.xxl,
  },
  logo: {
    fontSize: 60,
  },
  title: {
    fontSize: FONTS.title,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: SIZES.sm,
  },
  subtitle: {
    fontSize: FONTS.lg,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
  },

  // ── Form ───────────────────────────────
  form: {
    gap: SIZES.md,
  },

  // ── Inputs ─────────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    ...SHADOW,
  },
  inputIcon: {
    marginRight: SIZES.sm,
  },
  input: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text,
  },

  // ── Forgot password ────────────────────
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: SIZES.xs,   // ✅ Larger tap area
    paddingHorizontal: SIZES.xs,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: '600',
  },

  // ── Sign in button ─────────────────────
  loginBtn: {
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SIZES.sm,
    ...SHADOW,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },

  // ── Register row ───────────────────────
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.md,
    // ✅ Extra bottom padding so this last element
    // is never hidden behind the Android nav bar
    paddingBottom: SIZES.md,
  },
  registerLabel: {
    color: COLORS.textLight,
    fontSize: FONTS.md,
  },
  registerLink: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
});