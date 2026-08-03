// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import * as SplashScreen        from 'expo-splash-screen';
import { AuthProvider }         from './src/hooks/useAuth';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator             from './src/navigation/AppNavigator';

// ✅ Prevent auto-hide
try {
  SplashScreen.preventAutoHideAsync();
} catch {
  // Already prevented or not available
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Short delay for Firebase auth init
        // 500ms is enough - don't need 2000ms
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn('App prepare error:', err);
        setError(err.message);
      } finally {
        // ✅ Always mark ready - never get stuck
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
        // Already hidden or not available - ignore
      }
    }
  }, [appReady]);

  // ✅ Keep splash visible while preparing
  if (!appReady) return null;

  // ✅ Show error screen if something crashed
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
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
    flex:            1,
    backgroundColor: '#FF6B35',
  },
  errorContainer: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         20,
    backgroundColor: '#FF6B35',
  },
  errorTitle: {
    fontSize:   24,
    fontWeight: 'bold',
    color:      '#FFFFFF',
    marginBottom: 12,
  },
  errorText: {
    fontSize:  14,
    color:     'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});