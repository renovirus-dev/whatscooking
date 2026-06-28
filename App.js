import React, { useState, useEffect } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase/config';
import RootNavigator from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });

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
    <SafeAreaProvider>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </Animated.View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});