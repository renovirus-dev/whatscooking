// ============================================
// FILE: src/screens/user/FavoritesScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback,
  useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, getDoc, updateDoc,
  arrayRemove, increment, serverTimestamp,
} from 'firebase/firestore';
import { db }         from '../../firebase/config';
import { useAuth }    from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard from '../../components/RestaurantCard';

// ─── Sort Options ─────────────────────────────
const SORT_OPTIONS = [
  { label: 'A-Z',        value: 'name'   },
  { label: '⭐ Rating',  value: 'rating' },
  { label: '🟢 Open',   value: 'open'   },
];

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function FavoritesScreen({ navigation }) {
  const insets            = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  // ── State ─────────────────────────────────
  const [favorites, setFavorites]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState('name');
  const [removing, setRemoving]     = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─────────────────────────────────────────
  // LOAD FAVORITES
  // ✅ Fetches all favorited restaurants
  // ✅ Handles deleted restaurants gracefully
  // ─────────────────────────────────────────
  const loadFavorites = useCallback(async () => {
    if (!user || !userProfile) {
      setLoading(false);
      return;
    }

    try {
      const ids = userProfile?.favoriteRestaurants || [];

      if (ids.length === 0) {
        if (isMounted.current) {
          setFavorites([]);
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      // ✅ Fetch all in parallel
      const docs = await Promise.all(
        ids.map(id => getDoc(doc(db, 'restaurants', id)))
      );

      // ✅ Filter out deleted restaurants
      const data = docs
        .filter(d => d.exists())
        .map(d => ({ id: d.id, ...d.data() }));

      if (isMounted.current) {
        setFavorites(data);
      }
    } catch (error) {
      console.error('Favorites error:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user, userProfile]);

  // ─────────────────────────────────────────
  // LOAD ON MOUNT + WHEN FAVORITES CHANGE
  // ✅ Re-loads when userProfile.favoriteRestaurants changes
  // So unfavoriting from RestaurantDetail updates this list
  // ─────────────────────────────────────────
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites, userProfile?.favoriteRestaurants?.length]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavorites();
  }, [loadFavorites]);

  // ─────────────────────────────────────────
  // UNFAVORITE FROM THIS SCREEN
  // ─────────────────────────────────────────
  const handleUnfavorite = useCallback((restaurant) => {
    Alert.alert(
      '💔 Remove Favorite',
      `Remove ${restaurant.name} from your favorites?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text:  'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(restaurant.id);

              // ✅ Remove from user's favorites array
              await updateDoc(doc(db, 'users', user.uid), {
                favoriteRestaurants: arrayRemove(restaurant.id),
                updatedAt:           serverTimestamp(),
              });

              // ✅ Decrement restaurant's totalFavorites
              await updateDoc(doc(db, 'restaurants', restaurant.id), {
                totalFavorites: increment(-1),
              });

              // ✅ Optimistic update - remove from local state
              if (isMounted.current) {
                setFavorites(prev =>
                  prev.filter(r => r.id !== restaurant.id)
                );
              }
            } catch (err) {
              console.error('Unfavorite error:', err);
              Alert.alert('Error', 'Could not remove favorite. Please try again.');
            } finally {
              if (isMounted.current) setRemoving(null);
            }
          },
        },
      ]
    );
  }, [user]);

  // ─────────────────────────────────────────
  // FILTERED + SORTED FAVORITES
  // ✅ Memoized
  // ─────────────────────────────────────────
  const displayedFavorites = useMemo(() => {
    let result = [...favorites];

    // ── Search ─────────────────────────────
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.location?.city?.toLowerCase().includes(q) ||
        r.cuisineTypes?.some(c => c.toLowerCase().includes(q))
      );
    }

    // ── Sort ───────────────────────────────
    switch (sortBy) {
      case 'name':
        result.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        break;
      case 'rating':
        result.sort((a, b) =>
          (b.averageRating || 0) - (a.averageRating || 0)
        );
        break;
      case 'open':
        result.sort((a, b) => {
          if (a.isCurrentlyOpen && !b.isCurrentlyOpen) return -1;
          if (!a.isCurrentlyOpen && b.isCurrentlyOpen) return 1;
          return (b.averageRating || 0) - (a.averageRating || 0);
        });
        break;
    }

    return result;
  }, [favorites, search, sortBy]);

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
        <Text style={styles.emoji}>❤️</Text>
        <Text style={styles.title}>Your Favorites</Text>
        <Text style={styles.subtitle}>
          Sign in to save your favorite restaurants
          and access them anytime
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          // ✅ Navigate to Profile tab which handles auth
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // EMPTY FAVORITES
  // ─────────────────────────────────────────
  if (favorites.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emoji}>🤍</Text>
        <Text style={styles.title}>No Favorites Yet</Text>
        <Text style={styles.subtitle}>
          Tap the ❤️ on any restaurant to save it here
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Explore')}
          activeOpacity={0.8}
        >
          <Ionicons name="compass-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Explore Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────── */}
      <View style={[
        styles.header,
        { paddingTop: insets.top + SIZES.sm },
      ]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>❤️ My Favorites</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{favorites.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Search Bar ──────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search favorites..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}
		  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
		  >
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Sort Options ────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.sortChip,
              sortBy === opt.value && styles.sortChipActive,
            ]}
            onPress={() => setSortBy(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sortChipText,
              sortBy === opt.value && styles.sortChipTextActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Result count */}
        {search.trim() && (
          <Text style={styles.resultCount}>
            {displayedFavorites.length} of {favorites.length}
          </Text>
        )}
      </View>

      {/* ── Search Empty State ─────────────── */}
      {search.trim() && displayedFavorites.length === 0 && (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>
            No favorites match "{search}"
          </Text>
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.searchEmptyClear}>Clear search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Favorites List ──────────────────── */}
      <FlatList
        data={displayedFavorites}
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
          <View style={styles.cardWrapper}>
            <RestaurantCard
              restaurant={item}
              horizontal
              style={styles.card}
              onPress={() =>
                navigation.navigate('RestaurantDetail', {
                  restaurantId: item.id,
                  name:         item.name,
                })
              }
            />
            {/* ✅ Unfavorite button */}
            <TouchableOpacity
              style={styles.unfavoriteBtn}
              onPress={() => handleUnfavorite(item)}
              disabled={removing === item.id}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              {removing === item.id ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="heart" size={20} color={COLORS.error} />
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
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: SIZES.xl,
    backgroundColor:   COLORS.background,
    gap:               SIZES.sm,
  },
  emoji:       { fontSize: 70 },
  title: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   FONTS.md,
    color:      COLORS.textLight,
    textAlign:  'center',
    lineHeight: 22,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },
  actionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    gap:               SIZES.sm,
    marginTop:         SIZES.md,
    ...SHADOW,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.lg },

  // ── Header ────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  headerTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    minWidth:        26,
    height:          26,
    borderRadius:    13,
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 4,
  },
  countText: { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: 'bold' },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    marginHorizontal:  SIZES.md,
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

  // ── Sort Row ──────────────────────────────
  sortRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.sm,
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
  sortChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortChipText:       { fontSize: FONTS.xs, color: COLORS.text },
  sortChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  resultCount:        { fontSize: FONTS.xs, color: COLORS.textMuted, marginLeft: 'auto' },

  // ── Search Empty ──────────────────────────
  searchEmpty: {
    alignItems:   'center',
    paddingVertical: SIZES.lg,
    gap:          SIZES.xs,
  },
  searchEmptyText:  { fontSize: FONTS.md, color: COLORS.textMuted },
  searchEmptyClear: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },

  // ── List ──────────────────────────────────
  listContent: { padding: SIZES.md },
  separator:   { height: SIZES.md },

  // ── Card Wrapper ──────────────────────────
  cardWrapper: {
    position: 'relative',
  },
  card: { marginBottom: 0 },

  // ── Unfavorite Button ─────────────────────
  unfavoriteBtn: {
    position:        'absolute',
    top:             SIZES.md,
    right:           SIZES.md,
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
});