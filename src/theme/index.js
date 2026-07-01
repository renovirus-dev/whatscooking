// ============================================
// FILE: src/theme/index.js
// ============================================

export const COLORS = {
  // ── Brand ────────────────────────────────
  primary:      '#FF6B35',   // Orange — main brand color
  primaryDark:  '#E55A2B',   // Darker orange — pressed states
  primaryLight: '#FF8C5E',   // Lighter orange — highlights

  // ── Secondary ────────────────────────────
  secondary:    '#2C3E50',   // Dark navy — admin, headers
  accent:       '#27AE60',   // Green — used for price range active

  // ── Backgrounds ──────────────────────────
  background:   '#F8F9FA',   // Light grey — screen backgrounds
  surface:      '#FFFFFF',   // White — cards, inputs

  // ── Text ─────────────────────────────────
  text:         '#2C3E50',   // Dark — primary text
  textLight:    '#7F8C8D',   // Medium grey — secondary text
  textWhite:    '#FFFFFF',   // White — text on colored backgrounds
  textMuted:    '#95A5A6',   // Light grey — placeholders, hints

  // ── Status ───────────────────────────────
  success:      '#27AE60',   // Green — active, verified, available
  warning:      '#F39C12',   // Amber — warnings, stars, pending
  error:        '#E74C3C',   // Red — errors, delete, closed
  info:         '#3498DB',   // Blue — info, edit buttons, links

  // ── UI ───────────────────────────────────
  border:       '#E0E0E0',   // Light grey — input borders, dividers
  divider:      '#EEEEEE',   // Very light grey — list separators
  star:         '#F1C40F',   // Yellow — star ratings
  overlay:      'rgba(0,0,0,0.5)', // Dark overlay — modals, images
};

export const SIZES = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const FONTS = {
  xs:    10,
  sm:    12,
  md:    14,
  lg:    16,
  xl:    18,
  xxl:   24,
  title: 28,
  xxxl:  32,
};

export const RADIUS = {
  sm:    4,
  md:    8,
  lg:    12,
  xl:    16,
  round: 50,
};

export const SHADOW = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius:  4,
  elevation:     3,
};