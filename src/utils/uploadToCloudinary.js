// ============================================
// FILE: src/utils/uploadToCloudinary.js
// ============================================
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

const { cloudName, uploadPreset, baseUrl } = CLOUDINARY_CONFIG;

// ─────────────────────────────────────────────
// CORE UPLOAD FUNCTION
// ─────────────────────────────────────────────

/**
 * Upload a single image to Cloudinary
 * @param {string} imageUri    - local image URI
 * @param {object} options
 * @param {string} options.folder      - subfolder e.g. 'whats_cooking/restaurants'
 * @param {string} options.publicId    - optional custom filename
 * @param {number} options.quality     - compression 0-1 (default 0.8)
 * @param {number} options.maxWidth    - resize width (default 1200)
 * @param {function} options.onProgress - progress callback (0-100)
 * @returns {Promise<{url, publicId, width, height}>}
 */
export const uploadToCloudinary = async (imageUri, options = {}) => {
  const {
    folder      = 'whats_cooking',
    publicId    = null,
    quality     = 0.8,
    maxWidth    = 1200,
    onProgress  = null,
  } = options;

  try {
    // ── Step 1: Compress & resize image ─────
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth } }],
      {
        compress: quality,
        format:   ImageManipulator.SaveFormat.JPEG,
      }
    );

    // ── Step 2: Build form data ──────────────
    const formData = new FormData();
    formData.append('file', {
      uri:  manipulated.uri,
      type: 'image/jpeg',
      name: publicId
        ? `${publicId}.jpg`
        : `upload_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);
    if (publicId) formData.append('public_id', publicId);

    // ── Step 3: Upload to Cloudinary ─────────
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body:   formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();

    return {
      success:  true,
      url:      data.secure_url,    // ← use this as your image URL
      publicId: data.public_id,     // ← save this to delete later
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
  options     = {},
  onProgress  = null,
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

/**
 * Delete an image from Cloudinary
 * NOTE: Deletion requires a signed request or a backend function.
 * For now we just remove the URL from Firestore.
 * TODO: Add a Firebase Cloud Function to handle signed deletions.
 */
export const deleteFromCloudinary = async (publicId) => {
  // ⚠️ Direct delete needs API secret (not safe on client)
  // Solution: Save publicId to Firestore and delete via Cloud Function
  console.warn(
    'deleteFromCloudinary: Use a Cloud Function to delete.',
    'publicId to delete:', publicId,
  );
  return { success: false, message: 'Use Cloud Function for deletion' };
};

// ─────────────────────────────────────────────
// IMAGE PICKER HELPERS
// ─────────────────────────────────────────────

/**
 * Pick a single image from library
 * @returns {Promise<string|null>} image URI or null
 */
export const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera roll permission is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:          ImagePicker.MediaTypeOptions.Images,
    allowsEditing:       true,
    aspect:              [4, 3],
    quality:             1,      // we compress later
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
};

/**
 * Take a photo with camera
 * @returns {Promise<string|null>} image URI or null
 */
export const takePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect:        [4, 3],
    quality:       1,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
};

/**
 * Show action sheet to pick image source
 * then upload directly
 */
export const pickAndUpload = async (options = {}) => {
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
// These build Cloudinary URLs with transforms
// ─────────────────────────────────────────────

/**
 * Get optimized thumbnail URL
 * @param {string} url       - original Cloudinary URL
 * @param {number} width     - desired width
 * @param {number} height    - desired height
 */
export const getThumbUrl = (url, width = 200, height = 200) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${width},h_${height},c_fill,f_auto,q_auto/`
  );
};

/**
 * Get optimized banner URL (wide, shorter)
 * @param {string} url - original Cloudinary URL
 */
export const getBannerUrl = (url) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    '/upload/w_1200,h_400,c_fill,f_auto,q_auto/'
  );
};

/**
 * Get optimized avatar URL (square)
 * @param {string} url  - original Cloudinary URL
 * @param {number} size - size in px (default 150)
 */
export const getAvatarUrl = (url, size = 150) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${size},h_${size},c_fill,g_face,f_auto,q_auto/`
  );
};

/**
 * Get auto-optimized URL (Cloudinary picks best format/quality)
 * @param {string} url   - original Cloudinary URL
 * @param {number} width - max width
 */
export const getOptimizedUrl = (url, width = 800) => {
  if (!url || !url.includes('cloudinary')) return url;
  return url.replace(
    '/upload/',
    `/upload/w_${width},f_auto,q_auto/`
  );
};