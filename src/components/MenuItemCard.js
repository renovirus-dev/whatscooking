// ============================================
// FILE: src/components/MenuItemCard.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  doc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db }              from '../firebase/config';
import { useAuth }         from '../hooks/useAuth';
import { useAnalytics }    from '../hooks/useAnalytics';  // ✅ NEW
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';

// ─── Constants ───────────────────────────────
const DIETARY_BADGES = {
  isVegetarian: { icon: '🥬', label: 'Vegetarian' },
  isVegan:      { icon: '🌱', label: 'Vegan'       },
  isGlutenFree: { icon: '🌾', label: 'Gluten-Free' },
  isHalal:      { icon: '☪️',  label: 'Halal'       },
  isSpicy:      { icon: '🌶️', label: 'Spicy'       },
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';

// ─── Component ───────────────────────────────
export default function MenuItemCard({ item, onLoginRequired }) {
  const { user, userProfile, updateUserProfile } = useAuth();

  // ✅ Analytics tracking
  const { trackMenuItemView } = useAnalytics();

  const [modalVisible, setModalVisible] = useState(false);
  const [imageError, setImageError]     = useState(false);
  const [favLoading, setFavLoading]     = useState(false);

  // ✅ Check if dish is in user's favourites
  const isFavorited =
    userProfile?.favoriteDishes?.includes(item.id) || false;

  const activeDietary = Object.entries(DIETARY_BADGES).filter(
    ([key]) => item.dietaryInfo?.[key]
  );

  // ✅ Consistent fallback image based on item id
  const imageUri = imageError || !item.imageUrl
    ? FALLBACK_IMAGE
    : item.imageUrl;

  const imageSource = { uri: imageUri };

  // ─── Open modal + track view ─────────────
  const handleCardPress = () => {
    setModalVisible(true);
    // ✅ Track menu item view (works for guests too)
    trackMenuItemView(item.id, item.name, item.restaurantId);
  };

  // ─── Toggle dish favourite ────────────────
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

      // ✅ Refresh local userProfile so heart updates instantly
      await updateUserProfile({});

    } catch (err) {
      console.error('handleFavourite error:', err);
      Alert.alert('Error', 'Could not update favourite');
    } finally {
      setFavLoading(false);
    }
  };

  // ─── Render ──────────────────────────────
  return (
    <>
      {/* ══════════════════════════════════════ */}
      {/* CARD                                   */}
      {/* ══════════════════════════════════════ */}
      <TouchableOpacity
        style={[
          styles.card,
          !item.isAvailable && styles.cardUnavailable,
        ]}
        onPress={handleCardPress}   // ✅ tracks view
        activeOpacity={0.85}
      >
        {/* ── Left: Info ───────────────────── */}
        <View style={styles.info}>

          {/* Name + Special badge */}
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

          {/* Description */}
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          {/* Dietary icons */}
          {activeDietary.length > 0 && (
            <View style={styles.dietaryRow}>
              {activeDietary.map(([key, d]) => (
                <Text key={key} style={styles.dietaryIcon}>
                  {d.icon}
                </Text>
              ))}
            </View>
          )}

          {/* Price + prep time */}
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

          {/* Unavailable notice */}
          {!item.isAvailable && (
            <Text style={styles.unavailableText}>
              ❌ Not available today
            </Text>
          )}
        </View>

        {/* ── Right: Image + Heart ─────────── */}
        <View style={styles.imageWrapper}>
          <Image
            source={imageSource}
            style={[
              styles.image,
              !item.isAvailable && styles.imageGray,
            ]}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />

          {/* Heart button */}
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={handleFavourite}
            disabled={favLoading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorited ? COLORS.error : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* Expand hint */}
          <View style={styles.expandHint}>
            <Ionicons
              name="expand-outline"
              size={12}
              color="#FFFFFF"
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* ══════════════════════════════════════ */}
      {/* DETAIL MODAL                           */}
      {/* ══════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {/* Stop inner taps closing modal */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalCard}
          >
            {/* Hero image */}
            <Image
              source={imageSource}
              style={styles.modalImage}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Heart button on image */}
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

            {/* ✅ Scrollable body for long content */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalBody}>

                {/* Name + special */}
                <View style={styles.modalNameRow}>
                  <Text style={styles.modalName}>
                    {item.name}
                  </Text>
                  {item.isSpecialOfTheDay && (
                    <Text style={styles.modalSpecial}>
                      ⭐ Special
                    </Text>
                  )}
                </View>

                {/* Price + favourite count */}
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

                {/* Description */}
                {item.description ? (
                  <Text style={styles.modalDesc}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Dietary badges */}
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

                {/* Extra info */}
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

                {/* Tags */}
                {item.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* ✅ Analytics info on modal */}
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

                {/* Unavailable banner */}
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
                </TouchableOpacity>

                {/* Close button */}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseBtnText}>
                    Close
                  </Text>
                </TouchableOpacity>

              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({

  // ── Card ─────────────────────────────────
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

  // ── Info section ─────────────────────────
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

  // ── Image wrapper ─────────────────────────
  imageWrapper: { position: 'relative' },
  image: {
    width: 95,
    height: 95,
    borderRadius: RADIUS.lg,
  },
  imageGray: { opacity: 0.4 },

  // Heart button on card
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

  // Expand hint
  expandHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },

  // ── Modal ─────────────────────────────────
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

  // Close button on image
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

  // Heart button on modal image
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

  // Modal scroll + body
  modalScroll: {
    maxHeight: 420,
  },
  modalBody: {
    padding: SIZES.lg,
    gap: SIZES.sm,
  },

  // Modal name row
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

  // Price row
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

  // Description
  modalDesc: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
  },

  // Dietary
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

  // Extras
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

  // Tags
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

  // ✅ View count row
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCountText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },

  // Unavailable banner
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

  // Save favourite button
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
  modalFavBtnTextActive: {
    color: '#FFFFFF',
  },

  // Close button
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