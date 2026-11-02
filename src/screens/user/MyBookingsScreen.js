// ============================================
// FILE: src/screens/user/MyBookingsScreen.js
// Customer view of their reservations and pre-orders
// ============================================
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useLiveCollection } from '../../hooks/useEliteData';
import { COLORS, SIZES, FONTS } from '../../theme';
import {
  Card, Chip, ChipRow, StatusPill, EmptyState, Loader, PrimaryButton,
} from '../../components/ui';
import {
  formatDateKey, formatTime, formatStamp, money,
  updateReservationStatus, updateOrderStatus,
} from '../../utils/eliteService';

export default function MyBookingsScreen({ route, navigation }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(route.params?.tab === 'orders' ? 'orders' : 'reservations');
  const res = useLiveCollection('reservations', 'userId', user?.uid, !!user);
  const ord = useLiveCollection('orders', 'userId', user?.uid, !!user);

  const cancelReservation = useCallback((r) => {
    Alert.alert('Cancel reservation?', `${r.restaurantName} · ${formatDateKey(r.date)} at ${formatTime(r.time)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', onPress: () => updateReservationStatus(r, 'cancelled', { byOwner: false })
          .catch(e => Alert.alert('Error', e.message)) },
    ]);
  }, []);

  const cancelOrder = useCallback((o) => {
    Alert.alert('Cancel order?', `${o.restaurantName} · ${money(o.total)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel order', onPress: () => updateOrderStatus(o, 'cancelled', { byOwner: false })
          .catch(e => Alert.alert('Error', e.message)) },
    ]);
  }, []);

  if (!user) {
    return <EmptyState emoji="🔒" title="Sign in to see your bookings"
      subtitle="Your reservations and pre-orders will appear here." />;
  }

  const list    = tab === 'reservations' ? res : ord;
  if (list.loading) return <Loader />;

  return (
    <View style={s.container}>
      <View style={s.tabs}>
        <ChipRow>
          <Chip label={`🪑 Reservations (${res.items.length})`} active={tab === 'reservations'} onPress={() => setTab('reservations')} />
          <Chip label={`🥡 Orders (${ord.items.length})`} active={tab === 'orders'} onPress={() => setTab('orders')} />
        </ChipRow>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {list.error && (
          <EmptyState emoji="⚠️" title="Could not load" subtitle={list.error.message} />
        )}
        {!list.error && list.items.length === 0 && (
          <EmptyState
            emoji={tab === 'reservations' ? '🪑' : '🥡'}
            title={tab === 'reservations' ? 'No reservations yet' : 'No pre-orders yet'}
            subtitle="Find an Elite restaurant to book a table or order ahead."
          />
        )}

        {tab === 'reservations' && res.items.map(r => (
          <Card key={r.id}>
            <View style={s.head}>
              <Text style={s.title} numberOfLines={2}>{r.restaurantName}</Text>
              <StatusPill status={r.status} />
            </View>
            <Text style={s.line}>📅 {formatDateKey(r.date)} at {formatTime(r.time)}</Text>
            <Text style={s.line}>👥 Party of {r.partySize}{r.branchName ? ` · ${r.branchName}` : ''}</Text>
            {!!r.notes && <Text style={s.note}>“{r.notes}”</Text>}
            {['pending', 'confirmed'].includes(r.status) && (
              <PrimaryButton outline color={COLORS.error} label="Cancel" onPress={() => cancelReservation(r)} />
            )}
          </Card>
        ))}

        {tab === 'orders' && ord.items.map(o => (
          <Card key={o.id}>
            <View style={s.head}>
              <Text style={s.title} numberOfLines={2}>{o.restaurantName}</Text>
              <StatusPill status={o.status} />
            </View>
            {o.items?.map((i, idx) => (
              <Text key={idx} style={s.line}>{i.qty}× {i.name}</Text>
            ))}
            <Text style={s.line}>🕒 Pickup around {formatStamp(o.pickupAt)}{o.branchName ? ` · ${o.branchName}` : ''}</Text>
            <Text style={s.total}>
              {o.discount > 0 ? `Discount ${o.couponCode}: -${money(o.discount)} · ` : ''}Total {money(o.total)}
            </Text>
            {['pending', 'accepted'].includes(o.status) && (
              <PrimaryButton outline color={COLORS.error} label="Cancel order" onPress={() => cancelOrder(o)} />
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs:      { paddingHorizontal: SIZES.md, paddingTop: SIZES.sm },
  content:   { padding: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.xxl },
  head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SIZES.sm },
  title:     { flex: 1, fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  line:      { fontSize: FONTS.md, color: COLORS.text },
  note:      { fontSize: FONTS.sm, color: COLORS.textLight, fontStyle: 'italic' },
  total:     { fontSize: FONTS.md, fontWeight: '700', color: COLORS.primary },
});
