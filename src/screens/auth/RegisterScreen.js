// ============================================
// FILE: src/screens/auth/RegisterScreen.js
// REPLACE ENTIRE FILE - No external picker needed
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'user',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      role,
    } = form;

    // Validation
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
      role
    );
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
    // Auth state change handles navigation automatically
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join the What's Cooking community
          </Text>
        </View>

        {/* Name Row */}
        <View style={styles.nameRow}>
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
            />
          </View>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor={COLORS.textMuted}
              value={form.lastName}
              onChangeText={v => updateForm('lastName', v)}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={COLORS.textMuted}
            value={form.email}
            onChangeText={v => updateForm('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        {/* Phone */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="call-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number (optional)"
            placeholderTextColor={COLORS.textMuted}
            value={form.phone}
            onChangeText={v => updateForm('phone', v)}
            keyboardType="phone-pad"
          />
        </View>

        {/* Role Selection - Custom buttons, no Picker needed */}
        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>I am a:</Text>
          <View style={styles.roleButtons}>

            {/* Food Lover Button */}
            <TouchableOpacity
              style={[
                styles.roleBtn,
                form.role === 'user' && styles.roleBtnActive
              ]}
              onPress={() => updateForm('role', 'user')}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>👤</Text>
              <Text style={[
                styles.roleBtnLabel,
                form.role === 'user' && styles.roleBtnLabelActive
              ]}>
                Food Lover
              </Text>
              <Text style={[
                styles.roleBtnDesc,
                form.role === 'user' && styles.roleBtnDescActive
              ]}>
                Browse menus
              </Text>
              {form.role === 'user' && (
                <View style={styles.roleCheck}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Restaurant Owner Button */}
            <TouchableOpacity
              style={[
                styles.roleBtn,
                form.role === 'restaurant_owner' &&
                  styles.roleBtnActive
              ]}
              onPress={() =>
                updateForm('role', 'restaurant_owner')
              }
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>🍽️</Text>
              <Text style={[
                styles.roleBtnLabel,
                form.role === 'restaurant_owner' &&
                  styles.roleBtnLabelActive
              ]}>
                Restaurant Owner
              </Text>
              <Text style={[
                styles.roleBtnDesc,
                form.role === 'restaurant_owner' &&
                  styles.roleBtnDescActive
              ]}>
                Manage menus
              </Text>
              {form.role === 'restaurant_owner' && (
                <View style={styles.roleCheck}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </TouchableOpacity>

          </View>
        </View>

        {/* Password */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={COLORS.textMuted}
            value={form.password}
            onChangeText={v => updateForm('password', v)}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Confirm Password */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textMuted}
            value={form.confirmPassword}
            onChangeText={v => updateForm('confirmPassword', v)}
            secureTextEntry={!showPassword}
          />
          {/* Password match indicator */}
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

        {/* Register Button */}
        <TouchableOpacity
          style={[
            styles.registerBtn,
            loading && styles.registerBtnDisabled
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

        {/* Terms notice */}
        <Text style={styles.termsText}>
          By creating an account you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>

        {/* Login Link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>
            Already have an account?
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    flexGrow: 1,
    padding: SIZES.lg,
    gap: SIZES.md
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: SIZES.lg,
  },
  logo: {
    fontSize: 50
  },
  title: {
    fontSize: FONTS.title,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: SIZES.sm
  },
  subtitle: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    marginTop: SIZES.xs
  },
  nameRow: {
    flexDirection: 'row',
    gap: SIZES.sm
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW
  },
  input: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text
  },
  roleSection: {
    gap: SIZES.sm
  },
  roleTitle: {
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text
  },
  roleButtons: {
    flexDirection: 'row',
    gap: SIZES.md
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
    ...SHADOW
  },
  roleBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10'
  },
  roleEmoji: {
    fontSize: 28,
    marginBottom: SIZES.xs
  },
  roleBtnLabel: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center'
  },
  roleBtnLabelActive: {
    color: COLORS.primary
  },
  roleBtnDesc: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center'
  },
  roleBtnDescActive: {
    color: COLORS.primary
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
    alignItems: 'center'
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.sm
  },
  registerBtnDisabled: {
    opacity: 0.7
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.xl,
    fontWeight: 'bold'
  },
  termsText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600'
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loginLabel: {
    color: COLORS.textLight,
    fontSize: FONTS.md
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: 'bold'
  }
});