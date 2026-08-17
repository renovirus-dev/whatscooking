// ============================================
// FILE: src/components/MenuItemCard.js
// ============================================
import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Modal, Alert, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db }          from '../firebase/config';
import { useAuth }     from '../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';
import FoodImage       from './FoodImage';
import { getThumbUrl } from '../utils/uploadToCloudinary';

// ─── Safe Color Fallbacks ─────────────────────
const WARNING_COLOR = COLORS.warning || '#F39C12';

// ─── Safe Analytics Import ────────────────────
let useAnalytics;
try {
  useAnalytics = require('../hooks/useAnalytics').useAnalytics;
} catch {
  useAnalytics = () => ({
    trackMenuItemView: () => {},
    trackAction:       () => {},
  });
}

// ─── Dietary Badges ───────────────────────────
const DIETARY_BADGES = {
  isVegetarian: { icon: '🥬', label: 'Vegetarian' },
  isVegan:      { icon: '🌱', label: 'Vegan'       },
  isGlutenFree: { icon: '🌾', label: 'Gluten-Free' },
  isHalal:      { icon: '☪️',  label: 'Halal'       },
  isSpicy:      { icon: '🌶️', label: 'Spicy'       },
};

// ─────────────────────────────────────────────
// HAS CUSTOM IMAGE
// Returns true if item has a real uploaded image
// FoodImage will use it directly, skip MealDB
// ─────────────────────────────────────────────
const hasCustomImage = (item) => {
  return !!(
    item?.cloudinaryUrl ||
    (item?.imageUrl && item.imageUrl.startsWith('http'))
  );
};

// ─────────────────────────────────────────────
// GET CLOUDINARY URL
// Returns optimised thumb URL if available
// ─────────────────────────────────────────────
const getCloudinaryUrl = (item, w = 200, h = 200) => {
  if (item?.cloudinaryUrl) {
    return getThumbUrl(item.cloudinaryUrl, w, h);
  }
  if (item?.imageUrl?.startsWith('http')) {
    return item.imageUrl;
  }
  return null;
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function MenuItemCard({
  item,
  onLoginRequired,
  showHeart = true,
}) {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const { trackMenuItemView } = useAnalytics();

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [favLoading,   setFavLoading]   = useState(false);

  // ✅ Optimistic favourite state
  const [localFavorited, setLocalFavorited] = useState(
    () => userProfile?.favoriteDishes?.includes(item.id) || false
  );

  // ✅ Sync favourite when userProfile updates
  useEffect(() => {
    if (userProfile?.favoriteDishes !== undefined) {
      setLocalFavorited(userProfile.favoriteDishes.includes(item.id));
    }
  }, [userProfile?.favoriteDishes, item.id]);

  const isFavorited = localFavorited;

  const activeDietary = Object.entries(DIETARY_BADGES).filter(
    ([key]) => item.dietaryInfo?.[key]
  );

  // ─────────────────────────────────────────
  // CLOUDINARY URL for card + modal
  // ─────────────────────────────────────────
  const cardImageUrl  = getCloudinaryUrl(item, 200, 200);
  const modalImageUrl = getCloudinaryUrl(item, 600, 400);

  // ─────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────
  const handleCardPress = useCallback(() => {
    if (isMounted.current) setModalVisible(true);
    try { trackMenuItemView(item.id, item.name, item.restaurantId); } catch {}
  }, [item, trackMenuItemView]);

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) setModalVisible(false);
  }, []);

  const handleFavourite = useCallback(async (e) => {
    e?.stopPropagation?.();

    if (!user) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        Alert.alert(
          'Sign In Required',
          'Please sign in to save favourite dishes'
        );
      }
      return;
    }

    if (!isMounted.current) return;

    // ✅ Optimistic update
    const newValue = !localFavorited;
    setLocalFavorited(newValue);

    try {
      setFavLoading(true);
      const userRef = doc(db, 'users', user.uid);

      if (!newValue) {
        await updateDoc(userRef, { favoriteDishes: arrayRemove(item.id) });
      } else {
        await updateDoc(userRef, { favoriteDishes: arrayUnion(item.id) });
      }
    } catch (err) {
      console.error('handleFavourite error:', err);
      // ✅ Revert on failure
      if (isMounted.current) {
        setLocalFavorited(!newValue);
        Alert.alert('Error', 'Could not update favourite. Please try again.');
      }
    } finally {
      if (isMounted.current) setFavLoading(false);
    }
  }, [user, localFavorited, item.id, onLoginRequired]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <>
      {/* ══ CARD ══════════════════════════════ */}
      <TouchableOpacity
        style={[
          styles.card,
          !item.isAvailable     && styles.cardUnavailable,
          item.isSpecialOfTheDay && styles.cardSpecial,
        ]}
        onPress={handleCardPress}
        activeOpacity={0.85}
      >
        {/* ── Left: Info ──────────────────── */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.isSpecialOfTheDay && (
              <View style={styles.specialBadge}>
                <Text style={styles.specialText}>⭐ Special</Text>
              </View>
            )}
          </View>

          {!!item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {activeDietary.length > 0 && (
            <View style={styles.dietaryRow}>
              {activeDietary.map(([key, d]) => (
                <Text key={key} style={styles.dietaryIcon}>{d.icon}</Text>
              ))}
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>${item.price?.toFixed(2)}</Text>
            {!!item.preparationTime && (
              <View style={styles.prepTime}>
                <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.prepTimeText}>
                  {item.preparationTime} min
                </Text>
              </View>
            )}
          </View>

          {!item.isAvailable && (
            <Text style={styles.unavailableText}>❌ Not available today</Text>
          )}
        </View>

        {/* ── Right: Image + Heart ─────────── */}
        <View style={styles.imageWrapper}>

          {/* ✅ FoodImage handles:
               - Cloudinary URL directly (if exists)
               - MealDB async fetch (if no custom image)
               - Local asset fallback (instant)        */}
          <FoodImage
            item={item}
            cloudinaryUrl={cardImageUrl}
            style={[
              styles.image,
              !item.isAvailable && styles.imageGray,
            ]}
            resizeMode="cover"
          />

          {/* ✅ Heart button */}
          {showHeart && (
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={handleFavourite}
              disabled={favLoading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {favLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFavorited ? COLORS.error : '#FFFFFF'}
                />
              )}
            </TouchableOpacity>
          )}

          {/* Expand hint */}
          <View style={styles.expandHint} pointerEvents="none">
            <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>

      {/* ══ DETAIL MODAL ══════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalCard,
              { paddingBottom: insets.bottom + SIZES.sm },
            ]}
          >
            {/* ── Hero Image ────────────────── */}
            {/* ✅ Larger size for modal — 600×400 */}
            <FoodImage
              item={item}
              cloudinaryUrl={modalImageUrl}
              style={styles.modalImage}
              resizeMode="cover"
            />

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={handleCloseModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* ✅ Modal heart */}
            {showHeart && (
              <TouchableOpacity
                style={styles.modalHeartBtn}
                onPress={handleFavourite}
                disabled={favLoading}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {favLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isFavorited ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorited ? COLORS.error : '#FFFFFF'}
                  />
                )}
              </TouchableOpacity>
            )}

            {/* Drag handle */}
            <View style={styles.modalHandle} />

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalBody}>

                <View style={styles.modalNameRow}>
                  <Text style={styles.modalName}>{item.name}</Text>
                  {item.isSpecialOfTheDay && (
                    <Text style={styles.modalSpecial}>⭐ Special</Text>
                  )}
                </View>

                <View style={styles.modalPriceRow}>
                  <Text style={styles.modalPrice}>
                    ${item.price?.toFixed(2)}
                  </Text>
                  {item.totalFavorites > 0 && (
                    <View style={styles.favCount}>
                      <Ionicons name="heart" size={14} color={COLORS.error} />
                      <Text style={styles.favCountText}>
                        {item.totalFavorites} saved
                      </Text>
                    </View>
                  )}
                </View>

                {!!item.description && (
                  <Text style={styles.modalDesc}>{item.description}</Text>
                )}

                {activeDietary.length > 0 && (
                  <View style={styles.dietaryList}>
                    {activeDietary.map(([key, d]) => (
                      <View key={key} style={styles.dietaryBadge}>
                        <Text style={styles.dietaryBadgeText}>
                          {d.icon} {d.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {(item.servingSize || item.preparationTime) && (
                  <View style={styles.modalExtras}>
                    {!!item.servingSize && (
                      <View style={styles.extraItem}>
                        <Ionicons
                          name="restaurant-outline"
                          size={14}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.extraText}>{item.servingSize}</Text>
                      </View>
                    )}
                    {!!item.preparationTime && (
                      <View style={styles.extraItem}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.extraText}>
                          {item.preparationTime} min prep
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {item.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.viewCount > 0 && (
                  <View style={styles.viewCountRow}>
                    <Ionicons
                      name="eye-outline"
                      size={14}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.viewCountText}>
                      Viewed {item.viewCount} times
                    </Text>
                  </View>
                )}

                {!item.isAvailable && (
                  <View style={styles.unavailableBanner}>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={COLORS.error}
                    />
                    <Text style={styles.unavailableBannerText}>
                      Not available today
                    </Text>
                  </View>
                )}

                {/* ✅ Save Favourite Button */}
                {showHeart && (
                  <TouchableOpacity
                    style={[
                      styles.modalFavBtn,
                      isFavorited && styles.modalFavBtnActive,
                    ]}
                    onPress={handleFavourite}
                    disabled={favLoading}
                    activeOpacity={0.8}
                  >
                    {favLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isFavorited ? '#FFFFFF' : COLORS.error}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={isFavorited ? 'heart' : 'heart-outline'}
                          size={20}
                          color={isFavorited ? '#FFFFFF' : COLORS.error}
                        />
                        <Text style={[
                          styles.modalFavBtnText,
                          isFavorited && styles.modalFavBtnTextActive,
                        ]}>
                          {isFavorited
                            ? 'Saved to Favourites ✓'
                            : 'Save to Favourites'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={handleCloseModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>

              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({

  card: {
    flexDirection:   'row',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    marginBottom:    SIZES.md,
    gap:             SIZES.md,
    borderWidth:     1,
    borderColor:     'transparent',
    ...SHADOW,
  },
  cardUnavailable: { opacity: 0.65 },
  cardSpecial: {
    borderColor:     WARNING_COLOR + '40',
    backgroundColor: WARNING_COLOR + '05',
  },

  // ── Info ──────────────────────────────────
  info: { flex: 1, justifyContent: 'space-between' },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SIZES.xs,
    marginBottom:  SIZES.xs,
  },
  name: {
    flex:       1,
    fontSize:   FONTS.lg,
    fontWeight: '600',
    color:      COLORS.text,
  },
  specialBadge: {
    backgroundColor:   WARNING_COLOR + '25',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.sm,
  },
  specialText: {
    fontSize:   FONTS.xs,
    color:      WARNING_COLOR,
    fontWeight: '600',
  },
  description: {
    fontSize:     FONTS.sm,
    color:        COLORS.textLight,
    lineHeight:   18,
    marginBottom: SIZES.xs,
  },
  dietaryRow:  { flexDirection: 'row', gap: 4, marginBottom: SIZES.xs },
  dietaryIcon: { fontSize: 14 },
  priceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
    marginTop:     SIZES.xs,
  },
  price:        { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.primary },
  prepTime:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  prepTimeText: { fontSize: FONTS.xs, color: COLORS.textMuted },
  unavailableText: {
    fontSize:   FONTS.xs,
    color:      COLORS.error,
    marginTop:  4,
    fontWeight: '500',
  },

  // ── Image + Heart ─────────────────────────
  imageWrapper: {
    position: 'relative',
    width:    95,
    height:   95,
  },
  image: {
    width:        95,
    height:       95,
    borderRadius: RADIUS.lg,
  },
  imageGray: { opacity: 0.4 },

  heartBtn: {
    position:        'absolute',
    top:             4,
    right:           4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width:           32,
    height:          32,
    borderRadius:    16,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          10,
    elevation:       10,
  },
  expandHint: {
    position:        'absolute',
    bottom:          4,
    right:           4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius:    4,
    padding:         3,
    zIndex:          5,
  },

  // ── Modal ─────────────────────────────────
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent:  'flex-end',
  },
  modalCard: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow:             'hidden',
    maxHeight:            '92%',
  },
  modalImage: {
    width:  '100%',
    height: 220,
  },
  closeIconBtn: {
    position:        'absolute',
    top:             12,
    right:           12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width:           36,
    height:          36,
    borderRadius:    18,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          10,
    elevation:       10,
  },
  modalHeartBtn: {
    position:        'absolute',
    top:             12,
    left:            12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width:           42,
    height:          42,
    borderRadius:    21,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          10,
    elevation:       10,
  },
  modalHandle: {
    width:           40,
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       SIZES.sm,
    marginBottom:    SIZES.xs,
  },
  modalScroll: { maxHeight: 440 },
  modalBody:   { padding: SIZES.lg, gap: SIZES.sm },
  modalNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  modalName: {
    flex:       1,
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  modalSpecial: {
    fontSize:   FONTS.sm,
    color:      WARNING_COLOR,
    fontWeight: '600',
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.md,
  },
  modalPrice: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },
  favCount:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  favCountText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  modalDesc: {
    fontSize:   FONTS.md,
    color:      COLORS.textLight,
    lineHeight: 22,
  },
  dietaryList: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SIZES.sm,
  },
  dietaryBadge: {
    backgroundColor:   COLORS.success + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       COLORS.success + '40',
  },
  dietaryBadgeText: {
    fontSize:   FONTS.sm,
    color:      COLORS.success,
    fontWeight: '500',
  },
  modalExtras: {
    flexDirection: 'row',
    gap:           SIZES.lg,
    flexWrap:      'wrap',
  },
  extraItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  extraText:    { fontSize: FONTS.sm, color: COLORS.textMuted },
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SIZES.xs,
  },
  tag: {
    backgroundColor:   COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  tagText:       { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '500' },
  viewCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewCountText: { fontSize: FONTS.xs, color: COLORS.textMuted },
  unavailableBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SIZES.sm,
    backgroundColor: COLORS.error + '15',
    padding:         SIZES.md,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.error + '30',
  },
  unavailableBannerText: {
    fontSize:   FONTS.md,
    color:      COLORS.error,
    fontWeight: '500',
  },
  modalFavBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.error + '15',
    borderWidth:     1.5,
    borderColor:     COLORS.error,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    marginTop:       SIZES.sm,
    minHeight:       52,
  },
  modalFavBtnActive:     { backgroundColor: COLORS.error, borderColor: COLORS.error },
  modalFavBtnText:       { color: COLORS.error, fontSize: FONTS.md, fontWeight: 'bold' },
  modalFavBtnTextActive: { color: '#FFFFFF' },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    alignItems:      'center',
    marginTop:       SIZES.xs,
  },
  modalCloseBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
  },
});