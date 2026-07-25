// ============================================
// FILE: src/screens/admin/ManageRestaurantsScreen.js
// ============================================
import React, {
  useState, useEffect, useRef,
  useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, TextInput,
  ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, onSnapshot, doc,
  updateDoc, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db }    from '../../firebase/config';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ─── Safe Color Fallbacks ─────────────────────
const WARNING_COLOR = COLORS.warning || '#F39C12';
const INFO_COLOR    = COLORS.info    || '#3498DB';
const DIVIDER_COLOR = COLORS.divider || COLORS.border || '#E0E0E0';

// ─── Plan Config ──────────────────────────────
const PLAN_CONFIG = {
  free_trial: { label: '🆓 Trial',   color: COLORS.textMuted },
  basic:      { label: '⭐ Basic',   color: INFO_COLOR       },
  premium:    { label: '👑 Premium', color: COLORS.primary   },
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function ManageRestaurantsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── State ─────────────────────────────────
  const [restaurants, setRestaurants]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [togglingId, setTogglingId]     = useState(null);

  // ─────────────────────────────────────────
  // FIRESTORE LISTENER
  // ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'restaurants'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!isMounted.current) return;
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRestaurants(data);
        setLoading(false);
        setRefreshing(false); // ✅ Reset refreshing when data arrives
      },
      (err) => {
        if (!isMounted.current) return;
        console.error('ManageRestaurants listener error:', err);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────
  // FILTER COUNTS
  // ✅ Memoized counts for each tab
  // ─────────────────────────────────────────
  const filterCounts = useMemo(() => ({
    all:      restaurants.length,
    active:   restaurants.filter(r => r.isActive && r.isApproved).length,
    inactive: restaurants.filter(r => !r.isActive).length,
    pending:  restaurants.filter(r => !r.isApproved).length,
    verified: restaurants.filter(r => r.isVerified).length,
    trial:    restaurants.filter(r =>
                (r.subscription?.plan || 'free_trial') === 'free_trial'
              ).length,
    premium:  restaurants.filter(r =>
                r.subscription?.plan === 'premium'
              ).length,
  }), [restaurants]);

  // ─────────────────────────────────────────
  // FILTER TABS
  // ─────────────────────────────────────────
  const FILTERS = useMemo(() => [
    { key: 'all',      label: 'All',        count: filterCounts.all      },
    { key: 'pending',  label: '⏳ Pending',  count: filterCounts.pending  },
    { key: 'active',   label: '✅ Active',   count: filterCounts.active   },
    { key: 'inactive', label: '❌ Inactive', count: filterCounts.inactive },
    { key: 'verified', label: '✓ Verified',  count: filterCounts.verified },
    { key: 'trial',    label: '🆓 Trial',    count: filterCounts.trial    },
    { key: 'premium',  label: '👑 Premium',  count: filterCounts.premium  },
  ], [filterCounts]);

  // ─────────────────────────────────────────
  // FILTERED RESTAURANTS
  // ✅ All in useMemo - no useEffect + setState
  // ─────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];

    // ── Status filter ──────────────────────
    switch (filterStatus) {
      case 'active':
        result = result.filter(r => r.isActive && r.isApproved);
        break;
      case 'inactive':
        result = result.filter(r => !r.isActive);
        break;
      case 'pending':
        result = result.filter(r => !r.isApproved);
        break;
      case 'verified':
        result = result.filter(r => r.isVerified);
        break;
      case 'trial':
        result = result.filter(r =>
          (r.subscription?.plan || 'free_trial') === 'free_trial'
        );
        break;
      case 'premium':
        result = result.filter(r => r.subscription?.plan === 'premium');
        break;
    }

    // ── Search filter ──────────────────────
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name?.toLowerCase().includes(q)            ||
        r.location?.city?.toLowerCase().includes(q) ||
        r.cuisineTypes?.some(c => c.toLowerCase().includes(q))
      );
    }

    return result;
  }, [restaurants, filterStatus, search]);

  // ─────────────────────────────────────────
  // TOGGLE ACTIVE
  // ✅ Optimistic update
  // ─────────────────────────────────────────
  const toggleActive = useCallback((item) => {
    const { id, isActive, name } = item;
    Alert.alert(
      isActive ? `Deactivate "${name}"?` : `Activate "${name}"?`,
      isActive
        ? 'This restaurant will be hidden from users.'
        : 'This restaurant will be visible to users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setTogglingId(id);
            // ✅ Optimistic update
            setRestaurants(prev =>
              prev.map(r =>
                r.id === id ? { ...r, isActive: !isActive } : r
              )
            );
            try {
              await updateDoc(doc(db, 'restaurants', id), {
                isActive:  !isActive,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              // ✅ Revert on error
              setRestaurants(prev =>
                prev.map(r =>
                  r.id === id ? { ...r, isActive: isActive } : r
                )
              );
              Alert.alert('Error', 'Could not update restaurant');
            } finally {
              if (isMounted.current) setTogglingId(null);
            }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────
  // APPROVE RESTAURANT
  // ─────────────────────────────────────────
  const approveRestaurant = useCallback((item) => {
    Alert.alert(
      '✅ Approve Restaurant',
      `Approve "${item.name}"? It will become visible to customers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setTogglingId(item.id);
            setRestaurants(prev =>
              prev.map(r =>
                r.id === item.id
                  ? { ...r, isApproved: true, isActive: true }
                  : r
              )
            );
            try {
              await updateDoc(doc(db, 'restaurants', item.id), {
                isApproved: true,
                isActive:   true,
                updatedAt:  serverTimestamp(),
              });
              Alert.alert('✅ Approved', `${item.name} is now live!`);
            } catch (err) {
              setRestaurants(prev =>
                prev.map(r =>
                  r.id === item.id
                    ? { ...r, isApproved: false, isActive: false }
                    : r
                )
              );
              Alert.alert('Error', 'Could not approve restaurant');
            } finally {
              if (isMounted.current) setTogglingId(null);
            }
          },
        },
      ]
    );
  }, []);

  // ─────────────────────────────────────────
  // TOGGLE VERIFIED
  // ✅ Optimistic update
  // ─────────────────────────────────────────
  const toggleVerified = useCallback(async (item) => {
    const { id, isVerified } = item;
    setTogglingId(id);
    setRestaurants(prev =>
      prev.map(r =>
        r.id === id ? { ...r, isVerified: !isVerified } : r
      )
    );
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        isVerified: !isVerified,
        updatedAt:  serverTimestamp(),
      });
    } catch (err) {
      setRestaurants(prev =>
        prev.map(r =>
          r.id === id ? { ...r, isVerified: isVerified } : r
        )
      );
      Alert.alert('Error', 'Could not update restaurant');
    } finally {
      if (isMounted.current) setTogglingId(null);
    }
  }, []);

  // ─────────────────────────────────────────
  // PULL TO REFRESH
  // Firestore listener resets refreshing automatically
  // ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Safety timeout in case listener doesn't fire
    setTimeout(() => {
      if (isMounted.current) setRefreshing(false);
    }, 3000);
  }, []);

  // ─────────────────────────────────────────
  // RENDER CARD
  // ─────────────────────────────────────────
  const renderItem = useCallback(({ item }) => {
    const isToggling = togglingId === item.id;
    const planId     = item.subscription?.plan || 'free_trial';
    const plan       = PLAN_CONFIG[planId] || PLAN_CONFIG.free_trial;

    return (
      <View style={[
        styles.card,
        !item.isApproved && styles.cardPending,
      ]}>

        {/* ── Card Header ─────────────────── */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            {/* Name + verified badge */}
            <View style={styles.nameRow}>
              <Text style={styles.restaurantName} numberOfLines={1}>
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
              {!item.isApproved && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              )}
            </View>

            {/* Location */}
            <Text style={styles.restaurantLocation}>
              📍 {[
                item.location?.city,
                item.location?.country,
              ].filter(Boolean).join(', ') || 'No location'}
            </Text>

            {/* Cuisine types */}
            {item.cuisineTypes?.length > 0 && (
              <Text style={styles.restaurantCuisine} numberOfLines={1}>
                🍽️ {item.cuisineTypes.join(', ')}
              </Text>
            )}

            {/* Owner ID */}
            <Text style={styles.restaurantOwner}>
              👤 {item.ownerId?.slice(0, 12)}...
            </Text>
          </View>

          {/* Status + Plan badges */}
          <View style={styles.badgeColumn}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: item.isActive ? COLORS.success : COLORS.error },
            ]}>
              <Text style={styles.statusText}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={[
              styles.planBadge,
              { backgroundColor: plan.color + '20' },
            ]}>
              <Text style={[styles.planBadgeText, { color: plan.color }]}>
                {plan.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Info Row ────────────────────── */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="star-outline" size={14} color={WARNING_COLOR} />
            <Text style={styles.infoText}>
              {item.averageRating?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="heart-outline" size={14} color={COLORS.error} />
            <Text style={styles.infoText}>
              {item.totalFavorites || 0}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="chatbubble-outline" size={14} color={INFO_COLOR} />
            <Text style={styles.infoText}>
              {item.totalReviews || 0} reviews
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons
              name={item.isCurrentlyOpen ? 'time' : 'time-outline'}
              size={14}
              color={item.isCurrentlyOpen ? COLORS.success : COLORS.textMuted}
            />
            <Text style={[
              styles.infoText,
              { color: item.isCurrentlyOpen ? COLORS.success : COLORS.textMuted },
            ]}>
              {item.isCurrentlyOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* ── Actions ─────────────────────── */}
        <View style={styles.cardActions}>

          {/* ✅ Approve button (only if pending) */}
          {!item.isApproved && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnApprove,
                isToggling && { opacity: 0.6 },
              ]}
              onPress={() => approveRestaurant(item)}
              disabled={isToggling}
              activeOpacity={0.7}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionBtnTextWhite}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          )}

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
              },
              isToggling && { opacity: 0.6 },
            ]}
            onPress={() => toggleActive(item)}
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
                  { color: item.isActive ? COLORS.error : COLORS.success },
                ]}>
                  {item.isActive ? 'Disable' : 'Enable'}
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
              },
              isToggling && { opacity: 0.6 },
            ]}
            onPress={() => toggleVerified(item)}
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
                  { color: item.isVerified ? WARNING_COLOR : INFO_COLOR },
                ]}>
                  {item.isVerified ? 'Unverify' : 'Verify'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </View>
    );
  }, [togglingId, toggleActive, toggleVerified, approveRestaurant]);

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading restaurants...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <View style={styles.container}>

        {/* ── Search Bar ──────────────────── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, city, cuisine..."
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
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter Tabs ─────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterTab,
                filterStatus === f.key && styles.filterTabActive,
              ]}
              onPress={() => setFilterStatus(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterTabText,
                filterStatus === f.key && styles.filterTabTextActive,
              ]}>
                {f.label}
              </Text>
              {/* ✅ Count badge on each tab */}
              {f.count > 0 && (
                <View style={[
                  styles.filterTabBadge,
                  filterStatus === f.key && {
                    backgroundColor: 'rgba(255,255,255,0.3)',
                  },
                ]}>
                  <Text style={[
                    styles.filterTabBadgeText,
                    filterStatus === f.key && { color: '#FFFFFF' },
                  ]}>
                    {f.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Results Count ───────────────── */}
        <View style={styles.resultsRow}>
          <Text style={styles.countText}>
            {filteredRestaurants.length} restaurant
            {filteredRestaurants.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </Text>
          {(search || filterStatus !== 'all') && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setFilterStatus('all');
              }}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Restaurant List ─────────────── */}
        <FlatList
          data={filteredRestaurants}
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
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 50 }}>🏪</Text>
              <Text style={styles.emptyTitle}>No restaurants found</Text>
              {(search || filterStatus !== 'all') && (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearch('');
                    setFilterStatus('all');
                  }}
                >
                  <Text style={styles.clearFilterText}>
                    Clear Filters
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Loading ───────────────────────────────
  loadingBox: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            SIZES.sm,
  },
  loadingText: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Search Bar ────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    margin:            SIZES.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.xl,
    gap:               SIZES.sm,
    ...SHADOW,
  },
  searchInput: { flex: 1, fontSize: FONTS.md, color: COLORS.text },

  // ── Filter Tabs ───────────────────────────
  filterList: {
    paddingHorizontal: SIZES.md,
    gap:               SIZES.sm,
    paddingBottom:     SIZES.sm,
    alignItems:        'center',
  },
  filterTab: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
    gap:               6,
  },
  filterTabActive: {
    backgroundColor: COLORS.secondary,
    borderColor:     COLORS.secondary,
  },
  filterTabText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  filterTabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  filterTabBadge: {
    backgroundColor:   COLORS.border,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      8,
    minWidth:          18,
    alignItems:        'center',
  },
  filterTabBadgeText: {
    fontSize:   9,
    fontWeight: 'bold',
    color:      COLORS.textMuted,
  },

  // ── Results Row ───────────────────────────
  resultsRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    marginBottom:      SIZES.xs,
  },
  countText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  clearText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },

  // ── List ──────────────────────────────────
  list: { padding: SIZES.md, gap: SIZES.md },

  // ── Card ──────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    ...SHADOW,
  },
  cardPending: {
    borderColor:     WARNING_COLOR + '50',
    backgroundColor: WARNING_COLOR + '05',
  },
  cardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   SIZES.sm,
    gap:            SIZES.sm,
  },

  // ── Name Row ──────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
    flexWrap:      'wrap',
    marginBottom:  2,
  },
  restaurantName: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.text,
    flexShrink: 1,
  },
  verifiedBadge: {
    backgroundColor: INFO_COLOR,
    width:           20,
    height:          20,
    borderRadius:    10,
    justifyContent:  'center',
    alignItems:      'center',
  },
  pendingBadge: {
    backgroundColor:   WARNING_COLOR + '20',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       WARNING_COLOR + '40',
  },
  pendingBadgeText: {
    fontSize:   FONTS.xs,
    color:      WARNING_COLOR,
    fontWeight: '700',
  },
  restaurantLocation: {
    fontSize:  FONTS.sm,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  restaurantCuisine: {
    fontSize:      FONTS.xs,
    color:         COLORS.textMuted,
    marginTop:     2,
    textTransform: 'capitalize',
  },
  restaurantOwner: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 2,
  },

  // ── Badge Column ──────────────────────────
  badgeColumn: { gap: SIZES.xs, alignItems: 'flex-end' },
  statusBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
  },
  statusText: { color: '#FFFFFF', fontSize: FONTS.xs, fontWeight: 'bold' },
  planBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  planBadgeText: { fontSize: FONTS.xs, fontWeight: '700' },

  // ── Info Row ──────────────────────────────
  infoRow: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               SIZES.md,
    paddingVertical:   SIZES.sm,
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       DIVIDER_COLOR,
    marginBottom:      SIZES.sm,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: {
    fontSize:      FONTS.sm,
    color:         COLORS.textLight,
    textTransform: 'capitalize',
  },

  // ── Card Actions ──────────────────────────
  cardActions: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
  actionBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        SIZES.sm,
    borderRadius:   RADIUS.md,
    borderWidth:    1,
    gap:            4,
    minHeight:      40,
    minWidth:       80,
  },
  actionBtnApprove: {
    backgroundColor: COLORS.success,
    borderColor:     COLORS.success,
  },
  actionBtnText:      { fontSize: FONTS.sm, fontWeight: '600' },
  actionBtnTextWhite: {
    fontSize:   FONTS.sm,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  // ── Empty State ───────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: SIZES.xxl,
    gap:             SIZES.sm,
  },
  emptyTitle: { fontSize: FONTS.xl, color: COLORS.textMuted, marginTop: SIZES.md },
  clearFilterBtn: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.sm,
  },
  clearFilterText: { color: '#FFFFFF', fontWeight: '600', fontSize: FONTS.sm },
});