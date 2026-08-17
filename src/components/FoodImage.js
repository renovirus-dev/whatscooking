// ============================================
// FILE: src/components/FoodImage.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { getBestImageSource, getLocalFoodImage } from '../utils/localFoodImages';
import { COLORS } from '../theme';

export default function FoodImage({
  item,
  name,
  category,
  cloudinaryUrl,
  style,
  resizeMode = 'cover',
  showLoader = false,
  debounceMs = 800,
}) {
  const itemObj = item || { name, category };

  const getLocal = () => getLocalFoodImage(
    itemObj?.name     || '',
    itemObj?.category || 'main_course'
  );

  const [mealDbSource,  setMealDbSource]  = useState(null);
  const [loadingMealDB, setLoadingMealDB] = useState(false);

  const cancelledRef  = useRef(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    cancelledRef.current = false;
    setMealDbSource(null);
    setLoadingMealDB(false);

    // ── 1. Cloudinary URL passed as prop ──────
    if (cloudinaryUrl) {
      setMealDbSource({ uri: cloudinaryUrl });
      return;
    }

    // ── 2. Item already has custom URL ────────
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
      setMealDbSource({ uri: url });
      return;
    }

    // ── 3. No name → show category local image
    if (!itemObj?.name?.trim()) return;

    // ── 4. Debounce MealDB fetch ──────────────
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      if (cancelledRef.current) return;

      setLoadingMealDB(true);

      try {
        const result = await getBestImageSource(itemObj);

        if (cancelledRef.current) return;

        setLoadingMealDB(false);

        if (result?.fromMealDB && result?.source?.uri) {
          setMealDbSource(result.source);
        }
      } catch (err) {
        if (!cancelledRef.current) setLoadingMealDB(false);
      }
    }, debounceMs);

    return () => {
      cancelledRef.current = true;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };

  }, [
    itemObj?.name,
    itemObj?.category,
    itemObj?.imageUrl,
    itemObj?.cloudinaryUrl,
    cloudinaryUrl,
  ]);

  const localSource = getLocal();

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: '#F0F0F0' }]}>

      {/* Layer 1 — local asset, always visible instantly */}
      <Image
        source={localSource}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
      />

      {/* Layer 2 — MealDB or Cloudinary on top when ready */}
      {!!mealDbSource && (
        <Image
          source={mealDbSource}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onError={() => setMealDbSource(null)}
        />
      )}

      {/* Layer 3 — small spinner while MealDB fetches */}
      {showLoader && loadingMealDB && (
        <View style={styles.loaderWrapper}>
          <ActivityIndicator color={COLORS.primary} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrapper: {
    position:        'absolute',
    bottom:          4,
    right:           4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius:    12,
    padding:         4,
  },
});