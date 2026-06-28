// ============================================
// FILE: src/hooks/useAnalytics.js
// ============================================
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, doc, updateDoc,
  increment, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

// ─── Cache anonymous ID in memory ────────────
let cachedAnonId = null;

export async function getAnonymousId() {
  if (cachedAnonId) return cachedAnonId;

  try {
    let id = await AsyncStorage.getItem('anonymousId');
    if (!id) {
      id =
        'anon_' +
        Date.now() +
        '_' +
        Math.random().toString(36).substr(2, 9);
      await AsyncStorage.setItem('anonymousId', id);
    }
    cachedAnonId = id;
    return id;
  } catch {
    cachedAnonId = 'session_' + Date.now();
    return cachedAnonId;
  }
}

// ─── Main analytics hook ──────────────────────
export function useAnalytics() {
  const { user } = useAuth();

  // ─── Get actor ID ────────────────────────────
  const getActorId = async () => {
    if (user?.uid) return { id: user.uid, type: 'user' };
    const anonId = await getAnonymousId();
    return { id: anonId, type: 'guest' };
  };

  // ─── Track restaurant view ───────────────────
  const trackRestaurantView = async (restaurantId, restaurantName) => {
    if (!restaurantId) return;

    try {
      const actor = await getActorId();

      // ✅ ONLY log the event - no restaurant doc update
      // This works for guests AND logged-in users
      await addDoc(collection(db, 'analyticsEvents'), {
        type:           'restaurant_view',
        restaurantId,
        restaurantName: restaurantName || '',
        actorId:        actor.id,
        actorType:      actor.type,
        userId:         user?.uid || null,
        timestamp:      serverTimestamp(),
        platform:       getPlatform(),
      });

      // ✅ Only update restaurant doc if user is logged in
      // Guests cannot update restaurant docs
      if (user?.uid) {
        await updateDoc(doc(db, 'restaurants', restaurantId), {
          'analytics.totalViews':   increment(1),
          'analytics.weeklyViews':  increment(1),
          'analytics.monthlyViews': increment(1),
          updatedAt:                serverTimestamp(),
        }).catch(err => {
          // ✅ Silently fail - not critical
          console.log('Could not update view counter:', err.message);
        });
      }

    } catch (err) {
      console.log('Analytics trackRestaurantView:', err.message);
    }
  };

  // ─── Track action ────────────────────────────
  const trackAction = async (restaurantId, restaurantName, action) => {
    if (!restaurantId) return;

    try {
      const actor = await getActorId();

      // ✅ Always log the event (guests + users)
      await addDoc(collection(db, 'analyticsEvents'), {
        type:           `action_${action}`,
        restaurantId,
        restaurantName: restaurantName || '',
        actorId:        actor.id,
        actorType:      actor.type,
        userId:         user?.uid || null,
        timestamp:      serverTimestamp(),
        platform:       getPlatform(),
      });

      // ✅ Only increment counters if user is logged in
      if (user?.uid) {
        const fieldMap = {
          call:       'analytics.totalCalls',
          whatsapp:   'analytics.totalWhatsApp',
          directions: 'analytics.totalDirections',
          website:    'analytics.totalWebsiteClicks',
        };

        const field = fieldMap[action];
        if (field) {
          await updateDoc(doc(db, 'restaurants', restaurantId), {
            [field]:   increment(1),
            updatedAt: serverTimestamp(),
          }).catch(err => {
            console.log('Could not update action counter:', err.message);
          });
        }
      }

    } catch (err) {
      console.log('Analytics trackAction:', err.message);
    }
  };

  // ─── Track menu item view ────────────────────
  const trackMenuItemView = async (itemId, itemName, restaurantId) => {
    if (!itemId) return;

    try {
      const actor = await getActorId();

      // ✅ Always log the event
      await addDoc(collection(db, 'analyticsEvents'), {
        type:         'menu_item_view',
        itemId,
        itemName:     itemName || '',
        restaurantId,
        actorId:      actor.id,
        actorType:    actor.type,
        userId:       user?.uid || null,
        timestamp:    serverTimestamp(),
        platform:     getPlatform(),
      });

      // ✅ Only increment viewCount if user is logged in
      // OR use Option A rules to allow guest updates
      if (user?.uid) {
        await updateDoc(doc(db, 'menuItems', itemId), {
          viewCount: increment(1),
          updatedAt: serverTimestamp(),
        }).catch(err => {
          console.log('Could not update view count:', err.message);
        });
      }

    } catch (err) {
      console.log('Analytics trackMenuItemView:', err.message);
    }
  };

  // ─── Track search ─────────────────────────────
  const trackSearch = async (searchTerm, resultsCount) => {
    if (!searchTerm?.trim()) return;

    try {
      const actor = await getActorId();

      await addDoc(collection(db, 'analyticsEvents'), {
        type:         'search',
        searchTerm:   searchTerm.toLowerCase().trim(),
        resultsCount: resultsCount || 0,
        actorId:      actor.id,
        actorType:    actor.type,
        userId:       user?.uid || null,
        timestamp:    serverTimestamp(),
        platform:     getPlatform(),
      });

    } catch (err) {
      console.log('Analytics trackSearch:', err.message);
    }
  };

  // ─── Track time spent on page ─────────────────
  const usePageTimer = (restaurantId) => {
    const startTime = useRef(Date.now());

    useEffect(() => {
      if (!restaurantId) return;
      startTime.current = Date.now();

      return () => {
        const secondsSpent = Math.round(
          (Date.now() - startTime.current) / 1000
        );

        // Only track if more than 3 seconds
        if (secondsSpent < 3) return;

        // ✅ Only update if user is logged in
        if (user?.uid) {
          updateDoc(doc(db, 'restaurants', restaurantId), {
            'analytics.totalTimeSpent': increment(secondsSpent),
            'analytics.totalSessions':  increment(1),
          }).catch(() => {});
        }
      };
    }, [restaurantId]);
  };

  return {
    trackRestaurantView,
    trackAction,
    trackMenuItemView,
    trackSearch,
    usePageTimer,
  };
}

// ─── Get platform ─────────────────────────────
function getPlatform() {
  try {
    const { Platform } = require('react-native');
    return Platform.OS;
  } catch {
    return 'unknown';
  }
}