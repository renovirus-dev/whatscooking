// ============================================
// FILE: src/screens/owner/InsightsScreen.js
// Elite: customer insights + CSV export
// ============================================
import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useLiveCollection } from '../../hooks/useEliteData';
import EliteGate from '../../components/EliteGate';
import { COLORS, SIZES, FONTS } from '../../theme';
import { Card, SectionTitle, PrimaryButton, EmptyState, Loader } from '../../components/ui';
import {
  money, buildCsv, exportCsv, tsToMillis, formatDateKey, formatTime,
} from '../../utils/eliteService';

const REVENUE_STATUSES = ['completed'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Stat = ({ label, value }) => (
  <View style={s.stat}>
    <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

function Insights({ restaurant }) {
  const orders = useLiveCollection('orders', 'restaurantId', restaurant.id);
  const resv   = useLiveCollection('reservations', 'restaurantId', restaurant.id);
  const [exporting, setExporting] = useState(null);

  const data = useMemo(() => {
    const done = orders.items.filter(o => REVENUE_STATUSES.includes(o.status));
    const revenue = done.reduce((t, o) => t + (o.total || 0), 0);

    const dishes = {};
    done.forEach(o => (o.items || []).forEach(i => {
      dishes[i.name] = (dishes[i.name] || 0) + i.qty;
    }));
    const topDishes = Object.entries(dishes).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const byDay = Array(7).fill(0);
    orders.items.forEach(o => { byDay[new Date(tsToMillis(o.createdAt)).getDay()] += 1; });
    resv.items.forEach(r => { byDay[new Date(tsToMillis(r.createdAt)).getDay()] += 1; });
    const maxDay = Math.max(1, ...byDay);

    const customers = {};
    const touch = (id, name, phone, spend, when) => {
      if (!id) return;
      const c = customers[id] || { id, name, phone, visits: 0, spend: 0, last: 0 };
      c.visits += 1; c.spend += spend; c.last = Math.max(c.last, when);
      c.name = name || c.name; c.phone = phone || c.phone;
      customers[id] = c;
    };
    orders.items.forEach(o => {
      if (['declined', 'cancelled'].includes(o.status)) return;
      touch(o.userId, o.customerName, o.customerPhone,
        REVENUE_STATUSES.includes(o.status) ? (o.total || 0) : 0, tsToMillis(o.createdAt));
    });
    resv.items.forEach(r => {
      if (['declined', 'cancelled'].includes(r.status)) return;
      touch(r.userId, r.customerName, r.customerPhone, 0, tsToMillis(r.createdAt));
    });
    const list = Object.values(customers).sort((a, b) => b.spend - a.spend || b.visits - a.visits);

    return {
      revenue,
      avgOrder: done.length ? revenue / done.length : 0,
      doneCount: done.length,
      topDishes, byDay, maxDay, customers: list,
      repeat: list.filter(c => c.visits > 1).length,
      noShows: resv.items.filter(r => r.status === 'no_show').length,
    };
  }, [orders.items, resv.items]);

  const doExport = useCallback(async (kind) => {
    setExporting(kind);
    try {
      let csv; let file;
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'customers') {
        csv = buildCsv([
          { label: 'Name',  get: c => c.name },
          { label: 'Phone', get: c => c.phone },
          { label: 'Visits', get: c => c.visits },
          { label: 'Total spend', get: c => c.spend.toFixed(2) },
          { label: 'Last activity', get: c => new Date(c.last).toISOString().slice(0, 10) },
        ], data.customers);
        file = `customers-${stamp}.csv`;
      } else if (kind === 'orders') {
        csv = buildCsv([
          { label: 'Date', get: o => new Date(tsToMillis(o.createdAt)).toISOString().slice(0, 16).replace('T', ' ') },
          { label: 'Customer', get: o => o.customerName },
          { label: 'Phone', get: o => o.customerPhone },
          { label: 'Items', get: o => (o.items || []).map(i => `${i.qty}x ${i.name}`).join('; ') },
          { label: 'Subtotal', get: o => (o.subtotal ?? 0).toFixed(2) },
          { label: 'Discount', get: o => (o.discount ?? 0).toFixed(2) },
          { label: 'Coupon', get: o => o.couponCode || '' },
          { label: 'Total', get: o => (o.total ?? 0).toFixed(2) },
          { label: 'Status', get: o => o.status },
          { label: 'Location', get: o => o.branchName || 'Main' },
        ], orders.items);
        file = `orders-${stamp}.csv`;
      } else {
        csv = buildCsv([
          { label: 'Date', get: r => r.date },
          { label: 'Time', get: r => r.time },
          { label: 'Customer', get: r => r.customerName },
          { label: 'Phone', get: r => r.customerPhone },
          { label: 'Party size', get: r => r.partySize },
          { label: 'Status', get: r => r.status },
          { label: 'Location', get: r => r.branchName || 'Main' },
          { label: 'Notes', get: r => r.notes || '' },
        ], resv.items);
        file = `reservations-${stamp}.csv`;
      }
      await exportCsv(file, csv);
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Please try again.');
    } finally { setExporting(null); }
  }, [data.customers, orders.items, resv.items]);

  if (orders.loading || resv.loading) return <Loader />;
  const empty = orders.items.length === 0 && resv.items.length === 0;

  return (
    <>
      <View style={s.statsRow}>
        <Stat label="Revenue" value={money(data.revenue)} />
        <Stat label="Avg order" value={money(data.avgOrder)} />
        <Stat label="Customers" value={String(data.customers.length)} />
        <Stat label="Repeat" value={String(data.repeat)} />
      </View>

      {empty && (
        <EmptyState emoji="📊" title="No activity yet"
          subtitle="Insights appear once customers start booking and ordering." />
      )}

      {data.topDishes.length > 0 && (
        <Card>
          <SectionTitle>Top dishes</SectionTitle>
          {data.topDishes.map(([name, qty], i) => (
            <View key={name} style={s.row}>
              <Text style={s.rowName} numberOfLines={1}>{i + 1}. {name}</Text>
              <Text style={s.rowVal}>{qty} sold</Text>
            </View>
          ))}
        </Card>
      )}

      {!empty && (
        <Card>
          <SectionTitle>Busiest days</SectionTitle>
          {data.byDay.map((n, i) => (
            <View key={i} style={s.barRow}>
              <Text style={s.barLabel}>{DAYS[i]}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { flex: n / data.maxDay }]} />
                <View style={{ flex: 1 - n / data.maxDay }} />
              </View>
              <Text style={s.barVal}>{n}</Text>
            </View>
          ))}
          {data.noShows > 0 && <Text style={s.note}>{data.noShows} reservation no-show(s)</Text>}
        </Card>
      )}

      {data.customers.length > 0 && (
        <Card>
          <SectionTitle>Top customers</SectionTitle>
          {data.customers.slice(0, 8).map(c => (
            <View key={c.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{c.name || 'Customer'}</Text>
                <Text style={s.note}>{c.visits} visit{c.visits === 1 ? '' : 's'}</Text>
              </View>
              <Text style={s.rowVal}>{money(c.spend)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <SectionTitle>Export (CSV)</SectionTitle>
        <PrimaryButton outline icon="people-outline" label="Customers"
          loading={exporting === 'customers'} disabled={data.customers.length === 0}
          onPress={() => doExport('customers')} />
        <PrimaryButton outline icon="bag-outline" label="Pre-orders"
          loading={exporting === 'orders'} disabled={orders.items.length === 0}
          onPress={() => doExport('orders')} />
        <PrimaryButton outline icon="calendar-outline" label="Reservations"
          loading={exporting === 'reservations'} disabled={resv.items.length === 0}
          onPress={() => doExport('reservations')} />
      </Card>
    </>
  );
}

export default function InsightsScreen({ navigation }) {
  return (
    <EliteGate navigation={navigation} feature="Customer insights">
      {(restaurant) => (
        <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Insights restaurant={restaurant} />
        </ScrollView>
      )}
    </EliteGate>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.xxl },
  statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  stat: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: COLORS.surface,
    borderRadius: 12, padding: SIZES.md, alignItems: 'center',
  },
  statValue: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: FONTS.sm, color: COLORS.textLight },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm },
  rowName:   { flexShrink: 1, fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  rowVal:    { fontSize: FONTS.md, color: COLORS.primary, fontWeight: '700' },
  note:      { fontSize: FONTS.sm, color: COLORS.textLight },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  barLabel:  { width: 32, fontSize: FONTS.sm, color: COLORS.textLight },
  barTrack:  { flex: 1, height: 10, flexDirection: 'row', backgroundColor: COLORS.divider, borderRadius: 5, overflow: 'hidden' },
  barFill:   { backgroundColor: COLORS.primary },
  barVal:    { width: 28, textAlign: 'right', fontSize: FONTS.sm, color: COLORS.text },
});
