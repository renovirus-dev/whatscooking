// ============================================
// FILE: src/components/ReviewCard.js
// ============================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';

// ─── Safe StarRating Import ───────────────────
let StarRating;
try {
  StarRating = require('./StarRating').default;
} catch {
  StarRating = ({ rating = 0, size = 16 }) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? '#F39C12' : COLORS.border}
        />
      ))}
    </View>
  );
}

// ─── Avatar Colors ────────────────────────────
// ✅ Different color per first letter
// Makes reviews look more distinct
const AVATAR_COLORS = [
  '#FF6B35', '#27AE60', '#3498DB', '#9B59B6',
  '#E74C3C', '#F39C12', '#1ABC9C', '#2C3E50',
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

// ─── Date Formatter ───────────────────────────
const formatDate = (timestamp) => {
  if (!timestamp) return 'Recently';
  try {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    const now  = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0)  return 'Today';
    if (days === 1)  return 'Yesterday';
    if (days < 7)   return `${days} days ago`;
    if (days < 30)  return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  } catch {
    return 'Recently';
  }
};

// ─── Rating Label ─────────────────────────────
const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ReviewCard({
  review,
  isOwn    = false,
  onEdit,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(false);

  // ✅ Clamp rating 0-5
  const safeRating = Math.min(
    5, Math.max(0, Math.round(review.rating || 0))
  );

  const avatarColor   = getAvatarColor(review.userName);
  const avatarInitial = review.userName?.[0]?.toUpperCase() || '?';
  const isEdited      = review.updatedAt &&
    review.updatedAt !== review.createdAt;

  // ✅ Long comment detection
  const comment      = review.comment || '';
  const isLong       = comment.length > 160;
  const displayText  = isLong && !expanded
    ? comment.slice(0, 160) + '...'
    : comment;

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <View style={[
      styles.card,
      isOwn && styles.cardOwn,
    ]}>

      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>

        {/* ✅ Colored avatar */}
        <View style={[
          styles.avatar,
          { backgroundColor: avatarColor },
        ]}>
          <Text style={styles.avatarText}>
            {avatarInitial}
          </Text>
        </View>

        {/* Name + Date */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {review.userName || 'Anonymous'}
            </Text>
            {isOwn && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.date}>
              {formatDate(review.createdAt)}
            </Text>
            {/* ✅ Edited indicator */}
            {isEdited && (
              <Text style={styles.editedLabel}>(edited)</Text>
            )}
          </View>
        </View>

        {/* Edit / Delete actions */}
        {isOwn && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                style={styles.actionBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* ── Rating ──────────────────────────── */}
      <View style={styles.ratingRow}>
        <StarRating rating={safeRating} size={16} />
        {/* ✅ Rating number + label */}
        <Text style={styles.ratingNumber}>
          {safeRating}.0
        </Text>
        {RATING_LABELS[safeRating] && (
          <Text style={styles.ratingLabel}>
            · {RATING_LABELS[safeRating]}
          </Text>
        )}
      </View>

      {/* ── Comment ──────────────────────────── */}
      {comment ? (
        <View>
          <Text style={styles.comment}>
            {displayText}
          </Text>
          {/* ✅ Expand/collapse long comments */}
          {isLong && (
            <TouchableOpacity
              onPress={() => setExpanded(v => !v)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.expandBtn}>
                {expanded ? 'Show less ▲' : 'Read more ▼'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text style={styles.noComment}>
          No written review
        </Text>
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    marginBottom:    SIZES.md,
    gap:             SIZES.sm,
    borderWidth:     1,
    borderColor:     'transparent',
    ...SHADOW,
  },
  cardOwn: {
    borderColor:     COLORS.primary + '40',
    backgroundColor: COLORS.primary + '04',
  },

  // ── Header ────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
  },
  avatar: {
    width:          40,
    height:         40,
    borderRadius:   20,
    justifyContent: 'center',
    alignItems:     'center',
  },
  avatarText: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
  },
  userName: {
    fontSize:   FONTS.md,
    fontWeight: '600',
    color:      COLORS.text,
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor:   COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      RADIUS.round,
  },
  youBadgeText: {
    color:      '#FFFFFF',
    fontSize:   10,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  date: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },
  editedLabel: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
  },

  // ── Actions ───────────────────────────────
  actions: { flexDirection: 'row', gap: SIZES.sm },
  actionBtn: {
    padding:    SIZES.xs,
    minWidth:   32,
    minHeight:  32,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Rating ────────────────────────────────
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
  },
  ratingNumber: {
    fontSize:   FONTS.sm,
    fontWeight: '700',
    color:      COLORS.text,
  },
  ratingLabel: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },

  // ── Comment ───────────────────────────────
  comment: {
    fontSize:  FONTS.md,
    color:     COLORS.textLight,
    lineHeight: 22,
  },
  expandBtn: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
    marginTop:  SIZES.xs,
  },
  noComment: {
    fontSize:  FONTS.sm,
    color:     COLORS.textMuted,
    fontStyle: 'italic',
  },
});