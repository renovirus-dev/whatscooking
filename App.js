// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import * as SplashScreen        from 'expo-splash-screen';
import { AuthProvider }         from './src/hooks/useAuth';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator             from './src/navigation/AppNavigator';

// ✅ Keep splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Any asset loading goes here
        // Give time for Firebase auth to initialise
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        setAppReady(true);
      }
    };
    prepare();
  }, []);

  // ✅ Called when the root view finishes layout
  // This is the CORRECT moment to hide the splash
  // The app content is already rendered and ready
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      // ✅ Hide splash — content is already visible underneath
      // No fade needed — content shows instantly when splash hides
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  // ✅ While not ready — return null
  // The native splash screen stays visible during this time
  // No blank white screen because splash is still showing
  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          {/*
            ✅ Root view with onLayout callback
            When this renders and layout completes,
            splash hides and this view is immediately visible
            NO opacity animation needed — content is ready first
          */}
          <View
            style={styles.container}
            onLayout={onLayoutRootView}
          >
            <AppNavigator />
          </View>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // ✅ Match your splash background color
    // This prevents any flash when splash hides
    backgroundColor: '#FF6B35',
  },
});