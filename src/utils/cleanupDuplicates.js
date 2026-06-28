// ============================================
// FILE: src/utils/cleanupDuplicates.js
// UPDATED - with proper auth check
// ============================================
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

export const cleanupDuplicateRestaurants = async (ownerId) => {
  // ✅ Check user is logged in before trying to delete
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('❌ Not logged in - cannot cleanup');
    return;
  }

  if (currentUser.uid !== ownerId) {
    console.log('❌ Can only cleanup your own restaurants');
    return;
  }

  try {
    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', ownerId)
    );

    const snap = await getDocs(q);

    if (snap.docs.length <= 1) {
      console.log('✅ No duplicates found');
      return;
    }

    // ✅ Sort by createdAt - keep oldest, delete the rest
    const sorted = snap.docs.sort((a, b) => {
      const dateA = a.data().createdAt?.toMillis?.() || 0;
      const dateB = b.data().createdAt?.toMillis?.() || 0;
      return dateA - dateB; // oldest first
    });

    const [keep, ...duplicates] = sorted;
    console.log(`✅ Keeping: ${keep.id}`);

    for (const duplicate of duplicates) {
      await deleteDoc(doc(db, 'restaurants', duplicate.id));
      console.log(`🗑️ Deleted duplicate: ${duplicate.id}`);
    }

    console.log('✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.log('Fix: Update Firestore rules then try again');
  }
};