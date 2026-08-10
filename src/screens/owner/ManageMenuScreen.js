// ============================================
// FILE: src/screens/owner/ManageMenuScreen.js
// ============================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where,
  onSnapshot, doc, updateDoc,
  deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db }      from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { getImageSource }  from '../../utils/localFoodImages';
import { getThumbUrl }     from '../../utils/uploadToCloudinary';

const INFO_COLOR = COLORS.info || '#3498DB';

// ─── Category display names ───────────────────
const CATEGORY_LABELS = {
  appetizer:   '🥗 Appetizers',
  soup:        '🍲 Soups',
  salad:       '🥙 Salads',
  main_course: '🍽️ Main Course',
  side_dish:   '🍟 Side Dishes',
  dessert:     '🧁 Desserts',
  beverage:    '🥤 Beverages',
  breakfast:   '🍳 Breakfast',
  combo_meal:  '🎁 Combo Meals',
  snack:       '🍿 Snacks',
  other:       '🍴 Other',
};

// ─── Get image source ─────────────────────────
// ✅ Updated to handle Cloudinary URLs with optimization
const getMenuItemImage = (item) => {
  // ✅ Cloudinary URL → use thumb transform
  if (item?.cloudinaryUrl) {
    return { uri: getThumbUrl(item.cloudinaryUrl, 128, 128) };
  }
  // ✅ Legacy Firebase URL
  if (item?.imageUrl && item.imageUrl.startsWith('http')) {
    return { uri: item.imageUrl };
  }
  // ✅ Local auto image fallback
  return getImageSource(item);
};

export default function ManageMenuScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const isMounted = useRef(true);

  // ── State ─────────────────────────────────
  const [restaurantId, setRestaurantId] = useState(null);
  const [menuItems, setMenuItems]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [sortBy, setSortBy]             = useState('category');
  // 'category' | 'name' | 'price_asc' | 'price_desc'

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENERS
  // ✅ Merged into one effect chain
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Step 1: Get restaurant
    const restaurantQ = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );

    const unsubRestaurant = onSnapshot(
      restaurantQ,
      (snap) => {
        if (!isMounted.current) return;
        if (!snap.empty) {
          setRestaurantId(snap.docs[0].id);
        } else {
          setRestaurantId(null);
          setLoading(false);
        }
      },
      (err) => {
        if (!isMounted.current) return;
        console.error('Restaurant listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubRestaurant();
  }, [user]);

  useEffect(() => {
    if (!restaurantId) return;

    // Step 2: Get menu items
    const menuQ = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );

    const unsubMenu = onSnapshot(
      menuQ,
      (snap) => {
        if (!isMounted.current) return;
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMenuItems(items);
        setLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;
        console.error('Menu items listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubMenu();
  }, [restaurantId]);

  // ─────────────────────────────────────────
  // FILTERED + SORTED + SEARCHED ITEMS
  // ✅ All in one useMemo
  // ─────────────────────────────────────────
  const processedItems = useMemo(() => {
    let items = [...menuItems];

    // ── Filter ─────────────────────────────
    if (filter === 'available')   items = items.filter(i => i.isAvailable);
    if (filter === 'unavailable') items = items.filter(i => !i.isAvailable);
    if (filter === 'special')     items = items.filter(i => i.isSpecialOfTheDay);

    // ── Search ─────────────────────────────
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.name?.toLowerCase().includes(q)        ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }

    // ── Sort ───────────────────────────────
    items.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'category':
        default: {
          const catCompare = (a.category || '').localeCompare(b.category || '');
          if (catCompare !== 0) return catCompare;
          return (a.name || '').localeCompare(b.name || '');
        }
      }
    });

    return items;
  }, [menuItems, filter, searchQuery, sortBy]);

  // ─────────────────────────────────────────
  // GROUP BY CATEGORY
  // ─────────────────────────────────────────
  const groupedItems = useMemo(() => {
    if (sortBy !== 'category') return null; // flat list for other sorts
    return processedItems.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [processedItems, sortBy]);

  // ─────────────────────────────────────────
  // TOGGLE AVAILABILITY
  // ─────────────────────────────────────────
  const toggleAvailability = useCallback(async (itemId, current) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !current,
        updatedAt:   serverTimestamp(),
      });
    } catch (err) {
      if (isMounted.current) {
        Alert.alert('Error', 'Could not update item availability');
      }
    }
  }, []);

  // ─────────────────────────────────────────
  // TOGGLE SPECIAL OF THE DAY
  // ─────────────────────────────────────────
  const toggleSpecial = useCallback(async (itemId, current) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isSpecialOfTheDay: !current,
        updatedAt:         serverTimestamp(),
      });
    } catch (err) {
      if (isMounted.current) {
        Alert.alert('Error', 'Could not update special status');
      }
    }
  }, []);

  // ─────────────────────────────────────────
  // DELETE ITEM
  // ─────────────────────────────────────────
  const handleDelete = useCallback((item) => {
    Alert.alert(
      '🗑️ Delete Item',
      `Delete "${item.name}" from your menu?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'menuItems', item.id));
              // ✅ Note: Cloudinary image stays until manually deleted
              // publicId is saved as item.cloudinaryPublicId
            } catch (err) {
              if (isMounted.current) {
                Alert.alert('Error', 'Could not delete item');
              }
            }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────
  // RENDER MENU ITEM CARD
  // ─────────────────────────────────────────
  const renderMenuItem = useCallback((menuItem) => (
    <View
      key={menuItem.id}
      style={[
        styles.itemCard,
        !menuItem.isAvailable && styles.itemCardDim,
        menuItem.isSpecialOfTheDay && styles.itemCardSpecial,
      ]}
    >
      {/* ✅ Image with Cloudinary optimization */}
      <Image
        source={getMenuItemImage(menuItem)}
        style={styles.itemImage}
        resizeMode="cover"
      />

      {/* Special badge */}
      {menuItem.isSpecialOfTheDay && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>⭐ Special</Text>
        </View>
      )}

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {menuItem.name}
        </Text>
        <Text style={styles.itemPrice}>
          ${menuItem.price?.toFixed(2)}
        </Text>
        {menuItem.description ? (
          <Text style={styles.itemDesc} numberOfLines={1}>
            {menuItem.description}
          </Text>
        ) : null}

        {/* Dietary tags */}
        {menuItem.dietaryInfo && (
          <View style={styles.dietaryRow}>
            {menuItem.dietaryInfo.isVegetarian && (
              <View style={styles.dietaryTag}>
                <Text style={styles.dietaryTagText}>🥬 Veg</Text>
              </View>
            )}
            {menuItem.dietaryInfo.isVegan && (
              <View style={styles.dietaryTag}>
                <Text style={styles.dietaryTagText}>🌱 Vegan</Text>
              </View>
            )}
            {menuItem.dietaryInfo.isHalal && (
              <View style={styles.dietaryTag}>
                <Text style={styles.dietaryTagText}>☪️ Halal</Text>
              </View>
            )}
            {menuItem.dietaryInfo.isSpicy && (
              <View style={styles.dietaryTag}>
                <Text style={styles.dietaryTagText}>🌶️ Spicy</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.itemActions}>
        {/* Available toggle */}
        <Switch
          value={!!menuItem.isAvailable}
          onValueChange={() =>
            toggleAvailability(menuItem.id, menuItem.isAvailable)
          }
          trackColor={{
            false: '#E0E0E0',
            true:  COLORS.success + '80',
          }}
          thumbColor={menuItem.isAvailable ? COLORS.success : '#f4f3f4'}
        />

        {/* Special toggle */}
        <TouchableOpacity
          style={[
            styles.specialBtn,
            menuItem.isSpecialOfTheDay && styles.specialBtnActive,
          ]}
          onPress={() => toggleSpecial(menuItem.id, menuItem.isSpecialOfTheDay)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={menuItem.isSpecialOfTheDay ? 'star' : 'star-outline'}
            size={16}
            color={menuItem.isSpecialOfTheDay ? '#FFD700' : COLORS.textMuted}
          />
        </TouchableOpacity>

        {/* Edit */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('AddMenuItem', {
            item: menuItem,
            restaurantId,
          })}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="pencil-outline" size={16} color={INFO_COLOR} />
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(menuItem)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  ), [restaurantId, toggleAvailability, toggleSpecial, handleDelete, navigation]);

  // ─────────────────────────────────────────
  // NO RESTAURANT STATE
  // ─────────────────────────────────────────
  if (!loading && !restaurantId) {
    return (
      <View style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Text style={styles.centeredEmoji}>🍽️</Text>
        <Text style={styles.centeredTitle}>No Restaurant Found</Text>
        <Text style={styles.centeredText}>
          Set up your restaurant profile first
        </Text>
        <TouchableOpacity
          style={styles.setupBtn}
          onPress={() => navigation.navigate('RestaurantSetup')}
          activeOpacity={0.8}
        >
          <Text style={styles.setupBtnText}>Setup Restaurant</Text>
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
        <Text style={styles.loadingText}>Loading menu...</Text>
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>My Menu</Text>
            <Text style={styles.headerSubtitle}>
              {menuItems.length} item{menuItems.length !== 1 ? 's' : ''}
              {' · '}
              {menuItems.filter(i => i.isAvailable).length} available
            </Text>
          </View>

          <View style={styles.headerActions}>
            {/* ✅ Scan Menu Button */}
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => navigation.navigate('MenuScanner', {
                restaurantId,
              })}
              activeOpacity={0.8}
            >
              <Ionicons name="scan-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Add Item Button */}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddMenuItem', { restaurantId })}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}
			hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
			>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter + Sort Row ────────────────── */}
      <View style={styles.controlsRow}>
        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { key: 'all',         label: 'All',        count: menuItems.length                              },
            { key: 'available',   label: '✅ On',       count: menuItems.filter(i => i.isAvailable).length  },
            { key: 'unavailable', label: '❌ Off',      count: menuItems.filter(i => !i.isAvailable).length },
            { key: 'special',     label: '⭐ Specials', count: menuItems.filter(i => i.isSpecialOfTheDay).length },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterTab,
                filter === f.key && styles.filterTabActive,
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[
                styles.filterTabText,
                filter === f.key && styles.filterTabTextActive,
              ]}>
                {f.label} ({f.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort button */}
        <TouchableOpacity
          style={styles.sortBtn}
		  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => {
            Alert.alert(
              'Sort By',
              '',
              [
                { text: 'Category',    onPress: () => setSortBy('category')   },
                { text: 'Name A-Z',    onPress: () => setSortBy('name')        },
                { text: 'Price ↑',     onPress: () => setSortBy('price_asc')  },
                { text: 'Price ↓',     onPress: () => setSortBy('price_desc') },
                { text: 'Cancel', style: 'cancel'                              },
              ]
            );
          }}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Results Count ───────────────────── */}
      {(searchQuery || filter !== 'all') && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {processedItems.length} result{processedItems.length !== 1 ? 's' : ''}
            {searchQuery ? ` for "${searchQuery}"` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => { setSearchQuery(''); setFilter('all'); }}
			hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Empty State ──────────────────────── */}
      {processedItems.length === 0 ? (
        <View style={[
          styles.centered,
          { paddingBottom: insets.bottom + SIZES.lg },
        ]}>
          <Text style={styles.centeredEmoji}>
            {searchQuery ? '🔍' : '🍴'}
          </Text>
          <Text style={styles.centeredTitle}>
            {searchQuery
              ? 'No items match your search'
              : filter === 'all'
              ? 'No Menu Items Yet'
              : filter === 'available'
              ? 'No Available Items'
              : filter === 'special'
              ? 'No Specials Today'
              : 'No Unavailable Items'}
          </Text>
          <Text style={styles.centeredText}>
            {searchQuery
              ? 'Try a different search term'
              : filter === 'all'
              ? 'Add items manually or scan your menu'
              : 'Change the filter above'}
          </Text>
          {filter === 'all' && !searchQuery && (
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.setupBtn}
                onPress={() => navigation.navigate('AddMenuItem', { restaurantId })}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.setupBtnText}>Add First Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scanEmptyBtn}
                onPress={() => navigation.navigate('MenuScanner', { restaurantId })}
                activeOpacity={0.8}
              >
                <Ionicons name="scan-outline" size={18} color={COLORS.primary} />
                <Text style={styles.scanEmptyBtnText}>Scan Menu Page</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* ── Menu List ──────────────────────── */
        <FlatList
          data={
            groupedItems
              ? Object.entries(groupedItems)
              : [['_flat', processedItems]]
          }
          keyExtractor={([category]) => category}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + SIZES.xl },
          ]}
          renderItem={({ item: [category, items] }) => (
            <View style={styles.categoryGroup}>
              {/* Category Header (only in grouped mode) */}
              {groupedItems && (
                <View style={styles.categoryHeaderRow}>
                  <Text style={styles.categoryHeader}>
                    {CATEGORY_LABELS[category] || category
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                  <Text style={styles.categoryCount}>
                    {items.length}
                  </Text>
                </View>
              )}

              {items.map(menuItem => renderMenuItem(menuItem))}
            </View>
          )}
        />
      )}
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
  centeredEmoji: { fontSize: 60 },
  centeredTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  centeredText: {
    fontSize:  FONTS.md,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
  loadingText: {
    fontSize:  FONTS.md,
    color:     COLORS.textMuted,
    marginTop: SIZES.md,
  },

  // ── Setup / Empty Buttons ─────────────────
  setupBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.md,
    ...SHADOW,
  },
  setupBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },
  emptyActions: { gap: SIZES.sm, marginTop: SIZES.md, alignItems: 'center' },
  scanEmptyBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary + '10',
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    borderWidth:       1.5,
    borderColor:       COLORS.primary + '30',
  },
  scanEmptyBtnText: {
    color:      COLORS.primary,
    fontWeight: 'bold',
    fontSize:   FONTS.md,
  },

  // ── Header ────────────────────────────────
  header: {
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap:               SIZES.sm,
    ...SHADOW,
  },
  headerTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  headerTitle: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  headerSubtitle: {
    fontSize:  FONTS.sm,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  scanBtn: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.primary + '30',
  },
  addBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.md,
    gap:               4,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: FONTS.sm },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
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

  // ── Controls Row ──────────────────────────
  controlsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingRight:      SIZES.sm,
  },
  filterScroll: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   SIZES.sm,
    gap:               SIZES.sm,
    alignItems:        'center',
  },
  filterTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  filterTabText:       { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },
  filterTabTextActive: { color: '#FFFFFF', fontWeight: '600'                             },
  sortBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primary + '10',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.primary + '20',
    marginLeft:      SIZES.xs,
  },

  // ── Results Bar ───────────────────────────
  resultsBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    backgroundColor:   COLORS.primary + '08',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  resultsText:      { fontSize: FONTS.xs, color: COLORS.textMuted },
  clearFiltersText: { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '600' },

  // ── List ──────────────────────────────────
  listContent:   { padding: SIZES.md },
  categoryGroup: { marginBottom: SIZES.lg },
  categoryHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SIZES.sm,
    paddingBottom:  6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  categoryHeader: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  categoryCount: {
    fontSize:          FONTS.xs,
    color:             COLORS.primary,
    fontWeight:        '700',
    backgroundColor:   COLORS.primary + '15',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },

  // ── Item Card ─────────────────────────────
  itemCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    marginBottom:    SIZES.sm,
    ...SHADOW,
  },
  itemCardDim:     { opacity: 0.5 },
  itemCardSpecial: {
    borderWidth: 1.5,
    borderColor: '#FFD700' + '60',
    backgroundColor: '#FFD700' + '05',
  },
  itemImage: {
    width:        64,
    height:       64,
    borderRadius: RADIUS.md,
  },

  // ── Special Badge ─────────────────────────
  specialBadge: {
    position:          'absolute',
    top:               SIZES.sm,
    left:              SIZES.sm,
    backgroundColor:   '#FFD700',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
	zIndex:            5,
	elevation:         5,
  },
  specialBadgeText: {
    fontSize:   9,
    fontWeight: 'bold',
    color:      '#333',
  },

  // ── Item Info ─────────────────────────────
  itemInfo: {
    flex:       1,
    marginLeft: SIZES.md,
    gap:        2,
  },
  itemName:  { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text   },
  itemPrice: { fontSize: FONTS.md, fontWeight: 'bold', color: COLORS.primary },
  itemDesc:  { fontSize: FONTS.xs, color: COLORS.textMuted                  },
  dietaryRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    marginTop:     4,
  },
  dietaryTag: {
    backgroundColor:   COLORS.success + '15',
    borderRadius:      RADIUS.round,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  dietaryTagText: {
    fontSize:   10,
    color:      COLORS.success,
    fontWeight: '600',
  },

  // ── Item Actions ──────────────────────────
  itemActions: {
    alignItems: 'center',
    gap:        SIZES.sm,
    paddingLeft: SIZES.sm,
  },
  specialBtn: {
    padding:         SIZES.sm,
    backgroundColor: COLORS.border,
    borderRadius:    RADIUS.md,
  },
  specialBtnActive: {
    backgroundColor: '#FFD700' + '20',
  },
  editBtn: {
    padding:         SIZES.sm,
    backgroundColor: INFO_COLOR + '15',
    borderRadius:    RADIUS.md,
  },
  deleteBtn: {
    padding:         SIZES.sm,
    backgroundColor: COLORS.error + '15',
    borderRadius:    RADIUS.md,
  },
});