// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import * as Font                from 'expo-font';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { AuthProvider }         from './src/hooks/useAuth';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator             from './src/navigation/AppNavigator';

// ✅ Safely import SplashScreen
let SplashScreen;
try {
  SplashScreen = require('expo-splash-screen');
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  SplashScreen = { hideAsync: async () => {} };
}

// ─────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error);
    console.error('Stack:', errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>App Crashed</Text>
          <Text style={styles.errorText}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <Text style={styles.errorStack}>
            {this.state.error?.stack?.split('\n').slice(0, 5).join('\n') || ''}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // ✅ Pre-load Icon fonts for Web & Mobile
        await Font.loadAsync({
          ...Ionicons.font,
          ...MaterialCommunityIcons.font,
          ...FontAwesome.font,
        });

        // Small delay to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 300));
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
      } catch {}
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationProvider>
            <View style={styles.container} onLayout={onLayoutRootView}>
              <AppNavigator />
            </View>
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
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
    fontSize:   14,
    color:      'rgba(255,255,255,0.9)',
    textAlign:  'center',
    lineHeight: 22,
  },
  errorStack: {
    fontSize:        10,
    color:           'rgba(255,255,255,0.6)',
    textAlign:       'left',
    lineHeight:      16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding:         12,
    borderRadius:    8,
    width:           '100%',
    maxHeight:       150,
  },
  retryBtn: {
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical:   12,
    borderRadius:      8,
    marginTop:         8,
  },
  retryBtnText: {
    color:      '#FF6B35',
    fontWeight: 'bold',
    fontSize:   16,
  },
});