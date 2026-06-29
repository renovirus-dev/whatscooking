// ============================================
// FILE: src/screens/auth/OnboardingScreen.js
// ============================================
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS, RADIUS } from '../../theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: "Discover What's Cooking!",
    subtitle: 'Browse daily menus from restaurants in your area',
    emoji: '🍳',
    bg: COLORS.primary,
  },
  {
    id: '2',
    title: 'See Beautiful Food Images',
    subtitle: 'Every dish comes with mouthwatering photos',
    emoji: '📸',
    bg: '#27AE60',
  },
  {
    id: '3',
    title: 'For Restaurant Owners',
    subtitle: 'Upload your daily menu and reach more customers',
    emoji: '🍽️',
    bg: '#2C3E50',
  },
];

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  // ✅ Current slide background drives the whole screen colour
  // so status bar icons are always white (slides are dark/coloured)
  const currentBg = SLIDES[currentIndex]?.bg ?? COLORS.primary;

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      {/*
        ✅ paddingTop uses insets.top so the emoji/text
        never hides behind the translucent status bar
      */}
      <View
        style={[
          styles.slideInner,
          { paddingTop: insets.top + SIZES.xl },
        ]}
      >
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/*
        ✅ Status bar:
        - translucent so the slide colour shows through
        - light-content because all slide backgrounds are dark
        - backgroundColor matches current slide so there is
          no colour flash when swiping
      */}
      <StatusBar
        translucent
        backgroundColor={currentBg}
        barStyle="light-content"
      />

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / width
          );
          setCurrentIndex(index);
        }}
        // ✅ getItemLayout avoids layout recalculations
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/*
        ✅ Bottom panel sits below the slides.
        paddingBottom uses insets.bottom so the buttons
        never hide behind the Android nav bar.
      */}
      <View
        style={[
          styles.bottomPanel,
          { paddingBottom: insets.bottom + SIZES.lg },
        ]}
      >
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              // ✅ Tapping a dot scrolls to that slide
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
                setCurrentIndex(i);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Slides ──────────────────────────────
  slide: {
    // ✅ width is exact device width — no clipping
    width,
    // ✅ flex: 1 fills all available height above the bottom panel
    flex: 1,
  },
  slideInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.xl,
    // paddingTop set dynamically via insets in renderSlide
  },
  emoji: {
    fontSize: 80,
    marginBottom: SIZES.lg,
  },
  title: {
    fontSize: FONTS.title,
    fontWeight: 'bold',
    color: COLORS.textWhite,
    textAlign: 'center',
    marginBottom: SIZES.md,
  },
  subtitle: {
    fontSize: FONTS.lg,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Bottom panel ────────────────────────
  // ✅ White panel below slides — contains dots + buttons
  // paddingBottom set dynamically via insets
  bottomPanel: {
    backgroundColor: COLORS.background,
    paddingTop: SIZES.lg,
    paddingHorizontal: SIZES.lg,
  },

  // ── Dots ────────────────────────────────
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.lg,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
    borderRadius: 4,
  },

  // ── Buttons ─────────────────────────────
  buttons: {
    gap: SIZES.md,
  },
  loginBtn: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  loginText: {
    color: COLORS.primary,
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },
  registerBtn: {
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  registerText: {
    color: COLORS.textWhite,
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },
});