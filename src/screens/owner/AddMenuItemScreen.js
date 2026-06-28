// ============================================
// FILE: src/screens/owner/AddMenuItemScreen.js
// ============================================
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMenu }          from '../../hooks/useMenu';
import { getAutoFoodImage } from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Constants ───────────────────────────────
const CATEGORIES = [
  { id: 'appetizer',    label: '🥗 Appetizer'   },
  { id: 'soup',         label: '🍲 Soup'         },
  { id: 'salad',        label: '🥙 Salad'        },
  { id: 'main_course',  label: '🍽️ Main Course'  },
  { id: 'side_dish',    label: '🍟 Side Dish'    },
  { id: 'dessert',      label: '🧁 Dessert'      },
  { id: 'beverage',     label: '🥤 Beverage'     },
  { id: 'breakfast',    label: '🍳 Breakfast'    },
  { id: 'combo_meal',   label: '🎁 Combo Meal'   },
  { id: 'snack',        label: '🍿 Snack'        },
];

const DIETARY = [
  { id: 'isVegetarian', label: '🥬 Vegetarian' },
  { id: 'isVegan',      label: '🌱 Vegan'       },
  { id: 'isGlutenFree', label: '🌾 Gluten-Free' },
  { id: 'isHalal',      label: '☪️ Halal'        },
  { id: 'isSpicy',      label: '🌶️ Spicy'       },
];

// ─── Component ───────────────────────────────
export default function AddMenuItemScreen({ route, navigation }) {
  const { restaurantId, item: existingItem } = route.params || {};
  const { addMenuItem, updateMenuItem }       = useMenu(restaurantId);

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

  const [imageUri, setImageUri]       = useState(null);
  const [customImage, setCustomImage] = useState(
    existingItem?.imageUrl || null
  );

  // ✅ FIX: imageSeed drives which image shows
  // When regenerate pressed → new timestamp → new image
  const [imageSeed, setImageSeed] = useState(
    () => existingItem?.id || Date.now().toString()
  );

  // ✅ FIX: cacheBuster is appended to URL so React Native
  // doesn't show the cached version of a previously loaded URL
  const [cacheBuster, setCacheBuster] = useState(
    () => Date.now()
  );

  const [loading, setLoading] = useState(false);

  // ✅ Auto image recalculates when name, category or seed changes
  const rawAutoImage = getAutoFoodImage(
    form.name,
    form.category,
    imageSeed
  );

  // ✅ FIX: Append cacheBuster to force React Native to
  // re-fetch even if URL happens to be the same string
  const autoImage = `${rawAutoImage}&cb=${cacheBuster}`;

  // ✅ What shows in preview
  const displayImage = customImage || autoImage;

  // ─── Handlers ────────────────────────────
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

  // ─── Pick custom image ────────────────────
  const pickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow photo library access'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setCustomImage(result.assets[0].uri);
    }
  };

  // ─── Regenerate auto image ─────────────────
  const handleRegenerateImage = useCallback(() => {
    // Clear custom image
    setImageUri(null);
    setCustomImage(null);

    // ✅ New seed = different pool index
    const newSeed = Date.now().toString();
    setImageSeed(newSeed);

    // ✅ New cache buster = React Native refetches the URL
    setCacheBuster(Date.now());
  }, []);

  // ─── Remove custom image ──────────────────
  const handleRemoveCustomImage = () => {
    setImageUri(null);
    setCustomImage(null);
    // Auto image shows again with fresh cache buster
    setCacheBuster(Date.now());
  };

  // ─── Save ─────────────────────────────────
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

    // ✅ Use rawAutoImage (without cacheBuster) for saving
    // We don't want the cache buster in the stored URL
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
      // ✅ Pass clean URL (no cache buster) for Firestore storage
      autoImageUrl: customImage ? null : rawAutoImage,
    };

    let result;
    if (existingItem) {
      result = await updateMenuItem(existingItem.id, data, imageUri);
    } else {
      result = await addMenuItem(data, imageUri);
    }

    setLoading(false);

    if (result.success) {
      Alert.alert(
        '✅ Success',
        existingItem ? 'Menu item updated!' : 'Menu item added!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', result.error);
    }
  };

  // ─── Render ───────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Image Section ──────────────────── */}
      <View style={styles.imageSection}>

        {/* Image preview — tap to upload custom */}
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          <Image
            // ✅ FIX: key forces full remount when URL changes
            // This bypasses React Native's image cache completely
            key={displayImage}
            source={{ uri: displayImage }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* Camera overlay */}
          <View style={styles.imageOverlay}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.imageOverlayText}>
              {customImage ? 'Change Photo' : 'Upload Custom'}
            </Text>
          </View>

          {/* Auto / Custom badge */}
          {!customImage ? (
            <View style={styles.autoBadge}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <Text style={styles.autoBadgeText}>Auto</Text>
            </View>
          ) : (
            <View style={[styles.autoBadge, styles.customBadge]}>
              <Ionicons name="person" size={12} color="#FFFFFF" />
              <Text style={styles.autoBadgeText}>Custom</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Image action buttons ──────────── */}
        <View style={styles.imageActions}>

          {/* Regenerate */}
          <TouchableOpacity
            style={styles.imageActionBtn}
            onPress={handleRegenerateImage}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
            <Text style={styles.imageActionText}>
              New Auto Image
            </Text>
          </TouchableOpacity>

          {/* Remove custom */}
          {customImage && (
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
                Remove Custom
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Hint text */}
        <Text style={styles.imageHint}>
          {customImage
            ? '📷 Using your custom photo'
            : '🤖 Based on name & category — tap 🔄 for a different image'}
        </Text>
      </View>

      {/* ── Form ───────────────────────────── */}
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
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe the dish..."
            placeholderTextColor={COLORS.textMuted}
            value={form.description}
            onChangeText={v => updateForm('description', v)}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price + Prep Time */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Price ($) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              value={form.price}
              onChangeText={v => updateForm('price', v)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Prep Time (mins)</Text>
            <TextInput
              style={styles.input}
              placeholder="15"
              placeholderTextColor={COLORS.textMuted}
              value={form.preparationTime}
              onChangeText={v => updateForm('preparationTime', v)}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Serving Size */}
        <View style={styles.field}>
          <Text style={styles.label}>Serving Size</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Serves 1, 1 plate, 500g"
            placeholderTextColor={COLORS.textMuted}
            value={form.servingSize}
            onChangeText={v => updateForm('servingSize', v)}
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SIZES.sm }}
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
                  form.category === cat.id &&
                    styles.categoryBtnTextActive,
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
            style={styles.input}
            placeholder="popular, chef-special, new..."
            placeholderTextColor={COLORS.textMuted}
            value={form.tags}
            onChangeText={v => updateForm('tags', v)}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            loading && styles.saveBtnDisabled,
          ]}
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

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Image section
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
  autoBadge: {
    position: 'absolute',
    top: SIZES.sm, left: SIZES.sm,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
    gap: 4,
  },
  customBadge: {
    backgroundColor: COLORS.success,
  },
  autoBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.xs,
    fontWeight: '700',
  },

  // Action buttons
  imageActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: SIZES.md,
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

  // Form
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

  // Category
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

  // Dietary
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

  // Save button
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