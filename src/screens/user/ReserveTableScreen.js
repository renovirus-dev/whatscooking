// ============================================
// FILE: src/screens/user/ReserveTableScreen.js
// ============================================
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SIZES, FONTS } from '../../theme';
import {
  FormScreen, FooterBar, Card, SectionTitle, Input, Chip, ChipRow,
  ChipGrid, PrimaryButton, Stepper, EmptyState,
} from '../../components/ui';
import {
  canReserve, getEliteSettings, nextDays, timeSlots, formatTime,
  createReservation, formatDateKey,
} from '../../utils/eliteService';

export default function ReserveTableScreen({ route, navigation }) {
  const restaurant = route.params?.restaurant;
  const { user, userProfile } = useAuth();
  const settings = useMemo(() => getEliteSettings(restaurant), [restaurant]);
  const days     = useMemo(() => nextDays(14), []);

  const [date, setDate]   = useState(days[0].key);
  const [time, setTime]   = useState(null);
  const [party, setParty] = useState(2);
  const [branch, setBranch] = useState(null);
  const [name, setName]   = useState(
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ')
  );
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);

  const slots = useMemo(
    () => timeSlots(settings.openTime, settings.closeTime, date),
    [settings, date],
  );

  const onSubmit = useCallback(async () => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to reserve a table.'); return; }
    if (!time) { Alert.alert('Pick a time', 'Choose a time for your reservation.'); return; }
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your name.'); return; }
    if (phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Phone required', 'Please enter a phone number the restaurant can reach you on.');
      return;
    }
    setBusy(true);
    try {
      await createReservation({
        restaurant, user, name, phone, partySize: party, date, time, notes,
        branchName: branch,
      });
      Alert.alert(
        'Request sent 🎉',
        `${restaurant.name} will confirm your table for ${formatDateKey(date)} at ${formatTime(time)}.`,
        [{ text: 'OK', onPress: () => navigation.navigate('MyBookings') }],
      );
    } catch (err) {
      Alert.alert('Could not reserve', err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [user, time, name, phone, party, date, notes, branch, restaurant, navigation]);

  if (!restaurant || !canReserve(restaurant)) {
    return (
      <EmptyState
        emoji="🪑"
        title="Reservations unavailable"
        subtitle="This restaurant is not taking online reservations right now."
      />
    );
  }

  return (
    <FormScreen
      footer={
        <FooterBar>
          <PrimaryButton label="Request reservation" icon="calendar-outline"
            onPress={onSubmit} loading={busy} />
        </FooterBar>
      }
    >
      <Card>
        <Text style={s.restaurant}>{restaurant.name}</Text>
        <Text style={s.hours}>
          Open {formatTime(settings.openTime)} – {formatTime(settings.closeTime)}
        </Text>
      </Card>

      {restaurant.branches?.length > 0 && (
        <Card>
          <SectionTitle>Location</SectionTitle>
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
        <SectionTitle>Date</SectionTitle>
        <ChipRow>
          {days.map(d => (
            <Chip key={d.key} label={d.label} active={date === d.key}
              onPress={() => { setDate(d.key); setTime(null); }} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <SectionTitle>Time</SectionTitle>
        {slots.length === 0 ? (
          <Text style={s.hint}>No more times today — pick another date.</Text>
        ) : (
          <ChipGrid>
            {slots.map(t => (
              <Chip key={t} label={formatTime(t)} active={time === t} onPress={() => setTime(t)} />
            ))}
          </ChipGrid>
        )}
      </Card>

      <Card>
        <View style={s.row}>
          <SectionTitle>Party size</SectionTitle>
          <Stepper value={party} onChange={setParty} min={1} max={settings.maxPartySize} />
        </View>
        {party >= settings.maxPartySize && (
          <Text style={s.hint}>For larger groups please call the restaurant.</Text>
        )}
      </Card>

      <Card>
        <SectionTitle>Your details</SectionTitle>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Full name" />
        <Input label="Phone" value={phone} onChangeText={setPhone}
          placeholder="876 555 0123" keyboardType="phone-pad" />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes}
          placeholder="Birthday, allergies, seating preference…" multiline maxLength={300} />
      </Card>
    </FormScreen>
  );
}

const s = StyleSheet.create({
  restaurant: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text },
  hours:      { fontSize: FONTS.sm, color: COLORS.textLight },
  hint:       { fontSize: FONTS.sm, color: COLORS.textLight },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm },
});
