// ============================================
// FILE: src/screens/user/EditProfileScreen.js
// ============================================
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
  ActivityIndicator, Image, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker      from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db }             from '../../firebase/config';
import { useAuth }        from '../../hooks/useAuth';
import { CLOUDINARY_CONFIG } from '../../config/cloudinary';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─── Dietary Options ──────────────────────────
const DIETARY_OPTIONS = [
  { label: 'Vegetarian', emoji: '🥗' },
  { label: 'Vegan',      emoji: '🌱' },
  { label: 'Gluten Free',emoji: '🌾' },
  { label: 'Halal',      emoji: '☪️'  },
  { label: 'Kosher',     emoji: '✡️'  },
  { label: 'Dairy Free', emoji: '🥛' },
  { label: 'Nut Free',   emoji: '🥜' },
  { label: 'Keto',       emoji: '🥩' },
];

const MAX_BIO = 200;

// ─────────────────────────────────────────────
// UPLOAD AVATAR TO CLOUDINARY
// ─────────────────────────────────────────────
const uploadAvatarToCloudinary = async (imageUri, userId) => {
  try {
    // ✅ Compress first
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 400 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    const formData = new FormData();
    formData.append('file', {
      uri:  compressed.uri,
      type: 'image/jpeg',
      name: `avatar_${userId}_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', uploadPreset);
    // ✅ Goes to whats_cooking/profiles/
    formData.append('folder', folders.profiles);
    // ✅ Same public_id overwrites old avatar automatically
    formData.append('public_id', `avatar_${userId}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method:  'POST',
        body:    formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return { success: true, url: data.secure_url };
  } catch (err) {
    console.error('Avatar upload error:', err);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile, updateUserProfile, forgotPassword } = useAuth();

  // ── Refs ──────────────────────────────────
  const lastNameRef = useRef(null);
  const phoneRef    = useRef(null);
  const bioRef      = useRef(null);

  // ── Form State ────────────────────────────
  const [form, setForm] = useState({
    firstName: userProfile?.firstName || '',
    lastName:  userProfile?.lastName  || '',
    phone:     userProfile?.phone     || '',
    bio:       userProfile?.bio       || '',
  });

  const [dietary, setDietary] = useState(
    userProfile?.dietaryPreferences || []
  );
  const [notifications, setNotifications] = useState({
    pushEnabled: userProfile?.notifications?.pushEnabled ?? true,
    menuUpdates: userProfile?.notifications?.menuUpdates ?? true,
    promotions:  userProfile?.notifications?.promotions  ?? false,
  });

  // ── Avatar State ──────────────────────────
  const [avatarUri, setAvatarUri]         = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    userProfile?.avatar || null
  );
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // ── Save State ────────────────────────────
  const [loading, setLoading]   = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  // ─────────────────────────────────────────
  // CHANGE DETECTION
  // ✅ Only enable save when something changed
  // ─────────────────────────────────────────
  const hasChanges = useMemo(() => {
    const formChanged =
      form.firstName !== (userProfile?.firstName || '') ||
      form.lastName  !== (userProfile?.lastName  || '') ||
      form.phone     !== (userProfile?.phone     || '') ||
      form.bio       !== (userProfile?.bio       || '');

    const dietaryChanged = JSON.stringify([...dietary].sort()) !==
      JSON.stringify([...(userProfile?.dietaryPreferences || [])].sort());

    const notifChanged =
      notifications.pushEnabled !== (userProfile?.notifications?.pushEnabled ?? true) ||
      notifications.menuUpdates !== (userProfile?.notifications?.menuUpdates ?? true) ||
      notifications.promotions  !== (userProfile?.notifications?.promotions  ?? false);

    const avatarChanged = !!avatarUri || avatarRemoved;

    return formChanged || dietaryChanged || notifChanged || avatarChanged;
  }, [form, dietary, notifications, avatarUri, avatarRemoved, userProfile]);

  // ─────────────────────────────────────────
  // FORM HELPERS
  // ─────────────────────────────────────────
  const updateForm = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleDietary = useCallback((pref) => {
    setDietary(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  }, []);

  const toggleNotif = useCallback((key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─────────────────────────────────────────
  // AVATAR PICKER
  // ✅ Camera + Library + Remove options
  // ─────────────────────────────────────────
  const handleAvatarPress = useCallback(() => {
    const options = [
      { text: '📷 Take Photo',          onPress: () => pickAvatar('camera')  },
      { text: '🖼️ Choose from Library', onPress: () => pickAvatar('library') },
    ];

    if (avatarPreview) {
      options.push({
        text:    '🗑️ Remove Photo',
        style:   'destructive',
        onPress: () => {
          setAvatarUri(null);
          setAvatarPreview(null);
          setAvatarRemoved(true);
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Photo', 'Choose an option', options);
  }, [avatarPreview]);

  const pickAvatar = useCallback(async (source) => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect:        [1, 1],
          quality:       1,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:    ['images'],
          allowsEditing: true,
          aspect:        [1, 1],
          quality:       1,
        });
      }

      if (!result.canceled) {
        setAvatarUri(result.assets[0].uri);
        setAvatarPreview(result.assets[0].uri);
        setAvatarRemoved(false);
      }
    } catch (err) {
      console.error('Avatar pick error:', err);
      Alert.alert('Error', 'Could not select photo');
    }
  }, []);

  // ─────────────────────────────────────────
  // SAVE HANDLER
  // ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // ── Validation ────────────────────────
    if (!form.firstName.trim()) {
      Alert.alert('Required', 'First name is required');
      return;
    }
    if (!form.lastName.trim()) {
      Alert.alert('Required', 'Last name is required');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = userProfile?.avatar || '';

      // ── Upload new avatar ─────────────────
      if (avatarUri) {
        setLoadingStep('Uploading photo...');
        setAvatarUploading(true);

        const uploadResult = await uploadAvatarToCloudinary(
          avatarUri, user.uid
        );
        setAvatarUploading(false);

        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
        } else {
          // Ask if they want to continue without photo
          const continueWithout = await new Promise(resolve => {
            Alert.alert(
              '⚠️ Photo Upload Failed',
              'Could not upload your photo. Save profile without it?',
              [
                { text: 'Cancel',      onPress: () => resolve(false), style: 'cancel' },
                { text: 'Save Anyway', onPress: () => resolve(true) },
              ]
            );
          });
          if (!continueWithout) {
            setLoading(false);
            setLoadingStep('');
            return;
          }
        }
      }

      // ── Remove avatar ─────────────────────
      if (avatarRemoved) {
        avatarUrl = '';
      }

      // ── Save to Firestore ─────────────────
      setLoadingStep('Saving profile...');

      const result = await updateUserProfile({
        firstName:          form.firstName.trim(),
        lastName:           form.lastName.trim(),
        phone:              form.phone.trim(),
        bio:                form.bio.trim(),
        avatar:             avatarUrl,
        dietaryPreferences: dietary,
        notifications,
      });

      if (result.success) {
        Alert.alert(
          '✅ Profile Updated!',
          'Your changes have been saved.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
      setAvatarUploading(false);
    }
  }, [
    form, dietary, notifications,
    avatarUri, avatarRemoved,
    user, userProfile, updateUserProfile, navigation,
  ]);

  // ─────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────
  const handleChangePassword = useCallback(() => {
    Alert.alert(
      'Change Password',
      `A password reset email will be sent to:\n${user?.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              await forgotPassword(user?.email);
              Alert.alert(
                '📧 Email Sent',
                'Check your inbox for password reset instructions.'
              );
            } catch {
              Alert.alert('Error', 'Could not send reset email. Try again.');
            }
          },
        },
      ]
    );
  }, [user, forgotPassword]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 56}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      >

        {/* ── Avatar Section ─────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            disabled={avatarUploading}
          >
            {avatarUploading ? (
              <View style={styles.avatarFallback}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : avatarPreview ? (
              <Image
                source={{ uri: avatarPreview }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {form.firstName?.[0]?.toUpperCase() || '👤'}
                </Text>
              </View>
            )}

            {!avatarUploading && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            )}

            {/* ✅ New photo indicator */}
            {avatarUri && !avatarUploading && (
              <View style={styles.avatarNewBadge}>
                <Text style={styles.avatarNewText}>New</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.avatarHint}>
            {avatarUploading
              ? 'Uploading...'
              : avatarUri
              ? 'New photo selected — tap Save to apply'
              : 'Tap to change photo'}
          </Text>
        </View>

        {/* ── Basic Info ────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Basic Information</Text>

          {/* Name Row */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>
                First Name <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.firstName}
                onChangeText={v => updateForm('firstName', v)}
                placeholder="First name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>
                Last Name <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
              <TextInput
                ref={lastNameRef}
                style={styles.input}
                value={form.lastName}
                onChangeText={v => updateForm('lastName', v)}
                placeholder="Last name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
          </View>

          {/* Email — read only */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.input, styles.disabledInput]}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={COLORS.textMuted}
              />
              <Text style={styles.disabledText}>{user?.email}</Text>
            </View>
            <Text style={styles.fieldHint}>
              Email address cannot be changed
            </Text>
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="call-outline"
                size={16}
                color={COLORS.textMuted}
              />
              <TextInput
                ref={phoneRef}
                style={styles.inputFlex}
                value={form.phone}
                onChangeText={v => updateForm('phone', v)}
                placeholder="+1 (876) 000-0000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => bioRef.current?.focus()}
              />
            </View>
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bio</Text>
              <Text style={[
                styles.charCount,
                form.bio.length > MAX_BIO * 0.9 && { color: COLORS.error },
              ]}>
                {form.bio.length}/{MAX_BIO}
              </Text>
            </View>
            <TextInput
              ref={bioRef}
              style={[styles.input, styles.textarea]}
              value={form.bio}
              onChangeText={v => updateForm('bio', v.slice(0, MAX_BIO))}
              placeholder="Tell us a bit about yourself..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={MAX_BIO}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* ── Dietary Preferences ───────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🥗 Dietary Preferences</Text>
          <Text style={styles.sectionHint}>
            We'll highlight menu items that match your diet
          </Text>

          {dietary.length > 0 && (
            <View style={styles.selectedDietaryBanner}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={COLORS.success}
              />
              <Text style={styles.selectedDietaryText}>
                {dietary.length} preference
                {dietary.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

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
                  {active && (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Notifications ─────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          {[
            {
              key:   'pushEnabled',
              label: 'Push Notifications',
              desc:  'Allow alerts on this device',
              icon:  'phone-portrait-outline',
            },
            {
              key:   'menuUpdates',
              label: 'Daily Menu Updates',
              desc:  'When restaurants post today\'s menu',
              icon:  'restaurant-outline',
            },
            {
              key:   'promotions',
              label: 'Promotions & Deals',
              desc:  'Special offers from your favorites',
              icon:  'pricetag-outline',
            },
          ].map((notif, idx, arr) => (
            <View
              key={notif.key}
              style={[
                styles.notifRow,
                idx === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[
                styles.notifIconBg,
                { backgroundColor: COLORS.primary + '15' },
              ]}>
                <Ionicons
                  name={notif.icon}
                  size={18}
                  color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifLabel}>{notif.label}</Text>
                <Text style={styles.notifDesc}>{notif.desc}</Text>
              </View>
              {/* ✅ Using Switch instead of custom toggle */}
              <Switch
                value={!!notifications[notif.key]}
                onValueChange={() => toggleNotif(notif.key)}
                trackColor={{
                  false: COLORS.border,
                  true:  COLORS.primary + '80',
                }}
                thumbColor={
                  notifications[notif.key] ? COLORS.primary : '#f4f3f4'
                }
                ios_backgroundColor={COLORS.border}
              />
            </View>
          ))}
        </View>

        {/* ── Security ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Security</Text>
          <TouchableOpacity
            style={styles.securityBtn}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <View style={[
              styles.notifIconBg,
              { backgroundColor: COLORS.primary + '15' },
            ]}>
              <Ionicons name="key-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.securityBtnText}>Change Password</Text>
            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* ── Save Button ───────────────────── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (!hasChanges || loading) && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.saveBtnLoading}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.saveBtnText}>{loadingStep}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {hasChanges ? 'Save Changes' : 'No Changes'}
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Avatar Section ────────────────────────
  avatarSection: {
    alignItems:     'center',
    paddingVertical: SIZES.xl,
    backgroundColor: COLORS.primary,
    gap:            SIZES.sm,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width:        100,
    height:       100,
    borderRadius: 50,
    borderWidth:  3,
    borderColor:  '#FFFFFF',
  },
  avatarFallback: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     3,
    borderColor:     '#FFFFFF',
  },
  avatarInitial: {
    fontSize:   40,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  avatarEditBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    backgroundColor: COLORS.secondary,
    width:           30,
    height:          30,
    borderRadius:    15,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     '#FFFFFF',
  },
  avatarNewBadge: {
    position:          'absolute',
    top:               0,
    right:             0,
    backgroundColor:   COLORS.success,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  avatarNewText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  avatarHint:    { color: 'rgba(255,255,255,0.85)', fontSize: FONTS.sm },

  // ── Sections ──────────────────────────────
  section: {
    backgroundColor: COLORS.surface,
    margin:          SIZES.md,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.lg,
    gap:             SIZES.md,
    ...SHADOW,
  },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text },
  sectionHint:  { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: -SIZES.sm },

  // ── Form Fields ───────────────────────────
  row:      { flexDirection: 'row', gap: SIZES.md },
  field:    { gap: SIZES.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:    { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text },
  fieldHint:{ fontSize: FONTS.xs, color: COLORS.textMuted },
  charCount:{ fontSize: FONTS.xs, color: COLORS.textMuted },

  input: {
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    fontSize:          FONTS.md,
    color:             COLORS.text,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
    gap:               SIZES.sm,
  },
  inputFlex: { flex: 1, fontSize: FONTS.md, color: COLORS.text },
  textarea: {
    height:            80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    flexDirection: 'row',
    alignItems:    'center',
    opacity:       0.6,
    gap:           SIZES.sm,
  },
  disabledText: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Dietary Chips ─────────────────────────
  selectedDietaryBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SIZES.xs,
    backgroundColor: COLORS.success + '15',
    padding:         SIZES.sm,
    borderRadius:    RADIUS.md,
  },
  selectedDietaryText: {
    fontSize:   FONTS.sm,
    color:      COLORS.success,
    fontWeight: '600',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
    gap:               6,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji:      { fontSize: 14 },
  chipText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },

  // ── Notifications ─────────────────────────
  notifRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap:               SIZES.md,
  },
  notifIconBg: {
    width:          36,
    height:         36,
    borderRadius:   RADIUS.md,
    justifyContent: 'center',
    alignItems:     'center',
  },
  notifLabel: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  notifDesc:  { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },

  // ── Security ──────────────────────────────
  securityBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
    paddingVertical: SIZES.sm,
  },
  securityBtnText: {
    flex:       1,
    fontSize:   FONTS.md,
    color:      COLORS.text,
    fontWeight: '500',
  },

  // ── Save Button ───────────────────────────
  saveBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  COLORS.primary,
    marginHorizontal: SIZES.md,
    paddingVertical:  SIZES.md,
    borderRadius:     RADIUS.lg,
    gap:              SIZES.sm,
    ...SHADOW,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnLoading:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  saveBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },
});