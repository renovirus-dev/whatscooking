// ============================================
// FILE: src/components/MenuItemCard.js
// ============================================
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import {
  doc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db }      from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';
// ✅ Use local images — no internet needed, no Unsplash blocking
import { getImageSource } from '../utils/localFoodImages';

// ✅ Safe import of useAnalytics
let useAnalytics;
try {
  useAnalytics = require('../hooks/useAnalytics').useAnalytics;
} catch (e) {
  useAnalytics = () => ({
    trackMenuItemView: () => {},
    trackAction:       () => {},
  });
}

// ─── Constants ───────────────────────────────
const DIETARY_BADGES = {
  isVegetarian: { icon: '🥬', label: 'Vegetarian' },
  isVegan:      { icon: '🌱', label: 'Vegan'       },
  isGlutenFree: { icon: '🌾', label: 'Gluten-Free' },
  isHalal:      { icon: '☪️',  label: 'Halal'       },
  isSpicy:      { icon: '🌶️', label: 'Spicy'       },
};

// ─── Component ───────────────────────────────
export default function MenuItemCard({ item, onLoginRequired }) {
  const { user, userProfile, updateUserProfile } = useAuth();

  // ✅ Safe analytics
  let analytics;
  try {
    analytics = useAnalytics();
  } catch (e) {
    analytics = { trackMenuItemView: () => {}, trackAction: () => {} };
  }
  const { trackMenuItemView } = analytics;

  // ✅ isMounted ref
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [favLoading, setFavLoading]     = useState(false);

  // ✅ Check if dish is in user's favourites
  const isFavorited =
    userProfile?.favoriteDishes?.includes(item.id) || false;

  const activeDietary = Object.entries(DIETARY_BADGES).filter(
    ([key]) => item.dietaryInfo?.[key]
  );

  // ✅ Get image source — local bundled image
  // If item has a Firebase Storage URL (custom upload) use that
  // Otherwise use local image based on dish name and category
  const imageSource = getImageSource(item);

  // ─── Handlers ────────────────────────────
  const handleCardPress = () => {
    if (isMounted.current) setModalVisible(true);
    try {
      trackMenuItemView(item.id, item.name, item.restaurantId);
    } catch (e) {}
  };

  const handleCloseModal = () => {
    if (isMounted.current) setModalVisible(false);
  };

  const handleFavourite = async (e) => {
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

    try {
      setFavLoading(true);
      const userRef = doc(db, 'users', user.uid);

      if (isFavorited) {
        await updateDoc(userRef, {
          favoriteDishes: arrayRemove(item.id),
        });
      } else {
        await updateDoc(userRef, {
          favoriteDishes: arrayUnion(item.id),
        });
      }

      if (isMounted.current) {
        await updateUserProfile({});
      }
    } catch (err) {
      console.error('handleFavourite error:', err);
      if (isMounted.current) {
        Alert.alert('Error', 'Could not update favourite');
      }
    } finally {
      if (isMounted.current) setFavLoading(false);
    }
  };

  // ─── Render ──────────────────────────────
  return (
    <>
      {/* ── Card ──────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.card,
          !item.isAvailable && styles.cardUnavailable,
        ]}
        onPress={handleCardPress}
        activeOpacity={0.85}
      >
        {/* Left: Info */}
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

          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          {activeDietary.length > 0 && (
            <View style={styles.dietaryRow}>
              {activeDietary.map(([key, d]) => (
                <Text key={key} style={styles.dietaryIcon}>
                  {d.icon}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              ${item.price?.toFixed(2)}
            </Text>
            {item.preparationTime ? (
              <View style={styles.prepTime}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={COLORS.textMuted}
                />
                <Text style={styles.prepTimeText}>
                  {item.preparationTime} min
                </Text>
              </View>
            ) : null}
          </View>

          {!item.isAvailable && (
            <Text style={styles.unavailableText}>
              ❌ Not available today
            </Text>
          )}
        </View>

        {/* Right: Image + Heart */}
        <View style={styles.imageWrapper}>
          {/*
            ✅ source works with both:
            - require() number (local bundled image)
            - { uri: string } (Firebase Storage URL)
          */}
          <Image
            source={imageSource}
            style={[
              styles.image,
              !item.isAvailable && styles.imageGray,
            ]}
            resizeMode="cover"
          />

          <TouchableOpacity
            style={styles.heartBtn}
            onPress={handleFavourite}
            disabled={favLoading}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorited ? COLORS.error : '#FFFFFF'}
            />
          </TouchableOpacity>

          <View style={styles.expandHint}>
            <Ionicons
              name="expand-outline"
              size={12}
              color="#FFFFFF"
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Detail Modal ──────────────────── */}
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
            onPress={() => {}}
            style={styles.modalCard}
          >
            {/* Hero image — same source */}
            <Image
              source={imageSource}
              style={styles.modalImage}
              resizeMode="cover"
            />

            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={handleCloseModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalHeartBtn}
              onPress={handleFavourite}
              disabled={favLoading}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorited ? COLORS.error : '#FFFFFF'}
              />
            </TouchableOpacity>

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
                      <Ionicons
                        name="heart"
                        size={14}
                        color={COLORS.error}
                      />
                      <Text style={styles.favCountText}>
                        {item.totalFavorites} saved
                      </Text>
                    </View>
                  )}
                </View>

                {item.description ? (
                  <Text style={styles.modalDesc}>
                    {item.description}
                  </Text>
                ) : null}

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
                    {item.servingSize ? (
                      <View style={styles.extraItem}>
                        <Ionicons
                          name="restaurant-outline"
                          size={14}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.extraText}>
                          {item.servingSize}
                        </Text>
                      </View>
                    ) : null}
                    {item.preparationTime ? (
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
                    ) : null}
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
                      name="close-circle"
                      size={18}
                      color={COLORS.error}
                    />
                    <Text style={styles.unavailableBannerText}>
                      Not available today
                    </Text>
                  </View>
                )}

                {/* Save favourite button */}
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
                    <Text style={[
                      styles.modalFavBtnText,
                      isFavorited && styles.modalFavBtnTextActive,
                    ]}>
                      Saving...
                    </Text>
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

                {/* Close button */}
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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    gap: SIZES.md,
    ...SHADOW,
  },
  cardUnavailable: { opacity: 0.65 },
  info: { flex: 1, justifyContent: 'space-between' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.xs,
    marginBottom: SIZES.xs,
  },
  name: {
    flex: 1,
    fontSize: FONTS.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  specialBadge: {
    backgroundColor: COLORS.warning + '25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  specialText: {
    fontSize: FONTS.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  description: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    lineHeight: 18,
    marginBottom: SIZES.xs,
  },
  dietaryRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: SIZES.xs,
  },
  dietaryIcon: { fontSize: 14 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginTop: SIZES.xs,
  },
  price: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  prepTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  prepTimeText: { fontSize: FONTS.xs, color: COLORS.textMuted },
  unavailableText: {
    fontSize: FONTS.xs,
    color: COLORS.error,
    marginTop: 4,
    fontWeight: '500',
  },
  imageWrapper: { position: 'relative' },
  image: {
    width: 95,
    height: 95,
    borderRadius: RADIUS.lg,
  },
  imageGray: { opacity: 0.4 },
  heartBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  modalImage: {
    width: '100%',
    height: 220,
  },
  closeIconBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeartBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: { maxHeight: 420 },
  modalBody: {
    padding: SIZES.lg,
    gap: SIZES.sm,
  },
  modalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  modalName: {
    flex: 1,
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSpecial: {
    fontSize: FONTS.sm,
    color: COLORS.warning,
    fontWeight: '600',
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  modalPrice: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  favCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favCountText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },
  modalDesc: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  dietaryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  dietaryBadge: {
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  dietaryBadgeText: {
    fontSize: FONTS.sm,
    color: COLORS.success,
    fontWeight: '500',
  },
  modalExtras: {
    flexDirection: 'row',
    gap: SIZES.lg,
    flexWrap: 'wrap',
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  extraText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.xs,
  },
  tag: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  tagText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCountText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.error + '15',
    padding: SIZES.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  unavailableBannerText: {
    fontSize: FONTS.md,
    color: COLORS.error,
    fontWeight: '500',
  },
  modalFavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '15',
    borderWidth: 1.5,
    borderColor: COLORS.error,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.sm,
  },
  modalFavBtnActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  modalFavBtnText: {
    color: COLORS.error,
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
  modalFavBtnTextActive: { color: '#FFFFFF' },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },
});