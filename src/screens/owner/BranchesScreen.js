// ============================================
// FILE: src/screens/owner/BranchesScreen.js
// Elite: multiple locations / branches
// ============================================
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import EliteGate from '../../components/EliteGate';
import { COLORS, SIZES, FONTS } from '../../theme';
import { Card, SectionTitle, Input, PrimaryButton, EmptyState } from '../../components/ui';
import { MAX_BRANCHES } from '../../utils/eliteService';

function BranchManager({ restaurant }) {
  const branches = restaurant.branches || [];
  const [name, setName]       = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity]       = useState('');
  const [phone, setPhone]     = useState('');
  const [busy, setBusy]       = useState(false);

  const save = useCallback(async (next) => {
    await updateDoc(doc(db, 'restaurants', restaurant.id), {
      branches: next, updatedAt: serverTimestamp(),
    });
  }, [restaurant.id]);

  const add = useCallback(async () => {
    const n = name.trim();
    if (!n) { Alert.alert('Name required', 'Give the branch a name, e.g. “Half Way Tree”.'); return; }
    if (!address.trim()) { Alert.alert('Address required', 'Enter the branch address.'); return; }
    if (branches.length >= MAX_BRANCHES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_BRANCHES} extra locations.`); return;
    }
    if (branches.some(b => b.name.toLowerCase() === n.toLowerCase())) {
      Alert.alert('Duplicate', 'A branch with that name already exists.'); return;
    }
    setBusy(true);
    try {
      await save([...branches, {
        id: `b${Date.now()}`, name: n, address: address.trim(),
        city: city.trim(), phone: phone.trim(),
      }]);
      setName(''); setAddress(''); setCity(''); setPhone('');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setBusy(false); }
  }, [name, address, city, phone, branches, save]);

  const remove = useCallback((b) => {
    Alert.alert('Remove branch?', `${b.name} will no longer appear for customers.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', onPress: () => save(branches.filter(x => x.id !== b.id))
          .catch(e => Alert.alert('Error', e.message)) },
    ]);
  }, [branches, save]);

  return (
    <>
      <Card>
        <Text style={s.note}>
          Your main location is “{restaurant.name}”. Extra branches appear as options when
          customers reserve a table or pre-order.
        </Text>
      </Card>

      <SectionTitle>Branches ({branches.length}/{MAX_BRANCHES})</SectionTitle>
      {branches.length === 0 && (
        <EmptyState emoji="📍" title="No extra locations" subtitle="Add your other branches below." />
      )}
      {branches.map(b => (
        <Card key={b.id}>
          <Text style={s.title}>{b.name}</Text>
          <Text style={s.line}>📍 {b.address}{b.city ? `, ${b.city}` : ''}</Text>
          {!!b.phone && <Text style={s.line}>📞 {b.phone}</Text>}
          <PrimaryButton outline color={COLORS.error} label="Remove" onPress={() => remove(b)} />
        </Card>
      ))}

      {branches.length < MAX_BRANCHES && (
        <Card>
          <SectionTitle>Add branch</SectionTitle>
          <Input label="Branch name" value={name} onChangeText={setName} placeholder="Half Way Tree" maxLength={40} />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="12 Hope Road" maxLength={120} />
          <Input label="City" value={city} onChangeText={setCity} placeholder="Kingston" maxLength={40} />
          <Input label="Phone (optional)" value={phone} onChangeText={setPhone}
            keyboardType="phone-pad" placeholder="876 555 0123" maxLength={20} />
          <PrimaryButton label="Add branch" icon="add-circle-outline" onPress={add} loading={busy} />
        </Card>
      )}
    </>
  );
}

export default function BranchesScreen({ navigation }) {
  return (
    <EliteGate navigation={navigation} feature="Multiple locations">
      {(restaurant) => (
        <ScrollView style={s.container} contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BranchManager restaurant={restaurant} />
        </ScrollView>
      )}
    </EliteGate>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.xxl },
  title:     { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  line:      { fontSize: FONTS.md, color: COLORS.text },
  note:      { fontSize: FONTS.sm, color: COLORS.textLight },
});
