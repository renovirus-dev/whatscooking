// ============================================
// FILE: src/screens/owner/OwnerBookingsScreen.js
// Elite: manage reservations, pre-orders and booking settings
// ============================================
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Switch, StyleSheet } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useLiveCollection } from '../../hooks/useEliteData';
import EliteGate from '../../components/EliteGate';
import { COLORS, SIZES, FONTS } from '../../theme';
import {
  Card, Chip, ChipRow, StatusPill, EmptyState, Loader, PrimaryButton, Input,
} from '../../components/ui';
import {
  formatDateKey, formatTime, formatStamp, money, toDateKey, isValidTime,
  getEliteSettings, updateReservationStatus, updateOrderStatus, ORDER_NEXT,
} from '../../utils/eliteService';

const RES_FILTERS = [
  { key: 'pending',   label: 'Pending' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'past',      label: 'Past' },
];
const ORD_FILTERS = [
  { key: 'active',  label: 'Active' },
  { key: 'done',    label: 'Done' },
];

const run = (promise) => promise.catch(e => Alert.alert('Error', e?.message || 'Something went wrong'));

function Reservations({ restaurant }) {
  const { items, loading, error } = useLiveCollection('reservations', 'restaurantId', restaurant.id);
  const [filter, setFilter] = useState('pending');
  const today = toDateKey(new Date());

  const shown = useMemo(() => {
    const by = {
      pending:  r => r.status === 'pending',
      upcoming: r => r.status === 'confirmed' && r.date >= today,
      past:     r => !['pending'].includes(r.status) && !(r.status === 'confirmed' && r.date >= today),
    }[filter];
    const list = items.filter(by);
    // soonest first for actionable lists
    return filter === 'past' ? list : [...list].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [items, filter, today]);

  if (loading) return <Loader />;
  const pendingCount = items.filter(r => r.status === 'pending').length;

  return (
    <>
      <ChipRow>
        {RES_FILTERS.map(f => (
          <Chip key={f.key}
            label={f.key === 'pending' && pendingCount ? `Pending (${pendingCount})` : f.label}
            active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      {error && <EmptyState emoji="⚠️" title="Could not load" subtitle={error.message} />}
      {!error && shown.length === 0 && <EmptyState emoji="🪑" title="Nothing here yet" />}
      {shown.map(r => (
        <Card key={r.id}>
          <View style={s.head}>
            <Text style={s.title} numberOfLines={2}>{r.customerName}</Text>
            <StatusPill status={r.status} />
          </View>
          <Text style={s.line}>📅 {formatDateKey(r.date)} at {formatTime(r.time)}</Text>
          <Text style={s.line}>👥 Party of {r.partySize}{r.branchName ? ` · ${r.branchName}` : ''}</Text>
          <Text style={s.line}>📞 {r.customerPhone}</Text>
          {!!r.notes && <Text style={s.note}>“{r.notes}”</Text>}
          {r.status === 'pending' && (
            <View style={s.actions}>
              <PrimaryButton label="Confirm" color={COLORS.success} style={s.flex}
                onPress={() => run(updateReservationStatus(r, 'confirmed', { byOwner: true }))} />
              <PrimaryButton label="Decline" outline color={COLORS.error} style={s.flex}
                onPress={() => run(updateReservationStatus(r, 'declined', { byOwner: true }))} />
            </View>
          )}
          {r.status === 'confirmed' && (
            <View style={s.actions}>
              <PrimaryButton label="Completed" color={COLORS.success} style={s.flex}
                onPress={() => run(updateReservationStatus(r, 'completed', { byOwner: true }))} />
              <PrimaryButton label="No show" outline color={COLORS.error} style={s.flex}
                onPress={() => run(updateReservationStatus(r, 'no_show', { byOwner: true }))} />
            </View>
          )}
        </Card>
      ))}
    </>
  );
}

function Orders({ restaurant }) {
  const { items, loading, error } = useLiveCollection('orders', 'restaurantId', restaurant.id);
  const [filter, setFilter] = useState('active');

  const shown = useMemo(() => items.filter(o =>
    filter === 'active'
      ? ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
      : ['completed', 'declined', 'cancelled'].includes(o.status)
  ), [items, filter]);

  if (loading) return <Loader />;
  const activeCount = items.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)).length;

  return (
    <>
      <ChipRow>
        {ORD_FILTERS.map(f => (
          <Chip key={f.key}
            label={f.key === 'active' && activeCount ? `Active (${activeCount})` : f.label}
            active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      {error && <EmptyState emoji="⚠️" title="Could not load" subtitle={error.message} />}
      {!error && shown.length === 0 && <EmptyState emoji="🥡" title="No orders here" />}
      {shown.map(o => {
        const next = ORDER_NEXT[o.status];
        return (
          <Card key={o.id}>
            <View style={s.head}>
              <Text style={s.title} numberOfLines={2}>{o.customerName}</Text>
              <StatusPill status={o.status} />
            </View>
            {o.items?.map((i, idx) => <Text key={idx} style={s.line}>{i.qty}× {i.name}</Text>)}
            <Text style={s.line}>🕒 Pickup ~{formatStamp(o.pickupAt)}{o.branchName ? ` · ${o.branchName}` : ''}</Text>
            <Text style={s.line}>📞 {o.customerPhone}</Text>
            {!!o.notes && <Text style={s.note}>“{o.notes}”</Text>}
            <Text style={s.total}>
              {o.discount > 0 ? `${o.couponCode} -${money(o.discount)} · ` : ''}Total {money(o.total)}
            </Text>
            {next && (
              <View style={s.actions}>
                <PrimaryButton label={next.label} color={COLORS.success} style={s.flex}
                  onPress={() => run(updateOrderStatus(o, next.status, { byOwner: true }))} />
                {o.status === 'pending' && (
                  <PrimaryButton label="Decline" outline color={COLORS.error} style={s.flex}
                    onPress={() => run(updateOrderStatus(o, 'declined', { byOwner: true }))} />
                )}
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

function Settings({ restaurant }) {
  const initial = useMemo(() => getEliteSettings(restaurant), [restaurant]);
  const [form, setForm] = useState({
    reservationsEnabled: initial.reservationsEnabled,
    preordersEnabled:    initial.preordersEnabled,
    maxPartySize:        String(initial.maxPartySize),
    openTime:            initial.openTime,
    closeTime:           initial.closeTime,
    prepMinutes:         String(initial.prepMinutes),
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    setForm({
      reservationsEnabled: initial.reservationsEnabled,
      preordersEnabled:    initial.preordersEnabled,
      maxPartySize:        String(initial.maxPartySize),
      openTime:            initial.openTime,
      closeTime:           initial.closeTime,
      prepMinutes:         String(initial.prepMinutes),
    });
  }, [initial]);

  const save = useCallback(async () => {
    const party = parseInt(form.maxPartySize, 10);
    const prep  = parseInt(form.prepMinutes, 10);
    if (!isValidTime(form.openTime) || !isValidTime(form.closeTime)) {
      Alert.alert('Invalid time', 'Use 24-hour HH:MM, for example 11:00 and 21:30.'); return;
    }
    if (form.openTime >= form.closeTime) {
      Alert.alert('Invalid hours', 'Closing time must be after opening time.'); return;
    }
    if (!(party >= 1 && party <= 50)) { Alert.alert('Invalid party size', 'Enter 1 to 50.'); return; }
    if (!(prep >= 5 && prep <= 240)) { Alert.alert('Invalid prep time', 'Enter 5 to 240 minutes.'); return; }
    setBusy(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        eliteSettings: {
          reservationsEnabled: form.reservationsEnabled,
          preordersEnabled:    form.preordersEnabled,
          maxPartySize:        party,
          openTime:            form.openTime,
          closeTime:           form.closeTime,
          prepMinutes:         prep,
        },
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Saved', 'Booking settings updated.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setBusy(false); }
  }, [form, restaurant.id]);

  return (
    <>
      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Accept reservations</Text>
            <Text style={s.note}>Show “Reserve a table” to customers</Text>
          </View>
          <Switch value={form.reservationsEnabled} onValueChange={set('reservationsEnabled')}
            trackColor={{ true: COLORS.primary, false: COLORS.border }} />
        </View>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Accept pre-orders</Text>
            <Text style={s.note}>Show “Order ahead” to customers</Text>
          </View>
          <Switch value={form.preordersEnabled} onValueChange={set('preordersEnabled')}
            trackColor={{ true: COLORS.primary, false: COLORS.border }} />
        </View>
      </Card>
      <Card>
        <View style={s.actions}>
          <View style={s.flex}><Input label="Opens (HH:MM)" value={form.openTime}
            onChangeText={set('openTime')} placeholder="11:00" maxLength={5} /></View>
          <View style={s.flex}><Input label="Closes (HH:MM)" value={form.closeTime}
            onChangeText={set('closeTime')} placeholder="21:00" maxLength={5} /></View>
        </View>
        <View style={s.actions}>
          <View style={s.flex}><Input label="Max party size" value={form.maxPartySize}
            onChangeText={set('maxPartySize')} keyboardType="number-pad" maxLength={2} /></View>
          <View style={s.flex}><Input label="Order prep (min)" value={form.prepMinutes}
            onChangeText={set('prepMinutes')} keyboardType="number-pad" maxLength={3} /></View>
        </View>
      </Card>
      <PrimaryButton label="Save settings" icon="save-outline" onPress={save} loading={busy} />
    </>
  );
}

export default function OwnerBookingsScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.tab || 'reservations');
  return (
    <EliteGate navigation={navigation} feature="Bookings">
      {(restaurant) => (
        <ScrollView style={s.container} contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ChipRow>
            <Chip label="🪑 Reservations" active={tab === 'reservations'} onPress={() => setTab('reservations')} />
            <Chip label="🥡 Pre-orders" active={tab === 'orders'} onPress={() => setTab('orders')} />
            <Chip label="⚙️ Settings" active={tab === 'settings'} onPress={() => setTab('settings')} />
          </ChipRow>
          {tab === 'reservations' && <Reservations restaurant={restaurant} />}
          {tab === 'orders'       && <Orders restaurant={restaurant} />}
          {tab === 'settings'     && <Settings restaurant={restaurant} />}
        </ScrollView>
      )}
    </EliteGate>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.xxl },
  head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SIZES.sm },
  title:     { flex: 1, fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  line:      { fontSize: FONTS.md, color: COLORS.text },
  note:      { fontSize: FONTS.sm, color: COLORS.textLight },
  total:     { fontSize: FONTS.md, fontWeight: '700', color: COLORS.primary },
  actions:   { flexDirection: 'row', gap: SIZES.sm },
  flex:      { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
});
