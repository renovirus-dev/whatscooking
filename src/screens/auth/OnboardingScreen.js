// ============================================
// FILE: src/screens/auth/OnboardingScreen.js
// ============================================
import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, StatusBar, Animated,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import { COLORS, SIZES, FONTS, RADIUS } from '../../theme';

const { width } = Dimensions.get('window');

// ✅ FONTS.title fallback
const TITLE_SIZE = FONTS.title || FONTS.xxl || 28;

// ─── Onboarding Slides ────────────────────────
const SLIDES = [
  {
    id:       '1',
    emoji:    '🍳',
    title:    "Discover What's Cooking",
    subtitle: 'Browse daily menus from restaurants near you — updated fresh every day.',
    bg:       '#FF6B35',
    features: [
      'Daily menu updates',
      'Restaurants near you',
      'Real food photos',
    ],
  },
  {
    id:       '2',
    emoji:    '📍',
    title:    'Find Restaurants Near You',
    subtitle: 'Use Near Me to discover local restaurants within your area.',
    bg:       '#27AE60',
    features: [
      'GPS-powered search',
      'Filter by cuisine',
      'Open now indicator',
    ],
  },
  {
    id:       '3',
    emoji:    '⭐',
    title:    'Save & Review',
    subtitle: 'Save your favorite restaurants and dishes, write reviews.',
    bg:       '#8E44AD',
    features: [
      'Save favorites',
      'Write reviews',
      'Rate dishes',
    ],
  },
  {
    id:       '4',
    emoji:    '🍽️',
    title:    'For Restaurant Owners',
    subtitle: 'List your restaurant, upload daily menus and reach more customers.',
    bg:       '#2C3E50',
    features: [
      '14-day free trial',
      'Scan menus with camera',
      'Analytics dashboard',
    ],
  },
];

const ONBOARDING_KEY = '@whatscooking_onboarding_complete';

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX     = useRef(new Animated.Value(0)).current;

  const currentBg   = SLIDES[currentIndex]?.bg ?? COLORS.primary;
  const isLastSlide = currentIndex === SLIDES.length - 1;

  // ─────────────────────────────────────────
  // MARK ONBOARDING COMPLETE
  // ─────────────────────────────────────────
  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Non-blocking
    }
  }, []);

  // ─────────────────────────────────────────
  // NAVIGATION HANDLERS
  // ─────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (isLastSlide) {
      handleGetStarted();
    } else {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, isLastSlide]);

  const handleSkip = useCallback(async () => {
    await completeOnboarding();
    navigation.replace('Login');
  }, [completeOnboarding, navigation]);

  const handleGetStarted = useCallback(async () => {
    await completeOnboarding();
    navigation.replace('Register');
  }, [completeOnboarding, navigation]);

  const handleLogin = useCallback(async () => {
    await completeOnboarding();
    navigation.replace('Login');
  }, [completeOnboarding, navigation]);

  const handleDotPress = useCallback((index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  }, []);

  // ─────────────────────────────────────────
  // RENDER SLIDE
  // ─────────────────────────────────────────
  const renderSlide = useCallback(({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      <View style={[
        styles.slideInner,
        { paddingTop: insets.top + SIZES.xl },
      ]}>
        {/* Big emoji */}
        <Text style={styles.emoji}>{item.emoji}</Text>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        {/* ✅ Feature list */}
        <View style={styles.featureList}>
          {item.features.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ), [insets.top]);

  // ─────────────────────────────────────────
  // ANIMATED DOT
  // ─────────────────────────────────────────
  const Dot = useCallback(({ index }) => {
    const isActive = index === currentIndex;
    return (
      <TouchableOpacity
        onPress={() => handleDotPress(index)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <View style={[
          styles.dot,
          isActive && styles.dotActive,
        ]} />
      </TouchableOpacity>
    );
  }, [currentIndex, handleDotPress]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor={currentBg}
        barStyle="light-content"
      />

      {/* ── Skip Button ───────────────────── */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + SIZES.sm }]}
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* ── Slides ────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / width
          );
          setCurrentIndex(index);
        }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* ── Bottom Panel ──────────────────── */}
      <View style={[
        styles.bottomPanel,
        { paddingBottom: insets.bottom + SIZES.lg },
      ]}>
        {/* Slide counter */}
        <Text style={styles.slideCounter}>
          {currentIndex + 1} / {SLIDES.length}
        </Text>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} />
          ))}
        </View>

        {/* ✅ Next / Get Started button */}
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          {isLastSlide ? (
            <>
              <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
              <Text style={styles.nextBtnText}>Get Started</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextBtnText}>Next</Text>
              <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        {/* ✅ Sign in link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Already have an account?</Text>
          <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // ── Skip Button ───────────────────────────
  skipBtn: {
    position:          'absolute',
    right:             SIZES.lg,
    zIndex:            10,
    backgroundColor:   'rgba(255,255,255,0.25)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.round,
  },
  skipText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.sm,
    fontWeight: '600',
  },

  // ── Slides ────────────────────────────────
  slide:      { width, flex: 1 },
  slideInner: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: SIZES.xl,
  },
  emoji:    { fontSize: 80, marginBottom: SIZES.lg },
  title: {
    fontSize:     TITLE_SIZE,
    fontWeight:   'bold',
    color:        '#FFFFFF',
    textAlign:    'center',
    marginBottom: SIZES.md,
  },
  subtitle: {
    fontSize:   FONTS.lg,
    color:      'rgba(255,255,255,0.85)',
    textAlign:  'center',
    lineHeight: 26,
    marginBottom: SIZES.lg,
  },

  // ── Feature List ──────────────────────────
  featureList: {
    gap:             SIZES.sm,
    alignSelf:       'stretch',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius:    RADIUS.xl,
    padding:         SIZES.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  featureCheck: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  featureText: {
    fontSize:   FONTS.md,
    color:      '#FFFFFF',
    fontWeight: '500',
  },

  // ── Bottom Panel ──────────────────────────
  bottomPanel: {
    backgroundColor:   COLORS.background,
    paddingTop:        SIZES.lg,
    paddingHorizontal: SIZES.lg,
    gap:               SIZES.md,
    alignItems:        'center',
  },
  slideCounter: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
    fontWeight: '600',
  },

  // ── Dots ──────────────────────────────────
  dots: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'center',
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width:           24,
    borderRadius:    4,
  },

  // ── Next Button ───────────────────────────
  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   COLORS.primary,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    gap:               SIZES.sm,
    alignSelf:         'stretch',
  },
  nextBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
  },

  // ── Login Row ─────────────────────────────
  loginRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  loginLabel: { color: COLORS.textMuted, fontSize: FONTS.md },
  loginLink: {
    color:      COLORS.primary,
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
});