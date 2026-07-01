// ============================================
// FILE: src/screens/admin/ManageRestaurantsScreen.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db }    from '../../firebase/config';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Safe color fallbacks
// Prevents crash if these don't exist in your theme file
const WARNING_COLOR = COLORS.warning || '#F39C12';
const INFO_COLOR    = COLORS.info    || '#3498DB';

export default function ManageRestaurantsScreen() {
  const insets = useSafeAreaInsets();

  // ✅ isMounted ref — prevents setState after unmount
  const isMounted = useRef(true);

  const [restaurants, setRestaurants]       = useState([]);
  const [filtered, setFiltered]             = useState([]);
  const [search, setSearch]                 = useState('');
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [filterStatus, setFilterStatus]     = useState('all');
  const [togglingId, setTogglingId]         = useState(null);

  // ── Mounted lifecycle ─────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Firestore listener ────────────────────
  useEffect(() => {
    let unsubscribe = null;

    try {
      const q = query(
        collection(db, 'restaurants'),
        orderBy('createdAt', 'desc')
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          // ✅ Guard — only setState if still mounted
          if (!isMounted.current) return;

          const data = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
          }));
          setRestaurants(data);
          setLoading(false);
          setRefreshing(false);
        },
        (err) => {
          if (!isMounted.current) return;
          console.error('ManageRestaurants listener error:', err);
          setLoading(false);
          setRefreshing(false);
        }
      );
    } catch (err) {
      console.error('ManageRestaurants setup error:', err);
      if (isMounted.current) setLoading(false);
    }

    return () => {
      // ✅ Always unsubscribe on unmount
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ── Apply filters ─────────────────────────
  useEffect(() => {
    applyFilter();
  }, [restaurants, search, filterStatus]);

  const applyFilter = () => {
    let result = [...restaurants];

    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(lower) ||
        r.location?.city?.toLowerCase().includes(lower)
      );
    }

    if (filterStatus === 'active') {
      result = result.filter(r => r.isActive);
    } else if (filterStatus === 'inactive') {
      result = result.filter(r => !r.isActive);
    } else if (filterStatus === 'verified') {
      result = result.filter(r => r.isVerified);
    } else if (filterStatus === 'trial') {
      result = result.filter(
        r => r.subscription?.plan === 'free_trial'
      );
    }

    if (isMounted.current) {
      setFiltered(result);
    }
  };

  // ── Toggle active ─────────────────────────
  const toggleActive = (id, currentState, name) => {
    Alert.alert(
      currentState
        ? `Deactivate "${name}"?`
        : `Activate "${name}"?`,
      currentState
        ? 'This restaurant will be hidden from users.'
        : 'This restaurant will be visible to users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              if (isMounted.current) setTogglingId(id);
              await updateDoc(doc(db, 'restaurants', id), {
                isActive:  !currentState,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              Alert.alert('Error', 'Could not update restaurant');
            } finally {
              if (isMounted.current) setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  // ── Toggle verified ───────────────────────
  const toggleVerified = async (id, currentState) => {
    try {
      if (isMounted.current) setTogglingId(id);
      await updateDoc(doc(db, 'restaurants', id), {
        isVerified: !currentState,
        updatedAt:  serverTimestamp(),
      });
      if (isMounted.current) {
        Alert.alert(
          'Done',
          currentState
            ? 'Restaurant unverified'
            : 'Restaurant verified ✅'
        );
      }
    } catch (err) {
      if (isMounted.current) {
        Alert.alert('Error', 'Could not update restaurant');
      }
    } finally {
      if (isMounted.current) setTogglingId(null);
    }
  };

  const FILTERS = [
    { key: 'all',      label: 'All'         },
    { key: 'active',   label: '✅ Active'   },
    { key: 'inactive', label: '❌ Inactive' },
    { key: 'verified', label: '✓ Verified'  },
    { key: 'trial',    label: '🆓 Trial'    },
  ];

  // ── Render card ───────────────────────────
  const renderItem = ({ item }) => {
    const isToggling = togglingId === item.id;

    return (
      <View style={styles.card}>

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.restaurantName}>
                {item.name}
              </Text>
              {item.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>
            <Text style={styles.restaurantLocation}>
              📍 {item.location?.city || 'No city'},{' '}
              {item.location?.country || ''}
            </Text>
            <Text style={styles.restaurantOwner}>
              👤 Owner ID: {item.ownerId?.slice(0, 8)}...
            </Text>
          </View>

          {/* Status badge */}
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: item.isActive
                ? COLORS.success
                : COLORS.error,
            },
          ]}>
            <Text style={styles.statusText}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="star" size={14} color={WARNING_COLOR} />
            <Text style={styles.infoText}>
              {item.averageRating?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="heart" size={14} color={COLORS.error} />
            <Text style={styles.infoText}>
              {item.totalFavorites || 0}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="card" size={14} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {item.subscription?.plan || 'free_trial'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="chatbubble" size={14} color={INFO_COLOR} />
            <Text style={styles.infoText}>
              {item.totalReviews || 0} reviews
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>

          {/* Activate / Deactivate */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: item.isActive
                  ? COLORS.error   + '15'
                  : COLORS.success + '15',
                borderColor: item.isActive
                  ? COLORS.error   + '40'
                  : COLORS.success + '40',
                // ✅ Dim while toggling
                opacity: isToggling ? 0.6 : 1,
              },
            ]}
            onPress={() =>
              toggleActive(item.id, item.isActive, item.name)
            }
            disabled={isToggling}
            activeOpacity={0.7}
          >
            {isToggling ? (
              <ActivityIndicator
                size="small"
                color={item.isActive ? COLORS.error : COLORS.success}
              />
            ) : (
              <>
                <Ionicons
                  name={item.isActive
                    ? 'close-circle-outline'
                    : 'checkmark-circle-outline'}
                  size={16}
                  color={item.isActive ? COLORS.error : COLORS.success}
                />
                <Text style={[
                  styles.actionBtnText,
                  {
                    color: item.isActive
                      ? COLORS.error
                      : COLORS.success,
                  },
                ]}>
                  {item.isActive ? 'Deactivate' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Verify / Unverify */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: item.isVerified
                  ? WARNING_COLOR + '15'
                  : INFO_COLOR    + '15',
                borderColor: item.isVerified
                  ? WARNING_COLOR + '40'
                  : INFO_COLOR    + '40',
                opacity: isToggling ? 0.6 : 1,
              },
            ]}
            onPress={() =>
              toggleVerified(item.id, item.isVerified)
            }
            disabled={isToggling}
            activeOpacity={0.7}
          >
            {isToggling ? (
              <ActivityIndicator
                size="small"
                color={item.isVerified ? WARNING_COLOR : INFO_COLOR}
              />
            ) : (
              <>
                <Ionicons
                  name={item.isVerified
                    ? 'shield-outline'
                    : 'shield-checkmark-outline'}
                  size={16}
                  color={item.isVerified ? WARNING_COLOR : INFO_COLOR}
                />
                <Text style={[
                  styles.actionBtnText,
                  {
                    color: item.isVerified
                      ? WARNING_COLOR
                      : INFO_COLOR,
                  },
                ]}>
                  {item.isVerified ? 'Unverify' : 'Verify'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </View>
    );
  };

  // ── Main render ───────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 0 : insets.top
      }
    >
      <View style={styles.container}>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                filterStatus === f.key && styles.filterTabActive,
              ]}
              onPress={() => setFilterStatus(f.key)}
            >
              <Text style={[
                styles.filterTabText,
                filterStatus === f.key && styles.filterTabTextActive,
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Result count */}
        <Text style={styles.countText}>
          {filtered.length} restaurant
          {filtered.length !== 1 ? 's' : ''}
        </Text>

        {/* Restaurant list */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              Loading restaurants...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + SIZES.xl },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (isMounted.current) setRefreshing(true);
                }}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 50 }}>🏪</Text>
                <Text style={styles.emptyText}>
                  No restaurants found
                </Text>
                {search.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearSearchBtn}
                    onPress={() => setSearch('')}
                  >
                    <Text style={styles.clearSearchText}>
                      Clear search
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Search bar ──────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SIZES.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.xl,
    gap: SIZES.sm,
    ...SHADOW,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.text,
  },

  // ── Filter tabs ─────────────────────────
  filterList: {
    paddingHorizontal: SIZES.md,
    gap: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  filterTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.secondary,
    borderColor:     COLORS.secondary,
  },
  filterTabText: {
    fontSize:   FONTS.sm,
    color:      COLORS.text,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color:      '#FFFFFF',
    fontWeight: '600',
  },

  // ── Count label ─────────────────────────
  countText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.xs,
  },

  // ── Loading ─────────────────────────────
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
  },

  // ── List ────────────────────────────────
  list: {
    padding: SIZES.md,
    gap: SIZES.md,
  },

  // ── Card ────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  restaurantName: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  verifiedBadge: {
    backgroundColor: INFO_COLOR,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantLocation: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  restaurantOwner: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  statusText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xs,
    fontWeight: 'bold',
  },

  // ── Info row ────────────────────────────
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.md,
    paddingVertical: SIZES.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: SIZES.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    textTransform: 'capitalize',
  },

  // ── Card actions ────────────────────────
  cardActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
    // ✅ Minimum height for comfortable tap
    minHeight: 40,
  },
  actionBtnText: {
    fontSize:   FONTS.sm,
    fontWeight: '600',
  },

  // ── Empty state ─────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl * 2,
    gap: SIZES.sm,
  },
  emptyText: {
    fontSize: FONTS.xl,
    color: COLORS.textMuted,
    marginTop: SIZES.md,
  },
  clearSearchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: RADIUS.lg,
    marginTop: SIZES.sm,
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sm,
  },
});