// ============================================
// FILE: src/utils/checkAppUpdate.js
// ============================================
import { Platform, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

// ✅ URL of version.json hosted on GitHub Pages
const VERSION_JSON_URL = 'https://renovirus-dev.github.io/whatscooking/version.json';

// ✅ Read currently installed version from app.json
const CURRENT_VERSION_CODE = Constants.expoConfig?.android?.versionCode || 1;
const CURRENT_VERSION_NAME = Constants.expoConfig?.version || '1.0.0';

/**
 * Checks GitHub Pages version.json for new APK releases.
 * @param {boolean} silent - If true, stays quiet if user is on latest version.
 */
export async function checkAppUpdate(silent = true) {
  // ── Web Safe Bypass ─────────────────────────
  // ✅ Web users always run the newest build from Firebase Hosting. No APK update needed.
  if (Platform.OS === 'web') {
    if (!silent) {
      alert(`Up to Date ✓\nYou are using the latest live version of What's Cooking (Web v${CURRENT_VERSION_NAME}).`);
    }
    return;
  }

  // ── Android Native App Update Checker ──────
  try {
    // Cache-buster timestamp ensures we fetch fresh JSON every time
    const response = await fetch(`${VERSION_JSON_URL}?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Accept':        'application/json',
      },
    });

    if (!response.ok) {
      if (!silent) {
        Alert.alert('Error', 'Unable to check for updates right now.');
      }
      return;
    }

    const serverConfig = await response.json();

    // Compare server versionCode against app's installed versionCode
    if (serverConfig.versionCode > CURRENT_VERSION_CODE) {
      const buttons = [
        {
          text: 'Download Update',
          onPress: () => {
            if (serverConfig.downloadUrl) {
              Linking.openURL(serverConfig.downloadUrl);
            }
          },
        },
      ];

      // Allow canceling unless forceUpdate is true
      if (!serverConfig.forceUpdate) {
        buttons.unshift({ text: 'Later', style: 'cancel' });
      }

      Alert.alert(
        `🎉 Update Available (v${serverConfig.version})`,
        `${serverConfig.notes || 'A new version of What\'s Cooking is available!'}\n\nWould you like to download it now?`,
        buttons,
        { cancelable: !serverConfig.forceUpdate }
      );
    } else if (!silent) {
      // Manual check response when up to date
      Alert.alert(
        'Up to Date ✓',
        `You are using the latest version of What's Cooking (v${CURRENT_VERSION_NAME}).`
      );
    }
  } catch (err) {
    console.log('checkAppUpdate error:', err.message);
    if (!silent) {
      Alert.alert('Error', 'Unable to connect to update server.');
    }
  }
}