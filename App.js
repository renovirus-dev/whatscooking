// ============================================
// FILE: App.js — FIXED
// ============================================
import React, { useState, useEffect } from 'react';
import { StyleSheet, Animated, StatusBar, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    };
    prepare();
  }, []);

  if (!appReady) {
    // ✅ Return a background-colored view instead of null
    // This prevents the black flash on Android during splash
    return (
      <View style={styles.splashFallback} />
    );
  }

  return (
    // ✅ SafeAreaProvider at the very root — wraps everything
    <SafeAreaProvider>
      {/* 
        ✅ StatusBar config at root level
        - translucent: true  → app draws behind status bar (edge-to-edge)
        - backgroundColor    → transparent so our screens control color
      */}
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <AuthProvider>
        {/*
          ✅ Animated.View needs a backgroundColor so Android
          doesn't show black behind the fade-in animation.
          flex: 1 ensures it fills the entire screen.
        */}
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeAnim },
          ]}
        >
          <AppNavigator />
        </Animated.View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // ✅ prevents black flash on Android
  },
  splashFallback: {
    flex: 1,
    backgroundColor: '#F8F9FA', // ✅ matches your app background
  },
});