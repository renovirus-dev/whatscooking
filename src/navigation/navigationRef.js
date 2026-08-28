// ============================================
// FILE: src/navigation/navigationRef.js
// ============================================
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    // If navigation is not ready yet (e.g. app cold starting), retry in 500ms
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate(name, params);
      }
    }, 500);
  }
}