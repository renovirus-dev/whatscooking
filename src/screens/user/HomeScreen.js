// ============================================
// FILE: src/screens/user/HomeScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, RefreshControl,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, limit, onSnapshot,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db }         from '../../firebase/config';
import { useAuth }    from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard from '../../components/RestaurantCard';

// ─── Constants ───────────────────────────────
const CUISINES = [
  { label: 'Jamaican',   emoji: '🇯🇲', value: 'jamaican'    },
  { label: 'Caribbean',  emoji: '🌴', value: 'caribbean'   },
  { label: 'American',   emoji: '🍔', value: 'american'    },
  { label: 'Chinese',    emoji: '🥡', value: 'chinese'     },
  { label: 'Italian',    emoji: '🍕', value: 'italian'     },
  { label: 'Indian',     emoji: '🍛', value: 'indian'      },
  { label: 'Seafood',    emoji: '🦐', value: 'seafood'     },
  { label: 'BBQ',        emoji: '🍖', value: 'bbq'         },
  { label: 'Dessert',    emoji: '🧁', value: 'bakery'      },
  { label: 'Vegetarian', emoji: '🥗', value: 'vegetarian'  },
];

const RADIUS_OPTIONS = [
  { label: '2km',  value: 2  },
  { label: '5km',  value: 5  },
  { label: '10km', value: 10 },
  { label: '20km', value: 20 },
  { label: '50km', value: 50 },
];

// ─── Distance Helpers ─────────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
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
export default function HomeScreen({ navigation }) {
  const insets            = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  // ── Data State ────────────────────────────
  const [restaurants, setRestaurants]         = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);

  // ── Filter State ──────────────────────────
  const [search, setSearch]                   = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [openNowFilter, setOpenNowFilter]     = useState(false);

  // ── Location State ────────────────────────
  const [nearbyActive, setNearbyActive]       = useState(false);
  const [userCoords, setUserCoords]           = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedRadius, setSelectedRadius]   = useState(10);

  // ── Geocoded cache ────────────────────────
  // ✅ Only geocode restaurants that don't have coords
  const [geocodedMap, setGeocodedMap]         = useState({});
  const [geocoding, setGeocoding]             = useState(false);
  const geocodingRef                          = useRef(false);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENER
  // ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

        setRestaurants(data);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('HomeScreen query error:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────
  // GEOCODE MISSING COORDS
  // ✅ Only geocodes restaurants without coords
  // ✅ Uses a map cache to avoid re-geocoding
  // ✅ Won't run again if already geocoding
  // ─────────────────────────────────────────
  useEffect(() => {
    if (restaurants.length === 0 || geocodingRef.current) return;

    // Find restaurants without coords not already in cache
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
  // GET COORDS FOR RESTAURANT
  // ─────────────────────────────────────────
  const getRestaurantCoords = useCallback((restaurant) => {
    if (restaurant.coords?.latitude) return restaurant.coords;
    return geocodedMap[restaurant.id] || null;
  }, [geocodedMap]);

  // ─────────────────────────────────────────
  // GET DISTANCE
  // ─────────────────────────────────────────
  const getDistance = useCallback((restaurant) => {
    if (!userCoords) return null;
    const coords = getRestaurantCoords(restaurant);
    if (!coords) return null;
    return calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      coords.latitude,
      coords.longitude,
    );
  }, [userCoords, getRestaurantCoords]);

  // ─────────────────────────────────────────
  // NEAR ME TOGGLE
  // ✅ Guests can now use Near Me too
  // ─────────────────────────────────────────
  const handleNearbyToggle = useCallback(async () => {
    if (nearbyActive) {
      setNearbyActive(false);
      setUserCoords(null);
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
        setLocationLoading(false);
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
    } catch (err) {
      console.error('Location error:', err.message);
      Alert.alert(
        'Location Error',
        'Could not get your location. Please try again.'
      );
    } finally {
      setLocationLoading(false);
    }
  }, [nearbyActive]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ✅ Firestore listener updates automatically
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Firestore onSnapshot will update and call setRefreshing(false)
    // Safety timeout in case listener doesn't fire
    setTimeout(() => setRefreshing(false), 3000);
  }, []);

  // ─────────────────────────────────────────
  // FILTERED RESTAURANTS
  // ✅ Memoized - only recalculates when deps change
  // ─────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.map(r => ({
      ...r,
      distance: getDistance(r),
    }));

    // ── Near Me filter ──────────────────────
    if (nearbyActive && userCoords) {
      result = result.filter(
        r => r.distance !== null && r.distance <= selectedRadius
      );
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    // ── Open Now filter ────────────────────
    if (openNowFilter) {
      result = result.filter(r => r.isCurrentlyOpen);
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
    if (selectedCuisine) {
      result = result.filter(r =>
        r.cuisineTypes?.includes(selectedCuisine)
      );
    }

    return result;
  }, [
    restaurants, nearbyActive, userCoords, selectedRadius,
    openNowFilter, search, selectedCuisine, getDistance,
  ]);

  // ─────────────────────────────────────────
  // FEATURED RESTAURANTS
  // ✅ Memoized
  // ─────────────────────────────────────────
  const featuredRestaurants = useMemo(() => {
    let result = restaurants
      .filter(r => r.subscription?.plan !== 'free_trial')
      .map(r => ({ ...r, distance: getDistance(r) }));

    if (nearbyActive && userCoords) {
      result = result
        .filter(r => r.distance !== null && r.distance <= selectedRadius)
        .sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    return result.slice(0, 5);
  }, [restaurants, nearbyActive, userCoords, selectedRadius, getDistance]);

  // ─────────────────────────────────────────
  // CUISINE COUNTS
  // ✅ Shows how many restaurants per cuisine
  // ─────────────────────────────────────────
  const cuisineCounts = useMemo(() => {
    const counts = {};
    restaurants.forEach(r => {
      r.cuisineTypes?.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return counts;
  }, [restaurants]);

  // ── Stats ──────────────────────────────────
  const openCount = useMemo(() =>
    restaurants.filter(r => r.isCurrentlyOpen).length,
  [restaurants]);

  // ── Navigation ────────────────────────────
  const handleRestaurantPress = useCallback((restaurant) => {
    navigation.navigate('RestaurantDetail', {
      restaurantId: restaurant.id,
      name:         restaurant.name,
    });
  }, [navigation]);

  const handleCuisinePress = useCallback((value) => {
    setSelectedCuisine(prev => prev === value ? null : value);
  }, []);

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.loadingContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding restaurants...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  const showFeatured = featuredRestaurants.length > 0 &&
                       !search && !selectedCuisine;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 56}
    >
      <ScrollView
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
        {/* ── Greeting ──────────────────────── */}
        <View style={[styles.greeting, { paddingTop: insets.top + SIZES.md }]}>
          <Text style={styles.greetingText}>
            Hello, {userProfile?.firstName || 'Food Lover'} 👋
          </Text>
          <Text style={styles.greetingSubtext}>
            What are you craving today?
          </Text>
        </View>

        {/* ── Search Bar ────────────────────── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants, cuisines or city..."
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

          {/* Near Me Button */}
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

        {/* ── Quick Filters ─────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFilters}
        >
          {/* Open Now */}
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              openNowFilter && styles.quickFilterChipActive,
            ]}
            onPress={() => setOpenNowFilter(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.quickFilterDot,
              { backgroundColor: openNowFilter ? '#FFFFFF' : COLORS.success },
            ]} />
            <Text style={[
              styles.quickFilterText,
              openNowFilter && styles.quickFilterTextActive,
            ]}>
              Open Now ({openCount})
            </Text>
          </TouchableOpacity>

          {/* Top Rated */}
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              search === '__top_rated__' && styles.quickFilterChipActive,
            ]}
            onPress={() => {
              // Sort by rating - already done by default
              setSearch('');
              setSelectedCuisine(null);
              setOpenNowFilter(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickFilterText}>⭐ Top Rated</Text>
          </TouchableOpacity>

          {/* Has Delivery */}
          <TouchableOpacity
            style={styles.quickFilterChip}
            onPress={() => {
              // Navigate to explore with filter
              navigation.navigate('Explore', { filter: 'delivery' });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickFilterText}>🛵 Delivery</Text>
          </TouchableOpacity>

          {/* Dine In */}
          <TouchableOpacity
            style={styles.quickFilterChip}
            onPress={() =>
              navigation.navigate('Explore', { filter: 'dineIn' })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.quickFilterText}>🪑 Dine In</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Radius Selector (Near Me only) ── */}
        {nearbyActive && (
          <View style={styles.radiusSection}>
            <View style={styles.radiusHeader}>
              <Ionicons
                name="radio-button-on-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.radiusLabel}>Search Radius:</Text>
              {geocoding && (
                <View style={styles.geocodingBadge}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.geocodingText}>
                    Finding locations...
                  </Text>
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.radiusRow}
              nestedScrollEnabled
            >
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

              <TouchableOpacity
                style={styles.nearbyOffChip}
                onPress={() => {
                  setNearbyActive(false);
                  setUserCoords(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-outline" size={12} color={COLORS.error} />
                <Text style={styles.nearbyOffText}>Off</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.nearbyBanner}>
              <Ionicons
                name="navigate-outline"
                size={13}
                color={COLORS.primary}
              />
              <Text style={styles.nearbyBannerText}>
                Showing restaurants within {selectedRadius}km
                {filteredRestaurants.length > 0
                  ? ` · ${filteredRestaurants.length} found`
                  : ''}
              </Text>
            </View>
          </View>
        )}

        {/* ── Cuisine Filter ────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse Cuisines</Text>
            {selectedCuisine && (
              <TouchableOpacity onPress={() => setSelectedCuisine(null)}>
                <Text style={styles.clearFilter}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            horizontal
            data={CUISINES}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: SIZES.md }}
            keyExtractor={item => item.value}
            nestedScrollEnabled
            renderItem={({ item }) => {
              const active = selectedCuisine === item.value;
              const count  = cuisineCounts[item.value] || 0;
              return (
                <TouchableOpacity
                  style={styles.cuisineItem}
                  onPress={() => handleCuisinePress(item.value)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.cuisineEmoji,
                    active && styles.cuisineEmojiActive,
                  ]}>
                    <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                    {/* ✅ Count badge */}
                    {count > 0 && (
                      <View style={[
                        styles.cuisineCountBadge,
                        active && { backgroundColor: COLORS.primary },
                      ]}>
                        <Text style={styles.cuisineCountText}>{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.cuisineLabel,
                    active && styles.cuisineLabelActive,
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ── Guest Sign-In Prompt ──────────── */}
        {!user && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={COLORS.primary}
            />
            <Text style={styles.guestBannerText}>
              Sign in to save favorites & leave reviews
            </Text>
            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}

        {/* ── Featured Restaurants ──────────── */}
        {showFeatured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {nearbyActive ? '📍 Featured Nearby' : '⭐ Featured'}
            </Text>
            <FlatList
              horizontal
              data={featuredRestaurants}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: SIZES.md }}
              keyExtractor={item => item.id}
              nestedScrollEnabled
              renderItem={({ item }) => (
                <RestaurantCard
                  restaurant={item}
                  style={{ width: 260, marginRight: SIZES.md }}
                  distance={
                    nearbyActive ? formatDistance(item.distance) : null
                  }
                  onPress={() => handleRestaurantPress(item)}
                />
              )}
            />
          </View>
        )}

        {/* ── All / Filtered Restaurants ────── */}
        <View style={styles.section}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {nearbyActive
                ? `📍 Nearby (${selectedRadius}km)`
                : search
                ? `Results for "${search}"`
                : selectedCuisine
                ? `${CUISINES.find(c => c.value === selectedCuisine)?.emoji} ${
                    CUISINES.find(c => c.value === selectedCuisine)?.label
                  }`
                : openNowFilter
                ? '🟢 Open Now'
                : '🍽️ All Restaurants'}
            </Text>
            {filteredRestaurants.length > 0 && (
              <Text style={styles.resultCount}>
                {filteredRestaurants.length}
              </Text>
            )}
          </View>

          {/* Active Filters Summary */}
          {(search || selectedCuisine || openNowFilter || nearbyActive) && (
            <TouchableOpacity
              style={styles.clearAllFilters}
              onPress={() => {
                setSearch('');
                setSelectedCuisine(null);
                setOpenNowFilter(false);
                setNearbyActive(false);
                setUserCoords(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.clearAllFiltersText}>
                Clear all filters
              </Text>
            </TouchableOpacity>
          )}

          {/* Restaurant List */}
          {filteredRestaurants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>
                {nearbyActive ? '📍' : search ? '🔍' : '🍽️'}
              </Text>
              <Text style={styles.emptyTitle}>
                {nearbyActive
                  ? `No restaurants within ${selectedRadius}km`
                  : search
                  ? 'No results found'
                  : openNowFilter
                  ? 'No restaurants open right now'
                  : 'No restaurants yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {nearbyActive
                  ? 'Try increasing the search radius'
                  : search
                  ? 'Try a different search term'
                  : openNowFilter
                  ? 'Check back later or remove the filter'
                  : 'Check back soon!'}
              </Text>

              {/* Action Buttons */}
              <View style={styles.emptyActions}>
                {nearbyActive && (
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() =>
                      setSelectedRadius(prev => Math.min(prev + 10, 50))
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="expand-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.emptyActionBtnText}>
                      Increase Radius
                    </Text>
                  </TouchableOpacity>
                )}
                {(search || selectedCuisine || openNowFilter) && (
                  <TouchableOpacity
                    style={[
                      styles.emptyActionBtn,
                      { backgroundColor: COLORS.secondary },
                    ]}
                    onPress={() => {
                      setSearch('');
                      setSelectedCuisine(null);
                      setOpenNowFilter(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.emptyActionBtnText}>
                      Clear Filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            filteredRestaurants.map(restaurant => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                style={{
                  marginHorizontal: SIZES.md,
                  marginBottom:     SIZES.md,
                }}
                horizontal
                distance={
                  nearbyActive
                    ? formatDistance(restaurant.distance)
                    : null
                }
                onPress={() => handleRestaurantPress(restaurant)}
              />
            ))
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Loading ───────────────────────────────
  loadingContainer: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    gap:             SIZES.md,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Greeting ──────────────────────────────
  greeting: {
    paddingHorizontal: SIZES.lg,
    paddingBottom:     SIZES.sm,
    gap:               4,
  },
  greetingText: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  greetingSubtext: {
    fontSize: FONTS.lg,
    color:    COLORS.textLight,
  },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    margin:            SIZES.md,
    marginTop:         SIZES.sm,
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

  // ── Near Me Button ────────────────────────
  nearMeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.primary + '15',
    borderWidth:       1.5,
    borderColor:       COLORS.primary,
  },
  nearMeBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  nearMeText:       { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '700' },
  nearMeTextActive: { color: '#FFFFFF' },

  // ── Quick Filters ─────────────────────────
  quickFilters: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    gap:               SIZES.sm,
    alignItems:        'center',
  },
  quickFilterChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: SIZES.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  quickFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  quickFilterDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  quickFilterText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600' },
  quickFilterTextActive: { color: '#FFFFFF' },

  // ── Radius Section ────────────────────────
  radiusSection: {
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.sm,
    backgroundColor:  COLORS.primary + '08',
    borderRadius:     RADIUS.lg,
    padding:          SIZES.sm,
    borderWidth:      1,
    borderColor:      COLORS.primary + '20',
  },
  radiusHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
    marginBottom:  SIZES.xs,
  },
  radiusLabel: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  radiusRow: {
    flexDirection: 'row',
    gap:           SIZES.xs,
    paddingVertical: SIZES.xs,
  },
  radiusChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   5,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  radiusChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radiusChipText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600' },
  radiusChipTextActive: { color: '#FFFFFF' },
  nearbyOffChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   5,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.error + '12',
    borderWidth:       1,
    borderColor:       COLORS.error + '40',
  },
  nearbyOffText: { fontSize: FONTS.xs, color: COLORS.error, fontWeight: '700' },
  geocodingBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginLeft:    'auto',
  },
  geocodingText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '500',
  },
  nearbyBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SIZES.xs,
    marginTop:      SIZES.xs,
    paddingTop:     SIZES.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '15',
  },
  nearbyBannerText: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '500',
  },

  // ── Sections ──────────────────────────────
  section:       { marginBottom: SIZES.lg },
  sectionHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    marginBottom:      SIZES.md,
  },
  sectionTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  clearFilter: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  resultCount: {
    fontSize:          FONTS.sm,
    color:             COLORS.textMuted,
    backgroundColor:   COLORS.border,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    fontWeight:        '600',
  },
  clearAllFilters: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SIZES.xs,
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.sm,
    padding:          SIZES.sm,
    backgroundColor:  COLORS.error + '08',
    borderRadius:     RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.error + '20',
  },
  clearAllFiltersText: {
    fontSize:   FONTS.sm,
    color:      COLORS.error,
    fontWeight: '600',
  },

  // ── Cuisine ───────────────────────────────
  cuisineItem:  { alignItems: 'center', marginRight: SIZES.lg },
  cuisineEmoji: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: COLORS.surface,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     'transparent',
    position:        'relative',
    ...SHADOW,
  },
  cuisineEmojiActive: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  cuisineCountBadge: {
    position:          'absolute',
    top:               -4,
    right:             -4,
    backgroundColor:   COLORS.primary + '30',
    borderRadius:      8,
    minWidth:          16,
    height:            16,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 3,
  },
  cuisineCountText: {
    fontSize:   8,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },
  cuisineLabel:       { fontSize: FONTS.sm, color: COLORS.text, marginTop: SIZES.xs, fontWeight: '500' },
  cuisineLabelActive: { color: COLORS.primary, fontWeight: '700' },

  // ── Banners ───────────────────────────────
  guestBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.primary + '12',
    marginHorizontal: SIZES.md,
    marginBottom:     SIZES.md,
    padding:          SIZES.md,
    borderRadius:     RADIUS.lg,
    borderWidth:      1,
    borderColor:      COLORS.primary + '30',
    gap:              SIZES.sm,
  },
  guestBannerText: {
    flex:       1,
    color:      COLORS.primary,
    fontWeight: '600',
    fontSize:   FONTS.sm,
  },

  // ── Empty State ───────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: SIZES.xxl,
    paddingHorizontal: SIZES.xl,
    gap:             SIZES.sm,
  },
  emptyTitle:   { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  emptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  emptyActionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
  },
  emptyActionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: FONTS.sm },
});