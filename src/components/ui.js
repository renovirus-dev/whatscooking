// ============================================
// FILE: src/components/ui.js
// Small shared UI pieces for the Elite screens (Android + web safe)
// ============================================
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../theme';
import { STATUS_META } from '../utils/eliteService';

export const FormScreen = ({ children, footer }) => {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingBottom: footer ? SIZES.md : insets.bottom + SIZES.xl },
        ]}
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
};

export const FooterBar = ({ children }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, SIZES.sm) + SIZES.sm }]}>
      {children}
    </View>
  );
};

export const Card = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const SectionTitle = ({ children }) => (
  <Text style={s.sectionTitle}>{children}</Text>
);

export const Label = ({ children }) => <Text style={s.label}>{children}</Text>;

export const Input = ({ label, style, ...props }) => (
  <View style={{ gap: 4 }}>
    {!!label && <Label>{label}</Label>}
    <TextInput
      placeholderTextColor={COLORS.textMuted}
      style={[s.input, props.multiline && s.inputMulti, style]}
      {...props}
    />
  </View>
);

export const Chip = ({ label, active, onPress, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    style={[s.chip, active && s.chipActive, disabled && { opacity: 0.4 }]}
  >
    <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// Horizontal single-row chip scroller
export const ChipRow = ({ children }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={s.chipScroll}
    contentContainerStyle={s.chipRow}
    nestedScrollEnabled
  >
    {children}
  </ScrollView>
);

// Wrapping chip grid (used for time slots)
export const ChipGrid = ({ children }) => <View style={s.chipGrid}>{children}</View>;

export const PrimaryButton = ({
  label, onPress, loading, disabled, color = COLORS.primary, icon, outline, style,
}) => {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.8}
      style={[
        s.btn,
        outline
          ? { borderColor: color, borderWidth: 1.5, backgroundColor: 'transparent' }
          : { backgroundColor: color },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={outline ? color : '#FFF'} />
      ) : (
        <>
          {!!icon && <Ionicons name={icon} size={18} color={outline ? color : '#FFF'} />}
          <Text style={[s.btnText, outline && { color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export const Stepper = ({ value, onChange, min = 0, max = 99 }) => (
  <View style={s.stepper}>
    <TouchableOpacity
      style={[s.stepBtn, value <= min && { opacity: 0.35 }]}
      disabled={value <= min}
      onPress={() => onChange(value - 1)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="remove" size={18} color={COLORS.primary} />
    </TouchableOpacity>
    <Text style={s.stepValue}>{value}</Text>
    <TouchableOpacity
      style={[s.stepBtn, value >= max && { opacity: 0.35 }]}
      disabled={value >= max}
      onPress={() => onChange(value + 1)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="add" size={18} color={COLORS.primary} />
    </TouchableOpacity>
  </View>
);

export const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, color: COLORS.textMuted };
  return (
    <View style={[s.pill, { backgroundColor: meta.color + '20' }]}>
      <Text style={[s.pillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
};

export const EmptyState = ({ emoji = '📭', title, subtitle }) => (
  <View style={s.empty}>
    <Text style={{ fontSize: 44 }}>{emoji}</Text>
    <Text style={s.emptyTitle}>{title}</Text>
    {!!subtitle && <Text style={s.emptySub}>{subtitle}</Text>}
  </View>
);

export const Loader = () => (
  <View style={[s.flex, s.center]}>
    <ActivityIndicator size="large" color={COLORS.primary} />
  </View>
);

const s = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: COLORS.background },
  center:  { justifyContent: 'center', alignItems: 'center' },
  content: { padding: SIZES.md, gap: SIZES.md },
  footer: {
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SIZES.md, paddingTop: SIZES.sm,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SIZES.md, gap: SIZES.sm, ...SHADOW,
  },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  label:        { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.textLight },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SIZES.md, paddingVertical: 10,
    fontSize: FONTS.md, color: COLORS.text,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  chipScroll: { flexGrow: 0 },
  chipRow:    { gap: SIZES.sm, paddingVertical: 2, paddingRight: SIZES.md },
  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  chip: {
    paddingHorizontal: SIZES.md, paddingVertical: 8, borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, paddingHorizontal: SIZES.md, borderRadius: RADIUS.lg,
  },
  btnText: { color: '#FFF', fontSize: FONTS.lg, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { minWidth: 24, textAlign: 'center', fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  pill:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.round },
  pillText: { fontSize: FONTS.xs + 1, fontWeight: '700' },
  empty:    { alignItems: 'center', padding: SIZES.xl, gap: 6 },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptySub:   { fontSize: FONTS.sm, color: COLORS.textLight, textAlign: 'center' },
});
