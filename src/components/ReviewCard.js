// ============================================
// FILE: src/components/ReviewCard.js
// ============================================
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StarRating from './StarRating';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';

export default function ReviewCard({
  review,
  isOwn = false,
  onEdit,
  onDelete,
}) {
  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return 'Recently';
    return new Date(timestamp.toDate()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.card}>
      {/* ── Header ─────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {review.userName?.[0]?.toUpperCase() || '👤'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>
            {review.userName || 'Anonymous'}
          </Text>
          <Text style={styles.date}>
            {formatDate(review.createdAt)}
          </Text>
        </View>

        {/* Edit/Delete for own review */}
        {isOwn && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                style={styles.actionBtn}
              >
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                style={styles.actionBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={COLORS.error}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Stars ──────────────────────────── */}
      <StarRating
        rating={review.rating || 0}
        size={16}
      />

      {/* ── Comment ────────────────────────── */}
      {review.comment ? (
        <Text style={styles.comment}>{review.comment}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  userName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  date: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  actionBtn: {
    padding: SIZES.xs,
  },
  comment: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
    marginTop: SIZES.xs,
  },
});