// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import * as SplashScreen        from 'expo-splash-screen';
import { AuthProvider }         from './src/hooks/useAuth';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator             from './src/navigation/AppNavigator';

// ✅ Prevent auto-hide — we control when it hides
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not available - ignore
});

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Give splash screen time to show
        // AND give Firebase auth time to initialise
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.warn('App prepare error:', err);
      } finally {
        setAppReady(true);
      }
    };
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Splash already hidden - ignore
      }
    }
  }, [appReady]);

  // ✅ Return null keeps native splash visible
  if (!appReady) return null;

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
    flex:            1,
    backgroundColor: '#FF6B35',
  },
});