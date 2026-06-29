// ============================================
// FILE: src/screens/user/FavoritesScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db }          from '../../firebase/config';
import { useAuth }     from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import RestaurantCard  from '../../components/RestaurantCard';

export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  const [favorites, setFavorites]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && userProfile) {
      loadFavorites();
    } else {
      setLoading(false);
    }
  }, [user, userProfile]);

  const loadFavorites = async () => {
    try {
      const ids = userProfile?.favoriteRestaurants || [];
      if (ids.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      const promises = ids.map(id =>
        getDoc(doc(db, 'restaurants', id))
      );
      const docs = await Promise.all(promises);
      const data = docs
        .filter(d => d.exists())
        .map(d => ({ id: d.id, ...d.data() }));
      setFavorites(data);
    } catch (error) {
      console.error('Favorites error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites();
  };

  // ── Not logged in ─────────────────────────
  if (!user) {
    return (
      <View style={[
        styles.centered,
        {
          // ✅ Respect system bars on all empty/auth states
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emoji}>❤️</Text>
        <Text style={styles.title}>Your Favorites</Text>
        <Text style={styles.subtitle}>
          Login to save your favorite restaurants
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Login</Text>
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
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  // ── Empty favorites ───────────────────────
  if (favorites.length === 0) {
    return (
      <View style={[
        styles.centered,
        {
          paddingTop:    insets.top    + SIZES.xl,
          paddingBottom: insets.bottom + SIZES.xl,
        },
      ]}>
        <Text style={styles.emoji}>🤍</Text>
        <Text style={styles.title}>No Favorites Yet</Text>
        <Text style={styles.subtitle}>
          Tap the ❤️ heart icon on any restaurant to save it here
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Explore')}
          activeOpacity={0.8}
        >
          <Ionicons name="compass" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Explore Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main list ─────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>❤️ My Favorites</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{favorites.length}</Text>
        </View>
      </View>

      {/* ── Favorites list ───────────────────── */}
      <FlatList
        data={favorites}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          {
            // ✅ Last card clears Android nav bar
            // Replaces hardcoded paddingBottom: 40
            paddingBottom: insets.bottom + SIZES.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            horizontal
            style={styles.card}
            onPress={() =>
              navigation.navigate('RestaurantDetail', {
                restaurantId: item.id,
                name:         item.name,
              })
            }
          />
        )}
        // ✅ Separator between cards instead of relying on gap
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Centered states ──────────────────────
  // paddingTop / paddingBottom applied dynamically via insets
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.xl,
    backgroundColor: COLORS.background,
  },
  emoji: {
    fontSize: 70,
    marginBottom: SIZES.md,
  },
  title: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SIZES.sm,
  },
  subtitle: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SIZES.xl,
  },
  loadingText: {
    fontSize: FONTS.md,
    color: COLORS.textMuted,
    marginTop: SIZES.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: FONTS.lg,
  },

  // ── Header ───────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  headerTitle: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: FONTS.sm,
    fontWeight: 'bold',
  },

  // ── List ─────────────────────────────────
  // ✅ paddingBottom set dynamically via insets
  listContent: {
    padding: SIZES.md,
  },
  card: {
    marginBottom: 0,
  },

  // ── Separator ────────────────────────────
  separator: {
    height: SIZES.md,
  },
});