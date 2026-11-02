// ============================================
// FILE: src/screens/user/PreorderScreen.js
// ============================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS, RADIUS } from '../../theme';
import {
  FormScreen, FooterBar, Card, SectionTitle, Input, Chip, ChipRow,
  PrimaryButton, Stepper, EmptyState, Loader,
} from '../../components/ui';
import {
  canPreorder, getEliteSettings, createOrder, validateCoupon, money, describePromotion,
} from '../../utils/eliteService';

const PICKUP_OPTIONS = [20, 30, 45, 60, 90, 120];

export default function PreorderScreen({ route, navigation }) {
  const restaurant = route.params?.restaurant;
  const { user, userProfile } = useAuth();
  const settings = useMemo(() => getEliteSettings(restaurant), [restaurant]);

  const [menu, setMenu]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty]         = useState({});
  const [pickup, setPickup]   = useState(Math.max(settings.prepMinutes || 30, 20));
  const [branch, setBranch]   = useState(null);
  const [name, setName]       = useState(
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ')
  );
  const [phone, setPhone]     = useState(userProfile?.phone || '');
  const [notes, setNotes]     = useState('');
  const [code, setCode]       = useState('');
  const [promo, setPromo]     = useState(null);
  const [couponMsg, setCouponMsg] = useState(null);
  const [checking, setChecking]   = useState(false);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    if (!restaurant?.id) return undefined;
    return onSnapshot(
      query(
        collection(db, 'menuItems'),
        where('restaurantId', '==', restaurant.id),
        where('isAvailable', '==', true),
      ),
      (snap) => {
        setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.category || '').localeCompare(b.category || '')
            || (a.name || '').localeCompare(b.name || '')));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [restaurant?.id]);

  const items = useMemo(
    () => menu.filter(m => qty[m.id] > 0).map(m => ({
      id: m.id, name: m.name, price: Number(m.price) || 0, qty: qty[m.id],
    })),
    [menu, qty],
  );
  const subtotal = items.reduce((t, i) => t + i.price * i.qty, 0);
  const count    = items.reduce((t, i) => t + i.qty, 0);
  const discount = promo ? Math.min(promo.discount, subtotal) : 0;
  const total    = Math.max(0, subtotal - discount);

  // Changing the cart invalidates a previously validated coupon
  useEffect(() => {
    if (promo) { setPromo(null); setCouponMsg({ ok: false, text: 'Cart changed — re-apply your code' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const applyCoupon = useCallback(async () => {
    if (subtotal <= 0) { setCouponMsg({ ok: false, text: 'Add items first' }); return; }
    setChecking(true);
    try {
      const res = await validateCoupon(restaurant.id, code, subtotal);
      if (res.ok) {
        setPromo({ ...res.promo, discount: res.discount });
        setCouponMsg({ ok: true, text: `${describePromotion(res.promo)} applied` });
      } else {
        setPromo(null);
        setCouponMsg({ ok: false, text: res.message });
      }
    } catch {
      setCouponMsg({ ok: false, text: 'Could not check code, try again' });
    } finally {
      setChecking(false);
    }
  }, [restaurant?.id, code, subtotal]);

  const place = useCallback(async () => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to place a pre-order.'); return; }
    if (items.length === 0) { Alert.alert('Empty order', 'Add at least one item.'); return; }
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your name.'); return; }
    if (phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Phone required', 'Please enter a phone number for pickup updates.');
      return;
    }
    setBusy(true);
    try {
      await createOrder({
        restaurant, user, name, phone, items,
        promo: promo ? { id: promo.id, code: promo.code, type: promo.type, value: promo.value } : null,
        pickupMinutes: pickup, notes, branchName: branch,
      });
      Alert.alert(
        'Order placed 🎉',
        `${restaurant.name} will confirm your order shortly. Pay at pickup.`,
        [{ text: 'OK', onPress: () => navigation.navigate('MyBookings', { tab: 'orders' }) }],
      );
    } catch (err) {
      Alert.alert('Could not place order', err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [user, items, name, phone, promo, pickup, notes, branch, restaurant, navigation]);

  if (!restaurant || !canPreorder(restaurant)) {
    return (
      <EmptyState emoji="🥡" title="Pre-orders unavailable"
        subtitle="This restaurant is not taking online pre-orders right now." />
    );
  }
  if (loading) return <Loader />;

  const grouped = menu.reduce((g, m) => {
    const c = m.category || 'other';
    (g[c] = g[c] || []).push(m);
    return g;
  }, {});

  return (
    <FormScreen
      footer={
        <FooterBar>
          <PrimaryButton
            label={count ? `Place order · ${money(total)}` : 'Place order'}
            icon="bag-check-outline"
            disabled={count === 0}
            onPress={place}
            loading={busy}
          />
        </FooterBar>
      }
    >
      {menu.length === 0 ? (
        <EmptyState emoji="🍽️" title="No items available" subtitle="Check back soon." />
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <Card key={cat}>
            <SectionTitle>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SectionTitle>
            {list.map(item => (
              <View key={item.id} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.itemPrice}>{money(item.price)}</Text>
                </View>
                <Stepper
                  value={qty[item.id] || 0}
                  min={0}
                  max={20}
                  onChange={(v) => setQty(q => ({ ...q, [item.id]: v }))}
                />
              </View>
            ))}
          </Card>
        ))
      )}

      {count > 0 && (
        <>
          {restaurant.branches?.length > 0 && (
            <Card>
              <SectionTitle>Pickup location</SectionTitle>
              <ChipRow>
                <Chip label="Main" active={!branch} onPress={() => setBranch(null)} />
                {restaurant.branches.map(b => (
                  <Chip key={b.id} label={b.name} active={branch === b.name}
                    onPress={() => setBranch(b.name)} />
                ))}
              </ChipRow>
            </Card>
          )}

          <Card>
            <SectionTitle>Pickup in</SectionTitle>
            <ChipRow>
              {PICKUP_OPTIONS.filter(m => m >= (settings.prepMinutes || 20)).map(m => (
                <Chip key={m} label={`${m} min`} active={pickup === m} onPress={() => setPickup(m)} />
              ))}
            </ChipRow>
          </Card>

          <Card>
            <SectionTitle>Promo code</SectionTitle>
            <View style={s.couponRow}>
              <View style={{ flex: 1 }}>
                <Input value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setCouponMsg(null); }}
                  placeholder="Enter code" autoCapitalize="characters" autoCorrect={false} />
              </View>
              <PrimaryButton label="Apply" onPress={applyCoupon} loading={checking}
                disabled={!code.trim()} style={s.applyBtn} />
            </View>
            {!!couponMsg && (
              <Text style={{ color: couponMsg.ok ? COLORS.success : COLORS.error, fontSize: FONTS.sm }}>
                {couponMsg.text}
              </Text>
            )}
          </Card>

          <Card>
            <SectionTitle>Your details</SectionTitle>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Full name" />
            <Input label="Phone" value={phone} onChangeText={setPhone}
              placeholder="876 555 0123" keyboardType="phone-pad" />
            <Input label="Notes (optional)" value={notes} onChangeText={setNotes}
              placeholder="No onions, extra sauce…" multiline maxLength={300} />
          </Card>

          <Card>
            <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><Text style={s.sumVal}>{money(subtotal)}</Text></View>
            {discount > 0 && (
              <View style={s.sumRow}>
                <Text style={[s.sumLabel, { color: COLORS.success }]}>Discount ({promo.code})</Text>
                <Text style={[s.sumVal, { color: COLORS.success }]}>-{money(discount)}</Text>
              </View>
            )}
            <View style={s.sumRow}><Text style={s.totalLabel}>Total (pay at pickup)</Text><Text style={s.totalVal}>{money(total)}</Text></View>
          </Card>
        </>
      )}
    </FormScreen>
  );
}

const s = StyleSheet.create({
  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 4 },
  itemName:  { fontSize: FONTS.md, fontWeight: '600', color: COLORS.text },
  itemPrice: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },
  couponRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  applyBtn:  { paddingVertical: 11, borderRadius: RADIUS.md },
  sumRow:    { flexDirection: 'row', justifyContent: 'space-between', gap: SIZES.sm },
  sumLabel:  { fontSize: FONTS.md, color: COLORS.textLight },
  sumVal:    { fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  totalLabel:{ fontSize: FONTS.lg, color: COLORS.text, fontWeight: '700', flexShrink: 1 },
  totalVal:  { fontSize: FONTS.lg, color: COLORS.primary, fontWeight: '700' },
});
