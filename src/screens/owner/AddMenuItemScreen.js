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
import * as ImageManipulator from 'expo-image-manipulator';
import { useMenu }           from '../../hooks/useMenu';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { CLOUDINARY_CONFIG } from '../../config/cloudinary';
import { getThumbUrl }       from '../../utils/uploadToCloudinary';
import FoodImage             from '../../components/FoodImage';

// ─── Cloudinary Config ────────────────────────
const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

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

// ─────────────────────────────────────────────
// SAFE PLATFORM ALERTS
// ─────────────────────────────────────────────
const showSafeAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      // Find the primary/positive action button
      const confirmButton = buttons.find(b => b.style !== 'cancel' && b.text !== 'Cancel');
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        if (confirmButton && confirmButton.onPress) confirmButton.onPress();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel' || b.text === 'Cancel');
        if (cancelButton && cancelButton.onPress) cancelButton.onPress();
      }
    } else {
      alert(`${title}\n\n${message}`);
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// ─────────────────────────────────────────────
// UPLOAD IMAGE TO CLOUDINARY
// ✅ Web safe Blob parser & Multipart uploader
// ─────────────────────────────────────────────
const uploadImageToCloudinary = (imageUri, onProgress) => {
  return new Promise(async (resolve) => {
    try {
      let finalUri = imageUri;

      // Safe compression for native and web
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = compressed.uri;
      } catch (manipError) {
        console.warn('ImageManipulator bypassed:', manipError.message);
      }

      onProgress?.(25);

      const formData = new FormData();
      
      // ✅ Conversion to standard Blobs on Web
      if (Platform.OS === 'web') {
        const response = await fetch(finalUri);
        const blob = await response.blob();
        formData.append('file', blob, `menu_item_${Date.now()}.jpg`);
      } else {
        formData.append('file', {
          uri:  finalUri,
          type: 'image/jpeg',
          name: `menu_item_${Date.now()}.jpg`,
        });
      }

      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folders.menuItems);

      onProgress?.(50);

      // Upload via XHR
      const xhr = new XMLHttpRequest();

      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round(50 + (e.loaded / e.total) * 40);
          onProgress?.(pct);
        }
      });

      xhr.onload = () => {
        onProgress?.(100);
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            success:  true,
            url:      data.secure_url,
            publicId: data.public_id,
            width:    data.width,
            height:   data.height,
          });
        } else {
          let errMsg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMsg = errData.error?.message || errMsg;
          } catch {}
          console.error('Cloudinary upload error:', errMsg);
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror = () => {
        console.error('Cloudinary upload network error');
        resolve({ success: false, error: 'Network error during upload' });
      };

      xhr.ontimeout = () => {
        console.error('Cloudinary upload timed out');
        resolve({ success: false, error: 'Upload timed out' });
      };

      xhr.timeout = 60000;
      xhr.send(formData);

    } catch (err) {
      console.error('uploadImageToCloudinary error:', err);
      resolve({ success: false, error: err.message });
    }
  });
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function AddMenuItemScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { restaurantId, item: existingItem } = route.params || {};
  const { addMenuItem, updateMenuItem }       = useMenu(restaurantId);

  // ── Refs ──────────────────────────────────
  const descriptionRef = useRef(null);
  const priceRef       = useRef(null);
  const prepTimeRef    = useRef(null);
  const servingSizeRef = useRef(null);
  const tagsRef        = useRef(null);

  // ── Form State ────────────────────────────
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

  // ── Image State ───────────────────────────
  const [newImageUri, setNewImageUri]         = useState(null);
  const [existingImageUrl]                    = useState(
    existingItem?.imageUrl || existingItem?.cloudinaryUrl || null
  );
  const [useCustomImage, setUseCustomImage]   = useState(
    !!(existingItem?.imageUrl || existingItem?.cloudinaryUrl)
  );
  const [regenerateCount, setRegenerateCount] = useState(0);

  // ── Upload State ──────────────────────────
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading]               = useState(false);

  // ─────────────────────────────────────────
  // IMAGE STATE HELPERS
  // ─────────────────────────────────────────
  const isShowingNewPhoto      = useCustomImage && !!newImageUri;
  const isShowingExistingPhoto = useCustomImage && !newImageUri && !!existingImageUrl;
  const isShowingAutoPhoto     = !useCustomImage;

  // ─────────────────────────────────────────
  // FORM HANDLERS
  // ─────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // IMAGE HANDLERS
  // ─────────────────────────────────────────
  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showSafeAlert('Permission needed', 'Please allow photo library access');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS !== 'web', // Web crop engines are unsupported
      aspect:        Platform.OS !== 'web' ? [4, 3] : undefined,
      quality:       0.8,
    });

    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
      setUseCustomImage(true);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showSafeAlert('Permission needed', 'Please allow camera access');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS !== 'web',
      aspect:        Platform.OS !== 'web' ? [4, 3] : undefined,
      quality:       0.8,
    });

    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
      setUseCustomImage(true);
    }
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Add Menu Photo?\n\nPress OK to open your browser or device library.');
      if (confirmed) {
        pickImage();
      }
      return;
    }

    Alert.alert(
      '📷 Add Photo',
      'Choose image source',
      [
        { text: '📷 Take Photo',           onPress: takePhoto },
        { text: '🖼️ Choose from Library',  onPress: pickImage },
        { text: 'Cancel', style: 'cancel'                     },
      ]
    );
  };

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

  // ─────────────────────────────────────────
  // SCAN MENU ITEM
  // ─────────────────────────────────────────
  const handleScanMenuItem = () => {
    navigation.navigate('MenuScanner', {
      restaurantId,
      onScanComplete: (scannedData) => {
        if (scannedData?.name)        updateForm('name',        scannedData.name);
        if (scannedData?.price)       updateForm('price',       scannedData.price.toString());
        if (scannedData?.description) updateForm('description', scannedData.description);
        if (scannedData?.category)    updateForm('category',    scannedData.category);
      },
    });
  };

  // ─────────────────────────────────────────
  // SAVE HANDLER
  // ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      showSafeAlert('Error', 'Item name is required');
      return;
    }
    if (!form.price || isNaN(parseFloat(form.price))) {
      showSafeAlert('Error', 'A valid price is required');
      return;
    }
    if (!form.category) {
      showSafeAlert('Error', 'Please select a category');
      return;
    }

    setLoading(true);

    try {
      let cloudinaryUrl      = null;
      let cloudinaryPublicId = null;

      if (isShowingNewPhoto && newImageUri) {
        setUploading(true);
        setUploadProgress(0);

        const uploadResult = await uploadImageToCloudinary(
          newImageUri,
          (pct) => setUploadProgress(pct)
        );

        setUploading(false);
        setUploadProgress(0);

        if (!uploadResult.success) {
          const continueWithout = await new Promise(resolve => {
            showSafeAlert(
              '⚠️ Image Upload Failed',
              `${uploadResult.error}\n\nSave without image?`,
              [
                {
                  text:    'Cancel',
                  style:   'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text:    'Save Anyway',
                  onPress: () => resolve(true),
                },
              ]
            );
          });

          if (!continueWithout) {
            setLoading(false);
            return;
          }
        } else {
          cloudinaryUrl      = uploadResult.url;
          cloudinaryPublicId = uploadResult.publicId;
        }
      }

      if (isShowingExistingPhoto && existingImageUrl) {
        cloudinaryUrl      = existingImageUrl;
        cloudinaryPublicId = existingItem?.cloudinaryPublicId || null;
      }

      await saveMenuItem(cloudinaryUrl, cloudinaryPublicId);

    } catch (err) {
      console.error('handleSave error:', err);
      showSafeAlert('Error', err.message);
      setLoading(false);
      setUploading(false);
    }
  };

  const saveMenuItem = async (cloudinaryUrl, cloudinaryPublicId) => {
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

      imageUrl:           cloudinaryUrl      || null,
      cloudinaryUrl:      cloudinaryUrl      || null,
      cloudinaryPublicId: cloudinaryPublicId || null,

      autoImageUrl:  null,
      imageName:     form.name.trim(),
      imageCategory: form.category,
    };

    let result;
    if (existingItem) {
      result = await updateMenuItem(existingItem.id, data);
    } else {
      result = await addMenuItem(data);
    }

    setLoading(false);

    if (result?.success) {
      showSafeAlert(
        '✅ Success',
        existingItem ? 'Menu item updated!' : 'Menu item added!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      showSafeAlert('Error', result?.error || 'Something went wrong');
    }
  };

  const isUploading = uploading || loading;

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

        {/* ── Scan Banner ─────────────────── */}
        <TouchableOpacity
          style={styles.scanBanner}
          onPress={handleScanMenuItem}
          activeOpacity={0.85}
        >
          <View style={styles.scanBannerIcon}>
            <Ionicons name="scan-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanBannerTitle}>
              📷 Scan from Menu Page
            </Text>
            <Text style={styles.scanBannerSub}>
              Point camera at your menu to auto-fill this form
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        {/* ── Image Section ────────────────── */}
        <View style={styles.imageSection}>

          <TouchableOpacity
            style={styles.imagePicker}
            onPress={handlePickImage}
            activeOpacity={0.85}
            disabled={isUploading}
          >
            {isShowingNewPhoto ? (
              <Image
                source={{ uri: newImageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : isShowingExistingPhoto ? (
              <Image
                source={{ uri: getThumbUrl(existingImageUrl, 400, 300) }}
                style={styles.previewImage}
                resizeMode="cover"
                onError={(e) =>
                  console.log('Cloudinary img error:', e.nativeEvent.error)
                }
              />
            ) : (
              <FoodImage
                key={`${form.name}-${form.category}-${regenerateCount}`}
                name={form.name}
                category={form.category}
                style={styles.previewImage}
                resizeMode="cover"
                showLoader
              />
            )}

            {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.uploadProgressText}>
                  Uploading {uploadProgress}%
                </Text>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${uploadProgress}%` },
                  ]} />
                </View>
              </View>
            )}

            {!uploading && (
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <Text style={styles.imageOverlayText}>
                  Tap to change photo
                </Text>
              </View>
            )}

            {!uploading && (
              <>
                {isShowingNewPhoto && (
                  <View style={[styles.badge, styles.badgeNew]}>
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                    <Text style={styles.badgeText}>New Photo</Text>
                  </View>
                )}
                {isShowingExistingPhoto && (
                  <View style={[styles.badge, styles.badgeExisting]}>
                    <Ionicons
                      name="cloud-done-outline"
                      size={12}
                      color="#FFFFFF"
                    />
                    <Text style={styles.badgeText}>Cloudinary</Text>
                  </View>
                )}
                {isShowingAutoPhoto && (
                  <View style={[styles.badge, styles.badgeAuto]}>
                    <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                    <Text style={styles.badgeText}>
                      {form.name.trim() ? 'MealDB' : 'Category'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>

          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.imageActionBtn}
              onPress={handlePickImage}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
              <Text style={styles.imageActionText}>Upload Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageActionBtn}
              onPress={handleRegenerateImage}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.imageActionText}>Auto Image</Text>
            </TouchableOpacity>

            {(isShowingNewPhoto || isShowingExistingPhoto) && (
              <TouchableOpacity
                style={[styles.imageActionBtn, styles.imageActionBtnDanger]}
                onPress={handleRemoveCustomImage}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                <Text style={[styles.imageActionText, { color: COLORS.error }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.imageHint}>
            {uploading
              ? `⬆️ Uploading to Cloudinary... ${uploadProgress}%`
              : isShowingNewPhoto
              ? '📷 New photo selected — will upload to Cloudinary on save'
              : isShowingExistingPhoto
              ? '☁️ Saved on Cloudinary — tap 🔄 for auto or tap image to change'
              : form.name.trim()
              ? `🤖 Searching MealDB for "${form.name.trim()}"...`
              : `🍽️ Showing ${form.category.replace(/_/g, ' ')} — type a name for MealDB image`}
          </Text>
        </View>

        {/* ── Form ─────────────────────────── */}
        <View style={styles.form}>

          {/* Item Name */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Item Name <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
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
              placeholder="Describe the dish, ingredients, cooking style..."
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
              <Text style={styles.label}>
                Price ($) <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
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
            <Text style={styles.label}>
              Category <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
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
              Comma separated e.g. popular, chef-special, new
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

          {/* Upload Status Card */}
          {isShowingNewPhoto && !uploading && (
            <View style={styles.uploadStatusCard}>
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={COLORS.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadStatusTitle}>
                  Ready to Upload
                </Text>
                <Text style={styles.uploadStatusSub}>
                  Photo will be uploaded to Cloudinary when you save
                </Text>
              </View>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isUploading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <View style={styles.saveBtnLoading}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {uploading
                    ? `Uploading ${uploadProgress}%...`
                    : 'Saving...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
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

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },

  // ── Scan Banner ───────────────────────────
  scanBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.primary + '10',
    marginHorizontal: SIZES.md,
    marginTop:        SIZES.md,
    padding:          SIZES.md,
    borderRadius:     RADIUS.lg,
    borderWidth:      1.5,
    borderColor:      COLORS.primary + '30',
    gap:              SIZES.sm,
  },
  scanBannerIcon: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
  },
  scanBannerTitle: {
    fontSize:   FONTS.md,
    fontWeight: '700',
    color:      COLORS.text,
  },
  scanBannerSub: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 2,
  },

  // ── Image Section ─────────────────────────
  imageSection: {
    alignItems:        'center',
    padding:           SIZES.lg,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginTop:         SIZES.md,
  },
  imagePicker: {
    width:        280,
    height:       200,
    borderRadius: RADIUS.xl,
    overflow:     'hidden',
    position:     'relative',
    ...SHADOW,
  },
  previewImage: {
    width:  '100%',
    height: '100%',
  },

  // ── Upload Overlay ────────────────────────
  uploadOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             SIZES.sm,
    padding:         SIZES.md,
  },
  uploadProgressText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.md,
    fontWeight: '700',
  },
  progressBarBg: {
    width:           '80%',
    height:          6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius:    3,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          '100%',
    backgroundColor: COLORS.primary,
    borderRadius:    3,
  },

  // ── Camera Overlay ────────────────────────
  imageOverlay: {
    position:        'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: SIZES.sm,
    gap:             SIZES.xs,
  },
  imageOverlayText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: '600',
  },

  // ── Badges ────────────────────────────────
  badge: {
    position:          'absolute',
    top:               SIZES.sm,
    left:              SIZES.sm,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
    gap:               4,
  },
  badgeAuto:     { backgroundColor: COLORS.primary           },
  badgeExisting: { backgroundColor: COLORS.info || '#3498DB' },
  badgeNew:      { backgroundColor: COLORS.success           },
  badgeText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xs,
    fontWeight: '700',
  },

  // ── Image Actions ─────────────────────────
  imageActions: {
    flexDirection:  'row',
    gap:            SIZES.sm,
    marginTop:      SIZES.md,
    flexWrap:       'wrap',
    justifyContent: 'center',
  },
  imageActionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.primary + '15',
    borderWidth:       1,
    borderColor:       COLORS.primary + '40',
  },
  imageActionBtnDanger: {
    backgroundColor: COLORS.error + '10',
    borderColor:     COLORS.error + '40',
  },
  imageActionText: {
    color:      COLORS.primary,
    fontWeight: '600',
    fontSize:   FONTS.sm,
  },
  imageHint: {
    fontSize:          FONTS.xs,
    color:             COLORS.textMuted,
    textAlign:         'center',
    marginTop:         SIZES.sm,
    lineHeight:        18,
    paddingHorizontal: SIZES.md,
  },

  // ── Form ──────────────────────────────────
  form:      { padding: SIZES.md, gap: SIZES.md },
  field:     { gap: SIZES.xs },
  row:       { flexDirection: 'row', gap: SIZES.md },
  label:     { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  fieldHint: { fontSize: FONTS.xs, color: COLORS.textMuted },
  input: {
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    fontSize:          FONTS.md,
    color:             COLORS.text,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  textarea: {
    height:            80,
    textAlignVertical: 'top',
  },

  // ── Category ──────────────────────────────
  categoryBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  categoryBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  categoryBtnText:       { fontSize: FONTS.sm, color: COLORS.text },
  categoryBtnTextActive: { color: '#FFFFFF', fontWeight: '600'    },

  // ── Dietary ───────────────────────────────
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SIZES.sm,
  },
  dietaryBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  dietaryBtnActive: {
    backgroundColor: COLORS.success + '15',
    borderColor:     COLORS.success,
  },
  dietaryText:       { fontSize: FONTS.sm, color: COLORS.text   },
  dietaryTextActive: { color: COLORS.success, fontWeight: '600' },

  // ── Upload Status Card ────────────────────
  uploadStatusCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.primary + '08',
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    borderWidth:     1,
    borderColor:     COLORS.primary + '20',
    gap:             SIZES.sm,
  },
  uploadStatusTitle: {
    fontSize:   FONTS.sm,
    fontWeight: '700',
    color:      COLORS.text,
  },
  uploadStatusSub: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 2,
  },

  // ── Save Button ───────────────────────────
  saveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primary,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    marginTop:       SIZES.md,
    ...SHADOW,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnLoading: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  saveBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
  },
});