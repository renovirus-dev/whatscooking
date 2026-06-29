// ============================================
// FILE: src/screens/owner/DailyMenuScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useMenu } from '../../hooks/useMenu';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function DailyMenuScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [restaurantId, setRestaurantId] = useState(null);
  const [selectedIds, setSelectedIds]   = useState([]);
  const [chefMessage, setChefMessage]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [published, setPublished]       = useState(false);

  const { menuItems, setDailyMenu, getTodaysMenu } =
    useMenu(restaurantId);

  // ── Get restaurant ID ────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setRestaurantId(snap.docs[0].id);
      }
    });
    return unsub;
  }, [user]);

  // ── Load today's menu when ready ─────────
  useEffect(() => {
    if (restaurantId && menuItems.length > 0) {
      loadTodaysMenu();
    }
  }, [restaurantId, menuItems.length]);

  const loadTodaysMenu = async () => {
    const todaysMenu = await getTodaysMenu();
    if (todaysMenu) {
      setSelectedIds(todaysMenu.availableItemIds || []);
      setChefMessage(todaysMenu.chefMessage || '');
      setPublished(true);
    } else {
      setSelectedIds(menuItems.map(i => i.id));
    }
  };

  const toggleItem = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll   = () => setSelectedIds(menuItems.map(i => i.id));
  const deselectAll = () => setSelectedIds([]);

  const handlePublish = async () => {
    setSaving(true);
    const result = await setDailyMenu(selectedIds, [], chefMessage);
    setSaving(false);

    if (result.success) {
      setPublished(true);
      Alert.alert(
        '✅ Menu Published!',
        `${selectedIds.length} items are now visible to customers today.`
      );
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });

  // ── Publish bar height ───────────────────
  // ✅ Dynamically sized so it always clears the Android nav bar
  const PUBLISH_BAR_HEIGHT = 72 + insets.bottom;

  // ── Empty states ─────────────────────────
  if (!restaurantId) {
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
          Set up your restaurant first
        </Text>
      </View>
    );
  }

  if (menuItems.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <Text style={styles.centeredEmoji}>📋</Text>
        <Text style={styles.centeredTitle}>No Menu Items</Text>
        <Text style={styles.centeredText}>
          Add menu items first from the Menu tab
        </Text>
      </View>
    );
  }

  return (
    // ✅ KeyboardAvoidingView so chef message input
    // is not hidden when keyboard opens
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? 0
          // ✅ Android: offset = status bar (insets.top)
          // + tab bar height (approximate 56px)
          : insets.top + 56
      }
    >
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <View>
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

      {/* ── Stats bar ───────────────────────── */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {selectedIds.length} of {menuItems.length} items selected
        </Text>
        <View style={styles.statsActions}>
          <TouchableOpacity onPress={selectAll} style={styles.statsBtn}>
            <Text style={styles.statsBtnText}>Select All</Text>
          </TouchableOpacity>
          <Text style={styles.statsDot}>•</Text>
          <TouchableOpacity onPress={deselectAll} style={styles.statsBtn}>
            <Text style={[styles.statsBtnText, { color: COLORS.error }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Chef message ────────────────────── */}
      <View style={styles.messageBox}>
        <Text style={styles.messageLabel}>
          👨‍🍳 Chef's Message (optional)
        </Text>
        <TextInput
          style={styles.messageInput}
          placeholder="e.g. Try our special today! Limited quantity available..."
          placeholderTextColor={COLORS.textMuted}
          value={chefMessage}
          onChangeText={setChefMessage}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          returnKeyType="done"
        />
      </View>

      {/* ── Menu items list ──────────────────── */}
      <FlatList
        data={menuItems}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          {
            // ✅ Bottom padding = publish bar height + nav bar inset
            // so the last list item is never hidden behind the
            // fixed publish bar or the Android nav bar
            paddingBottom: PUBLISH_BAR_HEIGHT + SIZES.md,
          },
        ]}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.itemRow,
                isSelected && styles.itemRowSelected,
              ]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxActive,
              ]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>

              {/* Food image */}
              <Image
                source={{
                  uri: item.imageUrl ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100',
                }}
                style={styles.itemImage}
              />

              {/* Info */}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>
                  {item.category?.replace(/_/g, ' ')}
                </Text>
              </View>

              {/* Price */}
              <Text style={styles.itemPrice}>
                ${item.price?.toFixed(2)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Publish bar — fixed at bottom ────── */}
      {/*
        ✅ paddingBottom uses insets.bottom so the bar
        always sits above the Android nav bar, not behind it.
        This is the KEY fix for this screen.
      */}
      <View style={[
        styles.publishBar,
        { paddingBottom: insets.bottom + SIZES.sm },
      ]}>
        <View style={styles.publishInfo}>
          <Text style={styles.publishCount}>{selectedIds.length} items</Text>
          <Text style={styles.publishSubtext}>will be shown today</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.publishBtn,
            saving && styles.publishBtnDisabled,
          ]}
          onPress={handlePublish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Empty / loading states ───────────────
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
    marginBottom: SIZES.sm,
  },
  centeredText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Header ──────────────────────────────
  header: {
    backgroundColor: COLORS.primary,
    padding: SIZES.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerDate: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  publishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    gap: 4,
  },
  publishedText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: '600',
  },

  // ── Stats bar ───────────────────────────
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsText: {
    fontSize: FONTS.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  statsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  statsBtn: {
    paddingHorizontal: SIZES.sm,
    // ✅ Larger tap target
    paddingVertical: SIZES.xs,
  },
  statsBtnText: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statsDot: {
    color: COLORS.textMuted,
  },

  // ── Chef message ────────────────────────
  messageBox: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    gap: SIZES.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  messageLabel: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  messageInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    height: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── List ────────────────────────────────
  list: {
    padding: SIZES.md,
    gap: SIZES.sm,
    // ✅ paddingBottom set dynamically in contentContainerStyle
    // using PUBLISH_BAR_HEIGHT + insets — do not hardcode here
  },

  // ── Item row ────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW,
  },
  itemRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemCategory: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // ── Publish bar ─────────────────────────
  publishBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.md,
    // ✅ paddingBottom set dynamically via insets
    // in the JSX — do NOT hardcode here
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW,
  },
  publishInfo: {
    gap: 2,
  },
  publishCount: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  publishSubtext: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
  },
  publishBtnDisabled: {
    opacity: 0.7,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: FONTS.lg,
  },
});