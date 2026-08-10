// ============================================
// FILE: src/screens/user/FavoritesScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback,
  useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where,
  getDocs, doc, updateDoc,
  arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db }            from '../../firebase/config';
import { useAuth }       from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard    from '../../components/RestaurantCard';

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function FavoritesScreen({ navigation }) {
  const insets                = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  // ── State ─────────────────────────────────
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [removing, setRemoving]       = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─────────────────────────────────────────
  // FETCH SAVED RESTAURANTS
  // ✅ Chunks queries (Firestore 'in' limit = 30)
  // ✅ Preserves saved order
  // ─────────────────────────────────────────
  const fetchFavRestaurants = useCallback(async () => {
    const ids = userProfile?.favoriteRestaurants || [];

    if (ids.length === 0) {
      if (isMounted.current) {
        setRestaurants([]);
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    try {
      // ✅ Chunk into groups of 30 (Firestore limit)
      const chunks = [];
      for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
      }

      const allRestaurants = [];
      for (const chunk of chunks) {
        const q    = query(
          collection(db, 'restaurants'),
          where('__name__', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d =>
          allRestaurants.push({ id: d.id, ...d.data() })
        );
      }

      // ✅ Sort by original saved order
      allRestaurants.sort((a, b) =>
        ids.indexOf(a.id) - ids.indexOf(b.id)
      );

      if (isMounted.current) {
        setRestaurants(allRestaurants);
      }
    } catch (err) {
      console.error('FavoritesScreen fetch error:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userProfile?.favoriteRestaurants]);

  // ─────────────────────────────────────────
  // LOAD ON MOUNT + WHEN FAVORITES CHANGE
  // ─────────────────────────────────────────
  useEffect(() => {
    fetchFavRestaurants();
  }, [fetchFavRestaurants, userProfile?.favoriteRestaurants?.length]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavRestaurants();
  }, [fetchFavRestaurants]);

  // ─────────────────────────────────────────
  // REMOVE FROM FAVOURITES
  // ✅ Optimistic update — removes instantly
  // ✅ Reverts on failure
  // ─────────────────────────────────────────
  const handleUnfavorite = useCallback((restaurant) => {
    Alert.alert(
      '💔 Remove Restaurant',
      `Remove "${restaurant.name}" from your saved restaurants?`,
      [
        { text: 'Keep',   style: 'cancel' },
        {
          text:  'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(restaurant.id);

              // ✅ Optimistic UI update — remove from list instantly
              if (isMounted.current) {
                setRestaurants(prev =>
                  prev.filter(r => r.id !== restaurant.id)
                );
              }

              // ✅ Write to Firestore
              await updateDoc(doc(db, 'users', user.uid), {
                favoriteRestaurants: arrayRemove(restaurant.id),
                updatedAt:           serverTimestamp(),
              });

            } catch (err) {
              console.error('Unfavourite restaurant error:', err);

              // ✅ Revert on failure
              if (isMounted.current) {
                await fetchFavRestaurants();
                Alert.alert('Error', 'Could not remove restaurant. Please try again.');
              }
            } finally {
              if (isMounted.current) setRemoving(null);
            }
          },
        },
      ]
    );
  }, [user, fetchFavRestaurants]);

  // ─────────────────────────────────────────
  // SEARCH FILTER
  // ─────────────────────────────────────────
  const displayedRestaurants = useMemo(() => {
    if (!search.trim()) return restaurants;
    const q = search.toLowerCase();
    return restaurants.filter(r =>
      r.name?.toLowerCase().includes(q)          ||
      r.location?.city?.toLowerCase().includes(q)||
      r.cuisineTypes?.some(c => c.toLowerCase().includes(q))
    );
  }, [restaurants, search]);

  // ─────────────────────────────────────────
  // NOT LOGGED IN
  // ─────────────────────────────────────────
  if (!user) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emptyEmoji}>🍽️</Text>
        <Text style={styles.emptyTitle}>Saved Restaurants</Text>
        <Text style={styles.emptySubtext}>
          Sign in to save your favourite restaurants and access them anytime
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
          <Text style={styles.browseBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={styles.loadingText}>Loading saved restaurants...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────
  if (restaurants.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emptyEmoji}>🍽️</Text>
        <Text style={styles.emptyTitle}>No Saved Restaurants</Text>
        <Text style={styles.emptySubtext}>
          Tap the ❤️ on any restaurant to save it here
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
          <Text style={styles.browseBtnText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={displayedRestaurants}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
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
        ListHeaderComponent={
          <>
            {/* ── Search Bar ──────────────── */}
            <View style={styles.searchBar}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search saved restaurants..."
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* ── Count ───────────────────── */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {displayedRestaurants.length}
                {search ? ` of ${restaurants.length}` : ''}{' '}
                restaurant{restaurants.length !== 1 ? 's' : ''} saved
              </Text>
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Search Empty ────────────── */}
            {displayedRestaurants.length === 0 && (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyEmoji}>🔍</Text>
                <Text style={styles.searchEmptyText}>
                  No restaurants match your search
                </Text>
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.searchEmptyClear}>Clear search</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }

        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            {/* Restaurant Card */}
            <RestaurantCard
              restaurant={item}
              onPress={() =>
                navigation.navigate('RestaurantDetail', {
                  restaurantId: item.id,
                })
              }
              horizontal
            />

            {/* ✅ Remove from favourites button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleUnfavorite(item)}
              disabled={removing === item.id}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              {removing === item.id ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons
                  name="heart-dislike"
                  size={18}
                  color={COLORS.error}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Centered States ───────────────────────
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         SIZES.xl,
    backgroundColor: COLORS.background,
    gap:             SIZES.sm,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },
  emptyEmoji:  { fontSize: 60 },
  emptyTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  emptySubtext: {
    fontSize:   FONTS.md,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 22,
  },
  browseBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.md,
    ...SHADOW,
  },
  browseBtnText: { color: '#FFFFFF', fontSize: FONTS.lg, fontWeight: 'bold' },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    marginBottom:      SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.lg,
    borderWidth:       1,
    borderColor:       COLORS.border,
    gap:               SIZES.sm,
  },
  searchInput: {
    flex:     1,
    fontSize: FONTS.md,
    color:    COLORS.text,
    padding:  0,
  },

  // ── Count Row ─────────────────────────────
  countRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SIZES.sm,
  },
  countText: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '500' },
  clearText: { fontSize: FONTS.sm, color: COLORS.primary,   fontWeight: '600' },

  // ── Search Empty ──────────────────────────
  searchEmpty: {
    alignItems:      'center',
    paddingVertical: SIZES.xl,
    gap:             SIZES.sm,
  },
  searchEmptyEmoji: { fontSize: 40 },
  searchEmptyText:  { fontSize: FONTS.md, color: COLORS.textMuted },
  searchEmptyClear: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },

  // ── List ──────────────────────────────────
  list: { padding: SIZES.md, backgroundColor: COLORS.background },

  // ── Card Wrapper ──────────────────────────
  cardWrapper: { position: 'relative' },

  // ── Remove Button ─────────────────────────
  // ✅ Top-right corner of each restaurant card
  removeBtn: {
    position:        'absolute',
    top:             SIZES.sm,
    right:           SIZES.sm,
    backgroundColor: '#FFFFFF',
    width:           36,
    height:          36,
    borderRadius:    18,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          10,
    elevation:       10,
    ...SHADOW,
  },

  // ── Separator ─────────────────────────────
  separator: { height: SIZES.sm },
});