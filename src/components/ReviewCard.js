// ============================================
// FILE: src/components/ReviewCard.js
// ============================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';

// ✅ Safe import of StarRating
// If the component doesn't exist — use a simple fallback
let StarRating;
try {
  StarRating = require('./StarRating').default;
} catch (e) {
  // ✅ Fallback — renders plain star icons
  StarRating = ({ rating = 0, size = 16 }) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Ionicons
          key={star}
          name="star"
          size={size}
          color={star <= rating ? '#F39C12' : '#E0E0E0'}
        />
      ))}
    </View>
  );
}

export default function ReviewCard({
  review,
  isOwn   = false,
  onEdit,
  onDelete,
}) {
  // ✅ Safe date formatter
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Recently';
    try {
      const date = timestamp.toDate?.() || new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year:  'numeric',
        month: 'short',
        day:   'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  // ✅ Safe rating — clamp between 0 and 5
  const safeRating = Math.min(
    5,
    Math.max(0, Math.round(review.rating || 0))
  );

  return (
    <View style={[
      styles.card,
      // ✅ Own review gets a subtle highlight
      isOwn && styles.cardOwn,
    ]}>

      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>

        {/* Avatar initial */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {review.userName?.[0]?.toUpperCase() || '👤'}
          </Text>
        </View>

        {/* Name + date */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {review.userName || 'Anonymous'}
            </Text>
            {/* ✅ "You" badge on own review */}
            {isOwn && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <Text style={styles.date}>
            {formatDate(review.createdAt)}
          </Text>
        </View>

        {/* ✅ Edit / Delete for own review */}
        {isOwn && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                style={styles.actionBtn}
                activeOpacity={0.7}
                // ✅ Larger tap area
                hitSlop={{
                  top: 8, bottom: 8,
                  left: 8, right: 8,
                }}
              >
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                style={styles.actionBtn}
                activeOpacity={0.7}
                hitSlop={{
                  top: 8, bottom: 8,
                  left: 8, right: 8,
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={COLORS.error}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Star rating ──────────────────────── */}
      <StarRating
        rating={safeRating}
        size={16}
      />

      {/* ── Comment ──────────────────────────── */}
      {review.comment ? (
        <Text style={styles.comment}>
          {review.comment}
        </Text>
      ) : (
        // ✅ Show placeholder if no comment
        <Text style={styles.noComment}>
          No written review
        </Text>
      )}

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
  // ✅ Own review subtle highlight
  cardOwn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '04',
  },

  // ── Header ───────────────────────────────
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  userName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  // ✅ "You" badge
  youBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.round,
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  date: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Actions ──────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  actionBtn: {
    padding: SIZES.xs,
    // ✅ Minimum tap target size
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Comment ──────────────────────────────
  comment: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
    lineHeight: 22,
    marginTop: SIZES.xs,
  },
  noComment: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: SIZES.xs,
  },
});