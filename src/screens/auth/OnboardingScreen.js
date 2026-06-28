// ============================================
// FILE: src/screens/auth/OnboardingScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Dimensions, FlatList
} from 'react-native';
import { COLORS, SIZES, FONTS, RADIUS } from '../../theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: "Discover What's Cooking!",
    subtitle: "Browse daily menus from restaurants in your area",
    emoji: '🍳',
    bg: COLORS.primary,
  },
  {
    id: '2',
    title: "See Beautiful Food Images",
    subtitle: "Every dish comes with mouthwatering photos",
    emoji: '📸',
    bg: '#27AE60',
  },
  {
    id: '3',
    title: "For Restaurant Owners",
    subtitle: "Upload your daily menu and reach more customers",
    emoji: '🍽️',
    bg: '#2C3E50',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          setCurrentIndex(
            Math.round(e.nativeEvent.contentOffset.x / width)
          );
        }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  slide: {
    width,
    height: height * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  emoji: { fontSize: 80, marginBottom: SIZES.lg },
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SIZES.lg,
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  buttons: { padding: SIZES.lg, gap: SIZES.md },
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