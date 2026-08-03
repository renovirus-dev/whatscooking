// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text }     from 'react-native';
import { SafeAreaProvider }           from 'react-native-safe-area-context';
import * as SplashScreen              from 'expo-splash-screen';
import { AuthProvider }               from './src/hooks/useAuth';
import { NotificationProvider }       from './src/context/NotificationContext';
import AppNavigator                   from './src/navigation/AppNavigator';

// ✅ Prevent auto-hide
try {
  SplashScreen.preventAutoHideAsync();
} catch {}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Short delay for Firebase auth init
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn('App prepare error:', err);
        setError(err.message);
      } finally {
        setAppReady(true);
        // ✅ Hide splash as soon as app is ready
        try {
          await SplashScreen.hideAsync();
        } catch {}
      }
    };
    prepare();
  }, []);

  // ✅ Show nothing while preparing
  // Native splash stays visible
  if (!appReady) return null;

  // ✅ Show error if something crashed on startup
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Startup Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <View style={styles.container}>
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
    fontSize:     24,
    fontWeight:   'bold',
    color:        '#FFFFFF',
    marginBottom: 12,
    textAlign:    'center',
  },
  errorText: {
    fontSize:  14,
    color:     'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
});