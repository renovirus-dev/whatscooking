// ============================================
// FILE: src/hooks/useReviews.js
// ============================================
import { useState, useEffect } from 'react';
import {
  collection, query, where, limit,
  addDoc, updateDoc, deleteDoc,
  doc, getDocs, onSnapshot,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const useReviews = (restaurantId) => {
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [userReview, setUserReview] = useState(null);

  useEffect(() => {
    if (!restaurantId) return;

    const q = query(
      collection(db, 'reviews'),
      where('restaurantId', '==', restaurantId),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      // ✅ Sort by date in memory - no index needed
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setReviews(data);
      setLoading(false);
    }, (err) => {
      console.error('Reviews listener error:', err);
      setLoading(false);
    });

    return unsubscribe;
  }, [restaurantId]);

  // ─── Check if user already reviewed ──────
  const getUserReview = async (userId) => {
    if (!userId || !restaurantId) return null;
    try {
      const q = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', restaurantId),
        where('userId', '==', userId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
      return null;
    } catch (err) {
      console.error('getUserReview error:', err);
      return null;
    }
  };

  // ─── Add review ───────────────────────────
  const addReview = async ({
    userId,
    userName,
    restaurantId: restId,
    rating,
    comment,
  }) => {
    if (!userId) {
      return { success: false, error: 'Must be logged in' };
    }

    try {
      // ✅ Check if user already reviewed
      const existing = await getUserReview(userId);
      if (existing) {
        return {
          success: false,
          error: 'You have already reviewed this restaurant',
        };
      }

      await addDoc(collection(db, 'reviews'), {
        restaurantId: restId,
        userId,
        userName: userName || 'Anonymous',
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });

      // ✅ Update restaurant rating
      await recalculateRating(restId);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─── Update review ────────────────────────
  const updateReview = async (reviewId, rating, comment) => {
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        rating,
        comment: comment.trim(),
        updatedAt: serverTimestamp(),
      });

      await recalculateRating(restaurantId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─── Delete review ────────────────────────
  const deleteReview = async (reviewId) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      await recalculateRating(restaurantId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ─── Recalculate average rating ───────────
  const recalculateRating = async (restId) => {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', restId)
      );
      const snap = await getDocs(q);
      const allReviews = snap.docs.map(d => d.data());

      const total = allReviews.length;
      const avg = total > 0
        ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total
        : 0;

      await updateDoc(doc(db, 'restaurants', restId), {
        averageRating: Math.round(avg * 10) / 10,
        totalReviews: total,
      });
    } catch (err) {
      console.error('recalculateRating error:', err);
    }
  };

  return {
    reviews,
    loading,
    userReview,
    getUserReview,
    addReview,
    updateReview,
    deleteReview,
  };
};