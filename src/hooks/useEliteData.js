// ============================================
// FILE: src/hooks/useEliteData.js
// ============================================
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { tsToMillis } from '../utils/eliteService';

// Live list filtered on one field. Sorted client-side (newest first)
// so no composite Firestore index is needed.
export function useLiveCollection(name, field, value, enabled = true) {
  const [state, setState] = useState({ items: [], loading: true, error: null });

  useEffect(() => {
    if (!enabled || !value) {
      setState({ items: [], loading: false, error: null });
      return undefined;
    }
    setState(s => ({ ...s, loading: true }));
    return onSnapshot(
      query(collection(db, name), where(field, '==', value)),
      (snap) => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
        setState({ items, loading: false, error: null });
      },
      (error) => setState({ items: [], loading: false, error }),
    );
  }, [name, field, value, enabled]);

  return state;
}

// The signed-in owner's restaurant (live)
export function useOwnerRestaurant() {
  const { user } = useAuth();
  const [state, setState] = useState({ restaurant: null, loading: true });

  useEffect(() => {
    if (!user?.uid) {
      setState({ restaurant: null, loading: false });
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'restaurants'), where('ownerId', '==', user.uid)),
      (snap) => setState({
        restaurant: snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() },
        loading: false,
      }),
      () => setState({ restaurant: null, loading: false }),
    );
  }, [user?.uid]);

  return state;
}
