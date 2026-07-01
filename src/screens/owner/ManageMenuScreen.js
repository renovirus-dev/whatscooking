// ============================================
// FILE: src/screens/owner/ManageMenuScreen.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db }               from '../../firebase/config';
import { useAuth }          from '../../hooks/useAuth';
import { getAutoFoodImage } from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const INFO_COLOR = COLORS.info || '#3498DB';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop';

export default function ManageMenuScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isMounted = useRef(true);

  const [restaurantId, setRestaurantId]         = useState(null);
  const [menuItems, setMenuItems]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [filter, setFilter]                     = useState('all');
  const [refreshingImages, setRefreshingImages] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Get restaurant ────────────────────────
  useEffect(() => {
    if (!user) return;
    let unsubscribe = null;
    try {
      const q = query(
        collection(db, 'restaurants'),
        where('ownerId', '==', user.uid)
      );
      unsubscribe = onSnapshot(q, (snap) => {
        if (!isMounted.current) return;
        if (!snap.empty) {
          setRestaurantId(snap.docs[0].id);
        } else {
          setRestaurantId(null);
          setLoading(false);
        }
      }, (err) => {
        if (!isMounted.current) return;
        console.error('Restaurant listener error:', err);
        setLoading(false);
      });
    } catch (err) {
      if (isMounted.current) setLoading(false);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  // ── Get menu items ────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    let unsubscribe = null;
    try {
      const q = query(
        collection(db, 'menuItems'),
        where('restaurantId', '==', restaurantId)
      );
      unsubscribe = onSnapshot(q, (snap) => {
        if (!isMounted.current) return;
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          if (a.category < b.category) return -1;
          if (a.category > b.category) return 1;
          return a.name?.localeCompare(b.name) || 0;
        });
        setMenuItems(items);
        setLoading(false);
      }, (err) => {
        if (!isMounted.current) return;
        console.error('Menu items listener error:', err);
        setLoading(false);
      });
    } catch (err) {
      if (isMounted.current) setLoading(false);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [restaurantId]);

  // ── Toggle availability ───────────────────
  const toggleAvailability = async (itemId, current) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !current,
        updatedAt:   serverTimestamp(),
      });
    } catch (err) {
      if (isMounted.current) Alert.alert('Error', 'Could not update item');
    }
  };

  // ── Delete item ───────────────────────────
  const handleDelete = (itemId, name) => {
    Alert.alert(
      'Delete Item',
      `Delete "${name}" from your menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'menuItems', itemId));
            } catch (err) {
              if (isMounted.current) {
                Alert.alert('Error', 'Could not delete item');
              }
            }
          },
        },
      ]
    );
  };

  // ✅ Refresh single item image
  const refreshSingleImage = async (menuItem) => {
    try {
      // ✅ Generate correct cuisine image for this dish
      // Random counter 0-4 picks a good photo from the pool
      const randomCounter = Math.floor(Math.random() * 5);
      const newAutoImage  = getAutoFoodImage(
        menuItem.name,
        menuItem.category,
        `${menuItem.name}-${menuItem.category}-${randomCounter}`
      );

      await updateDoc(doc(db, 'menuItems', menuItem.id), {
        autoImageUrl: newAutoImage,
        imageUrl:     newAutoImage,
        updatedAt:    serverTimestamp(),
      });
    } catch (err) {
      console.error('refreshSingleImage error:', err);
    }
  };

  // ✅ Refresh ALL item images
  const handleRefreshAllImages = () => {
    Alert.alert(
      '🔄 Refresh All Images',
      `Update photos for all ${menuItems.length} menu items?\n\n` +
      `Jamaican dishes will get Jamaican food photos, Italian dishes Italian photos, etc.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh All',
          onPress: async () => {
            if (isMounted.current) setRefreshingImages(true);
            try {
              await Promise.all(
                menuItems.map(item => refreshSingleImage(item))
              );
              if (isMounted.current) {
                Alert.alert(
                  '✅ Done!',
                  `Updated images for ${menuItems.length} menu items.\n\nJamaican dishes now show correct photos!`
                );
              }
            } catch (err) {
              console.error('refreshAllImages error:', err);
              if (isMounted.current) {
                Alert.alert('Error', 'Some images could not be updated');
              }
            } finally {
              if (isMounted.current) setRefreshingImages(false);
            }
          },
        },
      ]
    );
  };

  // ── Filter & group ────────────────────────
  const filteredItems = menuItems.filter(item => {
    if (filter === 'available')   return item.isAvailable;
    if (filter === 'unavailable') return !item.isAvailable;
    return true;
  });

  const grouped = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // ── No restaurant ─────────────────────────
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

  // ── Loading ───────────────────────────────
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

  // ── Main render ───────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Menu Items ({menuItems.length})
        </Text>
        <View style={styles.headerActions}>

          {/* ✅ Refresh images button */}
          {menuItems.length > 0 && (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshAllImages}
              disabled={refreshingImages}
              activeOpacity={0.8}
            >
              {refreshingImages ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="images-outline"
                  size={20}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>
          )}

          {/* Add item button */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() =>
              navigation.navigate('AddMenuItem', { restaurantId })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ✅ Refresh hint banner */}
      {menuItems.length > 0 && (
        <TouchableOpacity
          style={styles.refreshHint}
          onPress={handleRefreshAllImages}
          disabled={refreshingImages}
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={14} color={COLORS.primary} />
          <Text style={styles.refreshHintText}>
            {refreshingImages
              ? 'Updating cuisine photos...'
              : 'Tap to fix photos — Jamaican dishes get Jamaican food images'}
          </Text>
          {!refreshingImages && (
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      )}

      {/* ── Filter tabs ─────────────────────── */}
      <View style={styles.filterRow}>
        {[
          { key: 'all',         label: 'All'           },
          { key: 'available',   label: '✅ Available'   },
          { key: 'unavailable', label: '❌ Unavailable' },
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
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Empty state ─────────────────────── */}
      {filteredItems.length === 0 ? (
        <View style={[
          styles.centered,
          { paddingBottom: insets.bottom + SIZES.lg },
        ]}>
          <Text style={styles.centeredEmoji}>🍴</Text>
          <Text style={styles.centeredTitle}>
            {filter === 'all'
              ? 'No Menu Items Yet'
              : filter === 'available'
              ? 'No Available Items'
              : 'No Unavailable Items'}
          </Text>
          <Text style={styles.centeredText}>
            {filter === 'all'
              ? 'Tap "Add Item" to build your menu'
              : 'Change the filter above'}
          </Text>
          {filter === 'all' && (
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() =>
                navigation.navigate('AddMenuItem', { restaurantId })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.setupBtnText}>+ Add First Item</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* ── Menu list grouped by category ─── */
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([category]) => category}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + SIZES.xl },
          ]}
          renderItem={({ item: [category, items] }) => (
            <View style={styles.categoryGroup}>

              <Text style={styles.categoryHeader}>
                {category
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase())}
                {' '}({items.length})
              </Text>

              {items.map(menuItem => (
                <View
                  key={menuItem.id}
                  style={[
                    styles.itemCard,
                    !menuItem.isAvailable && styles.itemCardDim,
                  ]}
                >
                  <Image
                    source={{
                      uri: menuItem.imageUrl ||
                           menuItem.autoImageUrl ||
                           FALLBACK_IMAGE,
                    }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />

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

                  <View style={styles.itemActions}>
                    <Switch
                      value={!!menuItem.isAvailable}
                      onValueChange={() =>
                        toggleAvailability(menuItem.id, menuItem.isAvailable)
                      }
                      trackColor={{
                        false: '#E0E0E0',
                        true:  COLORS.success + '80',
                      }}
                      thumbColor={
                        menuItem.isAvailable ? COLORS.success : '#f4f3f4'
                      }
                    />

                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() =>
                        navigation.navigate('AddMenuItem', {
                          item: menuItem,
                          restaurantId,
                        })
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="pencil" size={16} color={INFO_COLOR} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        handleDelete(menuItem.id, menuItem.name)
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.background,
  },
  centeredEmoji: { fontSize: 60, marginBottom: SIZES.md },
  centeredTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  centeredText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    marginTop: SIZES.md,
  },
  setupBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    marginTop: SIZES.lg,
    ...SHADOW,
  },
  setupBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: FONTS.md,
  },

  // ── Header ──────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW,
  },
  headerTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },

  // ✅ Refresh icon button
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sm,
  },

  // ✅ Refresh hint banner
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    backgroundColor: COLORS.primary + '08',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  refreshHintText: {
    flex: 1,
    fontSize: FONTS.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // ── Filter row ───────────────────────────
  filterRow: {
    flexDirection: 'row',
    padding: SIZES.sm,
    gap: SIZES.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  filterTabText: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color:      '#FFFFFF',
    fontWeight: '600',
  },

  listContent: { padding: SIZES.md },
  categoryGroup: { marginBottom: SIZES.lg },
  categoryHeader: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    ...SHADOW,
  },
  itemCardDim: { opacity: 0.55 },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
  },
  itemInfo: {
    flex: 1,
    marginLeft: SIZES.md,
    gap: 2,
  },
  itemName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  itemDesc: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  dietaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  dietaryTag: {
    backgroundColor: COLORS.success + '15',
    borderRadius: RADIUS.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dietaryTagText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
  itemActions: {
    alignItems: 'center',
    gap: SIZES.sm,
    paddingLeft: SIZES.sm,
  },
  editBtn: {
    padding: SIZES.sm,
    backgroundColor: INFO_COLOR + '15',
    borderRadius: RADIUS.md,
  },
  deleteBtn: {
    padding: SIZES.sm,
    backgroundColor: COLORS.error + '15',
    borderRadius: RADIUS.md,
  },
});