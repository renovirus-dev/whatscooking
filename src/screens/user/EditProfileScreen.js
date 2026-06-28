// ============================================
// FILE: src/screens/user/EditProfileScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { uploadImage } from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const DIETARY_OPTIONS = [
  { label: 'Vegetarian', emoji: '🥗' },
  { label: 'Vegan', emoji: '🌱' },
  { label: 'Gluten Free', emoji: '🌾' },
  { label: 'Halal', emoji: '☪️' },
  { label: 'Kosher', emoji: '✡️' },
  { label: 'Dairy Free', emoji: '🥛' },
  { label: 'Nut Free', emoji: '🥜' },
  { label: 'Keto', emoji: '🥩' },
];

export default function EditProfileScreen({ navigation }) {
  const { user, userProfile, updateUserProfile } = useAuth();

  const [form, setForm] = useState({
    firstName: userProfile?.firstName || '',
    lastName:  userProfile?.lastName  || '',
    phone:     userProfile?.phone     || '',
    bio:       userProfile?.bio       || '',
  });

  const [dietary, setDietary] = useState(
    userProfile?.dietaryPreferences || []
  );
  const [avatarUri, setAvatarUri]     = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    userProfile?.avatar || null
  );
  const [loading, setLoading]         = useState(false);
  const [notifications, setNotifications] = useState(
    userProfile?.notifications || {
      pushEnabled: true,
      menuUpdates: true,
      promotions:  false,
    }
  );

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleDietary = (pref) => {
    setDietary(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

  const pickAvatar = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      setAvatarPreview(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Error', 'First and last name are required');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = userProfile?.avatar || '';
      let avatarPath = userProfile?.avatarPath || '';

      // ✅ Upload new avatar if selected
      if (avatarUri) {
        avatarPath = `avatars/${user.uid}_${Date.now()}`;
        const uploadResult = await uploadImage(avatarUri, avatarPath);
        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
        }
      }

      const result = await updateUserProfile({
        firstName:            form.firstName.trim(),
        lastName:             form.lastName.trim(),
        phone:                form.phone.trim(),
        bio:                  form.bio.trim(),
        avatar:               avatarUrl,
        avatarPath,
        dietaryPreferences:   dietary,
        notifications,
      });

      if (result.success) {
        Alert.alert('✅ Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A password reset email will be sent to ' + user?.email,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            const { forgotPassword } = useAuth();
            await forgotPassword(user?.email);
            Alert.alert(
              '📧 Email Sent',
              'Check your inbox for password reset instructions'
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar ─────────────────────────── */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={pickAvatar}
          activeOpacity={0.8}
        >
          {avatarPreview ? (
            <Image
              source={{ uri: avatarPreview }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {form.firstName?.[0]?.toUpperCase() || '👤'}
              </Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </View>

      {/* ── Basic Info ─────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Basic Information</Text>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={v => updateForm('firstName', v)}
              placeholder="First name"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={form.lastName}
              onChangeText={v => updateForm('lastName', v)}
              placeholder="Last name"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, styles.disabledInput]}>
            <Text style={styles.disabledText}>{user?.email}</Text>
          </View>
          <Text style={styles.fieldHint}>
            Email cannot be changed
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={v => updateForm('phone', v)}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.bio}
            onChangeText={v => updateForm('bio', v)}
            placeholder="Tell us a bit about yourself..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      {/* ── Dietary Preferences ────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🥗 Dietary Preferences
        </Text>
        <Text style={styles.sectionHint}>
          We'll highlight menu items that match your diet
        </Text>
        <View style={styles.chipGrid}>
          {DIETARY_OPTIONS.map(opt => {
            const active = dietary.includes(opt.label);
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleDietary(opt.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                <Text style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Notifications ──────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        {[
          {
            key: 'menuUpdates',
            label: "Daily Menu Updates",
            desc: "Get notified when restaurants update their menu",
          },
          {
            key: 'promotions',
            label: "Promotions & Deals",
            desc: "Special offers from your favorite restaurants",
          },
          {
            key: 'pushEnabled',
            label: "Push Notifications",
            desc: "Allow push notifications on this device",
          },
        ].map(notif => (
          <TouchableOpacity
            key={notif.key}
            style={styles.notifRow}
            onPress={() => setNotifications(prev => ({
              ...prev,
              [notif.key]: !prev[notif.key],
            }))}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>{notif.label}</Text>
              <Text style={styles.notifDesc}>{notif.desc}</Text>
            </View>
            <View style={[
              styles.toggle,
              notifications[notif.key] && styles.toggleOn,
            ]}>
              <View style={[
                styles.toggleThumb,
                notifications[notif.key] && styles.toggleThumbOn,
              ]} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Security ───────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Security</Text>
        <TouchableOpacity
          style={styles.securityBtn}
          onPress={handleChangePassword}
          activeOpacity={0.7}
        >
          <Ionicons
            name="key-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.securityBtnText}>Change Password</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* ── Save Button ────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    backgroundColor: COLORS.primary,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.secondary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FONTS.sm,
    marginTop: SIZES.sm,
  },

  // Sections
  section: {
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    borderRadius: RADIUS.lg,
    padding: SIZES.lg,
    gap: SIZES.md,
    ...SHADOW,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionHint: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: -SIZES.sm,
  },

  // Form fields
  row: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  field: {
    gap: SIZES.xs,
  },
  label: {
    fontSize: FONTS.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  fieldHint: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: FONTS.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    justifyContent: 'center',
    opacity: 0.6,
  },
  disabledText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
  },

  // Dietary chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipEmoji: { fontSize: 14 },
  chipText: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Notifications
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SIZES.md,
  },
  notifLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  notifDesc: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: COLORS.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  // Security
  securityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  securityBtnText: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },
});