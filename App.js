// ============================================
// FILE: App.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Animated,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaProvider }      from 'react-native-safe-area-context';
import * as SplashScreen         from 'expo-splash-screen';
import { AuthProvider }          from './src/hooks/useAuth';
import { NotificationProvider }  from './src/context/NotificationContext';
import AppNavigator              from './src/navigation/AppNavigator';

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
          toValue:         1,
          duration:        400,
          useNativeDriver: true,
        }).start();
      }
    };
    prepare();
  }, []);

  if (!appReady) {
    return <View style={styles.splashFallback} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <AuthProvider>
        {/*
          ✅ NotificationProvider inside AuthProvider
          so it has access to user from useAuth()
          ✅ Outside AppNavigator so listener never
          mounts/unmounts when navigating between screens
        */}
        <NotificationProvider>
          <Animated.View
            style={[styles.container, { opacity: fadeAnim }]}
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
    backgroundColor: '#F8F9FA',
  },
  splashFallback: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});