// ============================================
// FILE: src/screens/owner/AddMenuItemScreen.js
// ============================================
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker      from 'expo-image-picker';
import { useMenu }           from '../../hooks/useMenu';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
// ✅ Use local images — no internet needed, no Unsplash blocking
import {
  getLocalFoodImage,
} from '../../utils/localFoodImages';

const CATEGORIES = [
  { id: 'appetizer',   label: '🥗 Appetizer'  },
  { id: 'soup',        label: '🍲 Soup'        },
  { id: 'salad',       label: '🥙 Salad'       },
  { id: 'main_course', label: '🍽️ Main Course' },
  { id: 'side_dish',   label: '🍟 Side Dish'   },
  { id: 'dessert',     label: '🧁 Dessert'     },
  { id: 'beverage',    label: '🥤 Beverage'    },
  { id: 'breakfast',   label: '🍳 Breakfast'   },
  { id: 'combo_meal',  label: '🎁 Combo Meal'  },
  { id: 'snack',       label: '🍿 Snack'       },
];

const DIETARY = [
  { id: 'isVegetarian', label: '🥬 Vegetarian' },
  { id: 'isVegan',      label: '🌱 Vegan'       },
  { id: 'isGlutenFree', label: '🌾 Gluten-Free' },
  { id: 'isHalal',      label: '☪️ Halal'        },
  { id: 'isSpicy',      label: '🌶️ Spicy'       },
];

export default function AddMenuItemScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { restaurantId, item: existingItem } = route.params || {};
  const { addMenuItem, updateMenuItem }       = useMenu(restaurantId);

  const descriptionRef = useRef(null);
  const priceRef       = useRef(null);
  const prepTimeRef    = useRef(null);
  const servingSizeRef = useRef(null);
  const tagsRef        = useRef(null);

  const [form, setForm] = useState({
    name:            existingItem?.name                        || '',
    description:     existingItem?.description                 || '',
    category:        existingItem?.category                    || 'main_course',
    price:           existingItem?.price?.toString()           || '',
    preparationTime: existingItem?.preparationTime?.toString() || '',
    servingSize:     existingItem?.servingSize                 || '',
    dietaryInfo:     existingItem?.dietaryInfo                 || {},
    tags:            existingItem?.tags?.join(', ')            || '',
  });

  // ── Image state ───────────────────────────
  const [newImageUri, setNewImageUri]         = useState(null);
  const [existingImageUrl]                    = useState(
    existingItem?.imageUrl || existingItem?.autoImageUrl || null
  );
  const [useCustomImage, setUseCustomImage]   = useState(
    !!(existingItem?.imageUrl || existingItem?.autoImageUrl)
  );
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [loading, setLoading]                 = useState(false);

  // ✅ Get local image — works offline, no URLs
  const getAutoImage = useCallback(() => {
    // Returns a require() number — works without internet
    return getLocalFoodImage(form.name, form.category);
  }, [form.name, form.category]);

  // ✅ Display image source
  // Priority: new picked > existing Firebase URL > local image
  const getDisplaySource = useCallback(() => {
    if (isShowingNewPhoto) {
      // Local file picked from gallery
      return { uri: newImageUri };
    }
    if (isShowingExistingPhoto && existingImageUrl) {
      // Firebase Storage URL from previous upload
      return { uri: existingImageUrl };
    }
    // ✅ Local bundled image — no internet needed
    return getAutoImage();
  }, [
    newImageUri,
    existingImageUrl,
    useCustomImage,
    form.name,
    form.category,
  ]);

  const isShowingNewPhoto      = useCustomImage && !!newImageUri;
  const isShowingExistingPhoto = useCustomImage && !newImageUri && !!existingImageUrl;
  const isShowingAutoPhoto     = !useCustomImage;

  // ── Form handlers ─────────────────────────
  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleDietary = (key) => {
    setForm(prev => ({
      ...prev,
      dietaryInfo: {
        ...prev.dietaryInfo,
        [key]: !prev.dietaryInfo[key],
      },
    }));
  };

  // ── Image handlers ────────────────────────
  const pickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'],
      allowsEditing: true,
      aspect:        [4, 3],
      quality:       0.8,
    });
    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
      setUseCustomImage(true);
    }
  };

  // ✅ Cycle auto image — just re-render
  // Local images change instantly with no loading
  const handleRegenerateImage = useCallback(() => {
    setUseCustomImage(false);
    setNewImageUri(null);
    setRegenerateCount(prev => prev + 1);
  }, []);

  const handleRemoveCustomImage = () => {
    setUseCustomImage(false);
    setNewImageUri(null);
    setRegenerateCount(prev => prev + 1);
  };

  // ── Save handler ──────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    if (!form.price || isNaN(parseFloat(form.price))) {
      Alert.alert('Error', 'A valid price is required');
      return;
    }
    if (!form.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setLoading(true);

    // ✅ For auto images — save the dish name and category
    // so we can regenerate the local image anytime
    // No URL needed — image comes from local assets
    const data = {
      name:            form.name.trim(),
      description:     form.description.trim(),
      category:        form.category,
      price:           parseFloat(form.price),
      preparationTime: parseInt(form.preparationTime) || null,
      servingSize:     form.servingSize.trim(),
      dietaryInfo:     form.dietaryInfo,
      tags:            form.tags
                         .split(',')
                         .map(t => t.trim())
                         .filter(Boolean),
      // ✅ For local images — store null for imageUrl
      // getLocalFoodImage(name, category) regenerates from name
      autoImageUrl: null,
      imageUrl:     isShowingExistingPhoto ? existingImageUrl : null,
    };

    let result;
    try {
      if (existingItem) {
        result = await updateMenuItem(
          existingItem.id,
          data,
          // ✅ Only upload if user picked a NEW photo
          isShowingNewPhoto ? newImageUri : null
        );
      } else {
        result = await addMenuItem(
          data,
          // ✅ Only upload if user picked a photo
          newImageUri || null
        );
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    setLoading(false);

    if (result?.success) {
      Alert.alert(
        '✅ Success',
        existingItem ? 'Menu item updated!' : 'Menu item added!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', result?.error || 'Something went wrong');
    }
  };

  // ✅ Compute display source once
  const displaySource = getDisplaySource();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 0 : insets.top + 56
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom + SIZES.xl,
        }}
      >

        {/* ── Image Section ───────────────── */}
        <View style={styles.imageSection}>

          <TouchableOpacity
            style={styles.imagePicker}
            onPress={pickImage}
            activeOpacity={0.85}
          >
            {/*
              ✅ source works with both:
              - require() number (local image)
              - { uri: string } (Firebase URL or local file)
            */}
            <Image
              key={`${form.name}-${form.category}-${regenerateCount}`}
              source={displaySource}
              style={styles.previewImage}
              resizeMode="cover"
            />

            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.imageOverlayText}>
                Tap to change photo
              </Text>
            </View>

            {isShowingNewPhoto && (
              <View style={[styles.badge, styles.badgeNew]}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>New Photo</Text>
              </View>
            )}
            {isShowingExistingPhoto && (
              <View style={[styles.badge, styles.badgeExisting]}>
                <Ionicons name="image" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>Current Photo</Text>
              </View>
            )}
            {isShowingAutoPhoto && (
              <View style={[styles.badge, styles.badgeAuto]}>
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>
                  {form.name.trim() ? 'Auto' : 'Category'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.imageActions}>

            {/* ✅ Regenerate — instant, no loading needed */}
            <TouchableOpacity
              style={styles.imageActionBtn}
              onPress={handleRegenerateImage}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
              <Text style={styles.imageActionText}>Auto Image</Text>
            </TouchableOpacity>

            {(isShowingNewPhoto || isShowingExistingPhoto) && (
              <TouchableOpacity
                style={[
                  styles.imageActionBtn,
                  styles.imageActionBtnDanger,
                ]}
                onPress={handleRemoveCustomImage}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={COLORS.error}
                />
                <Text style={[
                  styles.imageActionText,
                  { color: COLORS.error },
                ]}>
                  {isShowingNewPhoto ? 'Remove New' : 'Remove Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Hint text */}
          <Text style={styles.imageHint}>
            {isShowingNewPhoto
              ? '📷 New photo selected — tap Save to apply'
              : isShowingExistingPhoto
              ? '🖼️ Current saved photo — tap 🔄 for auto or tap image to change'
              : form.name.trim()
              ? `🤖 Auto image for "${form.name.trim()}" — tap 🔄 for different`
              : `🍽️ Showing ${form.category.replace(/_/g, ' ')} photo — type a name for specific image`}
          </Text>
        </View>

        {/* ── Form ────────────────────────── */}
        <View style={styles.form}>

          {/* Item Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Jerk Chicken, Fried Fish..."
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={v => updateForm('name', v)}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              ref={descriptionRef}
              style={[styles.input, styles.textarea]}
              placeholder="Describe the dish..."
              placeholderTextColor={COLORS.textMuted}
              value={form.description}
              onChangeText={v => updateForm('description', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="next"
              onSubmitEditing={() => priceRef.current?.focus()}
            />
          </View>

          {/* Price + Prep Time */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Price ($) *</Text>
              <TextInput
                ref={priceRef}
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                value={form.price}
                onChangeText={v => updateForm('price', v)}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={() => prepTimeRef.current?.focus()}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Prep Time (mins)</Text>
              <TextInput
                ref={prepTimeRef}
                style={styles.input}
                placeholder="15"
                placeholderTextColor={COLORS.textMuted}
                value={form.preparationTime}
                onChangeText={v => updateForm('preparationTime', v)}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => servingSizeRef.current?.focus()}
              />
            </View>
          </View>

          {/* Serving Size */}
          <View style={styles.field}>
            <Text style={styles.label}>Serving Size</Text>
            <TextInput
              ref={servingSizeRef}
              style={styles.input}
              placeholder="e.g. Serves 1, 1 plate, 500g"
              placeholderTextColor={COLORS.textMuted}
              value={form.servingSize}
              onChangeText={v => updateForm('servingSize', v)}
              returnKeyType="next"
              onSubmitEditing={() => tagsRef.current?.focus()}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SIZES.sm }}
              nestedScrollEnabled
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    form.category === cat.id && styles.categoryBtnActive,
                  ]}
                  onPress={() => updateForm('category', cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryBtnText,
                    form.category === cat.id && styles.categoryBtnTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Dietary Info */}
          <View style={styles.field}>
            <Text style={styles.label}>Dietary Information</Text>
            <View style={styles.dietaryGrid}>
              {DIETARY.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.dietaryBtn,
                    form.dietaryInfo[d.id] && styles.dietaryBtnActive,
                  ]}
                  onPress={() => toggleDietary(d.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dietaryText,
                    form.dietaryInfo[d.id] && styles.dietaryTextActive,
                  ]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={styles.label}>Tags</Text>
            <Text style={styles.fieldHint}>
              Comma separated e.g. popular, chef-special
            </Text>
            <TextInput
              ref={tagsRef}
              style={styles.input}
              placeholder="popular, chef-special, new..."
              placeholderTextColor={COLORS.textMuted}
              value={form.tags}
              onChangeText={v => updateForm('tags', v)}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={COLORS.textWhite}
                />
                <Text style={styles.saveBtnText}>
                  {existingItem ? 'Update Item' : 'Add to Menu'}
                </Text>
              </>
            )}
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
  imageSection: {
    alignItems: 'center',
    padding: SIZES.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  imagePicker: {
    width: 280,
    height: 200,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOW,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.sm,
    gap: SIZES.xs,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: SIZES.sm,
    left: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
    gap: 4,
  },
  badgeAuto:     { backgroundColor: COLORS.primary              },
  badgeExisting: { backgroundColor: COLORS.info   || '#3498DB'  },
  badgeNew:      { backgroundColor: COLORS.success               },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.xs,
    fontWeight: '700',
  },
  imageActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: SIZES.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  imageActionBtnDanger: {
    backgroundColor: COLORS.error + '10',
    borderColor: COLORS.error,
  },
  imageActionText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONTS.sm,
  },
  imageHint: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SIZES.sm,
    lineHeight: 18,
    paddingHorizontal: SIZES.md,
  },
  form:      { padding: SIZES.md, gap: SIZES.md },
  field:     { gap: SIZES.xs },
  row:       { flexDirection: 'row', gap: SIZES.md },
  label:     { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  fieldHint: { fontSize: FONTS.xs, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryBtnText:       { fontSize: FONTS.sm, color: COLORS.text },
  categoryBtnTextActive: { color: COLORS.textWhite, fontWeight: '600' },
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  dietaryBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dietaryBtnActive: {
    backgroundColor: COLORS.success + '15',
    borderColor: COLORS.success,
  },
  dietaryText:       { fontSize: FONTS.sm, color: COLORS.text },
  dietaryTextActive: { color: COLORS.success, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.md,
    ...SHADOW,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },
});