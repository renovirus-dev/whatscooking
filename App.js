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

// ✅ Keep splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Just wait for Firebase auth to initialise
        // Image cache removed - using Cloudinary now
        await new Promise(resolve => setTimeout(resolve, 800));
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
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

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