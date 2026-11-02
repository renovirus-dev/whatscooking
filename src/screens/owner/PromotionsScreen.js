// ============================================
// FILE: src/screens/owner/PromotionsScreen.js
// Elite: coupon codes
// ============================================
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useLiveCollection } from '../../hooks/useEliteData';
import EliteGate from '../../components/EliteGate';
import { COLORS, SIZES, FONTS } from '../../theme';
import {
  Card, SectionTitle, Input, Chip, ChipRow, PrimaryButton, EmptyState, Loader,
} from '../../components/ui';
import {
  createPromotion, setPromotionActive, deletePromotion, describePromotion, money,
} from '../../utils/eliteService';

const EXPIRY_OPTIONS = [
  { label: 'No expiry', days: 0 },
  { label: '7 days',    days: 7 },
  { label: '30 days',   days: 30 },
  { label: '90 days',   days: 90 },
];

function PromoList({ restaurant }) {
  const { items, loading, error } = useLiveCollection('promotions', 'restaurantId', restaurant.id);
  const [code, setCode]       = useState('');
  const [type, setType]       = useState('percent');
  const [value, setValue]     = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [limit, setLimit]     = useState('');
  const [expiry, setExpiry]   = useState(0);
  const [desc, setDesc]       = useState('');
  const [busy, setBusy]       = useState(false);

  const create = useCallback(async () => {
    const cleanCode = code.trim().toUpperCase();
    const v = parseFloat(value);
    if (!/^[A-Z0-9]{3,16}$/.test(cleanCode)) {
      Alert.alert('Invalid code', 'Use 3–16 letters or numbers, no spaces.'); return;
    }
    if (!(v > 0)) { Alert.alert('Invalid value', 'Enter a discount greater than 0.'); return; }
    if (type === 'percent' && v > 100) { Alert.alert('Invalid value', 'Percent cannot exceed 100.'); return; }
    const min = minOrder ? parseFloat(minOrder) : 0;
    const lim = limit ? parseInt(limit, 10) : 0;
    if (Number.isNaN(min) || min < 0 || Number.isNaN(lim) || lim < 0) {
      Alert.alert('Invalid number', 'Check the minimum order and usage limit.'); return;
    }
    setBusy(true);
    try {
      const expiresAt = expiry
        ? new Date(Date.now() + expiry * 86400000).toISOString() : null;
      await createPromotion(restaurant, {
        code: cleanCode, type, value: v, minOrder: min, usageLimit: lim,
        expiresAt, description: desc,
      });
      setCode(''); setValue(''); setMinOrder(''); setLimit(''); setDesc(''); setExpiry(0);
    } catch (e) {
      Alert.alert('Could not create', e.message);
    } finally { setBusy(false); }
  }, [code, type, value, minOrder, limit, expiry, desc, restaurant]);

  const remove = useCallback((p) => {
    Alert.alert('Delete code?', `${p.code} will stop working.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: () => deletePromotion(p).catch(e => Alert.alert('Error', e.message)) },
    ]);
  }, []);

  return (
    <>
      <Card>
        <SectionTitle>New promo code</SectionTitle>
        <Input label="Code" value={code} onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="WELCOME10" autoCapitalize="characters" autoCorrect={false} maxLength={16} />
        <ChipRow>
          <Chip label="% off" active={type === 'percent'} onPress={() => setType('percent')} />
          <Chip label="$ off" active={type === 'fixed'} onPress={() => setType('fixed')} />
        </ChipRow>
        <Input label={type === 'percent' ? 'Percent off' : 'Amount off ($)'} value={value}
          onChangeText={setValue} keyboardType="decimal-pad" placeholder={type === 'percent' ? '10' : '5.00'} />
        <View style={s.row}>
          <View style={s.flex}><Input label="Min order ($)" value={minOrder}
            onChangeText={setMinOrder} keyboardType="decimal-pad" placeholder="0" /></View>
          <View style={s.flex}><Input label="Max uses" value={limit}
            onChangeText={setLimit} keyboardType="number-pad" placeholder="Unlimited" /></View>
        </View>
        <ChipRow>
          {EXPIRY_OPTIONS.map(o => (
            <Chip key={o.days} label={o.label} active={expiry === o.days} onPress={() => setExpiry(o.days)} />
          ))}
        </ChipRow>
        <Input label="Description (optional)" value={desc} onChangeText={setDesc}
          placeholder="Welcome offer for new customers" maxLength={100} />
        <PrimaryButton label="Create code" icon="pricetag-outline" onPress={create} loading={busy} />
      </Card>

      <SectionTitle>Your codes</SectionTitle>
      {loading && <Loader />}
      {error && <EmptyState emoji="⚠️" title="Could not load" subtitle={error.message} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState emoji="🏷️" title="No promo codes yet" subtitle="Create one above to reward customers." />
      )}
      {items.map(p => {
        const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
        const used    = p.usageCount || 0;
        const full    = p.usageLimit > 0 && used >= p.usageLimit;
        const live    = p.isActive && !expired && !full;
        return (
          <Card key={p.id}>
            <View style={s.row}>
              <Text style={s.code}>{p.code}</Text>
              <Text style={[s.badge, { color: live ? COLORS.success : COLORS.textMuted }]}>
                {live ? 'Live' : expired ? 'Expired' : full ? 'Used up' : 'Paused'}
              </Text>
            </View>
            <Text style={s.line}>
              {describePromotion(p)}
              {p.minOrder > 0 ? ` · min ${money(p.minOrder)}` : ''}
            </Text>
            <Text style={s.note}>
              Used {used}{p.usageLimit > 0 ? ` / ${p.usageLimit}` : ''}
              {p.expiresAt ? ` · expires ${new Date(p.expiresAt).toLocaleDateString()}` : ''}
            </Text>
            {!!p.description && <Text style={s.note}>{p.description}</Text>}
            <View style={s.row}>
              <PrimaryButton outline style={s.flex}
                color={p.isActive ? COLORS.warning : COLORS.success}
                label={p.isActive ? 'Pause' : 'Resume'}
                onPress={() => setPromotionActive(p, !p.isActive).catch(e => Alert.alert('Error', e.message))} />
              <PrimaryButton outline color={COLORS.error} label="Delete" style={s.flex} onPress={() => remove(p)} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

export default function PromotionsScreen({ navigation }) {
  return (
    <EliteGate navigation={navigation} feature="Promotions">
      {(restaurant) => (
        <ScrollView style={s.container} contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PromoList restaurant={restaurant} />
        </ScrollView>
      )}
    </EliteGate>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.xxl },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm },
  flex:      { flex: 1 },
  code:      { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text, letterSpacing: 1, flexShrink: 1 },
  badge:     { fontSize: FONTS.sm, fontWeight: '700' },
  line:      { fontSize: FONTS.md, color: COLORS.text },
  note:      { fontSize: FONTS.sm, color: COLORS.textLight },
});
