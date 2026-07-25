// ============================================
// FILE: src/screens/user/ExploreScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback,
  useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, limit, onSnapshot,
} from 'firebase/firestore';
import * as Location  from 'expo-location';
import { db }         from '../../firebase/config';
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
  { label: 'Top Rated',    value: 'rating'   },
  { label: 'Most Reviews', value: 'reviews'  },
  { label: 'Nearest',      value: 'distance' },
];

const RADIUS_OPTIONS = [
  { label: '2km',  value: 2  },
  { label: '5km',  value: 5  },
  { label: '10km', value: 10 },
  { label: '20km', value: 20 },
  { label: '50km', value: 50 },
];

// ─── Helpers ─────────────────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(
    6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10
  ) / 10;
};

const formatDistance = (km) => {
  if (km === null || km === undefined) return null;
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
};

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

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function ExploreScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // ── Data State ────────────────────────────
  const [restaurants, setRestaurants]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);

  // ── Filter State ──────────────────────────
  // ✅ Handle filter param from HomeScreen
  const initialFilter = route.params?.filter;
  const [search, setSearch]                       = useState('');
  const [selectedCuisine, setSelectedCuisine]     = useState(
    route.params?.cuisine || 'all'
  );
  const [selectedPrice, setSelectedPrice]         = useState('All');
  const [selectedSort, setSelectedSort]           = useState('rating');
  const [showOpenOnly, setShowOpenOnly]           = useState(
    initialFilter === 'openNow'
  );
  const [showDeliveryOnly, setShowDeliveryOnly]   = useState(
    initialFilter === 'delivery'
  );
  const [showDineInOnly, setShowDineInOnly]       = useState(
    initialFilter === 'dineIn'
  );

  // ── Location State ────────────────────────
  const [nearbyActive, setNearbyActive]     = useState(false);
  const [userCoords, setUserCoords]         = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(10);

  // ── Geocode Cache ─────────────────────────
  const [geocodedMap, setGeocodedMap]   = useState({});
  const geocodingRef                    = useRef(false);
  const [geocoding, setGeocoding]       = useState(false);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENER
  // ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRestaurants(data);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      },
      (err) => {
        console.error('ExploreScreen query error:', err);
        setError(err.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────
  // GEOCODE MISSING COORDS (CACHED)
  // ✅ Same approach as HomeScreen
  // ─────────────────────────────────────────
  useEffect(() => {
    if (restaurants.length === 0 || geocodingRef.current) return;

    const needsGeocode = restaurants.filter(r =>
      !r.coords?.latitude && !geocodedMap[r.id]
    );

    if (needsGeocode.length === 0) return;

    geocodingRef.current = true;
    setGeocoding(true);

    Promise.all(
      needsGeocode.map(async (r) => {
        const address = [
          r.location?.address,
          r.location?.city,
          r.location?.country,
        ].filter(Boolean).join(', ');
        const coords = await geocodeAddress(address);
        return { id: r.id, coords };
      })
    ).then(results => {
      const newMap = { ...geocodedMap };
      results.forEach(({ id, coords }) => {
        if (coords) newMap[id] = coords;
      });
      setGeocodedMap(newMap);
      setGeocoding(false);
      geocodingRef.current = false;
    });
  }, [restaurants]);

  // ─────────────────────────────────────────
  // GET RESTAURANT COORDS
  // ─────────────────────────────────────────
  const getCoords = useCallback((restaurant) => {
    if (restaurant.coords?.latitude) return restaurant.coords;
    return geocodedMap[restaurant.id] || null;
  }, [geocodedMap]);

  // ─────────────────────────────────────────
  // NEAR ME TOGGLE
  // ─────────────────────────────────────────
  const handleNearbyToggle = useCallback(async () => {
    if (nearbyActive) {
      setNearbyActive(false);
      setUserCoords(null);
      if (selectedSort === 'distance') setSelectedSort('rating');
      return;
    }

    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '📍 Location Required',
          'Please allow location access to find restaurants near you.',
          [{ text: 'OK' }]
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserCoords({
        latitude:  location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setNearbyActive(true);
      setSelectedSort('distance');
    } catch (err) {
      console.error('Location error:', err.message);
      Alert.alert(
        'Location Error',
        'Could not get your location. Please try again.'
      );
    } finally {
      setLocationLoading(false);
    }
  }, [nearbyActive, selectedSort]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 3000);
  }, []);

  // ─────────────────────────────────────────
  // RESET ALL FILTERS
  // ─────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSearch('');
    setSelectedCuisine('all');
    setSelectedPrice('All');
    setSelectedSort('rating');
    setShowOpenOnly(false);
    setShowDeliveryOnly(false);
    setShowDineInOnly(false);
    setNearbyActive(false);
    setUserCoords(null);
    setSelectedRadius(10);
  }, []);

  // ─────────────────────────────────────────
  // FILTERED + SORTED RESTAURANTS
  // ✅ All in one useMemo
  // ─────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.map(r => ({
      ...r,
      distance: userCoords
        ? calculateDistance(
            userCoords.latitude, userCoords.longitude,
            getCoords(r)?.latitude, getCoords(r)?.longitude,
          )
        : null,
    }));

    // ── Near Me filter ──────────────────────
    if (nearbyActive && userCoords) {
      result = result.filter(
        r => r.distance !== null && r.distance <= selectedRadius
      );
    }

    // ── Search filter ──────────────────────
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(q)              ||
        r.location?.city?.toLowerCase().includes(q)   ||
        r.cuisineTypes?.some(c => c.toLowerCase().includes(q)) ||
        r.description?.toLowerCase().includes(q)
      );
    }

    // ── Cuisine filter ─────────────────────
    if (selectedCuisine !== 'all') {
      result = result.filter(r =>
        r.cuisineTypes?.includes(selectedCuisine)
      );
    }

    // ── Price filter ───────────────────────
    if (selectedPrice !== 'All') {
      result = result.filter(r => r.priceRange === selectedPrice);
    }

    // ── Open Now filter ────────────────────
    if (showOpenOnly) {
      result = result.filter(r => r.isCurrentlyOpen);
    }

    // ── Delivery filter ────────────────────
    if (showDeliveryOnly) {
      result = result.filter(r => r.hasDelivery);
    }

    // ── Dine In filter ─────────────────────
    if (showDineInOnly) {
      result = result.filter(r => r.hasDineIn);
    }

    // ── Sort ───────────────────────────────
    if (selectedSort === 'rating') {
      result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (selectedSort === 'reviews') {
      result.sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0));
    } else if (selectedSort === 'distance') {
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return result;
  }, [
    restaurants, userCoords, nearbyActive, selectedRadius,
    search, selectedCuisine, selectedPrice,
    showOpenOnly, showDeliveryOnly, showDineInOnly,
    selectedSort, getCoords,
  ]);

  // ─────────────────────────────────────────
  // ACTIVE FILTER COUNT
  // ✅ Shows how many filters are active
  // ─────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim())          count++;
    if (selectedCuisine !== 'all') count++;
    if (selectedPrice !== 'All')   count++;
    if (showOpenOnly)            count++;
    if (showDeliveryOnly)        count++;
    if (showDineInOnly)          count++;
    if (nearbyActive)            count++;
    return count;
  }, [
    search, selectedCuisine, selectedPrice,
    showOpenOnly, showDeliveryOnly, showDineInOnly, nearbyActive,
  ]);

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding restaurants...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────
  if (error) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Text style={{ fontSize: 48 }}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setError(null);
            setLoading(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 56}
    >

      {/* ── Search Bar ──────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants, cuisines, city..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {/* Near Me */}
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
              color={nearbyActive ? '#FFFFFF' : COLORS.primary}
            />
          ) : (
            <>
              <Ionicons
                name="navigate-outline"
                size={14}
                color={nearbyActive ? '#FFFFFF' : COLORS.primary}
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

      {/* ── Radius Selector (Near Me only) ───── */}
      {nearbyActive && (
        <View style={styles.radiusRow}>
          <Ionicons
            name="radio-button-on-outline"
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
                selectedRadius === opt.value && styles.radiusChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          {geocoding && (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={{ marginLeft: 'auto' }}
            />
          )}
        </View>
      )}

      {/* ── Cuisine Chips ────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cuisineScroll}
        contentContainerStyle={styles.cuisineContent}
        nestedScrollEnabled
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

      {/* ── Filter Chips ──────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
        nestedScrollEnabled
      >
        {/* Price Range */}
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

        {/* Open Now */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            showOpenOnly && styles.filterChipSuccess,
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

        {/* ✅ Delivery filter */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            showDeliveryOnly && styles.filterChipActive,
          ]}
          onPress={() => setShowDeliveryOnly(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.filterChipText,
            showDeliveryOnly && styles.filterChipTextActive,
          ]}>
            🛵 Delivery
          </Text>
        </TouchableOpacity>

        {/* ✅ Dine In filter */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            showDineInOnly && styles.filterChipActive,
          ]}
          onPress={() => setShowDineInOnly(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.filterChipText,
            showDineInOnly && styles.filterChipTextActive,
          ]}>
            🪑 Dine In
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sort + Reset Row ──────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map(s => {
          // ✅ Disable "Nearest" if Near Me not active
          const isDisabled = s.value === 'distance' && !nearbyActive;
          return (
            <TouchableOpacity
              key={s.value}
              style={[
                styles.sortChip,
                selectedSort === s.value && styles.sortChipActive,
                isDisabled && styles.sortChipDisabled,
              ]}
              onPress={() => !isDisabled && setSelectedSort(s.value)}
              activeOpacity={isDisabled ? 1 : 0.7}
            >
              <Text style={[
                styles.sortChipText,
                selectedSort === s.value && styles.sortChipTextActive,
                isDisabled && styles.sortChipTextDisabled,
              ]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* ✅ Active filter count + Reset */}
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.resetChip}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Ionicons name="close-outline" size={12} color={COLORS.error} />
            <Text style={styles.resetChipText}>
              Reset ({activeFilterCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Near Me Banner ────────────────────── */}
      {nearbyActive && userCoords && (
        <View style={styles.nearbyBanner}>
          <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
          <Text style={styles.nearbyBannerText}>
            Within {selectedRadius}km of your location
          </Text>
        </View>
      )}

      {/* ── Results Count ─────────────────────── */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {filteredRestaurants.length} restaurant
          {filteredRestaurants.length !== 1 ? 's' : ''} found
        </Text>
        {activeFilterCount > 0 && (
          <View style={styles.activeFiltersBadge}>
            <Text style={styles.activeFiltersBadgeText}>
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </Text>
          </View>
        )}
      </View>

      {/* ── Restaurant List ───────────────────── */}
      <FlatList
        data={filteredRestaurants}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + SIZES.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            horizontal
            style={styles.card}
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
              {nearbyActive ? '📍' : search ? '🔍' : '🍽️'}
            </Text>
            <Text style={styles.emptyTitle}>
              {nearbyActive
                ? `No restaurants within ${selectedRadius}km`
                : search
                ? `No results for "${search}"`
                : 'No restaurants found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {nearbyActive
                ? 'Try increasing the search radius'
                : 'Try adjusting your filters'}
            </Text>
            <View style={styles.emptyActions}>
              {nearbyActive && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() =>
                    setSelectedRadius(prev => Math.min(prev + 10, 50))
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>Bigger Radius</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.emptyActionBtn,
                  { backgroundColor: COLORS.secondary },
                ]}
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    padding:         SIZES.xl,
    gap:             SIZES.sm,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted, marginTop: SIZES.md },
  errorTitle:  { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text   },
  errorText:   { fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.md,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    margin:            SIZES.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.xl,
    gap:               SIZES.sm,
    ...SHADOW,
  },
  searchInput: {
    flex:          1,
    fontSize:      FONTS.md,
    color:         COLORS.text,
    paddingVertical: SIZES.sm,
  },

  // ── Near Me ───────────────────────────────
  nearMeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.primary + '15',
    borderWidth:       1,
    borderColor:       COLORS.primary,
  },
  nearMeBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  nearMeText:       { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '700' },
  nearMeTextActive: { color: '#FFFFFF' },

  // ── Radius Row ────────────────────────────
  radiusRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary + '08',
  },
  radiusLabel:      { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '600' },
  radiusChip: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  radiusChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radiusChipText:       { fontSize: FONTS.xs, color: COLORS.text, fontWeight: '600' },
  radiusChipTextActive: { color: '#FFFFFF' },

  // ── Cuisine Chips ─────────────────────────
  cuisineScroll:  { maxHeight: 56 },
  cuisineContent: {
    paddingHorizontal: SIZES.md,
    gap:               SIZES.sm,
    paddingVertical:   SIZES.sm,
    alignItems:        'center',
  },
  cuisineChip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    gap:               6,
    ...SHADOW,
  },
  cuisineChipActive: { backgroundColor: COLORS.primary },
  cuisineEmoji:      { fontSize: 16 },
  cuisineLabel:      { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  cuisineLabelActive:{ color: '#FFFFFF' },

  // ── Filter Chips ──────────────────────────
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
  filterChipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipSuccess: { backgroundColor: COLORS.success,  borderColor: COLORS.success  },
  filterChipText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Sort Row ──────────────────────────────
  sortRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    gap:               SIZES.sm,
    flexWrap:          'wrap',
  },
  sortLabel: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  sortChip: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  sortChipActive:   { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  sortChipDisabled: { opacity: 0.4 },
  sortChipText:         { fontSize: FONTS.xs, color: COLORS.text },
  sortChipTextActive:   { color: '#FFFFFF', fontWeight: '600' },
  sortChipTextDisabled: { color: COLORS.textMuted },
  resetChip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.error + '15',
    borderWidth:       1,
    borderColor:       COLORS.error + '40',
    gap:               4,
    marginLeft:        'auto',
  },
  resetChipText: { fontSize: FONTS.xs, color: COLORS.error, fontWeight: '600' },

  // ── Near Me Banner ────────────────────────
  nearbyBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    backgroundColor:   COLORS.primary + '10',
  },
  nearbyBannerText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '500',
  },

  // ── Results Row ───────────────────────────
  resultsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    gap:               SIZES.sm,
  },
  resultsText: {
    fontSize: FONTS.sm,
    color:    COLORS.textMuted,
  },
  activeFiltersBadge: {
    backgroundColor:   COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  activeFiltersBadgeText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
  },

  // ── List ──────────────────────────────────
  listContent: { padding: SIZES.md, gap: SIZES.md, flexGrow: 1 },
  card:        { marginBottom: 0 },

  // ── Empty State ───────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: SIZES.xxl,
    paddingHorizontal: SIZES.xl,
    gap:             SIZES.sm,
  },
  emptyEmoji:   { fontSize: 60 },
  emptyTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
    marginTop:  SIZES.md,
    textAlign:  'center',
  },
  emptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  emptyActionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
  },
  emptyActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: FONTS.sm },
});