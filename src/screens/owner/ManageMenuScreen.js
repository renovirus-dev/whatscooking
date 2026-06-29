// ============================================
// FILE: src/screens/owner/ManageMenuScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
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
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function ManageMenuScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [restaurantId, setRestaurantId] = useState(null);
  const [menuItems, setMenuItems]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');

  // ── Step 1: Get owner's restaurant ───────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setRestaurantId(snap.docs[0].id);
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, [user]);

  // ── Step 2: Get menu items ────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      items.sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return a.name?.localeCompare(b.name);
      });
      setMenuItems(items);
      setLoading(false);
    });
    return unsub;
  }, [restaurantId]);

  // ── Toggle availability ───────────────────
  const toggleAvailability = async (itemId, current) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !current,
        updatedAt:   serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Error', 'Could not update item');
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
            } catch (error) {
              Alert.alert('Error', 'Could not delete item');
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
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
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
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
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
          // ✅ Bottom inset so button clears nav bar
          { paddingBottom: insets.bottom + SIZES.lg },
        ]}>
          <Text style={styles.centeredEmoji}>🍴</Text>
          <Text style={styles.centeredTitle}>No Menu Items Yet</Text>
          <Text style={styles.centeredText}>
            Tap "Add Item" to build your menu
          </Text>
          <TouchableOpacity
            style={styles.setupBtn}
            onPress={() =>
              navigation.navigate('AddMenuItem', { restaurantId })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.setupBtnText}>+ Add First Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Menu list grouped by category ─── */
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([category]) => category}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            // ✅ Last card clears Android nav bar
            { paddingBottom: insets.bottom + SIZES.xl },
          ]}
          renderItem={({ item: [category, items] }) => (
            <View style={styles.categoryGroup}>

              {/* Category header */}
              <Text style={styles.categoryHeader}>
                {category
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase())}
                {' '}({items.length})
              </Text>

              {/* Items in category */}
              {items.map(menuItem => (
                <View
                  key={menuItem.id}
                  style={[
                    styles.itemCard,
                    !menuItem.isAvailable && styles.itemCardDim,
                  ]}
                >
                  {/* Food image */}
                  <Image
                    source={{
                      uri: menuItem.imageUrl ||
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100',
                    }}
                    style={styles.itemImage}
                  />

                  {/* Item info */}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {menuItem.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      ${menuItem.price?.toFixed(2)}
                    </Text>
                    {menuItem.description ? (
                      <Text
                        style={styles.itemDesc}
                        numberOfLines={1}
                      >
                        {menuItem.description}
                      </Text>
                    ) : null}

                    {/* ✅ Dietary tags inline */}
                    {menuItem.dietaryInfo && (
                      <View style={styles.dietaryRow}>
                        {menuItem.dietaryInfo.isVegetarian && (
                          <View style={styles.dietaryTag}>
                            <Text style={styles.dietaryTagText}>
                              🥬 Veg
                            </Text>
                          </View>
                        )}
                        {menuItem.dietaryInfo.isVegan && (
                          <View style={styles.dietaryTag}>
                            <Text style={styles.dietaryTagText}>
                              🌱 Vegan
                            </Text>
                          </View>
                        )}
                        {menuItem.dietaryInfo.isHalal && (
                          <View style={styles.dietaryTag}>
                            <Text style={styles.dietaryTagText}>
                              ☪️ Halal
                            </Text>
                          </View>
                        )}
                        {menuItem.dietaryInfo.isSpicy && (
                          <View style={styles.dietaryTag}>
                            <Text style={styles.dietaryTagText}>
                              🌶️ Spicy
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Actions column */}
                  <View style={styles.itemActions}>
                    {/* Available toggle */}
                    <Switch
                      value={!!menuItem.isAvailable}
                      onValueChange={() =>
                        toggleAvailability(
                          menuItem.id,
                          menuItem.isAvailable
                        )
                      }
                      trackColor={{
                        false: '#E0E0E0',
                        true:  COLORS.success + '80',
                      }}
                      thumbColor={
                        menuItem.isAvailable
                          ? COLORS.success
                          : '#f4f3f4'
                      }
                    />

                    {/* Edit */}
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
                      <Ionicons
                        name="pencil"
                        size={16}
                        color={COLORS.info}
                      />
                    </TouchableOpacity>

                    {/* Delete */}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        handleDelete(menuItem.id, menuItem.name)
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name="trash"
                        size={16}
                        color={COLORS.error}
                      />
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

  // ── Centered states ──────────────────────
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.background,
  },
  centeredEmoji: {
    fontSize: 60,
    marginBottom: SIZES.md,
  },
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

  // ── List ────────────────────────────────
  listContent: {
    padding: SIZES.md,
    // ✅ paddingBottom set dynamically via insets
  },

  // ── Category group ───────────────────────
  categoryGroup: {
    marginBottom: SIZES.lg,
  },
  categoryHeader: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },

  // ── Item card ────────────────────────────
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    ...SHADOW,
  },
  itemCardDim: {
    opacity: 0.55,
  },
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

  // ── Dietary tags ─────────────────────────
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

  // ── Item actions ─────────────────────────
  itemActions: {
    alignItems: 'center',
    gap: SIZES.sm,
    paddingLeft: SIZES.sm,
  },
  editBtn: {
    padding: SIZES.sm,
    backgroundColor: COLORS.info + '15',
    borderRadius: RADIUS.md,
  },
  deleteBtn: {
    padding: SIZES.sm,
    backgroundColor: COLORS.error + '15',
    borderRadius: RADIUS.md,
  },
});