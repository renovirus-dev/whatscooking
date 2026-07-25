// ============================================
// FILE: src/screens/user/FavoriteDishesScreen.js
// ============================================
import React, {
  useState, useEffect, useCallback,
  useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
  RefreshControl, TextInput, ScrollView,
  Alert,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where,
  getDocs, doc, updateDoc,
  arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db }         from '../../firebase/config';
import { useAuth }    from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import MenuItemCard   from '../../components/MenuItemCard';

// ─── Sort Options ─────────────────────────────
const SORT_OPTIONS = [
  { label: 'Saved Order', value: 'saved'    },
  { label: 'A-Z',         value: 'name'     },
  { label: '💰 Price ↑',  value: 'price_asc' },
  { label: '💰 Price ↓',  value: 'price_desc'},
];

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function FavoriteDishesScreen({ navigation }) {
  const insets            = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  // ── State ─────────────────────────────────
  const [dishes, setDishes]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('saved');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [removing, setRemoving]   = useState(null);

  const isMounted   = useRef(true);
  const savedIds    = useRef([]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─────────────────────────────────────────
  // FETCH FAVORITE DISHES
  // ✅ Chunks queries (Firestore 'in' limit = 30)
  // ✅ Preserves saved order
  // ✅ Handles deleted items gracefully
  // ─────────────────────────────────────────
  const fetchFavDishes = useCallback(async () => {
    const ids = userProfile?.favoriteDishes || [];
    savedIds.current = ids;

    if (ids.length === 0) {
      if (isMounted.current) {
        setDishes([]);
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

      const allDishes = [];
      for (const chunk of chunks) {
        const q    = query(
          collection(db, 'menuItems'),
          where('__name__', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d =>
          allDishes.push({ id: d.id, ...d.data() })
        );
      }

      // ✅ Sort by original saved order
      allDishes.sort((a, b) =>
        ids.indexOf(a.id) - ids.indexOf(b.id)
      );

      if (isMounted.current) {
        setDishes(allDishes);
      }
    } catch (err) {
      console.error('FavoriteDishes fetch error:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userProfile?.favoriteDishes]);

  // ─────────────────────────────────────────
  // LOAD ON MOUNT + WHEN FAVORITES CHANGE
  // ─────────────────────────────────────────
  useEffect(() => {
    fetchFavDishes();
  }, [fetchFavDishes, userProfile?.favoriteDishes?.length]);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavDishes();
  }, [fetchFavDishes]);

  // ─────────────────────────────────────────
  // UNFAVORITE DISH
  // ─────────────────────────────────────────
  const handleUnfavorite = useCallback((dish) => {
    Alert.alert(
      '💔 Remove Dish',
      `Remove "${dish.name}" from your favorites?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text:  'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(dish.id);

              // ✅ Remove from user's favoriteDishes array
              await updateDoc(doc(db, 'users', user.uid), {
                favoriteDishes: arrayRemove(dish.id),
                updatedAt:      serverTimestamp(),
              });

              // ✅ Optimistic update
              if (isMounted.current) {
                setDishes(prev => prev.filter(d => d.id !== dish.id));
              }
            } catch (err) {
              console.error('Unfavorite dish error:', err);
              Alert.alert('Error', 'Could not remove dish. Please try again.');
            } finally {
              if (isMounted.current) setRemoving(null);
            }
          },
        },
      ]
    );
  }, [user]);

  // ─────────────────────────────────────────
  // CATEGORIES FROM DISHES
  // ─────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(
      dishes.map(d => d.category).filter(Boolean)
    )];
    return cats;
  }, [dishes]);

  // ─────────────────────────────────────────
  // FILTERED + SORTED DISHES
  // ✅ Memoized
  // ─────────────────────────────────────────
  const displayedDishes = useMemo(() => {
    let result = [...dishes];

    // ── Category filter ────────────────────
    if (selectedCategory !== 'all') {
      result = result.filter(d => d.category === selectedCategory);
    }

    // ── Search filter ──────────────────────
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name?.toLowerCase().includes(q)        ||
        d.description?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
      );
    }

    // ── Sort ───────────────────────────────
    switch (sortBy) {
      case 'name':
        result.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        break;
      case 'price_asc':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'saved':
      default:
        // Already in saved order from fetch
        break;
    }

    return result;
  }, [dishes, selectedCategory, search, sortBy]);

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
        <Text style={styles.emptyTitle}>Favourite Dishes</Text>
        <Text style={styles.emptySubtext}>
          Sign in to save your favorite dishes and
          access them anytime
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
        <Text style={styles.loadingText}>Loading your dishes...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────
  if (dishes.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emptyEmoji}>🍽️</Text>
        <Text style={styles.emptyTitle}>No Favourite Dishes</Text>
        <Text style={styles.emptySubtext}>
          Tap the ❤️ on any menu item to save it here
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
        data={displayedDishes}
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
            {/* ── Search Bar ────────────────── */}
            <View style={styles.searchBar}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search dishes..."
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* ── Category Filter ───────────── */}
            {categories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    selectedCategory === 'all' && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === 'all' && styles.categoryChipTextActive,
                  ]}>
                    All ({dishes.length})
                  </Text>
                </TouchableOpacity>

                {categories.map(cat => {
                  const count = dishes.filter(d => d.category === cat).length;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        selectedCategory === cat && styles.categoryChipTextActive,
                      ]}>
                        {cat.replace(/_/g, ' ')} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Sort Row ──────────────────── */}
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
            </View>

            {/* ── Count ─────────────────────── */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {displayedDishes.length}
                {search || selectedCategory !== 'all'
                  ? ` of ${dishes.length}`
                  : ''}{' '}
                dish{dishes.length !== 1 ? 'es' : ''}
              </Text>
              {(search || selectedCategory !== 'all') && (
                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setSelectedCategory('all');
                  }}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Search Empty ──────────────── */}
            {displayedDishes.length === 0 && (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyEmoji}>🔍</Text>
                <Text style={styles.searchEmptyText}>
                  No dishes match your search
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setSelectedCategory('all');
                  }}
                >
                  <Text style={styles.searchEmptyClear}>
                    Clear filters
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }

        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <MenuItemCard
              item={item}
              onLoginRequired={() => navigation.navigate('Profile')}
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
                <Ionicons name="heart" size={18} color={COLORS.error} />
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
    padding:           SIZES.xl,
    backgroundColor:   COLORS.background,
    gap:               SIZES.sm,
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

  // ── Category Filter ───────────────────────
  categoryRow: {
    gap:           SIZES.sm,
    paddingBottom: SIZES.sm,
    alignItems:    'center',
  },
  categoryChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  categoryChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText:       { fontSize: FONTS.xs, color: COLORS.text, fontWeight: '500', textTransform: 'capitalize' },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // ── Sort Row ──────────────────────────────
  sortRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginBottom:  SIZES.sm,
    flexWrap:      'wrap',
  },
  sortLabel:        { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
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

  // ── Count Row ─────────────────────────────
  countRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SIZES.sm,
  },
  countText: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '500' },
  clearText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },

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

  // ── Unfavorite Button ─────────────────────
  unfavoriteBtn: {
    position:        'absolute',
    top:             SIZES.sm,
    right:           SIZES.sm,
    backgroundColor: '#FFFFFF',
    width:           32,
    height:          32,
    borderRadius:    16,
    justifyContent:  'center',
    alignItems:      'center',
    ...SHADOW,
    elevation:       4,
  },

  // ── Separator ─────────────────────────────
  separator: { height: SIZES.sm },
});