// ============================================
// FILE: src/utils/uploadToCloudinary.js
// ============================================
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// CORE UPLOAD FUNCTION
// ─────────────────────────────────────────────

/**
 * Upload a single image to Cloudinary (Cross-platform: Android, iOS & Web)
 * @param {string} imageUri - local image URI or web blob URI
 * @param {object|string} options - options object or folder name
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, width?: number, height?: number, error?: string}>}
 */
export const uploadToCloudinary = async (imageUri, options = {}) => {
  if (!imageUri) {
    return { success: false, error: 'No image URI provided' };
  }

  // Normalize options if a folder string was passed directly
  const opts = typeof options === 'string' ? { folder: options } : options;
  const {
    folder     = folders?.menuItems || 'whats_cooking',
    publicId   = null,
    quality    = 0.8,
    maxWidth   = 1200,
    onProgress = null,
  } = opts;

  try {
    // ── Step 1: Compress & resize image ─────
    let manipulatedUri = imageUri;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: maxWidth } }],
        {
          compress: quality,
          format:   ImageManipulator.SaveFormat.JPEG,
        }
      );
      manipulatedUri = manipulated.uri;
    } catch (manipErr) {
      console.warn('Image manipulation bypassed:', manipErr.message);
    }

    onProgress?.(25);

    // ── Step 2: Build FormData with Web Blob support ─
    const formData = new FormData();
    const fileName = publicId ? `${publicId}.jpg` : `upload_${Date.now()}.jpg`;

    // ✅ FIX: Convert local URI to a real binary Blob on Web
    if (Platform.OS === 'web') {
      const response = await fetch(manipulatedUri);
      const blob = await response.blob();
      formData.append('file', blob, fileName);
    } else {
      formData.append('file', {
        uri:  manipulatedUri,
        type: 'image/jpeg',
        name: fileName,
      });
    }

    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);
    if (publicId) formData.append('public_id', publicId);

    onProgress?.(50);

    // ── Step 3: Upload to Cloudinary ─────────
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    // ✅ FIX: Do not manually set 'Content-Type' so fetch adds the multipart boundary automatically
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body:   formData,
    });

    onProgress?.(100);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      success:  true,
      url:      data.secure_url,
      publicId: data.public_id,
      width:    data.width,
      height:   data.height,
      format:   data.format,
    };
  } catch (err) {
    console.error('uploadToCloudinary error:', err);
    return {
      success: false,
      error:   err.message,
    };
  }
};

// ─────────────────────────────────────────────
// UPLOAD MULTIPLE IMAGES
// ─────────────────────────────────────────────

/**
 * Upload multiple images to Cloudinary
 * @param {string[]} imageUris  - array of local image URIs
 * @param {object}   options    - same as uploadToCloudinary
 * @param {function} onProgress - called with (completed, total)
 * @returns {Promise<Array>}    - array of results
 */
export const uploadMultipleToCloudinary = async (
  imageUris,
  options    = {},
  onProgress = null,
) => {
  const results = [];

  for (let i = 0; i < imageUris.length; i++) {
    const result = await uploadToCloudinary(imageUris[i], options);
    results.push(result);
    if (onProgress) onProgress(i + 1, imageUris.length);
  }

  return results;
};

// ─────────────────────────────────────────────
// DELETE IMAGE FROM CLOUDINARY
// ─────────────────────────────────────────────
export const deleteFromCloudinary = async (publicId) => {
  console.warn(
    'deleteFromCloudinary: Use a Cloud Function to delete.',
    'publicId to delete:', publicId,
  );
  return { success: false, message: 'Use Cloud Function for deletion' };
};

// ─────────────────────────────────────────────
// IMAGE PICKER HELPERS (WEB-SAFE)
// ─────────────────────────────────────────────

/**
 * Pick a single image from library
 * @returns {Promise<string|null>} image URI or null
 */
export const pickImage = async () => {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera roll permission is required');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:    ImagePicker.MediaTypeOptions.Images,
    allowsEditing: Platform.OS !== 'web', // Web cropping fails silently
    aspect:        Platform.OS !== 'web' ? [4, 3] : undefined,
    quality:       1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return result.assets[0].uri;
};

/**
 * Take a photo with camera
 * @returns {Promise<string|null>} image URI or null
 */
export const takePhoto = async () => {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is required');
    }
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: Platform.OS !== 'web',
    aspect:        Platform.OS !== 'web' ? [4, 3] : undefined,
    quality:       1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return result.assets[0].uri;
};

/**
 * Show action dialog to pick image source then upload directly
 */
export const pickAndUpload = async (options = {}) => {
  if (Platform.OS === 'web') {
    try {
      const uri = await pickImage();
      if (!uri) return null;
      return await uploadToCloudinary(uri, options);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  const { Alert } = require('react-native');

  return new Promise((resolve) => {
    Alert.alert(
      '📷 Add Photo',
      'Choose image source',
      [
        {
          text: '📷 Take Photo',
          onPress: async () => {
            try {
              const uri = await takePhoto();
              if (!uri) return resolve(null);
              const result = await uploadToCloudinary(uri, options);
              resolve(result);
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          },
        },
        {
          text: '🖼️ Choose from Library',
          onPress: async () => {
            try {
              const uri = await pickImage();
              if (!uri) return resolve(null);
              const result = await uploadToCloudinary(uri, options);
              resolve(result);
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]
    );
  });
};

// ─────────────────────────────────────────────
// IMAGE TRANSFORMATION HELPERS
// ─────────────────────────────────────────────

export const getThumbUrl = (url, width = 200, height = 200) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${width},h_${height},c_fill,f_auto,q_auto/`
  );
};

export const getBannerUrl = (url) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    '/upload/w_1200,h_400,c_fill,f_auto,q_auto/'
  );
};

export const getAvatarUrl = (url, size = 150) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${size},h_${size},c_fill,g_face,f_auto,q_auto/`
  );
};

export const getOptimizedUrl = (url, width = 800) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${width},f_auto,q_auto/`
  );
};