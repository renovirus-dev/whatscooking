// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text }                  from 'react-native';
import { SafeAreaProvider }                        from 'react-native-safe-area-context';
import * as SplashScreen                           from 'expo-splash-screen';
import { AuthProvider }                            from './src/hooks/useAuth';
import { NotificationProvider }                    from './src/context/NotificationContext';
import AppNavigator                                from './src/navigation/AppNavigator';

// ✅ Prevent splash from auto-hiding
// Called outside component so it runs immediately
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented or unavailable — ignore
});

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Short delay for Firebase auth to initialise
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn('App prepare error:', err);
        setError(err.message);
      } finally {
        // ✅ Always mark ready — never get stuck on splash
        setAppReady(true);
      }
    };
    prepare();
  }, []);

  // ✅ Hide splash once root view renders
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Already hidden — ignore
      }
    }
  }, [appReady]);

  // ✅ Return null = keeps native splash visible
  if (!appReady) return null;

  // ✅ Show error screen if startup crashed
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
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
    padding:         24,
    backgroundColor: '#FF6B35',
    gap:             12,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize:   22,
    fontWeight: 'bold',
    color:      '#FFFFFF',
    textAlign:  'center',
  },
  errorText: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.85)',
    textAlign:  'center',
    lineHeight: 20,
  },
});