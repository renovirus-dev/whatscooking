// ============================================
// FILE: src/screens/user/RestaurantDetailScreen.js
// ============================================
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, ScrollView, Image,
  TouchableOpacity, StyleSheet, Linking,
  Alert, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Modal, Share,
  RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db }             from '../../firebase/config';
import { useAuth }        from '../../hooks/useAuth';
import { useRestaurants } from '../../hooks/useRestaurants';
import { useReviews }     from '../../hooks/useReviews';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { getThumbUrl, getBannerUrl } from '../../utils/uploadToCloudinary';
import MenuItemCard from '../../components/MenuItemCard';
import StarRating   from '../../components/StarRating';
import ReviewCard   from '../../components/ReviewCard';

// ✅ Safe analytics import
let useAnalytics;
try {
  useAnalytics = require('../../hooks/useAnalytics').useAnalytics;
} catch {
  useAnalytics = () => ({
    trackRestaurantView: () => {},
    trackAction:         () => {},
    usePageTimer:        () => {},
  });
}

// ─── Safe Color Fallbacks ─────────────────────
const WARNING_COLOR = COLORS.warning || '#F39C12';
const INFO_COLOR    = COLORS.info    || '#3498DB';

// ─── Constants ───────────────────────────────
const CATEGORY_ICONS = {
  appetizer:      '🥗',
  soup:           '🍲',
  salad:          '🥙',
  main_course:    '🍽️',
  side_dish:      '🍟',
  dessert:        '🧁',
  beverage:       '🥤',
  breakfast:      '🍳',
  lunch_special:  '☀️',
  dinner_special: '🌙',
  kids_menu:      '🧸',
  snack:          '🍿',
  combo_meal:     '🎁',
  other:          '🍴',
};

const TABS               = ['Menu', 'Reviews', 'Info'];
const MAX_REVIEW_COMMENT = 500;

const PRICE_LABELS = {
  '$':    'Budget friendly',
  '$$':   'Moderate',
  '$$$':  'Upscale',
  '$$$$': 'Fine dining',
};

const RATING_LABELS = [
  '', '😞 Poor', '😐 Fair', '🙂 Good', '😊 Very Good', '🤩 Excellent',
];

// ─── Helpers ──────────────────────────────────
const formatCategory = (cat) =>
  cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const getCoverImage = (restaurant) => {
  if (restaurant?.coverUrl?.includes('cloudinary')) {
    return { uri: getBannerUrl(restaurant.coverUrl) };
  }
  if (restaurant?.coverUrl) {
    return { uri: restaurant.coverUrl };
  }
  return require('../../assets/images/restaurant_placeholder.jpg');
};

const getLogoImage = (restaurant) => {
  if (restaurant?.logoUrl?.includes('cloudinary')) {
    return { uri: getThumbUrl(restaurant.logoUrl, 120, 120) };
  }
  if (restaurant?.logoUrl) {
    return { uri: restaurant.logoUrl };
  }
  return null;
};

// ─── Sub-components ───────────────────────────
const ActionButton = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    style={styles.actionBtn}
    onPress={onPress}
    activeOpacity={0.7}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <View style={[styles.actionBtnIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
);

const ServiceBadge = ({ label }) => (
  <View style={styles.serviceBadge}>
    <Text style={styles.serviceBadgeText}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function RestaurantDetailScreen({ route, navigation }) {
  const insets       = useSafeAreaInsets();
  const restaurantId = route.params?.restaurantId;

  const { user, userProfile } = useAuth();
  const { toggleFavorite }    = useRestaurants();
  const {
    reviews, loading: reviewsLoading,
    addReview, updateReview, deleteReview, getUserReview,
  } = useReviews(restaurantId);

  const analytics = useAnalytics();

  const isMounted   = useRef(true);
  const viewTracked = useRef(false);

  // ── State ─────────────────────────────────
  const [restaurant, setRestaurant]           = useState(null);
  const [menuItems, setMenuItems]             = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState(null);
  const [isFavorited, setIsFavorited]         = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeCategory, setActiveCategory]   = useState('all');
  const [activeTab, setActiveTab]             = useState('Menu');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [myReview, setMyReview]               = useState(null);
  const [reviewRating, setReviewRating]       = useState(5);
  const [reviewComment, setReviewComment]     = useState('');
  const [reviewLoading, setReviewLoading]     = useState(false);
  const [editingReview, setEditingReview]     = useState(false);

  // ── Lifecycle ─────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    try {
      if (typeof analytics.usePageTimer === 'function') {
        analytics.usePageTimer(restaurantId);
      }
    } catch {}
  }, [restaurantId]);

  // ── Firestore ─────────────────────────────
  useEffect(() => {
    if (!restaurantId) {
      setError('Restaurant not found');
      setLoading(false);
      return;
    }

    const unsubRestaurant = onSnapshot(
      doc(db, 'restaurants', restaurantId),
      (snap) => {
        if (!isMounted.current) return;
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setRestaurant(data);
          if (!viewTracked.current) {
            viewTracked.current = true;
            try { analytics.trackRestaurantView(restaurantId, data.name); }
            catch {}
          }
        } else {
          setError('Restaurant not found');
        }
        setLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubMenu = onSnapshot(
      query(
        collection(db, 'menuItems'),
        where('restaurantId', '==', restaurantId),
        where('isAvailable', '==', true),
      ),
      (snap) => {
        if (!isMounted.current) return;
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        setMenuItems(items);
      },
      (err) => console.error('Menu listener error:', err)
    );

    return () => { unsubRestaurant(); unsubMenu(); };
  }, [restaurantId]);

  // ✅ Sync isFavorited from userProfile but only when NOT mid-request
  useEffect(() => {
    if (!isMounted.current) return;
    if (!favoriteLoading) {
      setIsFavorited(
        userProfile?.favoriteRestaurants?.includes(restaurantId) || false
      );
    }
  }, [userProfile, restaurantId, favoriteLoading]);

  useEffect(() => {
    if (!user?.uid || !restaurantId) return;
    let cancelled = false;
    getUserReview(user.uid)
      .then(review => {
        if (cancelled || !isMounted.current) return;
        if (review) {
          setMyReview(review);
          setReviewRating(review.rating);
          setReviewComment(review.comment || '');
        } else {
          setMyReview(null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid, restaurantId, reviews.length]);

  // ── Derived ───────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
    return cats.length > 1 ? ['all', ...cats] : cats;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return menuItems;
    return menuItems.filter(i => i.category === activeCategory);
  }, [menuItems, activeCategory]);

  const groupedItems = useMemo(() =>
    filteredItems.reduce((groups, item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
      return groups;
    }, {}),
  [filteredItems]);

  const avgRating = useMemo(() =>
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null,
  [reviews]);

  // ── Handlers ──────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { if (isMounted.current) setRefreshing(false); }, 1000);
  }, []);

  const handleShare = useCallback(async () => {
    if (!restaurant) return;
    try {
      await Share.share({
        title:   restaurant.name,
        message: `Check out ${restaurant.name} on What's Cooking!\n📍 ${restaurant.location?.city}\n⭐ ${restaurant.averageRating?.toFixed(1) || 'New'} rating`,
      });
    } catch {}
  }, [restaurant]);

  const handleCall = useCallback(() => {
    const phone = restaurant?.contact?.phone;
    if (!phone) { Alert.alert('No Phone', 'No phone number available'); return; }
    try { analytics.trackAction(restaurantId, restaurant.name, 'call'); } catch {}
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Could not open phone'));
  }, [restaurant, restaurantId]);

  const handleDirections = useCallback(() => {
    const { address, city } = restaurant?.location || {};
    if (!address) { Alert.alert('No Address', 'No address available'); return; }
    try { analytics.trackAction(restaurantId, restaurant.name, 'directions'); } catch {}
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(`${address}, ${city || ''}`)}`
    ).catch(() => Alert.alert('Error', 'Could not open maps'));
  }, [restaurant, restaurantId]);

  const handleWhatsApp = useCallback(() => {
    const number = restaurant?.contact?.whatsapp;
    if (!number) return;
    try { analytics.trackAction(restaurantId, restaurant.name, 'whatsapp'); } catch {}
    Linking.openURL(
      `https://wa.me/${number.replace(/\D/g, '')}`
    ).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
  }, [restaurant, restaurantId]);

  const handleWebsite = useCallback(() => {
    const url = restaurant?.contact?.website;
    if (!url) return;
    try { analytics.trackAction(restaurantId, restaurant.name, 'website'); } catch {}
    Linking.openURL(
      url.startsWith('http') ? url : `https://${url}`
    ).catch(() => Alert.alert('Error', 'Could not open website'));
  }, [restaurant, restaurantId]);

  // ✅ FIXED: Optimistic favourite toggle
  const handleFavorite = useCallback(async () => {
    console.log('❤️ Favorite tapped!');
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }

    // ✅ Optimistic update BEFORE the async call — instant UI response
    const newValue = !isFavorited;
    setIsFavorited(newValue);

    try {
      setFavoriteLoading(true);
      await toggleFavorite(user.uid, restaurantId, isFavorited);
      console.log(`✅ Restaurant favourite ${newValue ? 'added' : 'removed'}:`, restaurantId);
    } catch {
      // ✅ Revert optimistic update on failure
      if (isMounted.current) {
        setIsFavorited(!newValue);
        Alert.alert('Error', 'Could not update favorites');
      }
    } finally {
      if (isMounted.current) setFavoriteLoading(false);
    }
  }, [user, restaurantId, isFavorited, toggleFavorite]);

  const handleOpenReview = useCallback(() => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to write a review');
      return;
    }
    setEditingReview(!!myReview);
    setShowReviewModal(true);
  }, [user, myReview]);

  const handleSubmitReview = useCallback(async () => {
    if (reviewRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }
    if (!isMounted.current) return;
    setReviewLoading(true);
    let result;
    try {
      if (myReview && editingReview) {
        result = await updateReview(myReview.id, reviewRating, reviewComment);
      } else {
        result = await addReview({
          userId:       user.uid,
          userName:     `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Anonymous',
          restaurantId,
          rating:       reviewRating,
          comment:      reviewComment.trim(),
        });
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }
    if (!isMounted.current) return;
    setReviewLoading(false);
    if (result?.success) {
      setShowReviewModal(false);
      Alert.alert('✅ Thank You!', editingReview ? 'Review updated!' : 'Review submitted!');
    } else {
      Alert.alert('Error', result?.error || 'Something went wrong');
    }
  }, [
    reviewRating, reviewComment, myReview, editingReview,
    user, userProfile, restaurantId, updateReview, addReview,
  ]);

  const handleDeleteReview = useCallback(() => {
    Alert.alert('Delete Review', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteReview(myReview.id);
            if (isMounted.current) {
              setMyReview(null);
              setReviewRating(5);
              setReviewComment('');
            }
          } catch {
            Alert.alert('Error', 'Could not delete review');
          }
        },
      },
    ]);
  }, [myReview, deleteReview]);

  // ── Loading / Error ───────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading restaurant...</Text>
      </View>
    );
  }

  if (error || !restaurant) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Text style={{ fontSize: 48 }}>🍽️</Text>
        <Text style={styles.errorTitle}>Restaurant Not Found</Text>
        <Text style={styles.errorText}>
          {error || 'This restaurant may no longer be available'}
        </Text>
        <TouchableOpacity
          style={styles.goBackBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverSource = getCoverImage(restaurant);
  const logoSource  = getLogoImage(restaurant);

  // ── Render ────────────────────────────────
  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Cover Image ─────────────────── */}
        <View style={styles.coverContainer}>
          <Image
            source={coverSource}
            style={styles.coverImage}
            resizeMode="cover"
          />

          {/* Overlay — pointerEvents none so it never blocks touches */}
          <View style={styles.coverOverlay} pointerEvents="none" />

          {/* Back Button */}
          <TouchableOpacity
            style={{
              position:        'absolute',
              top:             insets.top + 8,
              left:            16,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius:    21,
              width:           42,
              height:          42,
              justifyContent:  'center',
              alignItems:      'center',
              zIndex:          20,
              elevation:       20,
            }}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Share + Heart */}
          <View style={{
            position:      'absolute',
            top:           insets.top + 8,
            right:         16,
            flexDirection: 'row',
            gap:           10,
            zIndex:        20,
            elevation:     20,
          }}>
            {/* Share */}
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius:    21,
                width:           42,
                height:          42,
                justifyContent:  'center',
                alignItems:      'center',
              }}
              onPress={handleShare}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* ✅ Heart — optimistic, instant toggle */}
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius:    21,
                width:           42,
                height:          42,
                justifyContent:  'center',
                alignItems:      'center',
              }}
              onPress={handleFavorite}
              disabled={favoriteLoading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {favoriteLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorited ? '#FF6B6B' : '#FFFFFF'}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Open / Closed badge */}
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: restaurant.isCurrentlyOpen
                ? COLORS.success
                : COLORS.error,
            },
          ]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {restaurant.isCurrentlyOpen ? 'Open Now' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* ── Info Card ───────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.nameRow}>
            {logoSource ? (
              <Image
                source={logoSource}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={{ fontSize: 24 }}>🍽️</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName} numberOfLines={2}>
                {restaurant.name}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color={WARNING_COLOR} />
                <Text style={styles.rating}>
                  {restaurant.averageRating
                    ? restaurant.averageRating.toFixed(1)
                    : 'New'}
                </Text>
                <Text style={styles.reviewCount}>
                  ({restaurant.totalReviews || 0} reviews)
                </Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.priceRange}>
                  {restaurant.priceRange || '$$'}
                </Text>
              </View>
              {restaurant.location?.city && (
                <View style={styles.locationLine}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.locationText}>
                    {restaurant.location.city}
                    {restaurant.location.state ? `, ${restaurant.location.state}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {!!restaurant.description && (
            <Text style={styles.description}>{restaurant.description}</Text>
          )}

          {restaurant.cuisineTypes?.length > 0 && (
            <View style={styles.tagsRow}>
              {restaurant.cuisineTypes.map((type, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionButtons}>
            <ActionButton
              icon="call-outline" label="Call"
              color={COLORS.primary} onPress={handleCall}
            />
            <ActionButton
              icon="navigate-outline" label="Directions"
              color={COLORS.primary} onPress={handleDirections}
            />
            {!!restaurant.contact?.whatsapp && (
              <ActionButton
                icon="logo-whatsapp" label="WhatsApp"
                color={COLORS.success} onPress={handleWhatsApp}
              />
            )}
            {!!restaurant.contact?.website && (
              <ActionButton
                icon="globe-outline" label="Website"
                color={INFO_COLOR} onPress={handleWebsite}
              />
            )}
          </View>

          <View style={styles.servicesRow}>
            {restaurant.hasDineIn   && <ServiceBadge label="🪑 Dine In"  />}
            {restaurant.hasTakeout  && <ServiceBadge label="🥡 Takeout"  />}
            {restaurant.hasDelivery && <ServiceBadge label="🛵 Delivery" />}
          </View>

          {restaurant.announcement?.isActive && !!restaurant.announcement?.text && (
            <View style={styles.announcement}>
              <Ionicons name="megaphone-outline" size={16} color={WARNING_COLOR} />
              <Text style={styles.announcementText}>
                {restaurant.announcement.text}
              </Text>
            </View>
          )}
        </View>

        {/* ── Tabs ────────────────────────── */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
                {tab === 'Reviews' && reviews.length > 0
                  ? ` (${reviews.length})` : ''}
                {tab === 'Menu' && menuItems.length > 0
                  ? ` (${menuItems.length})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Menu ───────────────────── */}
        {activeTab === 'Menu' && (
          <View>
            {categories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryTabs}
                contentContainerStyle={{ paddingHorizontal: SIZES.md }}
                nestedScrollEnabled
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryTab,
                      activeCategory === cat && styles.categoryTabActive,
                    ]}
                    onPress={() => setActiveCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.categoryTabText,
                      activeCategory === cat && styles.categoryTabTextActive,
                    ]}>
                      {cat === 'all'
                        ? `🍽️ All (${menuItems.length})`
                        : `${CATEGORY_ICONS[cat] || '🍴'} ${formatCategory(cat)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.menuSection}>
              {menuItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48 }}>🍽️</Text>
                  <Text style={styles.emptyTitle}>Menu coming soon</Text>
                  <Text style={styles.emptySubtext}>
                    This restaurant hasn't added their menu yet
                  </Text>
                </View>
              ) : (
                Object.entries(groupedItems).map(([category, items]) => (
                  <View key={category}>
                    <Text style={styles.categoryTitle}>
                      {CATEGORY_ICONS[category] || '🍴'} {formatCategory(category)}
                      <Text style={styles.categoryCount}> ({items.length})</Text>
                    </Text>
                    {items.map(item => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        onLoginRequired={() =>
                          Alert.alert(
                            'Sign In Required',
                            'Please sign in to save favourite dishes'
                          )
                        }
                      />
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ── Tab: Reviews ────────────────── */}
        {activeTab === 'Reviews' && (
          <View style={styles.reviewsTab}>
            {reviews.length > 0 && (
              <View style={styles.ratingsSummary}>
                <Text style={styles.avgRatingNumber}>{avgRating}</Text>
                <StarRating rating={Math.round(Number(avgRating))} size={24} />
                <Text style={styles.totalReviewsText}>
                  {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.ratingBreakdown}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const pct   = reviews.length > 0
                      ? (count / reviews.length) * 100
                      : 0;
                    return (
                      <View key={star} style={styles.breakdownRow}>
                        <Text style={styles.breakdownStar}>{star}⭐</Text>
                        <View style={styles.breakdownBarBg}>
                          <View style={[styles.breakdownBar, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.breakdownCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {myReview && (
              <View style={styles.myReviewSection}>
                <Text style={styles.myReviewLabel}>YOUR REVIEW</Text>
                <ReviewCard
                  review={myReview}
                  isOwn
                  onEdit={() => {
                    setEditingReview(true);
                    setReviewRating(myReview.rating);
                    setReviewComment(myReview.comment || '');
                    setShowReviewModal(true);
                  }}
                  onDelete={handleDeleteReview}
                />
              </View>
            )}

            {user && !myReview && (
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={handleOpenReview}
                activeOpacity={0.8}
              >
                <Ionicons name="star-outline" size={20} color="#FFFFFF" />
                <Text style={styles.writeReviewText}>Write a Review</Text>
              </TouchableOpacity>
            )}

            {!user && (
              <View style={styles.loginPrompt}>
                <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                <Text style={styles.loginPromptText}>Sign in to write a review</Text>
              </View>
            )}

            {reviewsLoading ? (
              <ActivityIndicator
                color={COLORS.primary}
                style={{ marginTop: SIZES.lg }}
              />
            ) : reviews.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>⭐</Text>
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptySubtext}>Be the first to review!</Text>
              </View>
            ) : (
              reviews
                .filter(r => r.userId !== user?.uid)
                .map(review => (
                  <ReviewCard key={review.id} review={review} />
                ))
            )}
          </View>
        )}

        {/* ── Tab: Info ───────────────────── */}
        {activeTab === 'Info' && (
          <View style={styles.infoTab}>
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>📍 Location</Text>
              <TouchableOpacity
                style={styles.infoRow}
                onPress={handleDirections}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <Text style={styles.infoLink}>
                  {[
                    restaurant.location?.address,
                    restaurant.location?.city,
                    restaurant.location?.state,
                    restaurant.location?.country,
                  ].filter(Boolean).join(', ')}
                </Text>
                <Ionicons name="open-outline" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>📞 Contact</Text>
              {!!restaurant.contact?.phone && (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.infoLink}>{restaurant.contact.phone}</Text>
                  <View style={styles.infoCTA}>
                    <Text style={styles.infoCTAText}>Tap to call</Text>
                  </View>
                </TouchableOpacity>
              )}
              {!!restaurant.contact?.whatsapp && (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleWhatsApp}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={COLORS.success} />
                  <Text style={styles.infoLink}>{restaurant.contact.whatsapp}</Text>
                  <View style={[
                    styles.infoCTA,
                    { backgroundColor: COLORS.success + '20' },
                  ]}>
                    <Text style={[styles.infoCTAText, { color: COLORS.success }]}>
                      WhatsApp
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {!!restaurant.contact?.email && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.infoText}>{restaurant.contact.email}</Text>
                </View>
              )}
              {!!restaurant.contact?.website && (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleWebsite}
                  activeOpacity={0.7}
                >
                  <Ionicons name="globe-outline" size={16} color={INFO_COLOR} />
                  <Text style={[styles.infoLink, { color: INFO_COLOR }]}>
                    {restaurant.contact.website}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>🛎️ Services</Text>
              {[
                { key: 'hasDineIn',   label: '🪑 Dine In available'  },
                { key: 'hasTakeout',  label: '🥡 Takeout available'  },
                { key: 'hasDelivery', label: '🛵 Delivery available' },
              ].map(s => restaurant[s.key] && (
                <View key={s.key} style={styles.infoRow}>
                  <Text style={styles.infoText}>{s.label}</Text>
                </View>
              ))}
            </View>

            {restaurant.cuisineTypes?.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>🍴 Cuisine</Text>
                <View style={styles.tagsRow}>
                  {restaurant.cuisineTypes.map((type, i) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>💰 Price Range</Text>
              <Text style={styles.infoText}>
                {restaurant.priceRange || '$$'} —{' '}
                {PRICE_LABELS[restaurant.priceRange] || 'Moderate'}
              </Text>
            </View>

            {(restaurant.analytics?.totalViews > 0 ||
              restaurant.totalFavorites > 0) && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>📊 Popularity</Text>
                <View style={styles.popularityRow}>
                  <View style={styles.popularityStat}>
                    <Text style={styles.popularityValue}>
                      {restaurant.analytics?.totalViews || 0}
                    </Text>
                    <Text style={styles.popularityLabel}>Views</Text>
                  </View>
                  <View style={styles.popularityStat}>
                    <Text style={styles.popularityValue}>
                      {restaurant.totalFavorites || 0}
                    </Text>
                    <Text style={styles.popularityLabel}>Favorites</Text>
                  </View>
                  <View style={styles.popularityStat}>
                    <Text style={styles.popularityValue}>
                      {restaurant.totalReviews || 0}
                    </Text>
                    <Text style={styles.popularityLabel}>Reviews</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Review Modal ─────────────────── */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowReviewModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.reviewModal,
                { paddingBottom: insets.bottom + SIZES.lg },
              ]}
            >
              <View style={styles.modalHandle} />

              <Text style={styles.reviewModalTitle}>
                {editingReview ? '✏️ Edit Review' : '⭐ Write a Review'}
              </Text>
              <Text style={styles.reviewModalSubtitle}>{restaurant.name}</Text>

              <View style={styles.starPickerContainer}>
                <Text style={styles.starPickerLabel}>Your Rating</Text>
                <StarRating
                  rating={reviewRating}
                  size={40}
                  onRate={setReviewRating}
                />
                <Text style={styles.ratingLabel}>
                  {RATING_LABELS[reviewRating] || ''}
                </Text>
              </View>

              <View style={styles.reviewInputWrapper}>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Share your experience... (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  value={reviewComment}
                  onChangeText={v => setReviewComment(v.slice(0, MAX_REVIEW_COMMENT))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={MAX_REVIEW_COMMENT}
                />
                <Text style={styles.charCount}>
                  {reviewComment.length}/{MAX_REVIEW_COMMENT}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitReviewBtn,
                  reviewLoading && { opacity: 0.7 },
                ]}
                onPress={handleSubmitReview}
                disabled={reviewLoading}
                activeOpacity={0.8}
              >
                {reviewLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitReviewBtnText}>
                    {editingReview ? 'Update Review' : 'Submit Review'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelReviewBtn}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.cancelReviewBtnText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: COLORS.background },
  container:      { flex: 1 },

  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SIZES.xl, gap: SIZES.sm, backgroundColor: COLORS.background,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted, marginTop: SIZES.md },
  errorTitle:  { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  errorText:   { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  goBackBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg, marginTop: SIZES.md,
  },
  goBackBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  coverContainer: { height: 260, position: 'relative' },
  coverImage:     { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadge: {
    position:          'absolute',
    bottom:            SIZES.md,
    left:              SIZES.md,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    gap:               SIZES.xs,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  statusText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.sm },

  infoCard:     { backgroundColor: COLORS.surface, padding: SIZES.lg, ...SHADOW },
  nameRow:      {
    flexDirection: 'row', gap: SIZES.md,
    marginBottom: SIZES.sm, alignItems: 'center',
  },
  logo: {
    width: 64, height: 64, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  logoFallback: {
    width: 64, height: 64, borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  restaurantName: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: 4, flexWrap: 'wrap',
  },
  rating:      { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  reviewCount: { fontSize: FONTS.sm, color: COLORS.textMuted },
  dot:         { color: COLORS.textMuted },
  priceRange:  { fontSize: FONTS.md, color: COLORS.primary, fontWeight: '600' },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: FONTS.xs, color: COLORS.textMuted },
  description:  {
    fontSize: FONTS.md, color: COLORS.textLight,
    lineHeight: 22, marginBottom: SIZES.sm,
  },
  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: SIZES.xs, marginBottom: SIZES.sm,
  },
  tag:     {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.sm, paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  tagText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '500' },
  actionButtons: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: SIZES.md,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: COLORS.border, marginBottom: SIZES.sm,
  },
  actionBtn:     { alignItems: 'center', gap: 6 },
  actionBtnIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  actionText:  { fontSize: FONTS.xs, color: COLORS.text, fontWeight: '500' },
  servicesRow: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap', marginTop: SIZES.xs },
  serviceBadge: {
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SIZES.sm, paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.primary + '25',
  },
  serviceBadgeText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '500' },
  announcement: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: SIZES.sm, backgroundColor: WARNING_COLOR + '15',
    padding: SIZES.md, borderRadius: RADIUS.md, marginTop: SIZES.md,
    borderLeftWidth: 4, borderLeftColor: WARNING_COLOR,
  },
  announcementText: {
    fontSize: FONTS.md, color: COLORS.text, lineHeight: 20, flex: 1,
  },

  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: SIZES.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { fontSize: FONTS.md, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  categoryTabs: { marginVertical: SIZES.md },
  categoryTab: {
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round, backgroundColor: COLORS.surface,
    marginRight: SIZES.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  categoryTabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryTabText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  categoryTabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  menuSection:           { paddingHorizontal: SIZES.md },
  categoryTitle: {
    fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text,
    marginTop: SIZES.lg, marginBottom: SIZES.sm,
  },
  categoryCount: { fontSize: FONTS.md, fontWeight: 'normal', color: COLORS.textMuted },

  reviewsTab:     { padding: SIZES.md },
  ratingsSummary: {
    alignItems: 'center', backgroundColor: COLORS.surface,
    padding: SIZES.lg, borderRadius: RADIUS.xl,
    marginBottom: SIZES.md, gap: SIZES.sm, ...SHADOW,
  },
  avgRatingNumber:  { fontSize: 56, fontWeight: 'bold', color: COLORS.text },
  totalReviewsText: { fontSize: FONTS.md, color: COLORS.textMuted },
  ratingBreakdown:  { width: '100%', gap: SIZES.xs, marginTop: SIZES.sm },
  breakdownRow:     { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  breakdownStar:    { fontSize: FONTS.sm, width: 32 },
  breakdownBarBg: {
    flex: 1, height: 8, backgroundColor: COLORS.border,
    borderRadius: 4, overflow: 'hidden',
  },
  breakdownBar:   { height: '100%', backgroundColor: WARNING_COLOR, borderRadius: 4 },
  breakdownCount: {
    fontSize: FONTS.sm, color: COLORS.textMuted,
    width: 20, textAlign: 'right',
  },
  myReviewSection: { marginBottom: SIZES.md },
  myReviewLabel: {
    fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.2, marginBottom: SIZES.sm,
  },
  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg, gap: SIZES.sm, marginBottom: SIZES.lg,
  },
  writeReviewText: { color: '#FFFFFF', fontSize: FONTS.md, fontWeight: 'bold' },
  loginPrompt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm, backgroundColor: COLORS.primary + '10',
    padding: SIZES.md, borderRadius: RADIUS.lg, marginBottom: SIZES.lg,
  },
  loginPromptText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.md },

  infoTab:     { padding: SIZES.md, gap: SIZES.md },
  infoSection: {
    backgroundColor: COLORS.surface, padding: SIZES.md,
    borderRadius: RADIUS.lg, gap: SIZES.sm, ...SHADOW,
  },
  infoSectionTitle: {
    fontSize: FONTS.lg, fontWeight: 'bold',
    color: COLORS.text, marginBottom: SIZES.xs,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  infoText: {
    fontSize: FONTS.md, color: COLORS.textLight, lineHeight: 22, flex: 1,
  },
  infoLink: {
    fontSize: FONTS.md, color: COLORS.primary,
    textDecorationLine: 'underline', flex: 1,
  },
  infoCTA: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.sm, paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  infoCTAText:     { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '600' },
  popularityRow:   { flexDirection: 'row', justifyContent: 'space-around', marginTop: SIZES.sm },
  popularityStat:  { alignItems: 'center' },
  popularityValue: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.primary },
  popularityLabel: { fontSize: FONTS.xs, color: COLORS.textMuted },

  emptyState:   { alignItems: 'center', paddingVertical: SIZES.xxl, gap: SIZES.sm },
  emptyTitle:   { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  emptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  reviewModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SIZES.lg, gap: SIZES.md,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: SIZES.xs,
  },
  reviewModalTitle: {
    fontSize: FONTS.xxl, fontWeight: 'bold',
    color: COLORS.text, textAlign: 'center',
  },
  reviewModalSubtitle: {
    fontSize: FONTS.md, color: COLORS.textMuted,
    textAlign: 'center', marginTop: -SIZES.sm,
  },
  starPickerContainer: {
    alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.md,
  },
  starPickerLabel: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  ratingLabel:     { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.primary, height: 28 },
  reviewInputWrapper: { gap: 4 },
  reviewInput: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.lg,
    padding: SIZES.md, fontSize: FONTS.md, color: COLORS.text,
    height: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: COLORS.border,
  },
  charCount:           { fontSize: FONTS.xs, color: COLORS.textMuted, textAlign: 'right' },
  submitReviewBtn:     {
    backgroundColor: COLORS.primary, padding: SIZES.md,
    borderRadius: RADIUS.lg, alignItems: 'center',
  },
  submitReviewBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },
  cancelReviewBtn:     { alignItems: 'center', paddingVertical: SIZES.sm },
  cancelReviewBtnText: { color: COLORS.textMuted, fontSize: FONTS.md },
});