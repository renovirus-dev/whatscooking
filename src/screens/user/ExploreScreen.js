// ============================================
// FILE: src/screens/user/ExploreScreen.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../firebase/config';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard from '../../components/RestaurantCard';

// ─── Constants ───────────────────────────────
const CUISINES = [
  { label: 'All',        emoji: '🍽️', value: 'all'        },
  { label: 'Caribbean',  emoji: '🌴', value: 'caribbean'  },
  { label: 'Jamaican',   emoji: '🇯🇲', value: 'jamaican'  },
  { label: 'American',   emoji: '🍔', value: 'american'   },
  { label: 'Chinese',    emoji: '🥡', value: 'chinese'    },
  { label: 'Italian',    emoji: '🍕', value: 'italian'    },
  { label: 'Indian',     emoji: '🍛', value: 'indian'     },
  { label: 'Mexican',    emoji: '🌮', value: 'mexican'    },
  { label: 'Japanese',   emoji: '🍱', value: 'japanese'   },
  { label: 'Seafood',    emoji: '🦐', value: 'seafood'    },
  { label: 'BBQ',        emoji: '🍖', value: 'bbq'        },
  { label: 'Bakery',     emoji: '🧁', value: 'bakery'     },
  { label: 'Vegetarian', emoji: '🥗', value: 'vegetarian' },
];

const PRICE_RANGES = ['All', '$', '$$', '$$$', '$$$$'];

const SORT_OPTIONS = [
  { label: 'Top Rated',    value: 'rating'    },
  { label: 'Most Reviews', value: 'reviews'   },
  { label: 'Nearest',      value: 'distance'  }, // ✅ NEW
];

// ✅ NEW: Radius options for nearby filter
const RADIUS_OPTIONS = [
  { label: '2km',  value: 2  },
  { label: '5km',  value: 5  },
  { label: '10km', value: 10 },
  { label: '20km', value: 20 },
];

// ─── Distance Calculator ──────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

// ✅ Format distance for display
const formatDistance = (km) => {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
};

// ─── Geocode address using expo-location ──────
const geocodeAddress = async (address) => {
  try {
    if (!address?.trim()) return null;
    const results = await Location.geocodeAsync(address);
    if (results?.length > 0) {
      return {
        latitude:  results[0].latitude,
        longitude: results[0].longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
};

// ─── Component ───────────────────────────────
export default function ExploreScreen({ navigation, route }) {
  const [restaurants, setRestaurants]           = useState([]);
  const [filtered, setFiltered]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [search, setSearch]                     = useState('');
  const [selectedCuisine, setSelectedCuisine]   = useState(
    route.params?.cuisine || 'all'
  );
  const [selectedPrice, setSelectedPrice]       = useState('All');
  const [selectedSort, setSelectedSort]         = useState('rating');
  const [showOpenOnly, setShowOpenOnly]         = useState(false);

  // ✅ NEW: Location state
  const [nearbyActive, setNearbyActive]         = useState(false);
  const [userCoords, setUserCoords]             = useState(null);
  const [locationLoading, setLocationLoading]   = useState(false);
  const [selectedRadius, setSelectedRadius]     = useState(10);
  const [restaurantsWithCoords, setRestaurantsWithCoords] = useState([]);

  // ─── Firestore listener ──────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setRestaurants(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('ExploreScreen query error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // ✅ NEW: Geocode all restaurants when list loads
  // Skips restaurants that already have coords stored
  useEffect(() => {
    if (restaurants.length === 0) return;

    const geocodeAll = async () => {
      const withCoords = await Promise.all(
        restaurants.map(async (r) => {
          // ✅ Use stored coords if available (faster)
          if (r.coords?.latitude && r.coords?.longitude) {
            return { ...r };
          }

          // ✅ Geocode from address fields
          const address = [
            r.address,
            r.location?.city || r.city,
            r.location?.country || r.country,
          ]
            .filter(Boolean)
            .join(', ');

          const coords = await geocodeAddress(address);
          return { ...r, coords: coords || null };
        })
      );
      setRestaurantsWithCoords(withCoords);
    };

    geocodeAll();
  }, [restaurants]);

  // ✅ NEW: Request location and activate nearby filter
  const handleNearbyToggle = async () => {
    // If already active — turn it off
    if (nearbyActive) {
      setNearbyActive(false);
      setUserCoords(null);
      // Reset sort if it was set to distance
      if (selectedSort === 'distance') setSelectedSort('rating');
      return;
    }

    setLocationLoading(true);

    try {
      // Request permission
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          '📍 Location Required',
          'Please allow location access to find restaurants near you.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserCoords({
        latitude:  location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setNearbyActive(true);
      setSelectedSort('distance'); // ✅ Auto sort by nearest

    } catch (err) {
      Alert.alert(
        'Location Error',
        'Could not get your location. Please try again.',
      );
      console.error('Location error:', err.message);
    }

    setLocationLoading(false);
  };

  // ─── Apply filters ────────────────────────
  const applyFilters = useCallback(() => {
    // ✅ Use geocoded list when nearby is active
    let result = nearbyActive && restaurantsWithCoords.length > 0
      ? [...restaurantsWithCoords]
      : [...restaurants];

    // ✅ Add distance to each restaurant
    if (userCoords) {
      result = result.map(r => ({
        ...r,
        distance: calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          r.coords?.latitude,
          r.coords?.longitude,
        ),
      }));
    }

    // ✅ Filter by radius when nearby is active
    if (nearbyActive && userCoords) {
      result = result.filter(
        r => r.distance !== null && r.distance <= selectedRadius
      );
    }

    // Search filter
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(lower) ||
        r.location?.city?.toLowerCase().includes(lower) ||
        r.cuisineTypes?.some(c =>
          c.toLowerCase().includes(lower)
        )
      );
    }

    // Cuisine filter
    if (selectedCuisine !== 'all') {
      result = result.filter(r =>
        r.cuisineTypes?.includes(selectedCuisine)
      );
    }

    // Price filter
    if (selectedPrice !== 'All') {
      result = result.filter(r => r.priceRange === selectedPrice);
    }

    // Open now filter
    if (showOpenOnly) {
      result = result.filter(r => r.isCurrentlyOpen);
    }

    // Sort
    if (selectedSort === 'rating') {
      result.sort((a, b) =>
        (b.averageRating || 0) - (a.averageRating || 0)
      );
    } else if (selectedSort === 'reviews') {
      result.sort((a, b) =>
        (b.totalReviews || 0) - (a.totalReviews || 0)
      );
    } else if (selectedSort === 'distance') {
      // ✅ Sort by nearest first - nulls go to end
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    setFiltered(result);
  }, [
    restaurants,
    restaurantsWithCoords,
    search,
    selectedCuisine,
    selectedPrice,
    selectedSort,
    showOpenOnly,
    nearbyActive,
    userCoords,
    selectedRadius,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ─── Reset all filters ───────────────────
  const handleReset = () => {
    setSearch('');
    setSelectedCuisine('all');
    setSelectedPrice('All');
    setShowOpenOnly(false);
    setSelectedSort('rating');
    setNearbyActive(false);
    setUserCoords(null);
    setSelectedRadius(10);
  };

  // ─── Loading ─────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding restaurants...</Text>
      </View>
    );
  }

  // ─── Error ───────────────────────────────
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48 }}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // ─── Render ──────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Search Bar ─────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants or cuisines..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* ✅ NEW: Near Me button inside search bar */}
        <TouchableOpacity
          style={[
            styles.nearMeBtn,
            nearbyActive && styles.nearMeBtnActive,
          ]}
          onPress={handleNearbyToggle}
          disabled={locationLoading}
          activeOpacity={0.8}
        >
          {locationLoading ? (
            <ActivityIndicator
              size="small"
              color={nearbyActive ? COLORS.textWhite : COLORS.primary}
            />
          ) : (
            <>
              <Ionicons
                name="navigate"
                size={14}
                color={nearbyActive ? COLORS.textWhite : COLORS.primary}
              />
              <Text style={[
                styles.nearMeText,
                nearbyActive && styles.nearMeTextActive,
              ]}>
                Near Me
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ✅ NEW: Radius selector - only shows when nearby is active */}
      {nearbyActive && (
        <View style={styles.radiusRow}>
          <Ionicons
            name="radio-button-on"
            size={14}
            color={COLORS.primary}
          />
          <Text style={styles.radiusLabel}>Radius:</Text>
          {RADIUS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.radiusChip,
                selectedRadius === opt.value && styles.radiusChipActive,
              ]}
              onPress={() => setSelectedRadius(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.radiusChipText,
                selectedRadius === opt.value &&
                  styles.radiusChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Cuisine Filter ─────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cuisineScroll}
        contentContainerStyle={styles.cuisineContent}
      >
        {CUISINES.map(c => (
          <TouchableOpacity
            key={c.value}
            style={[
              styles.cuisineChip,
              selectedCuisine === c.value && styles.cuisineChipActive,
            ]}
            onPress={() => setSelectedCuisine(c.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.cuisineEmoji}>{c.emoji}</Text>
            <Text style={[
              styles.cuisineLabel,
              selectedCuisine === c.value && styles.cuisineLabelActive,
            ]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Price + Open Now Filters ────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {PRICE_RANGES.map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.filterChip,
              selectedPrice === p && styles.filterChipActive,
            ]}
            onPress={() => setSelectedPrice(p)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterChipText,
              selectedPrice === p && styles.filterChipTextActive,
            ]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.filterChip,
            showOpenOnly && styles.filterChipOpen,
          ]}
          onPress={() => setShowOpenOnly(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.filterChipText,
            showOpenOnly && styles.filterChipTextActive,
          ]}>
            🟢 Open Now
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sort Row ───────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity
            key={s.value}
            style={[
              styles.sortChip,
              selectedSort === s.value && styles.sortChipActive,
            ]}
            onPress={() => setSelectedSort(s.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sortChipText,
              selectedSort === s.value && styles.sortChipTextActive,
            ]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Reset button */}
        {(selectedCuisine !== 'all' ||
          selectedPrice !== 'All' ||
          showOpenOnly ||
          nearbyActive ||
          search.length > 0) && (
          <TouchableOpacity
            style={styles.resetChip}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={12} color={COLORS.error} />
            <Text style={styles.resetChipText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ NEW: Nearby active banner */}
      {nearbyActive && userCoords && (
        <View style={styles.nearbyBanner}>
          <Ionicons name="navigate" size={14} color={COLORS.primary} />
          <Text style={styles.nearbyBannerText}>
            Showing restaurants within {selectedRadius}km of your location
          </Text>
        </View>
      )}

      {/* ── Results count ──────────────────── */}
      <Text style={styles.resultsText}>
        {filtered.length} restaurant
        {filtered.length !== 1 ? 's' : ''} found
      </Text>

      {/* ── List ───────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            horizontal
            style={styles.card}
            // ✅ Pass distance so card can show it
            distance={nearbyActive ? formatDistance(item.distance) : null}
            onPress={() =>
              navigation.navigate('RestaurantDetail', {
                restaurantId: item.id,
                name:         item.name,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>
              {nearbyActive ? '📍' : '🔍'}
            </Text>
            <Text style={styles.emptyTitle}>
              {nearbyActive
                ? `No restaurants within ${selectedRadius}km`
                : 'No restaurants found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {nearbyActive
                ? 'Try increasing the search radius'
                : 'Try adjusting your filters'}
            </Text>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Text style={styles.resetBtnText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.xl,
    gap: SIZES.sm,
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
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.xl,
    gap: SIZES.sm,
    ...SHADOW,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.text,
    paddingVertical: SIZES.sm,
  },

  // ✅ NEW: Near Me button
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  nearMeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  nearMeText: {
    fontSize: FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '700',
  },
  nearMeTextActive: {
    color: COLORS.textWhite,
  },

  // ✅ NEW: Radius row
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.sm,
    gap: SIZES.xs,
    backgroundColor: COLORS.primary + '08',
    paddingTop: SIZES.xs,
  },
  radiusLabel: {
    fontSize: FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
    marginRight: 2,
  },
  radiusChip: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radiusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  radiusChipText: {
    fontSize: FONTS.xs,
    color:      COLORS.text,
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: COLORS.textWhite,
  },

  // ✅ NEW: Nearby active banner
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    backgroundColor: COLORS.primary + '10',
  },
  nearbyBannerText: {
    fontSize: FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '500',
  },

  // Cuisine chips
  cuisineScroll:  { maxHeight: 60 },
  cuisineContent: {
    paddingHorizontal: SIZES.md,
    gap:               SIZES.sm,
    paddingBottom:     SIZES.sm,
  },
  cuisineChip: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:   RADIUS.round,
    backgroundColor: COLORS.surface,
    gap: 6,
    ...SHADOW,
  },
  cuisineChipActive: { backgroundColor: COLORS.primary },
  cuisineEmoji:      { fontSize: 16 },
  cuisineLabel: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '500',
  },
  cuisineLabelActive: { color: '#FFFFFF' },

  // Filter chips
  filterScroll:  { maxHeight: 44 },
  filterContent: {
    paddingHorizontal: SIZES.md,
    gap:               SIZES.sm,
    alignItems:        'center',
  },
  filterChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  filterChipOpen: {
    backgroundColor: COLORS.success,
    borderColor:     COLORS.success,
  },
  filterChipText: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '500',
  },
  filterChipTextActive: { color: '#FFFFFF' },

  // Sort row
  sortRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    gap:            SIZES.sm,
    flexWrap:       'wrap',
  },
  sortLabel: {
    fontSize:   FONTS.sm,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  sortChip: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  sortChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor:     COLORS.secondary,
  },
  sortChipText: {
    fontSize: FONTS.xs,
    color:    COLORS.text,
  },
  sortChipTextActive: {
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  resetChip: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:  RADIUS.round,
    backgroundColor: COLORS.error + '15',
    borderWidth:   1,
    borderColor:   COLORS.error + '40',
    gap: 4,
  },
  resetChipText: {
    fontSize:   FONTS.xs,
    color:      COLORS.error,
    fontWeight: '600',
  },

  // Results
  resultsText: {
    fontSize: FONTS.sm,
    color:    COLORS.textMuted,
    paddingHorizontal: SIZES.md,
    marginBottom:      SIZES.xs,
  },

  // List
  listContent: {
    padding:       SIZES.md,
    gap:           SIZES.md,
    paddingBottom: 40,
    flexGrow:      1,
  },
  card: { marginBottom: 0 },

  // Empty state
  emptyState: {
    alignItems:    'center',
    paddingVertical: SIZES.xxl * 2,
    gap:           SIZES.sm,
  },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
    marginTop:  SIZES.md,
    textAlign:  'center',
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color:    COLORS.textMuted,
  },
  resetBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderRadius:    RADIUS.lg,
    marginTop:       SIZES.lg,
  },
  resetBtnText: {
    color:      '#FFFFFF',
    fontWeight: '600',
    fontSize:   FONTS.md,
  },
});