// ============================================
// FILE: src/hooks/useCloudinaryUpload.js
// ============================================
import { useState, useCallback } from 'react';
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  pickAndUpload,
  pickImage,
  takePhoto,
} from '../utils/uploadToCloudinary';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

/**
 * Hook for easy Cloudinary uploads in any screen
 *
 * Usage:
 * const { uploading, progress, upload, uploadMultiple } =
 *   useCloudinaryUpload('restaurants');
 */
export const useCloudinaryUpload = (folderKey = 'restaurants') => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);   // 0-100
  const [error, setError]         = useState(null);

  const folder = CLOUDINARY_CONFIG.folders[folderKey]
    || `whats_cooking/${folderKey}`;

  // ── Upload single image ────────────────────
  const upload = useCallback(async (imageUri, options = {}) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadToCloudinary(imageUri, {
        folder,
        ...options,
      });

      if (!result.success) throw new Error(result.error);

      setProgress(100);
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  }, [folder]);

  // ── Upload multiple images ─────────────────
  const uploadMultiple = useCallback(async (imageUris, options = {}) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const results = await uploadMultipleToCloudinary(
        imageUris,
        { folder, ...options },
        (completed, total) => {
          setProgress(Math.round((completed / total) * 100));
        }
      );

      return results;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setUploading(false);
    }
  }, [folder]);

  // ── Pick & upload in one step ──────────────
  const pickAndUploadImage = useCallback(async (options = {}) => {
    setUploading(true);
    setError(null);

    try {
      const result = await pickAndUpload({ folder, ...options });
      if (!result) return null;
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [folder]);

  return {
    uploading,
    progress,
    error,
    upload,
    uploadMultiple,
    pickAndUploadImage,
  };
};