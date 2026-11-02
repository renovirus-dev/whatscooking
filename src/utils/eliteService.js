// ============================================
// FILE: src/utils/eliteService.js
// Elite-tier features: reservations, pre-orders, promotions, exports
// ============================================
import { Platform, Share } from 'react-native';
import {
  addDoc, collection, doc, updateDoc, deleteDoc,
  getDocs, query, where, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkSubscriptionStatus } from './subscriptionHelper';
import { COLORS } from '../theme';

// ─── Status metadata ──────────────────────────
export const STATUS_META = {
  pending:   { label: 'Pending',   color: COLORS.warning },
  confirmed: { label: 'Confirmed', color: COLORS.info },
  accepted:  { label: 'Accepted',  color: COLORS.info },
  preparing: { label: 'Preparing', color: '#8E44AD' },
  ready:     { label: 'Ready',     color: COLORS.success },
  completed: { label: 'Completed', color: COLORS.success },
  declined:  { label: 'Declined',  color: COLORS.error },
  cancelled: { label: 'Cancelled', color: COLORS.textMuted },
  no_show:   { label: 'No show',   color: COLORS.error },
};

// Next step an owner can take for an order
export const ORDER_NEXT = {
  pending:   { status: 'accepted',  label: 'Accept' },
  accepted:  { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready',     label: 'Mark ready' },
  ready:     { status: 'completed', label: 'Complete' },
};

export const MAX_BRANCHES = 5;

// ─── Plan / settings helpers ──────────────────
export const isEliteRestaurant = (restaurant) =>
  !!restaurant &&
  restaurant.subscription?.plan === 'elite' &&
  checkSubscriptionStatus(restaurant).isValid;

export const getEliteSettings = (restaurant) => ({
  reservationsEnabled: true,
  preordersEnabled:    true,
  maxPartySize:        10,
  openTime:            '11:00',
  closeTime:           '21:00',
  prepMinutes:         30,
  ...(restaurant?.eliteSettings || {}),
});

export const canReserve = (restaurant) =>
  isEliteRestaurant(restaurant) && getEliteSettings(restaurant).reservationsEnabled;

export const canPreorder = (restaurant) =>
  isEliteRestaurant(restaurant) && getEliteSettings(restaurant).preordersEnabled;

// ─── Date / time helpers ──────────────────────
const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const nextDays = (count = 14) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return {
      key: toDateKey(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  });

export const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const formatTime = (t) => {
  if (!isValidTime(t)) return t || '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const timeSlots = (openTime, closeTime, dateKey, step = 30) => {
  const open  = isValidTime(openTime)  ? toMinutes(openTime)  : 11 * 60;
  const close = isValidTime(closeTime) ? toMinutes(closeTime) : 21 * 60;
  const now   = new Date();
  const minToday = now.getHours() * 60 + now.getMinutes() + 30;
  const isToday  = dateKey === toDateKey(now);
  const slots = [];
  for (let m = open; m <= close; m += step) {
    if (isToday && m < minToday) continue;
    slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return slots;
};

export const tsToMillis = (v) => {
  if (!v) return Date.now(); // pending serverTimestamp
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? Date.now() : t;
};

export const formatStamp = (v) =>
  new Date(tsToMillis(v)).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export const formatDateKey = (key) => {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
};

export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// ─── Notifications ────────────────────────────
export const notifyUser = async (userId, title, body, type = 'system') => {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId, title, body, type, isRead: false, createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('notifyUser failed:', err?.message);
  }
};

// ─── Reservations ─────────────────────────────
export const createReservation = async ({
  restaurant, user, name, phone, partySize, date, time, notes, branchName,
}) => {
  const ref = await addDoc(collection(db, 'reservations'), {
    restaurantId:   restaurant.id,
    restaurantName: restaurant.name,
    ownerId:        restaurant.ownerId || null,
    userId:         user.uid,
    customerName:   name.trim(),
    customerPhone:  phone.trim(),
    partySize,
    date,
    time,
    branchName:     branchName || null,
    notes:          (notes || '').trim(),
    status:         'pending',
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  });
  await notifyUser(
    restaurant.ownerId,
    '🪑 New reservation request',
    `${name.trim()} · party of ${partySize} · ${formatDateKey(date)} at ${formatTime(time)}`,
    'reservation',
  );
  return ref.id;
};

export const updateReservationStatus = async (reservation, status, { byOwner }) => {
  await updateDoc(doc(db, 'reservations', reservation.id), {
    status, updatedAt: serverTimestamp(),
  });
  const when = `${formatDateKey(reservation.date)} at ${formatTime(reservation.time)}`;
  if (byOwner) {
    const text = {
      confirmed: `Your table at ${reservation.restaurantName} is confirmed for ${when}.`,
      declined:  `${reservation.restaurantName} could not accept your reservation for ${when}.`,
      no_show:   null,
      completed: null,
    }[status];
    if (text) {
      await notifyUser(
        reservation.userId,
        status === 'confirmed' ? '✅ Reservation confirmed' : '❌ Reservation declined',
        text, 'reservation',
      );
    }
  } else {
    await notifyUser(
      reservation.ownerId,
      '🪑 Reservation cancelled',
      `${reservation.customerName} cancelled their booking for ${when}.`,
      'reservation',
    );
  }
};

// ─── Promotions ───────────────────────────────
export const createPromotion = async (restaurant, data) => {
  const code = data.code.trim().toUpperCase();
  const dup = await getDocs(query(
    collection(db, 'promotions'),
    where('restaurantId', '==', restaurant.id),
    where('code', '==', code),
  ));
  if (!dup.empty) throw new Error(`Code ${code} already exists`);
  await addDoc(collection(db, 'promotions'), {
    restaurantId: restaurant.id,
    ownerId:      restaurant.ownerId || null,
    code,
    type:         data.type,
    value:        data.value,
    minOrder:     data.minOrder || 0,
    usageLimit:   data.usageLimit || 0,
    usageCount:   0,
    expiresAt:    data.expiresAt || null,
    description:  (data.description || '').trim(),
    isActive:     true,
    createdAt:    serverTimestamp(),
  });
};

export const setPromotionActive = (promo, isActive) =>
  updateDoc(doc(db, 'promotions', promo.id), { isActive });

export const deletePromotion = (promo) =>
  deleteDoc(doc(db, 'promotions', promo.id));

export const describePromotion = (p) =>
  p.type === 'percent' ? `${p.value}% off` : `${money(p.value)} off`;

export const calcDiscount = (promo, subtotal) => {
  if (!promo) return 0;
  const raw = promo.type === 'percent' ? (subtotal * promo.value) / 100 : promo.value;
  return Math.round(Math.min(raw, subtotal) * 100) / 100;
};

export const validateCoupon = async (restaurantId, rawCode, subtotal) => {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'Enter a code' };
  const snap = await getDocs(query(
    collection(db, 'promotions'),
    where('restaurantId', '==', restaurantId),
    where('code', '==', code),
  ));
  if (snap.empty) return { ok: false, message: 'Invalid code' };
  const promo = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (!promo.isActive) return { ok: false, message: 'This code is no longer active' };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { ok: false, message: 'This code has expired' };
  }
  if (promo.usageLimit > 0 && (promo.usageCount || 0) >= promo.usageLimit) {
    return { ok: false, message: 'This code has reached its usage limit' };
  }
  if (promo.minOrder > 0 && subtotal < promo.minOrder) {
    return { ok: false, message: `Minimum order is ${money(promo.minOrder)}` };
  }
  return { ok: true, promo, discount: calcDiscount(promo, subtotal) };
};

// ─── Pre-orders ───────────────────────────────
export const createOrder = async ({
  restaurant, user, name, phone, items, promo, pickupMinutes, notes, branchName,
}) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = calcDiscount(promo, subtotal);
  const pickupAt = new Date(Date.now() + pickupMinutes * 60000);
  const total    = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  const ref = await addDoc(collection(db, 'orders'), {
    restaurantId:   restaurant.id,
    restaurantName: restaurant.name,
    ownerId:        restaurant.ownerId || null,
    userId:         user.uid,
    customerName:   name.trim(),
    customerPhone:  phone.trim(),
    items:          items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    subtotal:       Math.round(subtotal * 100) / 100,
    discount,
    couponCode:     promo?.code || null,
    total,
    branchName:     branchName || null,
    pickupAt:       pickupAt.toISOString(),
    notes:          (notes || '').trim(),
    status:         'pending',
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  });

  if (promo?.id) {
    try { await updateDoc(doc(db, 'promotions', promo.id), { usageCount: increment(1) }); }
    catch (err) { console.warn('Coupon usage not recorded:', err?.message); }
  }
  await notifyUser(
    restaurant.ownerId,
    '🥡 New pre-order',
    `${name.trim()} · ${items.reduce((s, i) => s + i.qty, 0)} items · ${money(total)}`,
    'order',
  );
  return ref.id;
};

export const updateOrderStatus = async (order, status, { byOwner }) => {
  await updateDoc(doc(db, 'orders', order.id), { status, updatedAt: serverTimestamp() });
  if (byOwner) {
    const text = {
      accepted:  `${order.restaurantName} accepted your order.`,
      preparing: `${order.restaurantName} is preparing your order.`,
      ready:     `Your order at ${order.restaurantName} is ready for pickup! 🎉`,
      declined:  `${order.restaurantName} could not accept your order.`,
    }[status];
    if (text) await notifyUser(order.userId, '🥡 Order update', text, 'order');
  } else {
    await notifyUser(
      order.ownerId, '🥡 Order cancelled',
      `${order.customerName} cancelled their order (${money(order.total)}).`, 'order',
    );
  }
};

// ─── CSV export ───────────────────────────────
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const buildCsv = (columns, rows) =>
  [columns.map(c => csvCell(c.label)).join(',')]
    .concat(rows.map(r => columns.map(c => csvCell(c.get(r))).join(',')))
    .join('\n');

export const exportCsv = async (filename, csv) => {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: csv });
};
