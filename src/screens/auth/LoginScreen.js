// ============================================
// FILE: src/screens/auth/LoginScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { login, forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.title}>What's Cooking</Text>
          <Text style={styles.subtitle}>
            Sign in to your account
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
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
            />
          </View>

          {/* Password */}
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
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.loginText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerLabel}>
              Don't have an account?
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerLink}>
                {' '}Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, padding: SIZES.lg },
  header: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
  },
  logo: { fontSize: 60 },
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
  form: { gap: SIZES.md },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    ...SHADOW,
  },
  inputIcon: { marginRight: SIZES.sm },
  input: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SIZES.sm,
  },
  loginText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.md,
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
