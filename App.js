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
// ✅ Load image cache from Firestore at startup
import { loadImageCache }       from './src/utils/imageUpload';

// ✅ Keep splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Run all startup tasks in parallel
        await Promise.all([
          // Give Firebase auth time to initialise
          new Promise(resolve => setTimeout(resolve, 1000)),
          // ✅ Load food image URLs from Firestore
          // If images were downloaded via Image Manager,
          // this loads their Firebase Storage URLs into memory
          // so getAutoFoodImage() returns Firebase URLs
          // instead of Unsplash URLs
          loadImageCache().catch(err => {
            // ✅ Never crash if cache load fails
            // App works fine with Unsplash URLs as fallback
            console.warn('Image cache load failed:', err.message);
          }),
        ]);
      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        setAppReady(true);
      }
    };
    prepare();
  }, []);

  // ✅ Called when the root view finishes layout
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  // ✅ Keep native splash visible while preparing
  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
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
    backgroundColor: '#FF6B35',
  },
});