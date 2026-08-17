// ============================================
// FILE: src/components/FoodImage.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { getBestImageSource, getLocalFoodImage } from '../utils/localFoodImages';
import { COLORS } from '../theme';

// ─────────────────────────────────────────────
// FoodImage Component
// ✅ Shows local image INSTANTLY (no flicker)
// ✅ Upgrades to MealDB image when fetched
// ✅ Falls back to local if MealDB fails
// ✅ Cancels fetch on unmount (no memory leak)
// ─────────────────────────────────────────────
export default function FoodImage({
  item,           // { name, category, imageUrl, cloudinaryUrl }
  name,           // OR pass name + category directly
  category,
  style,
  resizeMode = 'cover',
  showLoader = false,
}) {
  // Build a minimal item object if name/category passed directly
  const itemObj = item || { name, category };

  // ── Instant local fallback ────────────────
  const localSource = getLocalFoodImage(
    itemObj?.name     || '',
    itemObj?.category || 'main_course'
  );

  const [source,        setSource]        = useState(localSource);
  const [loadingMealDB, setLoadingMealDB] = useState(false);
  const [imgError,      setImgError]      = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    // Reset on item change
    cancelledRef.current = false;
    setImgError(false);

    // ── If item has Cloudinary/custom URL → use it directly ──
    const url = itemObj?.imageUrl    ||
                itemObj?.cloudinaryUrl ||
                itemObj?.autoImageUrl  || '';

    if (
      url && (
        url.includes('cloudinary') ||
        url.startsWith('https://firebasestorage') ||
        url.startsWith('https://storage.googleapis') ||
        (url.startsWith('http') && !url.includes('themealdb'))
      )
    ) {
      setSource({ uri: url });
      return;
    }

    // ── Show local instantly, then try MealDB ──
    const newLocal = getLocalFoodImage(
      itemObj?.name     || '',
      itemObj?.category || 'main_course'
    );
    setSource(newLocal);

    // Only fetch MealDB if there's a name to search
    if (!itemObj?.name?.trim()) return;

    setLoadingMealDB(true);

    getBestImageSource(itemObj).then((result) => {
      if (cancelledRef.current) return;
      setLoadingMealDB(false);

      if (result?.fromMealDB && result?.source?.uri) {
        setSource(result.source);
      }
      // else keep local — already showing
    });

    return () => {
      cancelledRef.current = true;
    };
  }, [
    itemObj?.name,
    itemObj?.category,
    itemObj?.imageUrl,
    itemObj?.cloudinaryUrl,
  ]);

  const handleError = () => {
    if (imgError) return; // already fell back
    setImgError(true);
    setSource(localSource); // snap back to local
  };

  return (
    <View style={[styles.wrapper, style]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={handleError}
      />
      {showLoader && loadingMealDB && (
        <ActivityIndicator
          style={styles.loader}
          color={COLORS.primary}
          size="small"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow:        'hidden',
    backgroundColor: '#F0F0F0',
  },
  loader: {
    position: 'absolute',
    right:    6,
    bottom:   6,
  },
});