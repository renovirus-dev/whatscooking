// ============================================
// FILE: src/screens/auth/RegisterScreen.js
// ============================================
import React, { useState, useRef } from 'react';
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

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  // ✅ Refs for focus chain — so "next" key on keyboard
  // jumps to the next input field
  const lastNameRef        = useRef(null);
  const emailRef           = useRef(null);
  const phoneRef           = useRef(null);
  const passwordRef        = useRef(null);
  const confirmPasswordRef = useRef(null);

  const [form, setForm] = useState({
    firstName:       '',
    lastName:        '',
    email:           '',
    password:        '',
    confirmPassword: '',
    phone:           '',
    role:            'user',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const {
      firstName, lastName, email,
      password, confirmPassword, role,
    } = form;

    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await register(
      email.trim().toLowerCase(),
      password,
      firstName.trim(),
      lastName.trim(),
      role,
    );
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
    // Auth state change handles navigation automatically
  };

  // ── Password strength indicator ──────────
  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6)  return { label: 'Too short', color: COLORS.error   };
    if (p.length < 8)  return { label: 'Weak',      color: '#FFA500'      };
    if (p.length < 12) return { label: 'Good',      color: COLORS.success };
    return               { label: 'Strong',          color: '#27AE60'      };
  };
  const strength = getPasswordStrength();

  return (
    // ✅ KeyboardAvoidingView outermost
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            // ✅ Top: clears translucent status bar
            paddingTop: insets.top + SIZES.lg,
            // ✅ Bottom: clears Android nav bar
            paddingBottom: insets.bottom + SIZES.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerSection}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join the What's Cooking community
          </Text>
        </View>

        {/* ── Name row ── */}
        <View style={styles.nameRow}>
          {/* First name */}
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Ionicons
              name="person-outline"
              size={18}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor={COLORS.textMuted}
              value={form.firstName}
              onChangeText={v => updateForm('firstName', v)}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              // ✅ Jump to last name on "next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
          </View>

          {/* Last name */}
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

        {/* ── Email ── */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={COLORS.textMuted}
          />
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
        </View>

        {/* ── Phone ── */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="call-outline"
            size={18}
            color={COLORS.textMuted}
          />
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

        {/* ── Role selection ── */}
        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>I am a:</Text>
          <View style={styles.roleButtons}>

            {/* Food Lover */}
            <TouchableOpacity
              style={[
                styles.roleBtn,
                form.role === 'user' && styles.roleBtnActive,
              ]}
              onPress={() => updateForm('role', 'user')}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>👤</Text>
              <Text style={[
                styles.roleBtnLabel,
                form.role === 'user' && styles.roleBtnLabelActive,
              ]}>
                Food Lover
              </Text>
              <Text style={[
                styles.roleBtnDesc,
                form.role === 'user' && styles.roleBtnDescActive,
              ]}>
                Browse menus
              </Text>
              {form.role === 'user' && (
                <View style={styles.roleCheck}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
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
                Manage menus
              </Text>
              {form.role === 'restaurant_owner' && (
                <View style={styles.roleCheck}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

          </View>
        </View>

        {/* ── Password ── */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password (min 6 characters)"
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
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* ✅ Password strength indicator */}
        {strength && (
          <View style={styles.strengthRow}>
            <View style={styles.strengthBarBg}>
              <View style={[
                styles.strengthBarFill,
                {
                  backgroundColor: strength.color,
                  width: form.password.length >= 12 ? '100%'
                       : form.password.length >= 8  ? '66%'
                       : form.password.length >= 6  ? '33%'
                       : '15%',
                },
              ]} />
            </View>
            <Text style={[styles.strengthLabel, { color: strength.color }]}>
              {strength.label}
            </Text>
          </View>
        )}

        {/* ── Confirm password ── */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textMuted}
            value={form.confirmPassword}
            onChangeText={v => updateForm('confirmPassword', v)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
          {/* ✅ Password match indicator */}
          {form.confirmPassword.length > 0 && (
            <Ionicons
              name={
                form.password === form.confirmPassword
                  ? 'checkmark-circle'
                  : 'close-circle'
              }
              size={18}
              color={
                form.password === form.confirmPassword
                  ? COLORS.success
                  : COLORS.error
              }
            />
          )}
        </View>

        {/* ── Create account button ── */}
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
              <Ionicons
                name="person-add-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.registerBtnText}>
                Create Account
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Terms notice ── */}
        <Text style={styles.termsText}>
          By creating an account you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>

        {/* ── Login link ── */}
        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>
            Already have an account?
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
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

  // ✅ No hardcoded paddingTop/Bottom here
  // — set dynamically from insets in contentContainerStyle
  content: {
    flexGrow: 1,
    paddingHorizontal: SIZES.lg,
    gap: SIZES.md,
  },

  // ── Header ─────────────────────────────
  headerSection: {
    alignItems: 'center',
    paddingVertical: SIZES.lg,
  },
  logo: {
    fontSize: 50,
  },
  title: {
    fontSize: FONTS.title,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: SIZES.sm,
  },
  subtitle: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
  },

  // ── Name row ───────────────────────────
  nameRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },

  // ── Inputs ─────────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW,
  },
  input: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text,
  },

  // ── Password strength ──────────────────
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    // ✅ Negative marginTop pulls it closer to the password field
    marginTop: -SIZES.xs,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: FONTS.xs,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'right',
  },

  // ── Role selection ─────────────────────
  roleSection: {
    gap: SIZES.sm,
  },
  roleTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  roleBtn: {
    flex: 1,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
    ...SHADOW,
  },
  roleBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  roleEmoji: {
    fontSize: 28,
    marginBottom: SIZES.xs,
  },
  roleBtnLabel: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  roleBtnLabelActive: {
    color: COLORS.primary,
  },
  roleBtnDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  roleBtnDescActive: {
    color: COLORS.primary,
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Register button ────────────────────
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.sm,
    ...SHADOW,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },

  // ── Terms ──────────────────────────────
  termsText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // ── Login link ─────────────────────────
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // ✅ Extra bottom breathing room — main padding
    // is handled by insets on contentContainerStyle
    paddingBottom: SIZES.md,
  },
  loginLabel: {
    color: COLORS.textLight,
    fontSize: FONTS.md,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
});