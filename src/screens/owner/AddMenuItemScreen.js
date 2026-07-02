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
import { getAutoFoodImage }  from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

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

// ✅ Category placeholder images
// Used when no name is typed yet
// Each category has a known good photo
const CATEGORY_PLACEHOLDERS = {
  appetizer:   'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&h=300&fit=crop&q=80',
  soup:        'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop&q=80',
  salad:       'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&q=80',
  main_course: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&q=80',
  side_dish:   'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop&q=80',
  dessert:     'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop&q=80',
  beverage:    'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop&q=80',
  breakfast:   'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop&q=80',
  combo_meal:  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80',
  snack:       'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop&q=80',
};

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
  const [imageLoading, setImageLoading]       = useState(false);
  const [loading, setLoading]                 = useState(false);

  // ✅ Get auto image — only when name is typed
  const getAutoImage = useCallback(() => {
    const name     = form.name.trim();
    const category = form.category || 'main_course';

    // ✅ KEY FIX: If no name typed yet —
    // show the category placeholder instead of
    // running through the keyword match which
    // falls to default pool with random photos
    if (!name) {
      return CATEGORY_PLACEHOLDERS[category] ||
             CATEGORY_PLACEHOLDERS['main_course'];
    }

    const seed = `${name}-${category}-${regenerateCount}`;
    return getAutoFoodImage(name, category, seed);
  }, [form.name, form.category, regenerateCount]);

  // ✅ Display image priority
  const displayImage = useCustomImage
    ? (newImageUri || existingImageUrl || getAutoImage())
    : getAutoImage();

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

  const handleRegenerateImage = useCallback(() => {
    setUseCustomImage(false);
    setNewImageUri(null);
    setImageLoading(true);
    setRegenerateCount(prev => prev + 1);
  }, []);

  const handleRemoveCustomImage = () => {
    setUseCustomImage(false);
    setNewImageUri(null);
    setImageLoading(true);
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

    // ✅ Generate stable auto image using the dish name
    const stableAutoImage = getAutoFoodImage(
      form.name.trim(),
      form.category,
      `${form.name.trim()}-${form.category}-0`
    );

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
      autoImageUrl: useCustomImage ? null : stableAutoImage,
      imageUrl:     isShowingExistingPhoto ? existingImageUrl : null,
    };

    let result;
    try {
      if (existingItem) {
        result = await updateMenuItem(
          existingItem.id,
          data,
          isShowingNewPhoto ? newImageUri : null
        );
      } else {
        result = await addMenuItem(data, newImageUri);
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
            {imageLoading && isShowingAutoPhoto && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                />
              </View>
            )}

            <Image
              key={`${displayImage}-${regenerateCount}`}
              source={{ uri: displayImage }}
              style={styles.previewImage}
              resizeMode="cover"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
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
            <TouchableOpacity
              style={[
                styles.imageActionBtn,
                imageLoading && styles.imageActionBtnDisabled,
              ]}
              onPress={handleRegenerateImage}
              disabled={imageLoading}
              activeOpacity={0.7}
            >
              {imageLoading ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                />
              ) : (
                <Ionicons
                  name="refresh"
                  size={16}
                  color={COLORS.primary}
                />
              )}
              <Text style={styles.imageActionText}>
                {imageLoading ? 'Loading...' : 'Auto Image'}
              </Text>
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

          {/* ✅ Better hint text */}
          <Text style={styles.imageHint}>
            {isShowingNewPhoto
              ? '📷 New photo selected — tap Save to apply'
              : isShowingExistingPhoto
              ? '🖼️ Current saved photo — tap 🔄 for auto or tap image to change'
              : form.name.trim()
              ? `🤖 Auto image for "${form.name.trim()}" — tap 🔄 for next`
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
              onChangeText={v => {
                updateForm('name', v);
                if (isShowingAutoPhoto) setImageLoading(true);
              }}
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
                  onPress={() => {
                    updateForm('category', cat.id);
                    if (isShowingAutoPhoto) setImageLoading(true);
                  }}
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
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.border + '80',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
  imageActionBtnDisabled: { opacity: 0.6 },
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