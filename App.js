import React, { useState, useEffect } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';

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
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    };
    prepare();
  }, []);

  if (!appReady) {
    return null;
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Animated.View style={styles.container}>
          <AppNavigator />
        </Animated.View>
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});