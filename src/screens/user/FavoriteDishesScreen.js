// ============================================
// FILE: src/screens/user/FavoriteDishesScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db }          from '../../firebase/config';
import { useAuth }     from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import MenuItemCard    from '../../components/MenuItemCard';

export default function FavoriteDishesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  const [dishes, setDishes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavDishes = async () => {
      const ids = userProfile?.favoriteDishes || [];
      if (ids.length === 0) {
        setDishes([]);
        setLoading(false);
        return;
      }

      try {
        // ✅ Firestore 'in' query supports up to 30 items
        const chunks = [];
        for (let i = 0; i < ids.length; i += 30) {
          chunks.push(ids.slice(i, i + 30));
        }

        const allDishes = [];
        for (const chunk of chunks) {
          const q = query(
            collection(db, 'menuItems'),
            where('__name__', 'in', chunk)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(d =>
            allDishes.push({ id: d.id, ...d.data() })
          );
        }

        // ✅ Preserve order from favorites array
        allDishes.sort((a, b) =>
          ids.indexOf(a.id) - ids.indexOf(b.id)
        );

        setDishes(allDishes);
      } catch (err) {
        console.error('FavoriteDishes fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavDishes();
  }, [userProfile?.favoriteDishes]);

  // ── Loading state ─────────────────────────
  if (loading) {
    return (
      <View style={[
        styles.centered,
        {
          // ✅ Respect system bars on loading state
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dishes...</Text>
      </View>
    );
  }

  // ── Empty state ───────────────────────────
  if (dishes.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          // ✅ Respect system bars on empty state
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
        },
      ]}>
        <Text style={styles.emptyEmoji}>❤️</Text>
        <Text style={styles.emptyTitle}>No Favourite Dishes</Text>
        <Text style={styles.emptySubtext}>
          Tap the heart on any menu item to save it here
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={styles.browseBtnText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main list ─────────────────────────────
  return (
    <FlatList
      data={dishes}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.list,
        {
          // ✅ Last dish card clears Android nav bar
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}
      ListHeaderComponent={
        <Text style={styles.countText}>
          {dishes.length} saved dish
          {dishes.length !== 1 ? 'es' : ''}
        </Text>
      }
      renderItem={({ item }) => (
        <MenuItemCard
          item={item}
          onLoginRequired={() => navigation.navigate('Profile')}
        />
      )}
      // ✅ Nice separator between cards
      ItemSeparatorComponent={() => (
        <View style={styles.separator} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  // ── Centered states ──────────────────────
  // paddingTop / paddingBottom applied dynamically via insets
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.background,
    gap: SIZES.sm,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    marginTop: SIZES.sm,
  },
  emptyEmoji: {
    fontSize: 60,
  },
  emptyTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  browseBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    marginTop: SIZES.lg,
    // ✅ Shadow for button depth
    ...SHADOW,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },

  // ── List ────────────────────────────────
  // ✅ paddingBottom set dynamically via insets
  list: {
    padding: SIZES.md,
    backgroundColor: COLORS.background,
  },

  // ── Count label ─────────────────────────
  countText: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginBottom: SIZES.md,
    fontWeight: '500',
  },

  // ── Separator ───────────────────────────
  separator: {
    height: SIZES.sm,
  },
});