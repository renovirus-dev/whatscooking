// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';  // ✅ NEW
import { auth } from './src/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import RootNavigator from './src/navigation/RootNavigator';

// ✅ Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Wait for Firebase auth to initialize
        await new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });

        // Add minimum splash time so it does not flash
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();

        // Fade in the app
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    };

    prepare();
  }, []);

  if (!appReady) return null;

  return (
	<SafeAreaProvider>
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </Animated.View>
	<SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});