// ============================================
// FILE: src/screens/user/RestaurantDetailScreen.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, collection, query, where,
  limit, onSnapshot,
} from 'firebase/firestore';
import { db }             from '../../firebase/config';
import { useAuth }        from '../../hooks/useAuth';
import { useRestaurants } from '../../hooks/useRestaurants';
import { useReviews }     from '../../hooks/useReviews';
import { useAnalytics }   from '../../hooks/useAnalytics';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import MenuItemCard from '../../components/MenuItemCard';
import StarRating   from '../../components/StarRating';
import ReviewCard   from '../../components/ReviewCard';

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

const TABS = ['Menu', 'Reviews', 'Info'];

function formatCategory(cat) {
  return cat
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Component ───────────────────────────────
export default function RestaurantDetailScreen({ route }) {
  const insets       = useSafeAreaInsets();
  const restaurantId = route.params?.restaurantId;

  const { user, userProfile }   = useAuth();
  const { toggleFavorite }      = useRestaurants();
  const {
    reviews,
    loading: reviewsLoading,
    addReview,
    updateReview,
    deleteReview,
    getUserReview,
  } = useReviews(restaurantId);

  const {
    trackRestaurantView,
    trackAction,
    usePageTimer,
  } = useAnalytics();

  usePageTimer(restaurantId);

  // ── State ─────────────────────────────────
  const [restaurant, setRestaurant]           = useState(null);
  const [menuItems, setMenuItems]             = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [isFavorited, setIsFavorited]         = useState(false);
  const [activeCategory, setActiveCategory]   = useState('all');
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeTab, setActiveTab]             = useState('Menu');

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [myReview, setMyReview]               = useState(null);
  const [reviewRating, setReviewRating]       = useState(5);
  const [reviewComment, setReviewComment]     = useState('');
  const [reviewLoading, setReviewLoading]     = useState(false);
  const [editingReview, setEditingReview]     = useState(false);

  const viewTracked = useRef(false);

  // ── Firestore listeners ───────────────────
  useEffect(() => {
    if (!restaurantId) {
      setError('Restaurant not found');
      setLoading(false);
      return;
    }

    const unsubRestaurant = onSnapshot(
      doc(db, 'restaurants', restaurantId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setRestaurant(data);
          if (!viewTracked.current) {
            viewTracked.current = true;
            trackRestaurantView(restaurantId, data.name);
          }
        } else {
          setError('Restaurant not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Restaurant listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    const menuQuery = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
      where('isAvailable', '==', true),
    );

    const unsubMenu = onSnapshot(
      menuQuery,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) =>
          (a.category || '').localeCompare(b.category || '')
        );
        setMenuItems(items);
      },
      (err) => { console.error('Menu listener error:', err); }
    );

    setIsFavorited(
      userProfile?.favoriteRestaurants?.includes(restaurantId) || false
    );

    return () => {
      unsubRestaurant();
      unsubMenu();
    };
  }, [restaurantId, userProfile]);

  useEffect(() => {
    if (!user || !restaurantId) return;
    getUserReview(user.uid).then(review => {
      if (review) {
        setMyReview(review);
        setReviewRating(review.rating);
        setReviewComment(review.comment || '');
      }
    });
  }, [user, restaurantId, reviews]);

  // ── Handlers ─────────────────────────────
  const handleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save favorites');
      return;
    }
    try {
      setFavoriteLoading(true);
      await toggleFavorite(user.uid, restaurantId, isFavorited);
      setIsFavorited(prev => !prev);
    } catch (err) {
      Alert.alert('Error', 'Could not update favorites');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleCall = () => {
    const phone = restaurant?.contact?.phone;
    if (!phone) { Alert.alert('No phone', 'No phone number available'); return; }
    trackAction(restaurantId, restaurant.name, 'call');
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'Could not open phone app')
    );
  };

  const handleDirections = () => {
    const address = restaurant?.location?.address;
    const city    = restaurant?.location?.city;
    if (!address) { Alert.alert('No address', 'No address available'); return; }
    trackAction(restaurantId, restaurant.name, 'directions');
    const encoded = encodeURIComponent(`${address}, ${city}`);
    Linking.openURL(`https://maps.google.com/?q=${encoded}`).catch(() =>
      Alert.alert('Error', 'Could not open maps')
    );
  };

  const handleWhatsApp = () => {
    const number = restaurant?.contact?.whatsapp;
    if (!number) return;
    trackAction(restaurantId, restaurant.name, 'whatsapp');
    const clean = number.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${clean}`).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp')
    );
  };

  const handleWebsite = () => {
    const url = restaurant?.contact?.website;
    if (!url) return;
    trackAction(restaurantId, restaurant.name, 'website');
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(fullUrl).catch(() =>
      Alert.alert('Error', 'Could not open website')
    );
  };

  const handleOpenReview = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to write a review');
      return;
    }
    setEditingReview(!!myReview);
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Rating required', 'Please select a star rating');
      return;
    }
    setReviewLoading(true);
    let result;
    if (myReview && editingReview) {
      result = await updateReview(myReview.id, reviewRating, reviewComment);
    } else {
      result = await addReview({
        userId:       user.uid,
        userName:     `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Anonymous',
        restaurantId,
        rating:       reviewRating,
        comment:      reviewComment,
      });
    }
    setReviewLoading(false);
    if (result.success) {
      setShowReviewModal(false);
      Alert.alert('✅ Thank you!', 'Your review has been submitted');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleDeleteReview = () => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete your review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReview(myReview.id);
            setMyReview(null);
            setReviewRating(5);
            setReviewComment('');
          },
        },
      ]
    );
  };

  // ── Derived data ──────────────────────────
  const categories = [
    'all',
    ...new Set(menuItems.map(i => i.category).filter(Boolean)),
  ];

  const filteredItems = activeCategory === 'all'
    ? menuItems
    : menuItems.filter(i => i.category === activeCategory);

  const groupedItems = filteredItems.reduce((groups, item) => {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
    return groups;
  }, {});

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) /
        reviews.length).toFixed(1)
    : null;

  // ── Loading / Error ───────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
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
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <Text style={{ fontSize: 48 }}>🍽️</Text>
        <Text style={styles.errorTitle}>Restaurant Not Found</Text>
        <Text style={styles.errorText}>
          {error || 'This restaurant may no longer be available'}
        </Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────
  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          // ✅ Bottom padding clears Android nav bar
          paddingBottom: insets.bottom + SIZES.xl,
        }}
      >

        {/* ── Cover image ─────────────────────── */}
        <View style={styles.coverContainer}>
          <Image
            source={{
              uri: restaurant.coverUrl ||
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
            }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          <View style={styles.coverOverlay} />

          {/* Favourite button */}
          <TouchableOpacity
            style={[
              styles.favoriteBtn,
              // ✅ Push down from the top system bar
              { top: insets.top + SIZES.md },
            ]}
            onPress={handleFavorite}
            disabled={favoriteLoading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorited ? COLORS.error : COLORS.textWhite}
            />
          </TouchableOpacity>

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

        {/* ── Info card ───────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.nameRow}>
            {restaurant.logoUrl ? (
              <Image source={{ uri: restaurant.logoUrl }} style={styles.logo} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={{ fontSize: 24 }}>🍽️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color="#F39C12" />
                <Text style={styles.rating}>
                  {restaurant.averageRating
                    ? restaurant.averageRating.toFixed(1)
                    : 'New'}
                </Text>
                <Text style={styles.reviewCount}>
                  ({restaurant.totalReviews || 0} reviews)
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.priceRange}>
                  {restaurant.priceRange || '$$'}
                </Text>
              </View>
            </View>
          </View>

          {restaurant.description ? (
            <Text style={styles.description}>{restaurant.description}</Text>
          ) : null}

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

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <ActionButton
              icon="call"
              label="Call"
              color={COLORS.primary}
              onPress={handleCall}
            />
            <ActionButton
              icon="navigate"
              label="Directions"
              color={COLORS.primary}
              onPress={handleDirections}
            />
            {restaurant.contact?.whatsapp && (
              <ActionButton
                icon="logo-whatsapp"
                label="WhatsApp"
                color={COLORS.success}
                onPress={handleWhatsApp}
              />
            )}
            {restaurant.contact?.website && (
              <ActionButton
                icon="globe"
                label="Website"
                color={COLORS.info}
                onPress={handleWebsite}
              />
            )}
          </View>

          {/* Services */}
          <View style={styles.servicesRow}>
            {restaurant.hasDineIn   && <ServiceBadge label="🪑 Dine In"  />}
            {restaurant.hasTakeout  && <ServiceBadge label="🥡 Takeout"  />}
            {restaurant.hasDelivery && <ServiceBadge label="🛵 Delivery" />}
          </View>

          {/* Announcement */}
          {restaurant.announcement?.isActive &&
            restaurant.announcement?.text && (
            <View style={styles.announcement}>
              <Text style={styles.announcementText}>
                📢 {restaurant.announcement.text}
              </Text>
            </View>
          )}
        </View>

        {/* ── Tab bar ─────────────────────────── */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}>
                {tab}
                {tab === 'Reviews' && reviews.length > 0
                  ? ` (${reviews.length})`
                  : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Menu ───────────────────────── */}
        {activeTab === 'Menu' && (
          <View>
            {menuItems.length > 0 && (
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
                        ? '🍽️ All'
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
                      {CATEGORY_ICONS[category] || '🍴'}{' '}
                      {formatCategory(category)}
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

        {/* ── Tab: Reviews ────────────────────── */}
        {activeTab === 'Reviews' && (
          <View style={styles.reviewsTab}>
            {reviews.length > 0 && (
              <View style={styles.ratingsSummary}>
                <Text style={styles.avgRatingNumber}>{avgRating}</Text>
                <StarRating rating={Math.round(Number(avgRating))} size={24} />
                <Text style={styles.totalReviewsText}>
                  {reviews.length} review
                  {reviews.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.ratingBreakdown}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const pct   = reviews.length > 0
                      ? (count / reviews.length) * 100 : 0;
                    return (
                      <View key={star} style={styles.breakdownRow}>
                        <Text style={styles.breakdownStar}>{star}⭐</Text>
                        <View style={styles.breakdownBarBg}>
                          <View style={[
                            styles.breakdownBar,
                            { width: `${pct}%` },
                          ]} />
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
                <Text style={styles.loginPromptText}>
                  Sign in to write a review
                </Text>
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
                <Text style={styles.emptySubtext}>
                  Be the first to review this restaurant!
                </Text>
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

        {/* ── Tab: Info ───────────────────────── */}
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
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>📞 Contact</Text>

              {restaurant.contact?.phone && (
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

              {restaurant.contact?.whatsapp && (
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

              {restaurant.contact?.email && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.infoText}>{restaurant.contact.email}</Text>
                </View>
              )}

              {restaurant.contact?.website && (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleWebsite}
                  activeOpacity={0.7}
                >
                  <Ionicons name="globe-outline" size={16} color={COLORS.info} />
                  <Text style={[styles.infoLink, { color: COLORS.info }]}>
                    {restaurant.contact.website}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>🛎️ Services</Text>
              {restaurant.hasDineIn && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🪑 Dine In available</Text>
                </View>
              )}
              {restaurant.hasTakeout && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🥡 Takeout available</Text>
                </View>
              )}
              {restaurant.hasDelivery && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🛵 Delivery available</Text>
                </View>
              )}
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
                {{
                  '$':    'Budget friendly',
                  '$$':   'Moderate',
                  '$$$':  'Upscale',
                  '$$$$': 'Fine dining',
                }[restaurant.priceRange] || 'Moderate'}
              </Text>
            </View>

            {restaurant.analytics?.totalViews > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>📊 Popularity</Text>
                <View style={styles.popularityRow}>
                  <View style={styles.popularityStat}>
                    <Text style={styles.popularityValue}>
                      {restaurant.analytics.totalViews || 0}
                    </Text>
                    <Text style={styles.popularityLabel}>Total Views</Text>
                  </View>
                  <View style={styles.popularityStat}>
                    <Text style={styles.popularityValue}>
                      {restaurant.totalFavorites || 0}
                    </Text>
                    <Text style={styles.popularityLabel}>Favourited</Text>
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

      {/* ── Review Modal ─────────────────────── */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={
            Platform.OS === 'ios' ? 0 : insets.top
          }
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
                // ✅ Bottom padding clears Android nav bar
                { paddingBottom: insets.bottom + SIZES.lg },
              ]}
              onPress={() => {}}
            >
              <Text style={styles.reviewModalTitle}>
                {editingReview ? '✏️ Edit Review' : '⭐ Write a Review'}
              </Text>
              <Text style={styles.reviewModalSubtitle}>
                {restaurant.name}
              </Text>

              <View style={styles.starPickerContainer}>
                <Text style={styles.starPickerLabel}>Your Rating</Text>
                <StarRating
                  rating={reviewRating}
                  size={40}
                  onRate={setReviewRating}
                />
                <Text style={styles.ratingLabel}>
                  {[
                    '',
                    '😞 Poor',
                    '😐 Fair',
                    '🙂 Good',
                    '😊 Very Good',
                    '🤩 Excellent',
                  ][reviewRating]}
                </Text>
              </View>

              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience... (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

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

// ─── Sub-components ───────────────────────────
function ActionButton({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.actionBtnIcon,
        { backgroundColor: color + '15' },
      ]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ServiceBadge({ label }) {
  return (
    <View style={styles.serviceBadge}>
      <Text style={styles.serviceBadgeText}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
    gap: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    marginTop: SIZES.md,
  },
  errorTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.sm,
  },
  errorText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Cover ────────────────────────────────
  coverContainer: { height: 240, position: 'relative' },
  coverImage:     { width: '100%', height: '100%' },
  coverOverlay:   {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  favoriteBtn: {
    position: 'absolute',
    // ✅ `top` set dynamically via insets in JSX
    right: SIZES.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: SIZES.sm,
    borderRadius: RADIUS.round,
  },
  statusBadge: {
    position: 'absolute',
    bottom: SIZES.md,
    left: SIZES.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: RADIUS.round,
    gap: SIZES.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  statusText: {
    color: COLORS.textWhite,
    fontWeight: 'bold',
    fontSize: FONTS.sm,
  },

  // ── Info card ────────────────────────────
  infoCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    ...SHADOW,
  },
  nameRow: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginBottom: SIZES.sm,
    alignItems: 'center',
  },
  logo: { width: 60, height: 60, borderRadius: RADIUS.md },
  logoFallback: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  rating:      { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  reviewCount: { fontSize: FONTS.sm, color: COLORS.textMuted },
  dot:         { color: COLORS.textMuted },
  priceRange:  { fontSize: FONTS.md, color: COLORS.primary, fontWeight: '600' },
  description: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
    marginBottom: SIZES.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.xs,
    marginBottom: SIZES.md,
  },
  tag: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  tagText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SIZES.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.md,
  },
  actionBtn:     { alignItems: 'center', gap: 6 },
  actionBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: FONTS.xs,
    color: COLORS.text,
    fontWeight: '500',
  },
  servicesRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    flexWrap: 'wrap',
    marginTop: SIZES.sm,
  },
  serviceBadge: {
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  serviceBadgeText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  announcement: {
    backgroundColor: COLORS.warning + '20',
    padding: SIZES.md,
    borderRadius: RADIUS.md,
    marginTop: SIZES.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  announcementText: {
    fontSize: FONTS.md,
    color: COLORS.text,
    lineHeight: 20,
  },

  // ── Tab bar ──────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { fontSize: FONTS.md, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  // ── Category tabs ────────────────────────
  categoryTabs: { marginVertical: SIZES.md },
  categoryTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    marginRight: SIZES.sm,
    ...SHADOW,
  },
  categoryTabActive:     { backgroundColor: COLORS.primary },
  categoryTabText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  categoryTabTextActive: { color: COLORS.textWhite, fontWeight: '600' },

  // ── Menu section ─────────────────────────
  menuSection:   { paddingHorizontal: SIZES.md },
  categoryTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.lg,
    marginBottom: SIZES.sm,
  },

  // ── Reviews tab ──────────────────────────
  reviewsTab: { padding: SIZES.md },
  ratingsSummary: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: RADIUS.xl,
    marginBottom: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW,
  },
  avgRatingNumber: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalReviewsText: { fontSize: FONTS.md, color: COLORS.textMuted },
  ratingBreakdown:  { width: '100%', gap: SIZES.xs, marginTop: SIZES.sm },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  breakdownStar:  { fontSize: FONTS.sm, width: 30 },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    width: 20,
    textAlign: 'right',
  },
  myReviewSection: { marginBottom: SIZES.md },
  myReviewLabel: {
    fontSize: FONTS.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: SIZES.sm,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  writeReviewText: {
    color: '#FFFFFF',
    fontSize: FONTS.md,
    fontWeight: 'bold',
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.primary + '10',
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    marginBottom: SIZES.lg,
  },
  loginPromptText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONTS.md,
  },

  // ── Info tab ─────────────────────────────
  infoTab:     { padding: SIZES.md, gap: SIZES.md },
  infoSection: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  infoSectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  infoText: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
    flex: 1,
  },
  infoLink: {
    fontSize: FONTS.md,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    flex: 1,
  },
  infoCTA: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  infoCTAText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  popularityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SIZES.sm,
  },
  popularityStat: { alignItems: 'center' },
  popularityValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  popularityLabel: { fontSize: FONTS.xs, color: COLORS.textMuted },

  // ── Empty state ──────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    gap: SIZES.sm,
  },
  emptyTitle:   { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  emptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },

  // ── Review modal ─────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reviewModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SIZES.lg,
    gap: SIZES.md,
    // ✅ paddingBottom set dynamically via insets in JSX
  },
  reviewModalTitle: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  reviewModalSubtitle: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: -SIZES.sm,
  },
  starPickerContainer: {
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.md,
  },
  starPickerLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingLabel: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
    height: 28,
  },
  reviewInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitReviewBtn: {
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },
  cancelReviewBtn:     { alignItems: 'center', paddingVertical: SIZES.sm },
  cancelReviewBtnText: { color: COLORS.textMuted, fontSize: FONTS.md },
});