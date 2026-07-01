// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Animated,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import * as SplashScreen        from 'expo-splash-screen';
import * as Font                from 'expo-font';
import { AuthProvider }         from './src/hooks/useAuth';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator             from './src/navigation/AppNavigator';

// ✅ Keep splash screen visible until we say hide
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Load any assets here
        // Add font loading, image pre-loading etc
        // Minimum delay so splash is actually visible
        await Promise.all([
          // ✅ Small delay so splash screen shows
          new Promise(resolve => setTimeout(resolve, 1500)),
          // ✅ Add any font loading here if needed
          // Font.loadAsync({ ... }),
        ]);
      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        // ✅ Mark app as ready
        setAppReady(true);
      }
    };

    prepare();
  }, []);

  // ✅ Called when root view layout is complete
  // This is the correct way to hide splash with expo-splash-screen
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      // ✅ Hide splash — triggers fade in
      await SplashScreen.hideAsync();

      // ✅ Fade in the app
      Animated.timing(fadeAnim, {
        toValue:         1,
        duration:        300,
        useNativeDriver: true,
      }).start();
    }
  }, [appReady, fadeAnim]);

  // ✅ Keep splash visible while preparing
  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <AuthProvider>
        <NotificationProvider>
          {/*
            ✅ onLayout on the root view
            This is what triggers SplashScreen.hideAsync()
            at exactly the right moment
          */}
          <Animated.View
            style={[styles.container, { opacity: fadeAnim }]}
            onLayout={onLayoutRootView}
          >
            <AppNavigator />
          </Animated.View>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B35', // ✅ Match splash background color
  },
  splashFallback: {
    flex: 1,
    backgroundColor: '#FF6B35',
  },
});