// ============================================
// FILE: src/screens/user/HomeScreen.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, RefreshControl,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where,
  limit, onSnapshot,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard from '../../components/RestaurantCard';

// ─── Constants ───────────────────────────────
const CUISINES = [
  { label: 'Caribbean', emoji: '🌴', value: 'caribbean' },
  { label: 'American',  emoji: '🍔', value: 'american'  },
  { label: 'Chinese',   emoji: '🥡', value: 'chinese'   },
  { label: 'Italian',   emoji: '🍕', value: 'italian'   },
  { label: 'Indian',    emoji: '🍛', value: 'indian'    },
  { label: 'Seafood',   emoji: '🦐', value: 'seafood'   },
  { label: 'BBQ',       emoji: '🍖', value: 'bbq'       },
  { label: 'Dessert',   emoji: '🧁', value: 'bakery'    },
];

const RADIUS_OPTIONS = [
  { label: '2km',  value: 2  },
  { label: '5km',  value: 5  },
  { label: '10km', value: 10 },
  { label: '20km', value: 20 },
  { label: '50km', value: 50 },
];

// ─── Distance Helpers ────────────────────────
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

const formatDistance = (km) => {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
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

// ─── Component ───────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [restaurants, setRestaurants]   = useState([]);
  const [featured, setFeatured]         = useState([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState(null);

  // ✅ NEW: Location state
  const [nearbyActive, setNearbyActive]       = useState(false);
  const [userCoords, setUserCoords]           = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedRadius, setSelectedRadius]   = useState(10);
  const [geocodedRestaurants, setGeocodedRestaurants] = useState([]);
  const [geocoding, setGeocoding]             = useState(false);

  // ─── Firestore listener ──────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      where('isActive', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));

        data.sort((a, b) =>
          (b.averageRating || 0) - (a.averageRating || 0)
        );

        setRestaurants(data);

        setFeatured(
          data
            .filter(r => r.subscription?.plan !== 'free_trial')
            .slice(0, 5)
        );

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

  // ✅ NEW: Geocode restaurants when list updates
  useEffect(() => {
    if (restaurants.length === 0) return;

    const geocodeAll = async () => {
      setGeocoding(true);
      const withCoords = await Promise.all(
        restaurants.map(async (r) => {
          // Use stored coords if available
          if (r.coords?.latitude && r.coords?.longitude) {
            return { ...r };
          }

          // Geocode from address
          const address = [
            r.address,
            r.location?.address,
            r.location?.city || r.city,
            r.location?.country || r.country,
          ]
            .filter(Boolean)
            .join(', ');

          const coords = await geocodeAddress(address);
          return { ...r, coords: coords || null };
        })
      );
      setGeocodedRestaurants(withCoords);
      setGeocoding(false);
    };

    geocodeAll();
  }, [restaurants]);

  // ✅ NEW: Handle Near Me toggle
  const handleNearbyToggle = async () => {
    // If already active — turn off
    if (nearbyActive) {
      setNearbyActive(false);
      setUserCoords(null);
      return;
    }

    // Must be logged in
    if (!user) {
      Alert.alert(
        '📍 Sign In Required',
        'Please sign in to use the "Near Me" feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Profile'),
          },
        ]
      );
      return;
    }

    setLocationLoading(true);

    try {
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

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserCoords({
        latitude:  location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setNearbyActive(true);

    } catch (err) {
      Alert.alert(
        'Location Error',
        'Could not get your location. Please try again.'
      );
      console.error('Location error:', err.message);
    }

    setLocationLoading(false);
  };

  // ✅ NEW: Add distance to restaurants
  const addDistances = useCallback((list) => {
    if (!userCoords) return list;

    return list.map(r => ({
      ...r,
      distance: calculateDistance(
        userCoords.latitude,
        userCoords.longitude,
        r.coords?.latitude,
        r.coords?.longitude,
      ),
    }));
  }, [userCoords]);

  // ─── Filter logic (updated) ──────────────
  const getFilteredRestaurants = useCallback(() => {
    // Use geocoded list when nearby is active
    let source = nearbyActive && geocodedRestaurants.length > 0
      ? geocodedRestaurants
      : restaurants;

    // Add distances if user location available
    let result = addDistances(source);

    // Filter by radius when nearby active
    if (nearbyActive && userCoords) {
      result = result.filter(
        r => r.distance !== null && r.distance <= selectedRadius
      );
      // Sort by nearest
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    // Search filter
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(lower) ||
        r.location?.city?.toLowerCase().includes(lower)
      );
    }

    // Cuisine filter
    if (selectedCuisine) {
      result = result.filter(r =>
        r.cuisineTypes?.includes(selectedCuisine)
      );
    }

    return result;
  }, [
    restaurants, geocodedRestaurants, search,
    selectedCuisine, nearbyActive, userCoords,
    selectedRadius, addDistances,
  ]);

  const filteredRestaurants = getFilteredRestaurants();

  // ✅ NEW: Nearby featured restaurants
  const getNearbyFeatured = useCallback(() => {
    if (!nearbyActive || !userCoords) return featured;

    const withDist = addDistances(
      geocodedRestaurants.length > 0 ? geocodedRestaurants : featured
    );

    return withDist
      .filter(r =>
        r.subscription?.plan !== 'free_trial' &&
        r.distance !== null &&
        r.distance <= selectedRadius
      )
      .sort((a, b) => (a.distance || 999) - (b.distance || 999))
      .slice(0, 5);
  }, [
    nearbyActive, userCoords, featured,
    geocodedRestaurants, selectedRadius, addDistances,
  ]);

  const displayFeatured = getNearbyFeatured();

  const openCount = restaurants.filter(r => r.isCurrentlyOpen).length;

  // ─── Handlers ────────────────────────────
  const handleRefresh = () => setRefreshing(true);

  const handleRestaurantPress = (restaurant) => {
    navigation.navigate('RestaurantDetail', {
      restaurantId: restaurant.id,
      name: restaurant.name,
    });
  };

  const handleCuisinePress = (value) => {
    setSelectedCuisine(prev => prev === value ? null : value);
  };

  // ─── Loading state ────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          Finding restaurants...
        </Text>
      </View>
    );
  }

  // ─── Render ──────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* ── Greeting ───────────────────────── */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          Hello,{' '}
          {userProfile?.firstName || 'Food Lover'} 👋
        </Text>
        <Text style={styles.greetingSubtext}>
          What are you craving today?
        </Text>
      </View>

      {/* ── Search Bar + Near Me ───────────── */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.textMuted}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants or city..."
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
              color={nearbyActive ? '#FFFFFF' : COLORS.primary}
            />
          ) : (
            <>
              <Ionicons
                name="navigate"
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

      {/* ✅ NEW: Radius selector — only shows when nearby active */}
      {nearbyActive && (
        <View style={styles.radiusSection}>
          <View style={styles.radiusHeader}>
            <Ionicons
              name="radio-button-on"
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.radiusLabel}>
              Search Radius:
            </Text>

            {/* Geocoding indicator */}
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
                  selectedRadius === opt.value &&
                    styles.radiusChipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Turn off nearby */}
            <TouchableOpacity
              style={styles.nearbyOffChip}
              onPress={() => {
                setNearbyActive(false);
                setUserCoords(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close"
                size={12}
                color={COLORS.error}
              />
              <Text style={styles.nearbyOffText}>Off</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Nearby status banner */}
          <View style={styles.nearbyBanner}>
            <Ionicons
              name="navigate"
              size={13}
              color={COLORS.primary}
            />
            <Text style={styles.nearbyBannerText}>
              📍 Showing restaurants within {selectedRadius}km
              {filteredRestaurants.length > 0 &&
                ` — ${filteredRestaurants.length} found`}
            </Text>
          </View>
        </View>
      )}

      {/* ── Cuisine Filter ─────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse Cuisines</Text>
        <FlatList
          horizontal
          data={CUISINES}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: SIZES.md }}
          keyExtractor={item => item.value}
          renderItem={({ item }) => {
            const active = selectedCuisine === item.value;
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

      {/* ── Open Now Banner ────────────────── */}
      {openCount > 0 && (
        <View style={styles.openNowBanner}>
          <Ionicons
            name="time"
            size={20}
            color={COLORS.textWhite}
          />
          <Text style={styles.openNowText}>
            {openCount} restaurant
            {openCount !== 1 ? 's' : ''} open right now
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textWhite}
          />
        </View>
      )}

      {/* ── Sign in prompt for guests ──────── */}
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
            name="chevron-forward"
            size={18}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      )}

      {/* ── Featured Restaurants ───────────── */}
      {displayFeatured.length > 0 && !search && !selectedCuisine && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {nearbyActive ? '📍 Featured Nearby' : '⭐ Featured'}
          </Text>
          <FlatList
            horizontal
            data={displayFeatured}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: SIZES.md }}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <RestaurantCard
                restaurant={item}
                style={{ width: 260, marginRight: SIZES.md }}
                distance={
                  nearbyActive
                    ? formatDistance(item.distance)
                    : null
                }
                onPress={() => handleRestaurantPress(item)}
              />
            )}
          />
        </View>
      )}

      {/* ── All / Nearby Restaurants ──────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {nearbyActive
            ? `📍 Nearby (${selectedRadius}km)`
            : search
            ? `Results for "${search}"`
            : selectedCuisine
            ? `${CUISINES.find(c => c.value === selectedCuisine)
                ?.emoji} ${CUISINES.find(
                  c => c.value === selectedCuisine
                )?.label}`
            : '🍽️ All Restaurants'}
        </Text>

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
                : 'No restaurants yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {nearbyActive
                ? 'Try increasing the radius above'
                : search
                ? 'Try searching for something else'
                : 'Check back soon!'}
            </Text>

            {nearbyActive && (
              <TouchableOpacity
                style={styles.increaseRadiusBtn}
                onPress={() =>
                  setSelectedRadius(prev =>
                    Math.min(prev + 10, 50)
                  )
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name="expand"
                  size={16}
                  color={COLORS.textWhite}
                />
                <Text style={styles.increaseRadiusBtnText}>
                  Increase Radius
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredRestaurants.map(restaurant => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              style={{
                marginHorizontal: SIZES.md,
                marginBottom: SIZES.md,
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

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SIZES.md,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
  },

  // Greeting
  greeting: {
    padding: SIZES.lg,
    paddingBottom: SIZES.sm,
    paddingTop: SIZES.xl,
  },
  greetingText: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  greetingSubtext: {
    fontSize: FONTS.lg,
    color: COLORS.textLight,
    marginTop: 4,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    marginTop: SIZES.sm,
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
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  nearMeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  nearMeText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  nearMeTextActive: {
    color: '#FFFFFF',
  },

  // ✅ NEW: Radius section
  radiusSection: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.lg,
    padding: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.xs,
  },
  radiusLabel: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: SIZES.xs,
    paddingVertical: SIZES.xs,
  },
  radiusChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radiusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  radiusChipText: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#FFFFFF',
  },
  nearbyOffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  nearbyOffText: {
    fontSize: FONTS.xs,
    color: COLORS.error,
    fontWeight: '700',
  },

  // ✅ NEW: Geocoding indicator
  geocodingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  geocodingText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // ✅ NEW: Nearby banner
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginTop: SIZES.xs,
    paddingTop: SIZES.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '15',
  },
  nearbyBannerText: {
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // ✅ NEW: Increase radius button
  increaseRadiusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round,
    marginTop: SIZES.md,
  },
  increaseRadiusBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONTS.sm,
  },

  // Sections
  section: {
    marginBottom: SIZES.lg,
  },
  sectionTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.md,
  },

  // Cuisine chips
  cuisineItem: {
    alignItems: 'center',
    marginRight: SIZES.lg,
  },
  cuisineEmoji: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW,
  },
  cuisineEmojiActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  cuisineLabel: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    marginTop: SIZES.xs,
    fontWeight: '500',
  },
  cuisineLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Banners
  openNowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    marginHorizontal: SIZES.md,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  openNowText: {
    flex: 1,
    color: COLORS.textWhite,
    fontWeight: '600',
    fontSize: FONTS.md,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    gap: SIZES.sm,
  },
  guestBannerText: {
    flex: 1,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONTS.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    gap: SIZES.sm,
  },
  emptyTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});