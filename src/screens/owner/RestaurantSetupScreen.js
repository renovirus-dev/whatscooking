// ============================================
// FILE: src/screens/owner/RestaurantSetupScreen.js
// ============================================
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker      from 'expo-image-picker';
import * as Location         from 'expo-location';
import { useAuth }           from '../../hooks/useAuth';
import { useRestaurants }    from '../../hooks/useRestaurants';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { getThumbUrl, getBannerUrl } from '../../utils/uploadToCloudinary';

// ✅ Safe color fallback
const ACCENT_COLOR = COLORS.accent || COLORS.secondary || '#8E44AD';

const CUISINE_OPTIONS = [
  'caribbean', 'jamaican',     'american',  'chinese',
  'indian',    'italian',      'mexican',   'japanese',
  'thai',      'mediterranean','seafood',   'bbq',
  'fast-food', 'vegetarian',   'bakery',    'other',
];

const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'];

// ─── Price Range Labels ───────────────────────
const PRICE_LABELS = {
  '$':    'Budget',
  '$$':   'Moderate',
  '$$$':  'Upscale',
  '$$$$': 'Fine Dining',
};

// ─── Safe Platform Alerts ─────────────────────
const showSafeAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      // Find the primary/positive action button
      const confirmButton = buttons.find(b => b.style !== 'cancel' && b.text !== 'Cancel');
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        if (confirmButton && confirmButton.onPress) confirmButton.onPress();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel' || b.text === 'Cancel');
        if (cancelButton && cancelButton.onPress) cancelButton.onPress();
      }
    } else {
      alert(`${title}\n\n${message}`);
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// ─── Geocode Helper ───────────────────────────
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

export default function RestaurantSetupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user }                               = useAuth();
  const { createRestaurant, updateRestaurant } = useRestaurants();
  const existingRestaurant                     = route.params?.restaurant;

  // ── Input Refs ────────────────────────────
  const descriptionRef = useRef(null);
  const phoneRef       = useRef(null);
  const whatsappRef    = useRef(null);
  const emailRef       = useRef(null);
  const websiteRef     = useRef(null);
  const addressRef     = useRef(null);
  const cityRef        = useRef(null);
  const stateRef       = useRef(null);
  const countryRef     = useRef(null);

  // ── Form State ────────────────────────────
  const [form, setForm] = useState({
    name:         existingRestaurant?.name               || '',
    description:  existingRestaurant?.description        || '',
    phone:        existingRestaurant?.contact?.phone     || '',
    email:        existingRestaurant?.contact?.email     || '',
    whatsapp:     existingRestaurant?.contact?.whatsapp  || '',
    website:      existingRestaurant?.contact?.website   || '',
    address:      existingRestaurant?.location?.address  || '',
    city:         existingRestaurant?.location?.city     || '',
    state:        existingRestaurant?.location?.state    || '',
    country:      existingRestaurant?.location?.country  || 'Jamaica',
    cuisineTypes: existingRestaurant?.cuisineTypes       || [],
    priceRange:   existingRestaurant?.priceRange         || '$$',
    hasDelivery:  existingRestaurant?.hasDelivery        || false,
    hasTakeout:   existingRestaurant?.hasTakeout         || true,
    hasDineIn:    existingRestaurant?.hasDineIn          || true,
  });

  // ── Image State ───────────────────────────
  const [logoUri, setLogoUri]           = useState(null);
  const [coverUri, setCoverUri]         = useState(null);
  const [logoPreview, setLogoPreview]   = useState(
    existingRestaurant?.logoUrl
      ? getThumbUrl(existingRestaurant.logoUrl, 160, 160)
      : null
  );
  const [coverPreview, setCoverPreview] = useState(
    existingRestaurant?.coverUrl
      ? getBannerUrl(existingRestaurant.coverUrl)
      : null
  );

  // ── Upload/Save State ─────────────────────
  const [loading, setLoading]         = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [geocoding, setGeocoding]     = useState(false);
  const [coordsFound, setCoordsFound] = useState(
    !!(existingRestaurant?.coords?.latitude)
  );

  // ─────────────────────────────────────────
  // FORM HANDLERS
  // ─────────────────────────────────────────
  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (['address', 'city', 'state', 'country'].includes(field)) {
      setCoordsFound(false);
    }
  };

  const toggleCuisine = (cuisine) => {
    setForm(prev => {
      const current = prev.cuisineTypes;
      return {
        ...prev,
        cuisineTypes: current.includes(cuisine)
          ? current.filter(c => c !== cuisine)
          : [...current, cuisine],
      };
    });
  };

  // ─────────────────────────────────────────
  // IMAGE PICKERS
  // ─────────────────────────────────────────
  const pickImageFromLibrary = async (type) => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showSafeAlert('Permission needed', 'Please allow photo library access');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS !== 'web',
      aspect:        Platform.OS !== 'web' ? (type === 'logo' ? [1, 1] : [16, 9]) : undefined,
      quality:       0.8,
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

  const takePhotoWithCamera = async (type) => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showSafeAlert('Permission needed', 'Please allow camera access');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS !== 'web',
      aspect:        Platform.OS !== 'web' ? (type === 'logo' ? [1, 1] : [16, 9]) : undefined,
      quality:       0.8,
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

  const handlePickImage = (type) => {
    if (Platform.OS === 'web') {
      // Browser handles library + device camera automatically in its native dialog
      pickImageFromLibrary(type);
      return;
    }

    const label = type === 'logo' ? 'Logo' : 'Cover Photo';
    Alert.alert(
      `📷 ${label}`,
      'Choose image source',
      [
        { text: '📷 Take Photo',          onPress: () => takePhotoWithCamera(type)   },
        { text: '🖼️ Choose from Library', onPress: () => pickImageFromLibrary(type) },
        { text: 'Cancel', style: 'cancel'                                            },
      ]
    );
  };

  const handleRemoveImage = (type) => {
    if (type === 'logo') {
      setLogoUri(null);
      setLogoPreview(existingRestaurant?.logoUrl || null);
    } else {
      setCoverUri(null);
      setCoverPreview(existingRestaurant?.coverUrl || null);
    }
  };

  // ─────────────────────────────────────────
  // VERIFY ADDRESS
  // ─────────────────────────────────────────
  const handleVerifyAddress = async () => {
    if (!form.address.trim() || !form.city.trim()) {
      showSafeAlert(
        'Address Required',
        'Please enter at least a street address and city.'
      );
      return;
    }
    setGeocoding(true);
    const coords = await geocodeAddress(
      form.address, form.city, form.state, form.country,
    );
    setGeocoding(false);

    if (coords) {
      setCoordsFound(true);
      showSafeAlert(
        '✅ Address Verified',
        `Location found!\n` +
        `Lat: ${coords.latitude.toFixed(4)}\n` +
        `Lng: ${coords.longitude.toFixed(4)}\n\n` +
        `Customers can now find you on "Near Me" search.`
      );
    } else {
      setCoordsFound(false);
      showSafeAlert(
        '⚠️ Address Not Found',
        'Could not find this address on the map.\n\n' +
        'Tips:\n' +
        '• Check spelling\n' +
        '• Add more address details\n' +
        '• Try a nearby landmark\n\n' +
        'You can still save without verification.',
        [{ text: 'OK' }]
      );
    }
  };

  // ─────────────────────────────────────────
  // SAVE HANDLER
  // ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      showSafeAlert('Error', 'Restaurant name is required');
      return;
    }
    if (!form.phone.trim()) {
      showSafeAlert('Error', 'Phone number is required');
      return;
    }
    if (!form.address.trim() || !form.city.trim()) {
      showSafeAlert('Error', 'Address and city are required');
      return;
    }
    if (form.cuisineTypes.length === 0) {
      showSafeAlert('Error', 'Please select at least one cuisine type');
      return;
    }

    setLoading(true);

    setLoadingStep('Finding location...');
    let coords = null;
    if (existingRestaurant?.coords?.latitude && coordsFound) {
      coords = existingRestaurant.coords;
    } else {
      coords = await geocodeAddress(
        form.address, form.city, form.state, form.country,
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
      coords: coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : existingRestaurant?.coords || null,
      cuisineTypes: form.cuisineTypes,
      priceRange:   form.priceRange,
      hasDelivery:  form.hasDelivery,
      hasTakeout:   form.hasTakeout,
      hasDineIn:    form.hasDineIn,
      ownerId:      user.uid,
    };

    if (logoUri || coverUri) {
      setLoadingStep('Uploading images...');
    } else {
      setLoadingStep('Saving restaurant...');
    }

    let result;
    try {
      if (existingRestaurant) {
        result = await updateRestaurant(
          existingRestaurant.id, data, logoUri, coverUri,
        );
      } else {
        result = await createRestaurant(data, logoUri, coverUri);
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    setLoading(false);
    setLoadingStep('');

    if (result?.success) {
      showSafeAlert(
        '✅ Success!',
        existingRestaurant
          ? 'Restaurant updated successfully!'
          : 'Restaurant created!\n\nNext: Add your menu items.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      showSafeAlert('Error', result?.error || 'Something went wrong');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 56}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      >

        {/* ── Cover Photo ──────────────────── */}
        <TouchableOpacity
          style={styles.coverPicker}
          onPress={() => handlePickImage('cover')}
          activeOpacity={0.85}
          disabled={loading}
        >
          {coverPreview ? (
            <>
              <Image
                source={{ uri: coverPreview }}
                style={styles.coverImage}
                resizeMode="cover"
              />
              {coverUri && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => handleRemoveImage('cover')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.pickerText}>Tap to add cover photo</Text>
              <Text style={styles.pickerHint}>Recommended: 1200 × 400px</Text>
            </View>
          )}
          <View style={styles.coverEditBadge}>
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </View>
          {coverUri && (
            <View style={styles.newPhotoBadge}>
              <Text style={styles.newPhotoBadgeText}>New</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Logo ─────────────────────────── */}
        <View style={styles.logoRow}>
          <TouchableOpacity
            style={styles.logoPicker}
            onPress={() => handlePickImage('logo')}
            activeOpacity={0.85}
            disabled={loading}
          >
            {logoPreview ? (
              <Image
                source={{ uri: logoPreview }}
                style={styles.logoImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="camera" size={22} color={COLORS.textMuted} />
              </View>
            )}
            <View style={styles.logoEditBadge}>
              <Ionicons name="pencil" size={10} color="#FFFFFF" />
            </View>
            {logoUri && (
              <View style={[styles.newPhotoBadge, { top: 0, right: 0 }]}>
                <Text style={styles.newPhotoBadgeText}>New</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.logoHints}>
            <Text style={styles.logoHintTitle}>
              {existingRestaurant ? 'Update Photos' : 'Add Photos'}
            </Text>
            <Text style={styles.logoHintText}>
              Logo: Square (1:1){'\n'}
              Cover: Wide (16:9)
            </Text>
            {(logoUri || coverUri) && (
              <Text style={styles.logoHintNew}>
                📤 Will upload on save
              </Text>
            )}
          </View>
        </View>

        {/* ── Form ─────────────────────────── */}
        <View style={styles.form}>

          {/* ── Basic Info ─────────────────── */}
          <Text style={styles.sectionTitle}>📋 Basic Information</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Restaurant Name <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mama's Kitchen"
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={v => updateForm('name', v)}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.charCount}>
                {form.description.length}/300
              </Text>
            </View>
            <TextInput
              ref={descriptionRef}
              style={[styles.input, styles.textarea]}
              placeholder="Tell customers about your restaurant..."
              placeholderTextColor={COLORS.textMuted}
              value={form.description}
              onChangeText={v => updateForm('description', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="next"
              maxLength={300}
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          {/* ── Contact ────────────────────── */}
          <Text style={styles.sectionTitle}>📞 Contact Info</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Phone Number <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                ref={phoneRef}
                style={styles.inputFlex}
                placeholder="+1 (876) 000-0000"
                placeholderTextColor={COLORS.textMuted}
                value={form.phone}
                onChangeText={v => updateForm('phone', v)}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => whatsappRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>WhatsApp Number</Text>
            <View style={styles.inputRow}>
              <Ionicons name="logo-whatsapp" size={18} color={COLORS.success} />
              <TextInput
                ref={whatsappRef}
                style={styles.inputFlex}
                placeholder="+1 (876) 000-0000"
                placeholderTextColor={COLORS.textMuted}
                value={form.whatsapp}
                onChangeText={v => updateForm('whatsapp', v)}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                ref={emailRef}
                style={styles.inputFlex}
                placeholder="restaurant@email.com"
                placeholderTextColor={COLORS.textMuted}
                value={form.email}
                onChangeText={v => updateForm('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => websiteRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Website</Text>
            <View style={styles.inputRow}>
              <Ionicons name="globe-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                ref={websiteRef}
                style={styles.inputFlex}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={COLORS.textMuted}
                value={form.website}
                onChangeText={v => updateForm('website', v)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => addressRef.current?.focus()}
              />
            </View>
          </View>

          {/* ── Location ───────────────────── */}
          <Text style={styles.sectionTitle}>📍 Location</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Street Address <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
            <TextInput
              ref={addressRef}
              style={styles.input}
              placeholder="123 Main Street"
              placeholderTextColor={COLORS.textMuted}
              value={form.address}
              onChangeText={v => updateForm('address', v)}
              returnKeyType="next"
              onSubmitEditing={() => cityRef.current?.focus()}
            />
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>
                City <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
              <TextInput
                ref={cityRef}
                style={styles.input}
                placeholder="Kingston"
                placeholderTextColor={COLORS.textMuted}
                value={form.city}
                onChangeText={v => updateForm('city', v)}
                returnKeyType="next"
                onSubmitEditing={() => stateRef.current?.focus()}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>State/Parish</Text>
              <TextInput
                ref={stateRef}
                style={styles.input}
                placeholder="St. Andrew"
                placeholderTextColor={COLORS.textMuted}
                value={form.state}
                onChangeText={v => updateForm('state', v)}
                returnKeyType="next"
                onSubmitEditing={() => countryRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              ref={countryRef}
              style={styles.input}
              placeholder="Jamaica"
              placeholderTextColor={COLORS.textMuted}
              value={form.country}
              onChangeText={v => updateForm('country', v)}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.verifyBtn,
              coordsFound && styles.verifyBtnSuccess,
              geocoding   && styles.verifyBtnLoading,
            ]}
            onPress={handleVerifyAddress}
            disabled={geocoding || loading}
            activeOpacity={0.8}
          >
            {geocoding ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>Finding location...</Text>
              </>
            ) : coordsFound ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>✅ Address Verified</Text>
              </>
            ) : (
              <>
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>Verify Address on Map</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.locationHint}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={COLORS.primary}
            />
            <Text style={styles.locationHintText}>
              Verifying your address lets customers find you
              in "Near Me" search.
            </Text>
          </View>

          {/* ── Cuisine Types ──────────────── */}
          <Text style={styles.sectionTitle}>🍴 Cuisine Type</Text>
          <Text style={styles.sectionHint}>Select all that apply</Text>

          <View style={styles.chipGrid}>
            {CUISINE_OPTIONS.map(cuisine => {
              const isSelected = form.cuisineTypes.includes(cuisine);
              return (
                <TouchableOpacity
                  key={cuisine}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleCuisine(cuisine)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipText,
                    isSelected && styles.chipTextActive,
                  ]}>
                    {cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {form.cuisineTypes.length > 0 && (
            <Text style={styles.selectedHint}>
              ✅ {form.cuisineTypes.length} cuisine
              {form.cuisineTypes.length !== 1 ? 's' : ''} selected
            </Text>
          )}

          {/* ── Price Range ─────────────────── */}
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
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.priceBtnText,
                  form.priceRange === p && styles.priceBtnTextActive,
                ]}>
                  {p}
                </Text>
                <Text style={[
                  styles.priceBtnLabel,
                  form.priceRange === p && { color: '#FFFFFF' },
                ]}>
                  {PRICE_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Services ─────────────────────── */}
          <Text style={styles.sectionTitle}>🛎️ Services Offered</Text>

          {[
            { key: 'hasDineIn',   label: 'Dine In',  icon: '🪑', desc: 'Customers eat at your restaurant'    },
            { key: 'hasTakeout',  label: 'Takeout',  icon: '🥡', desc: 'Customers pick up their order'       },
            { key: 'hasDelivery', label: 'Delivery', icon: '🛵', desc: 'You deliver to customers'            },
          ].map(service => (
            <TouchableOpacity
              key={service.key}
              style={[
                styles.serviceRow,
                form[service.key] && styles.serviceRowActive,
              ]}
              onPress={() => updateForm(service.key, !form[service.key])}
              activeOpacity={0.7}
            >
              <Text style={styles.serviceEmoji}>{service.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceLabel}>{service.label}</Text>
                <Text style={styles.serviceDesc}>{service.desc}</Text>
              </View>
              <View style={[
                styles.serviceToggle,
                form[service.key] && styles.serviceToggleOn,
              ]}>
                <Ionicons
                  name={form[service.key]
                    ? 'checkmark-circle'
                    : 'close-circle-outline'}
                  size={20}
                  color={form[service.key] ? COLORS.success : COLORS.textMuted}
                />
                <Text style={[
                  styles.serviceToggleText,
                  form[service.key] && { color: COLORS.success },
                ]}>
                  {form[service.key] ? 'Yes' : 'No'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* ── Save Button ──────────────────── */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.saveBtnLoading}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{loadingStep}</Text>
              </View>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {existingRestaurant ? 'Update Restaurant' : 'Create Restaurant'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Cover Photo ───────────────────────────
  coverPicker: {
    height:          180,
    backgroundColor: COLORS.border,
    position:        'relative',
  },
  coverImage: {
    width:  '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width:          '100%',
    height:         '100%',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            SIZES.xs,
  },
  pickerText: {
    color:    COLORS.textMuted,
    fontSize: FONTS.md,
  },
  pickerHint: {
    color:    COLORS.textMuted,
    fontSize: FONTS.xs,
  },
  coverEditBadge: {
    position:        'absolute',
    bottom:          10,
    right:           10,
    backgroundColor: COLORS.primary,
    width:           30,
    height:          30,
    borderRadius:    15,
    justifyContent:  'center',
    alignItems:      'center',
  },
  removeImageBtn: {
    position:        'absolute',
    top:             8,
    right:           8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius:    12,
  },
  newPhotoBadge: {
    position:          'absolute',
    top:               8,
    left:              8,
    backgroundColor:   COLORS.success,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.round,
  },
  newPhotoBadgeText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xs,
    fontWeight: '700',
  },

  // ── Logo ──────────────────────────────────
  logoRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    paddingLeft:   SIZES.lg,
    paddingRight:  SIZES.md,
    marginTop:     -40,
    gap:           SIZES.md,
  },
  logoPicker: {
    width:        80,
    height:       80,
    borderRadius: 40,
    position:     'relative',
    ...SHADOW,
  },
  logoImage: {
    width:       80,
    height:      80,
    borderRadius:40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  logoPlaceholder: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     3,
    borderColor:     '#FFFFFF',
  },
  logoEditBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    backgroundColor: COLORS.primary,
    width:           22,
    height:          22,
    borderRadius:    11,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     '#FFFFFF',
  },
  logoHints: {
    flex:      1,
    marginBottom: SIZES.xs,
  },
  logoHintTitle: {
    fontSize:   FONTS.md,
    fontWeight: '700',
    color:      COLORS.text,
  },
  logoHintText: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  logoHintNew: {
    fontSize:   FONTS.xs,
    color:      COLORS.primary,
    fontWeight: '600',
    marginTop:  4,
  },

  // ── Form ──────────────────────────────────
  form: {
    padding:   SIZES.md,
    gap:       SIZES.md,
    marginTop: SIZES.md,
  },
  sectionTitle: {
    fontSize:     FONTS.lg,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginTop:    SIZES.sm,
    marginBottom: SIZES.xs,
    paddingBottom: SIZES.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHint: {
    fontSize:    FONTS.sm,
    color:       COLORS.textMuted,
    marginBottom: SIZES.sm,
    marginTop:   -SIZES.xs,
  },
  field:  { gap: SIZES.xs },
  twoCol: { flexDirection: 'row', gap: SIZES.md },

  // ── Labels ────────────────────────────────
  labelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    fontSize:   FONTS.md,
    fontWeight: '600',
    color:      COLORS.text,
  },
  charCount: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },

  // ── Inputs ────────────────────────────────
  input: {
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    fontSize:          FONTS.md,
    color:             COLORS.text,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    gap:               SIZES.sm,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  inputFlex: {
    flex:     1,
    fontSize: FONTS.md,
    color:    COLORS.text,
  },
  textarea: {
    height:            80,
    textAlignVertical: 'top',
  },

  // ── Verify Button ─────────────────────────
  verifyBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SIZES.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.md,
  },
  verifyBtnSuccess: { backgroundColor: COLORS.success },
  verifyBtnLoading: { opacity: 0.8                   },
  verifyBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.md,
    fontWeight: '700',
  },

  // ── Location Hint ─────────────────────────
  locationHint: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SIZES.xs,
    backgroundColor: COLORS.primary + '10',
    padding:         SIZES.sm,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.primary + '20',
    marginTop:       -SIZES.xs,
  },
  locationHintText: {
    flex:      1,
    fontSize:  FONTS.xs,
    color:     COLORS.primary,
    lineHeight: 18,
  },

  // ── Cuisine Chips ─────────────────────────
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SIZES.sm,
  },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.surface,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  chipText:       { fontSize: FONTS.sm, color: COLORS.text,   fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF',   fontWeight: '600'                        },
  selectedHint: {
    fontSize:   FONTS.xs,
    color:      COLORS.success,
    fontWeight: '600',
    marginTop:  -SIZES.xs,
  },

  // ── Price Range ───────────────────────────
  priceRow: { flexDirection: 'row', gap: SIZES.sm },
  priceBtn: {
    flex:            1,
    paddingVertical: SIZES.sm,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     COLORS.border,
    gap:             2,
  },
  priceBtnActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor:     ACCENT_COLOR,
  },
  priceBtnText: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  priceBtnTextActive: { color: '#FFFFFF' },
  priceBtnLabel: {
    fontSize: 9,
    color:    COLORS.textMuted,
  },

  // ── Services ──────────────────────────────
  serviceRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    padding:         SIZES.md,
    borderRadius:    RADIUS.md,
    gap:             SIZES.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  serviceRowActive: {
    borderColor:     COLORS.success + '40',
    backgroundColor: COLORS.success + '05',
  },
  serviceEmoji: { fontSize: 22 },
  serviceLabel: {
    fontSize:   FONTS.md,
    color:      COLORS.text,
    fontWeight: '600',
  },
  serviceDesc: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  serviceToggle: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   4,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.border,
  },
  serviceToggleOn:  { backgroundColor: COLORS.success + '15' },
  serviceToggleText:{ fontSize: FONTS.sm, fontWeight: '600', color: COLORS.textMuted },

  // ── Save Button ───────────────────────────
  saveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.primary,
    padding:         SIZES.md,
    borderRadius:    RADIUS.lg,
    gap:             SIZES.sm,
    marginTop:       SIZES.md,
    ...SHADOW,
  },
  saveBtnDisabled: { opacity: 0.7                                         },
  saveBtnLoading:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  saveBtnText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
  },
});