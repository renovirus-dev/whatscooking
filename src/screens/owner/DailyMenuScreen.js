// ============================================
// FILE: src/screens/owner/DailyMenuScreen.js
// ============================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db }        from '../../firebase/config';
import { useAuth }   from '../../hooks/useAuth';
import { useMenu }   from '../../hooks/useMenu';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import FoodImage     from '../../components/FoodImage';
import { getThumbUrl } from '../../utils/uploadToCloudinary';
import { checkSubscriptionStatus } from '../../utils/subscriptionHelper';
import { notifyCustomersOnMenuPublish } from '../../utils/sendPushNotification';

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

const showSafeAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmButton = buttons.find(b => b.style !== 'cancel' && b.text !== 'Cancel');
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        if (confirmButton && confirmButton.onPress) confirmButton.onPress();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel' || b.text === 'Cancel');
        if (cancelButton && cancelButton.onPress) cancelButton.onPress();
      }
    } else {
      alert(`${title}\n\n${message}`);
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

const getCloudinaryUrl = (item) => {
  if (item?.cloudinaryUrl) {
    return getThumbUrl(item.cloudinaryUrl, 100, 100);
  }
  if (item?.imageUrl?.startsWith('http')) {
    return item.imageUrl;
  }
  return null;
};

const MAX_CHEF_MESSAGE = 200;
const DARK = '#2C3E50';

export default function DailyMenuScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [restaurant, setRestaurant]         = useState(null);
  const [restaurantId, setRestaurantId]     = useState(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  
  const [selectedIds, setSelectedIds]       = useState([]);
  const [specialIds, setSpecialIds]         = useState([]);
  const [chefMessage, setChefMessage]       = useState('');
  const [saving, setSaving]                 = useState(false);
  const [published, setPublished]           = useState(false);
  const [menuLoading, setMenuLoading]       = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const hasLoadedMenu = useRef(false);

  const { menuItems, loading: menuItemsLoading, setDailyMenu, getTodaysMenu } = useMenu(restaurantId);

  // ── Listen to Restaurant doc ──────────────
  useEffect(() => {
    if (!user?.uid) {
      setRestaurantLoading(false);
      return;
    }
    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const docInfo = snap.docs[0];
        const restData = { id: docInfo.id, ...docInfo.data() };
        setRestaurant(restData);
        setRestaurantId(docInfo.id);
        setRestaurantName(restData.name || 'Restaurant');
      } else {
        setRestaurant(null);
        setRestaurantId(null);
      }
      setRestaurantLoading(false);
    }, () => setRestaurantLoading(false));

    return unsub;
  }, [user?.uid]);

  const subStatus = checkSubscriptionStatus(restaurant);

  // ── Single-shot today's menu loader ───────
  useEffect(() => {
    let isMounted = true;

    const loadMenu = async () => {
      if (!restaurantId || hasLoadedMenu.current) return;
      setMenuLoading(true);

      try {
        const todaysMenu = await getTodaysMenu();
        if (!isMounted) return;

        if (todaysMenu) {
          setSelectedIds(todaysMenu.availableItemIds || []);
          setSpecialIds(todaysMenu.specials          || []);
          setChefMessage(todaysMenu.chefMessage      || '');
          setPublished(true);
        } else if (menuItems.length > 0) {
          setSelectedIds(
            menuItems
              .filter(i => i.isAvailable)
              .map(i => i.id)
          );
          setSpecialIds([]);
          setPublished(false);
        }
        hasLoadedMenu.current = true;
      } catch (err) {
        console.error('loadTodaysMenu error:', err);
      } finally {
        if (isMounted) setMenuLoading(false);
      }
    };

    if (restaurantId && !menuItemsLoading) {
      loadMenu();
    }

    return () => { isMounted = false; };
  }, [restaurantId, menuItemsLoading, getTodaysMenu, menuItems]);

  // Categories & Filtering
  const categories = useMemo(() => {
    const cats = [
      'all',
      ...new Set(menuItems.map(i => i.category || 'other')),
    ];
    return cats;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return menuItems;
    return menuItems.filter(
      i => (i.category || 'other') === activeCategory
    );
  }, [menuItems, activeCategory]);

  const toggleItem = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }, []);

  const toggleSpecial = useCallback((id) => {
    if (!selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
    setSpecialIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }, [selectedIds]);

  const selectAll = useCallback(() => {
    setSelectedIds(menuItems.map(i => i.id));
  }, [menuItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
    setSpecialIds([]);
  }, []);

  const selectAvailableOnly = useCallback(() => {
    setSelectedIds(menuItems.filter(i => i.isAvailable).map(i => i.id));
  }, [menuItems]);

  const handlePublish = useCallback(async () => {
    if (selectedIds.length === 0) {
      showSafeAlert(
        'No Items Selected',
        'Please select at least one menu item to publish.'
      );
      return;
    }

    setSaving(true);
    const result = await setDailyMenu(
      selectedIds,
      specialIds,
      chefMessage.trim()
    );
    setSaving(false);

    if (result.success) {
      setPublished(true);

      notifyCustomersOnMenuPublish({
        restaurantId,
        restaurantName,
        itemCount:    selectedIds.length,
        specialCount: specialIds.length,
        chefMessage:  chefMessage.trim(),
      });

      showSafeAlert(
        '✅ Menu Published!',
        `${selectedIds.length} items published for today.\n` +
        (specialIds.length > 0
          ? `⭐ ${specialIds.length} specials highlighted.`
          : '')
      );
    } else {
      showSafeAlert('Error', result.error || 'Failed to publish menu');
    }
  }, [selectedIds, specialIds, chefMessage, setDailyMenu, restaurantId, restaurantName]);

  const selectedCount = selectedIds.length;
  const specialCount  = specialIds.length;
  const totalCount    = menuItems.length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });

  const PUBLISH_BAR_HEIGHT = 80 + insets.bottom;

  // ─────────────────────────────────────────
  // GUARDS
  // ─────────────────────────────────────────
  if (restaurantLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredText}>Loading restaurant...</Text>
      </View>
    );
  }

  if (restaurant && !subStatus.isValid) {
    const isSuspended = subStatus.status === 'suspended';
    const isPending   = subStatus.status === 'pending';
    return (
      <View style={[styles.lockedContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.lockedIconBg, isSuspended && { backgroundColor: COLORS.error + '15' }]}>
          <Ionicons 
            name={isSuspended ? "ban-outline" : isPending ? "time-outline" : "calendar-outline"} 
            size={50} 
            color={isSuspended ? COLORS.error : isPending ? COLORS.warning || '#F39C12' : COLORS.primary} 
          />
        </View>
        <Text style={styles.lockedTitle}>
          {isSuspended ? 'Account Suspended' : isPending ? 'Verification Pending' : 'Subscription Expired'}
        </Text>
        <Text style={[styles.lockedDesc, { paddingHorizontal: SIZES.lg }]}>
          {subStatus.message}
        </Text>
        
        {isSuspended ? (
          <TouchableOpacity
            style={[styles.lockedUpgradeBtn, { backgroundColor: DARK }]}
            onPress={() =>
              showSafeAlert(
                '📧 Contact Admin',
                'For support, please email our team at:\nrenogooden@outlook.com',
                [{ text: 'OK' }]
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lockedUpgradeBtnText}>Contact Support</Text>
          </TouchableOpacity>
        ) : isPending ? (
          <TouchableOpacity
            style={[styles.lockedUpgradeBtn, { backgroundColor: COLORS.warning || '#F39C12' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.lockedUpgradeBtnText}>Go Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.lockedUpgradeBtn}
            onPress={() => navigation.navigate('Subscription', { restaurant })}
            activeOpacity={0.8}
          >
            <Ionicons name="diamond-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lockedUpgradeBtnText}>💳 Renew / Upgrade Plan</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!restaurantId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.centeredEmoji}>🍽️</Text>
        <Text style={styles.centeredTitle}>No Restaurant Found</Text>
        <Text style={styles.centeredText}>Set up your restaurant first</Text>
      </View>
    );
  }

  if (menuItems.length === 0 && !menuItemsLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.centeredEmoji}>📋</Text>
        <Text style={styles.centeredTitle}>No Menu Items</Text>
        <Text style={styles.centeredText}>Add menu items first from the Menu tab</Text>
        <TouchableOpacity
          style={styles.addItemsBtn}
          onPress={() => navigation?.navigate('ManageMenu')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.addItemsBtnText}>Add Menu Items</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 56}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📅 Today's Menu</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        {published && (
          <View style={styles.publishedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.publishedText}>Published</Text>
          </View>
        )}
      </View>

      {menuLoading || menuItemsLoading ? (
        <View style={styles.menuLoading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.menuLoadingText}>Loading today's menu...</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsBar}>
            <View style={styles.statsLeft}>
              <Text style={styles.statsText}>
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>
                  {selectedCount}
                </Text>
                /{totalCount} items
              </Text>
              {specialCount > 0 && (
                <View style={styles.specialCountBadge}>
                  <Text style={styles.specialCountText}>
                    ⭐ {specialCount} special{specialCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statsActions}>
              <TouchableOpacity onPress={selectAll} style={styles.statsBtn}>
                <Text style={styles.statsBtnText}>All</Text>
              </TouchableOpacity>
              <Text style={styles.statsDot}>·</Text>
              <TouchableOpacity onPress={selectAvailableOnly} style={styles.statsBtn}>
                <Text style={styles.statsBtnText}>Available</Text>
              </TouchableOpacity>
              <Text style={styles.statsDot}>·</Text>
              <TouchableOpacity onPress={deselectAll} style={styles.statsBtn}>
                <Text style={[styles.statsBtnText, { color: COLORS.error }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.messageBox}>
            <View style={styles.messageLabelRow}>
              <Text style={styles.messageLabel}>👨‍🍳 Chef's Message</Text>
              <Text style={[
                styles.charCount,
                chefMessage.length > MAX_CHEF_MESSAGE * 0.9 && { color: COLORS.error },
              ]}>
                {chefMessage.length}/{MAX_CHEF_MESSAGE}
              </Text>
            </View>
            <TextInput
              style={styles.messageInput}
              placeholder="e.g. Try our special today! Limited quantity..."
              placeholderTextColor={COLORS.textMuted}
              value={chefMessage}
              onChangeText={v => setChefMessage(v.slice(0, MAX_CHEF_MESSAGE))}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              returnKeyType="done"
              maxLength={MAX_CHEF_MESSAGE}
            />
          </View>

          {categories.length > 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryTab,
                    activeCategory === cat && styles.categoryTabActive,
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[
                    styles.categoryTabText,
                    activeCategory === cat && styles.categoryTabTextActive,
                  ]}>
                    {cat === 'all'
                      ? `All (${menuItems.length})`
                      : `${CATEGORY_LABELS[cat] || cat} (${
                          menuItems.filter(i => (i.category || 'other') === cat).length
                        })`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.list,
              { paddingBottom: PUBLISH_BAR_HEIGHT + SIZES.md },
            ]}
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              const isSpecial  = specialIds.includes(item.id);

              return (
                <TouchableOpacity
                  style={[
                    styles.itemRow,
                    isSelected && styles.itemRowSelected,
                    isSpecial  && styles.itemRowSpecial,
                    !item.isAvailable && styles.itemRowUnavailable,
                  ]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxActive,
                  ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>

                  <View style={styles.itemImageWrapper}>
                    <FoodImage
                      item={item}
                      cloudinaryUrl={getCloudinaryUrl(item)}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSpecial && (
                        <Text style={styles.specialLabel}>⭐ Special</Text>
                      )}
                    </View>
                    <Text style={styles.itemCategory}>
                      {CATEGORY_LABELS[item.category] || item.category?.replace(/_/g, ' ')}
                    </Text>
                    {!item.isAvailable && (
                      <Text style={styles.unavailableLabel}>⚠️ Marked unavailable</Text>
                    )}
                  </View>

                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>${item.price?.toFixed(2)}</Text>
                    <TouchableOpacity
                      style={[styles.starBtn, isSpecial && styles.starBtnActive]}
                      onPress={() => toggleSpecial(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isSpecial ? 'star' : 'star-outline'}
                        size={18}
                        color={isSpecial ? '#FFD700' : COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      <View style={[
        styles.publishBar,
        { paddingBottom: insets.bottom + SIZES.sm },
      ]}>
        <View style={styles.publishInfo}>
          <Text style={styles.publishCount}>
            {selectedCount} item{selectedCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.publishSubtext}>
            {specialCount > 0 ? `${specialCount} special${specialCount !== 1 ? 's' : ''} · ` : ''}
            will show today
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, saving && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.publishBtnText}>
                {published ? 'Update Menu' : 'Publish Menu'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         SIZES.xl,
    backgroundColor: COLORS.background,
    gap:             SIZES.sm,
  },
  centeredEmoji: { fontSize: 60 },
  centeredTitle: { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  centeredText:  { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  addItemsBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.xs,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.md,
  },
  addItemsBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  lockedContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SIZES.xl, backgroundColor: COLORS.background, gap: SIZES.md,
  },
  lockedIconBg: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  lockedTitle: { fontSize: FONTS.xxl, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  lockedDesc:  { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  lockedUpgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
  },
  lockedUpgradeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  header: {
    backgroundColor: COLORS.primary,
    padding:         SIZES.lg,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: 'bold', color: '#FFFFFF' },
  headerDate:  { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  publishedBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.success,
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    gap:               4,
  },
  publishedText: { color: '#FFFFFF', fontSize: FONTS.sm, fontWeight: '600' },

  menuLoading: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        SIZES.lg,
    gap:            SIZES.sm,
  },
  menuLoadingText: { fontSize: FONTS.md, color: COLORS.textMuted },

  statsBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsLeft: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  statsText: { fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  specialCountBadge: {
    backgroundColor:   '#FFD700' + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
    borderWidth:       1,
    borderColor:       '#FFD700' + '40',
  },
  specialCountText: { fontSize: FONTS.xs, color: '#B8860B', fontWeight: '700' },
  statsActions:     { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  statsBtn:         { paddingHorizontal: SIZES.xs, paddingVertical: SIZES.xs },
  statsBtnText:     { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  statsDot:         { color: COLORS.textMuted, fontSize: FONTS.sm },

  messageBox: {
    backgroundColor:   COLORS.surface,
    padding:           SIZES.md,
    gap:               SIZES.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  messageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageLabel:    { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  charCount:       { fontSize: FONTS.xs, color: COLORS.textMuted },
  messageInput: {
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.md,
    padding:           SIZES.md,
    fontSize:          FONTS.md,
    color:             COLORS.text,
    height:            60,
    textAlignVertical: 'top',
    borderWidth:       1,
    borderColor:       COLORS.border,
  },

  categoryScroll:        { maxHeight: 44, backgroundColor: COLORS.surface },
  categoryScrollContent: {
    paddingHorizontal: SIZES.sm,
    paddingVertical:   SIZES.sm,
    gap:               SIZES.sm,
    alignItems:        'center',
  },
  categoryTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  categoryTabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryTabText:       { fontSize: FONTS.xs, color: COLORS.textMuted, fontWeight: '500' },
  categoryTabTextActive: { color: '#FFFFFF', fontWeight: '600' },

  list: { padding: SIZES.md, gap: SIZES.sm },
  itemRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.md,
    borderWidth:     2,
    borderColor:     'transparent',
    ...SHADOW,
  },
  itemRowSelected:    { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  itemRowSpecial:     { borderColor: '#FFD700',      backgroundColor: '#FFD700' + '05'      },
  itemRowUnavailable: { opacity: 0.6 },
  checkbox: {
    width:          24,
    height:         24,
    borderRadius:   6,
    borderWidth:    2,
    borderColor:    COLORS.border,
    justifyContent: 'center',
    alignItems:     'center',
  },
  checkboxActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  itemImageWrapper: { width: 50, height: 50, borderRadius: RADIUS.md, overflow: 'hidden' },
  itemImage:        { width: 50, height: 50, borderRadius: RADIUS.md },
  itemInfo:         { flex: 1 },
  itemNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
    flexWrap:      'wrap',
  },
  itemName:         { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  specialLabel:     { fontSize: FONTS.xs, color: '#B8860B', fontWeight: '700' },
  itemCategory:     { fontSize: FONTS.xs, color: COLORS.textMuted, textTransform: 'capitalize', marginTop: 2 },
  unavailableLabel: { fontSize: FONTS.xs, color: COLORS.error, marginTop: 2 },
  itemRight:        { alignItems: 'center', gap: SIZES.xs },
  itemPrice:        { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.primary },
  starBtn:          { padding: 4, backgroundColor: COLORS.border, borderRadius: RADIUS.sm },
  starBtnActive:    { backgroundColor: '#FFD700' + '20' },

  publishBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingTop:        SIZES.md,
    borderTopWidth:    1,
    borderTopColor:    COLORS.border,
    ...SHADOW,
  },
  publishInfo:        { gap: 2 },
  publishCount:       { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.primary },
  publishSubtext:     { fontSize: FONTS.xs, color: COLORS.textMuted },
  publishBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    gap:               SIZES.sm,
  },
  publishBtnDisabled: { opacity: 0.7 },
  publishBtnText:     { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.lg },
});