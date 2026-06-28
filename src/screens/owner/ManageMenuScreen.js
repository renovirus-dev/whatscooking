// ============================================
// FILE: src/screens/owner/ManageMenuScreen.js
// CREATE THIS FILE
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function ManageMenuScreen({ navigation }) {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Step 1: Get owner's restaurant
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

  // Step 2: Get menu items when restaurantId is ready
  useEffect(() => {
    if (!restaurantId) return;

    const q = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );

    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort by category then name
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

  // Toggle item availability
  const toggleAvailability = async (itemId, current) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), {
        isAvailable: !current,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      Alert.alert('Error', 'Could not update item');
    }
  };

  // Delete item
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
          }
        }
      ]
    );
  };

  // Filter items
  const filteredItems = menuItems.filter(item => {
    if (filter === 'available') return item.isAvailable;
    if (filter === 'unavailable') return !item.isAvailable;
    return true;
  });

  // Group by category
  const grouped = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // No restaurant yet
  if (!loading && !restaurantId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredEmoji}>🍽️</Text>
        <Text style={styles.centeredTitle}>
          No Restaurant Found
        </Text>
        <Text style={styles.centeredText}>
          Set up your restaurant profile first
        </Text>
        <TouchableOpacity
          style={styles.setupBtn}
          onPress={() => navigation.navigate('RestaurantSetup')}
        >
          <Text style={styles.setupBtnText}>
            Setup Restaurant
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Menu Items ({menuItems.length})
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddMenuItem', {
            restaurantId
          })}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: '✅ Available' },
          { key: 'unavailable', label: '❌ Unavailable' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && styles.filterTabActive
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[
              styles.filterTabText,
              filter === f.key && styles.filterTabTextActive
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>
            Loading menu...
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        // Empty State
        <View style={styles.centered}>
          <Text style={styles.centeredEmoji}>🍴</Text>
          <Text style={styles.centeredTitle}>
            No Menu Items Yet
          </Text>
          <Text style={styles.centeredText}>
            Tap "Add Item" to build your menu
          </Text>
          <TouchableOpacity
            style={styles.setupBtn}
            onPress={() => navigation.navigate('AddMenuItem', {
              restaurantId
            })}
          >
            <Text style={styles.setupBtnText}>
              + Add First Item
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Menu List grouped by category
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([category]) => category}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: [category, items] }) => (
            <View style={styles.categoryGroup}>
              {/* Category Header */}
              <Text style={styles.categoryHeader}>
                {category
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase())}
                {' '}({items.length})
              </Text>

              {/* Items in this category */}
              {items.map(menuItem => (
                <View key={menuItem.id} style={[
                  styles.itemCard,
                  !menuItem.isAvailable && styles.itemCardDim
                ]}>
                  {/* Food Image */}
                  <Image
                    source={{ uri: menuItem.imageUrl }}
                    style={styles.itemImage}
                  />

                  {/* Item Info */}
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
                  </View>

                  {/* Actions */}
                  <View style={styles.itemActions}>
                    {/* Available Switch */}
                    <Switch
                      value={menuItem.isAvailable}
                      onValueChange={() =>
                        toggleAvailability(
                          menuItem.id,
                          menuItem.isAvailable
                        )
                      }
                      trackColor={{
                        false: '#E0E0E0',
                        true: '#27AE6080'
                      }}
                      thumbColor={
                        menuItem.isAvailable ? '#27AE60' : '#f4f3f4'
                      }
                    />

                    {/* Edit Button */}
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() =>
                        navigation.navigate('AddMenuItem', {
                          item: menuItem,
                          restaurantId
                        })
                      }
                    >
                      <Ionicons
                        name="pencil"
                        size={16}
                        color="#3498DB"
                      />
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        handleDelete(menuItem.id, menuItem.name)
                      }
                    >
                      <Ionicons
                        name="trash"
                        size={16}
                        color="#E74C3C"
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
    backgroundColor: '#F8F9FA'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  centeredEmoji: {
    fontSize: 60,
    marginBottom: 16
  },
  centeredTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center'
  },
  centeredText: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 8
  },
  loadingText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 12
  },
  setupBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20
  },
  setupBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14
  },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  filterTabActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35'
  },
  filterTabText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500'
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  listContent: {
    padding: 16,
    paddingBottom: 40
  },
  categoryGroup: {
    marginBottom: 20
  },
  categoryHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35'
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  itemCardDim: {
    opacity: 0.6
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50'
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginTop: 2
  },
  itemDesc: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 2
  },
  itemActions: {
    alignItems: 'center',
    gap: 8
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#3498DB15',
    borderRadius: 8
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#E74C3C15',
    borderRadius: 8
  }
});