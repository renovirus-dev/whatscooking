// ============================================
// FILE: src/screens/owner/RestaurantSetupScreen.js
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';          // ✅ NEW
import { useAuth } from '../../hooks/useAuth';
import { useRestaurants } from '../../hooks/useRestaurants';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const CUISINE_OPTIONS = [
  'caribbean', 'jamaican', 'american', 'chinese',
  'indian', 'italian', 'mexican', 'japanese',
  'thai', 'mediterranean', 'seafood', 'bbq',
  'fast-food', 'vegetarian', 'bakery', 'other'
];

const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'];

// ✅ NEW: Geocode address to coordinates
const geocodeAddress = async (address, city, state, country) => {
  try {
    const fullAddress = [address, city, state, country]
      .filter(Boolean)
      .join(', ');

    if (!fullAddress.trim()) return null;

    const results = await Location.geocodeAsync(fullAddress);

    if (results && results.length > 0) {
      return {
        latitude:  results[0].latitude,
        longitude: results[0].longitude,
      };
    }
    return null;
  } catch (err) {
    console.log('Geocode error:', err.message);
    return null;
  }
};

export default function RestaurantSetupScreen({
  navigation,
  route
}) {
  const { user }                          = useAuth();
  const { createRestaurant, updateRestaurant } = useRestaurants();
  const existingRestaurant                = route.params?.restaurant;

  const [form, setForm] = useState({
    name:         existingRestaurant?.name                    || '',
    description:  existingRestaurant?.description             || '',
    phone:        existingRestaurant?.contact?.phone          || '',
    email:        existingRestaurant?.contact?.email          || '',
    whatsapp:     existingRestaurant?.contact?.whatsapp       || '',
    website:      existingRestaurant?.contact?.website        || '',
    address:      existingRestaurant?.location?.address       || '',
    city:         existingRestaurant?.location?.city          || '',
    state:        existingRestaurant?.location?.state         || '',
    country:      existingRestaurant?.location?.country       || '',
    cuisineTypes: existingRestaurant?.cuisineTypes            || [],
    priceRange:   existingRestaurant?.priceRange              || '$$',
    hasDelivery:  existingRestaurant?.hasDelivery             || false,
    hasTakeout:   existingRestaurant?.hasTakeout              || true,
    hasDineIn:    existingRestaurant?.hasDineIn               || true,
  });

  const [logoUri, setLogoUri]           = useState(null);
  const [coverUri, setCoverUri]         = useState(null);
  const [logoPreview, setLogoPreview]   = useState(
    existingRestaurant?.logoUrl || null
  );
  const [coverPreview, setCoverPreview] = useState(
    existingRestaurant?.coverUrl || null
  );
  const [loading, setLoading]           = useState(false);

  // ✅ NEW: Track geocoding status
  const [geocoding, setGeocoding]       = useState(false);
  const [coordsFound, setCoordsFound]   = useState(
    // If existing restaurant already has coords stored
    !!(existingRestaurant?.coords?.latitude)
  );

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // ✅ Reset coords status when address fields change
    if (['address', 'city', 'state', 'country'].includes(field)) {
      setCoordsFound(false);
    }
  };

  const toggleCuisine = (cuisine) => {
    setForm(prev => {
      const current = prev.cuisineTypes;
      if (current.includes(cuisine)) {
        return {
          ...prev,
          cuisineTypes: current.filter(c => c !== cuisine),
        };
      }
      return {
        ...prev,
        cuisineTypes: [...current, cuisine],
      };
    });
  };

  // ✅ Updated: uses new mediaTypes format
  const pickImage = async (type) => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow photo library access'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],                        // ✅ Updated
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === 'logo') {
        setLogoUri(uri);
        setLogoPreview(uri);
      } else {
        setCoverUri(uri);
        setCoverPreview(uri);
      }
    }
  };

  // ✅ NEW: Manual geocode button handler
  const handleVerifyAddress = async () => {
    if (!form.address.trim() || !form.city.trim()) {
      Alert.alert(
        'Address Required',
        'Please enter at least a street address and city.'
      );
      return;
    }

    setGeocoding(true);
    const coords = await geocodeAddress(
      form.address,
      form.city,
      form.state,
      form.country,
    );
    setGeocoding(false);

    if (coords) {
      setCoordsFound(true);
      Alert.alert(
        '✅ Address Verified',
        `Location found!\nLat: ${coords.latitude.toFixed(4)}\nLng: ${coords.longitude.toFixed(4)}\n\nCustomers can now find you on "Near Me" search.`
      );
    } else {
      setCoordsFound(false);
      Alert.alert(
        '⚠️ Address Not Found',
        'Could not find this address on the map. Please check the spelling or add more details.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }
    if (!form.phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }
    if (!form.address.trim() || !form.city.trim()) {
      Alert.alert('Error', 'Address and city are required');
      return;
    }

    setLoading(true);

    // ✅ NEW: Auto geocode address when saving
    let coords = null;

    // Use existing coords if address not changed
    if (existingRestaurant?.coords?.latitude && coordsFound) {
      coords = existingRestaurant.coords;
    } else {
      // Geocode the address
      coords = await geocodeAddress(
        form.address,
        form.city,
        form.state,
        form.country,
      );
    }

    const data = {
      name:        form.name.trim(),
      description: form.description.trim(),
      contact: {
        phone:    form.phone.trim(),
        email:    form.email.trim(),
        whatsapp: form.whatsapp.trim(),
        website:  form.website.trim(),
      },
      location: {
        address: form.address.trim(),
        city:    form.city.trim(),
        state:   form.state.trim(),
        country: form.country.trim(),
      },
      // ✅ NEW: Store coords for fast Near Me searches
      coords: coords
        ? {
            latitude:  coords.latitude,
            longitude: coords.longitude,
          }
        : existingRestaurant?.coords || null,

      cuisineTypes: form.cuisineTypes,
      priceRange:   form.priceRange,
      hasDelivery:  form.hasDelivery,
      hasTakeout:   form.hasTakeout,
      hasDineIn:    form.hasDineIn,
      ownerId:      user.uid,
    };

    let result;
    if (existingRestaurant) {
      result = await updateRestaurant(
        existingRestaurant.id,
        data,
        logoUri,
        coverUri,
      );
    } else {
      result = await createRestaurant(data, logoUri, coverUri);
    }

    setLoading(false);

    if (result.success) {
      Alert.alert(
        '✅ Success!',
        existingRestaurant
          ? 'Restaurant updated successfully!'
          : 'Restaurant created! Now add your menu items.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cover Photo ──────────────────────── */}
      <TouchableOpacity
        style={styles.coverPicker}
        onPress={() => pickImage('cover')}
      >
        {coverPreview ? (
          <Image
            source={{ uri: coverPreview }}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons
              name="image-outline"
              size={40}
              color={COLORS.textMuted}
            />
            <Text style={styles.pickerText}>
              Tap to add cover photo
            </Text>
          </View>
        )}
        <View style={styles.coverEditBadge}>
          <Ionicons name="camera" size={14} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* ── Logo ─────────────────────────────── */}
      <TouchableOpacity
        style={styles.logoPicker}
        onPress={() => pickImage('logo')}
      >
        {logoPreview ? (
          <Image
            source={{ uri: logoPreview }}
            style={styles.logoImage}
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Ionicons
              name="camera"
              size={22}
              color={COLORS.textMuted}
            />
          </View>
        )}
        <View style={styles.logoEditBadge}>
          <Ionicons name="pencil" size={10} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <View style={styles.form}>

        {/* ── Basic Info ──────────────────────── */}
        <Text style={styles.sectionTitle}>📋 Basic Information</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Restaurant Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mama's Kitchen"
            placeholderTextColor={COLORS.textMuted}
            value={form.name}
            onChangeText={v => updateForm('name', v)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Tell customers about your restaurant..."
            placeholderTextColor={COLORS.textMuted}
            value={form.description}
            onChangeText={v => updateForm('description', v)}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* ── Contact ─────────────────────────── */}
        <Text style={styles.sectionTitle}>📞 Contact Info</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number *</Text>
          <View style={styles.inputRow}>
            <Ionicons
              name="call-outline"
              size={18}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.inputFlex}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={COLORS.textMuted}
              value={form.phone}
              onChangeText={v => updateForm('phone', v)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>WhatsApp Number</Text>
          <View style={styles.inputRow}>
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={COLORS.success}
            />
            <TextInput
              style={styles.inputFlex}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={COLORS.textMuted}
              value={form.whatsapp}
              onChangeText={v => updateForm('whatsapp', v)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.inputFlex}
              placeholder="restaurant@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={form.email}
              onChangeText={v => updateForm('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Website</Text>
          <View style={styles.inputRow}>
            <Ionicons
              name="globe-outline"
              size={18}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.inputFlex}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={COLORS.textMuted}
              value={form.website}
              onChangeText={v => updateForm('website', v)}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Location ────────────────────────── */}
        <Text style={styles.sectionTitle}>📍 Location</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main Street"
            placeholderTextColor={COLORS.textMuted}
            value={form.address}
            onChangeText={v => updateForm('address', v)}
          />
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="Kingston"
              placeholderTextColor={COLORS.textMuted}
              value={form.city}
              onChangeText={v => updateForm('city', v)}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>State/Parish</Text>
            <TextInput
              style={styles.input}
              placeholder="St. Andrew"
              placeholderTextColor={COLORS.textMuted}
              value={form.state}
              onChangeText={v => updateForm('state', v)}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Country</Text>
          <TextInput
            style={styles.input}
            placeholder="Jamaica"
            placeholderTextColor={COLORS.textMuted}
            value={form.country}
            onChangeText={v => updateForm('country', v)}
          />
        </View>

        {/* ✅ NEW: Verify address button + status */}
        <TouchableOpacity
          style={[
            styles.verifyBtn,
            coordsFound && styles.verifyBtnSuccess,
          ]}
          onPress={handleVerifyAddress}
          disabled={geocoding}
          activeOpacity={0.8}
        >
          {geocoding ? (
            <>
              <ActivityIndicator
                size="small"
                color={COLORS.textWhite}
              />
              <Text style={styles.verifyBtnText}>
                Finding location...
              </Text>
            </>
          ) : coordsFound ? (
            <>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.textWhite}
              />
              <Text style={styles.verifyBtnText}>
                ✅ Address Verified
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="navigate"
                size={18}
                color={COLORS.textWhite}
              />
              <Text style={styles.verifyBtnText}>
                Verify Address on Map
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ✅ NEW: Hint about Near Me */}
        <View style={styles.locationHint}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.locationHintText}>
            Verifying your address lets customers find you
            when using "Near Me" search.
          </Text>
        </View>

        {/* ── Cuisine Types ────────────────────── */}
        <Text style={styles.sectionTitle}>🍴 Cuisine Type</Text>
        <Text style={styles.sectionHint}>Select all that apply</Text>
        <View style={styles.chipGrid}>
          {CUISINE_OPTIONS.map(cuisine => (
            <TouchableOpacity
              key={cuisine}
              style={[
                styles.chip,
                form.cuisineTypes.includes(cuisine) &&
                  styles.chipActive,
              ]}
              onPress={() => toggleCuisine(cuisine)}
            >
              <Text style={[
                styles.chipText,
                form.cuisineTypes.includes(cuisine) &&
                  styles.chipTextActive,
              ]}>
                {cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Price Range ──────────────────────── */}
        <Text style={styles.sectionTitle}>💰 Price Range</Text>
        <View style={styles.priceRow}>
          {PRICE_OPTIONS.map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priceBtn,
                form.priceRange === p && styles.priceBtnActive,
              ]}
              onPress={() => updateForm('priceRange', p)}
            >
              <Text style={[
                styles.priceBtnText,
                form.priceRange === p && styles.priceBtnTextActive,
              ]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Services ────────────────────────── */}
        <Text style={styles.sectionTitle}>🛎️ Services Offered</Text>
        {[
          { key: 'hasDineIn',   label: 'Dine In',  icon: '🪑' },
          { key: 'hasTakeout',  label: 'Takeout',  icon: '🥡' },
          { key: 'hasDelivery', label: 'Delivery', icon: '🛵' },
        ].map(service => (
          <TouchableOpacity
            key={service.key}
            style={styles.serviceRow}
            onPress={() =>
              updateForm(service.key, !form[service.key])
            }
          >
            <Text style={styles.serviceEmoji}>{service.icon}</Text>
            <Text style={styles.serviceLabel}>{service.label}</Text>
            <View style={[
              styles.serviceToggle,
              form[service.key] && styles.serviceToggleOn,
            ]}>
              <Text style={styles.serviceToggleText}>
                {form[service.key] ? '✅ Yes' : '❌ No'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Save Button ──────────────────────── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            loading && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                Saving...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.saveBtnText}>
                {existingRestaurant
                  ? 'Update Restaurant'
                  : 'Create Restaurant'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  coverPicker: {
    height: 180,
    backgroundColor: COLORS.border,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  pickerText: {
    color: COLORS.textMuted,
    fontSize: FONTS.md,
  },
  coverEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPicker: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginLeft: SIZES.lg,
    marginTop: -40,
    position: 'relative',
    ...SHADOW,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  form: {
    padding: SIZES.md,
    gap: SIZES.md,
    marginTop: SIZES.md,
  },
  sectionTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.sm,
    marginBottom: SIZES.xs,
  },
  sectionHint: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
    marginBottom: SIZES.sm,
    marginTop: -SIZES.xs,
  },
  field: {
    gap: SIZES.xs,
  },
  twoCol: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  label: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    fontSize: FONTS.md,
    color: COLORS.text,
    ...SHADOW,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    gap: SIZES.sm,
    ...SHADOW,
  },
  inputFlex: {
    flex: 1,
    fontSize: FONTS.md,
    color: COLORS.text,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // ✅ NEW: Verify button
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.md,
    ...SHADOW,
  },
  verifyBtnSuccess: {
    backgroundColor: COLORS.success,
  },
  verifyBtnText: {
    color: COLORS.textWhite,
    fontSize: FONTS.md,
    fontWeight: '700',
  },

  // ✅ NEW: Location hint
  locationHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.xs,
    backgroundColor: COLORS.primary + '10',
    padding: SIZES.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    marginTop: -SIZES.xs,
  },
  locationHintText: {
    flex: 1,
    fontSize: FONTS.xs,
    color: COLORS.primary,
    lineHeight: 18,
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  priceBtn: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  priceBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  priceBtnText: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  priceBtnTextActive: {
    color: '#FFFFFF',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.md,
    gap: SIZES.md,
    ...SHADOW,
  },
  serviceEmoji: {
    fontSize: 22,
  },
  serviceLabel: {
    flex: 1,
    fontSize: FONTS.lg,
    color: COLORS.text,
    fontWeight: '500',
  },
  serviceToggle: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  serviceToggleOn: {
    backgroundColor: COLORS.success + '15',
    borderColor: COLORS.success + '30',
  },
  serviceToggleText: {
    fontSize: FONTS.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    marginTop: SIZES.md,
    ...SHADOW,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.xl,
    fontWeight: 'bold',
  },
});