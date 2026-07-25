// ============================================
// FILE: src/screens/owner/MenuScannerScreen.js
// ============================================
import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
  TextInput, FlatList, Image, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { useMenu }           from '../../hooks/useMenu';
import { useSubscription }   from '../../hooks/useSubscription';
import { CLOUDINARY_CONFIG } from '../../config/cloudinary';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─── Google Vision API ────────────────────────
const VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_KEY || '';
const VISION_API_URL =
  `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;

// ─── Category Keywords Map ────────────────────
// Used to auto-detect category from section headers
const CATEGORY_KEYWORDS = {
  appetizer:   ['appetizer', 'starter', 'starters', 'appetizers', 'small plates'],
  soup:        ['soup', 'soups', 'broth', 'chowder'],
  salad:       ['salad', 'salads'],
  main_course: ['main', 'mains', 'entree', 'entrees', 'dinner', 'lunch', 'main course'],
  side_dish:   ['side', 'sides', 'side dish', 'extras'],
  dessert:     ['dessert', 'desserts', 'sweet', 'sweets', 'pudding'],
  beverage:    ['drink', 'drinks', 'beverage', 'beverages', 'juice', 'cocktail'],
  breakfast:   ['breakfast', 'brunch', 'morning'],
  combo_meal:  ['combo', 'combos', 'meal deal', 'bundle'],
  snack:       ['snack', 'snacks', 'bite', 'bites'],
};

// ─── Max pages by plan ────────────────────────
const MAX_PAGES = {
  free_trial: 0,
  basic:      2,
  premium:    20,
};

// ─── Steps ───────────────────────────────────
const STEPS = {
  CAPTURE:    'capture',
  PROCESSING: 'processing',
  REVIEW:     'review',
};

// ─────────────────────────────────────────────
// OCR HELPER: Call Google Vision API
// ─────────────────────────────────────────────
const callGoogleVision = async (base64Image) => {
  if (!VISION_API_KEY) {
    throw new Error('Google Vision API key not configured');
  }

  const response = await fetch(VISION_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image:    { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error('Vision API request failed');
  }

  const data = await response.json();
  return data.responses?.[0]?.fullTextAnnotation?.text || '';
};

// ─────────────────────────────────────────────
// PARSER: Extract menu items from raw OCR text
// ─────────────────────────────────────────────
const parseMenuText = (rawText) => {
  const lines    = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items    = [];
  let currentCategory = 'main_course';

  // ── Price regex patterns ──────────────────
  // Matches: $12.99, $12, 12.99, J$1200
  const priceRegex = /(?:J?\$|USD\s*)?\s*(\d{1,4}(?:\.\d{2})?)/;

  // ── Check if line is a section header ─────
  const isSectionHeader = (line) => {
    const lower = line.toLowerCase().trim();
    // Headers are usually short, all caps, or match keywords
    const isAllCaps  = line === line.toUpperCase() && line.length > 2;
    const isShort    = line.split(' ').length <= 4;
    const isKeyword  = Object.values(CATEGORY_KEYWORDS)
      .flat()
      .some(kw => lower.includes(kw));
    return (isAllCaps || isKeyword) && isShort && !priceRegex.test(line);
  };

  // ── Detect category from header ───────────
  const detectCategory = (line) => {
    const lower = line.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) return cat;
    }
    return currentCategory;
  };

  // ── Parse price from line ─────────────────
  const parsePrice = (line) => {
    const match = line.match(priceRegex);
    if (!match) return null;
    const price = parseFloat(match[1]);
    // ✅ Sanity check: menu prices between $0.50 and $999
    if (price < 0.5 || price > 999) return null;
    return price;
  };

  // ── Remove price from line ────────────────
  const removePriceFromLine = (line) => {
    return line
      .replace(/J?\$\s*\d{1,4}(?:\.\d{2})?/g, '')
      .replace(/\d{1,4}\.\d{2}/g, '')
      .trim();
  };

  // ── Main parsing loop ─────────────────────
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for section header
    if (isSectionHeader(line)) {
      currentCategory = detectCategory(line);
      i++;
      continue;
    }

    // Check if line has a price
    const price = parsePrice(line);
    if (price !== null) {
      const nameRaw = removePriceFromLine(line);

      // ✅ Name should be at least 2 chars and not just numbers
      if (nameRaw.length >= 2 && !/^\d+$/.test(nameRaw)) {
        // Look ahead for description (next line without price)
        let description = '';
        if (
          i + 1 < lines.length &&
          !parsePrice(lines[i + 1]) &&
          !isSectionHeader(lines[i + 1]) &&
          lines[i + 1].length > 2
        ) {
          description = lines[i + 1];
          i++; // skip description line
        }

        items.push({
          id:          `scan_${Date.now()}_${items.length}`,
          name:        nameRaw
                         .replace(/^\W+/, '') // remove leading non-word chars
                         .replace(/\s+/g, ' ')
                         .trim(),
          price,
          description: description.trim(),
          category:    currentCategory,
          confidence:  0.85,
          isEdited:    false,
          isSelected:  true,
        });
      }
    }

    i++;
  }

  // ✅ Remove duplicates by name similarity
  const unique = items.filter((item, idx) =>
    !items.slice(0, idx).some(
      prev => prev.name.toLowerCase() === item.name.toLowerCase()
    )
  );

  return unique;
};

// ─────────────────────────────────────────────
// UPLOAD SCANNED PAGE TO CLOUDINARY
// ─────────────────────────────────────────────
const uploadScanToCloudinary = async (imageUri, pageNum) => {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1600 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    const formData = new FormData();
    formData.append('file', {
      uri:  compressed.uri,
      type: 'image/jpeg',
      name: `menu_scan_page_${pageNum}_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', uploadPreset);
    // ✅ Goes to whats_cooking/menus/
    formData.append('folder', folders.menus);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method:  'POST',
        body:    formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return { success: true, url: data.secure_url };
  } catch (err) {
    console.error('Scan upload error:', err);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function MenuScannerScreen({ route, navigation }) {
  const insets       = useSafeAreaInsets();
  const { restaurantId, restaurant } = route.params || {};

  const { addScannedMenuItems }              = useMenu(restaurantId);
  const { getCurrentPlan, hasBasic }         = useSubscription();
  const [permission, requestPermission]      = useCameraPermissions();

  const cameraRef = useRef(null);

  // ── State ─────────────────────────────────
  const [step, setStep]               = useState(STEPS.CAPTURE);
  const [scannedPages, setScannedPages] = useState([]);
  // [{ uri, cloudinaryUrl, text }]
  const [extractedItems, setExtractedItems] = useState([]);
  const [processingMsg, setProcessingMsg]   = useState('');
  const [processingPct, setProcessingPct]   = useState(0);
  const [saving, setSaving]                 = useState(false);
  const [editingItem, setEditingItem]       = useState(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [facing, setFacing]                 = useState('back');

  // ── Plan check ────────────────────────────
  const currentPlan = getCurrentPlan(restaurant);
  const maxPages    = MAX_PAGES[currentPlan?.id || 'free_trial'];

  // ── Permission check ──────────────────────
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // ── Not subscribed (free trial) ───────────
  if (!hasBasic(restaurant)) {
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Ionicons name="scan-outline" size={60} color={COLORS.textMuted} />
        <Text style={styles.lockedTitle}>Menu Scanner</Text>
        <Text style={styles.lockedDesc}>
          Scan your physical menu pages to automatically
          extract and add items to your menu.
        </Text>
        <View style={styles.planCompare}>
          {[
            { plan: '🆓 Free Trial', scan: '❌ Not available' },
            { plan: '⭐ Basic',      scan: '✅ Up to 2 pages' },
            { plan: '👑 Premium',   scan: '✅ Up to 20 pages' },
          ].map((row, i) => (
            <View key={i} style={styles.planCompareRow}>
              <Text style={styles.planComparePlan}>{row.plan}</Text>
              <Text style={styles.planCompareScan}>{row.scan}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.lockedUpgradeBtn}
          onPress={() => navigation.navigate('Subscription', { restaurant })}
          activeOpacity={0.8}
        >
          <Ionicons name="diamond-outline" size={18} color="#FFFFFF" />
          <Text style={styles.lockedUpgradeBtnText}>
            Upgrade to Basic — $9.99/mo
          </Text>
        </TouchableOpacity>
        <Text style={styles.lockedPayText}>
          PayPal · Scotiabank Bank Transfer
        </Text>
      </View>
    );
  }

  // ── No camera permission ──────────────────
  if (!permission?.granted) {
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Ionicons name="camera-outline" size={60} color={COLORS.textMuted} />
        <Text style={styles.lockedTitle}>Camera Access Needed</Text>
        <Text style={styles.lockedDesc}>
          Please allow camera access to scan your menu
        </Text>
        <TouchableOpacity
          style={styles.lockedUpgradeBtn}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.lockedUpgradeBtnText}>
            Allow Camera Access
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // STEP 1: CAPTURE PHOTO
  // ─────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    // ✅ Check page limit
    if (scannedPages.length >= maxPages) {
      Alert.alert(
        '📄 Page Limit Reached',
        `Your ${currentPlan.name} plan allows up to ${maxPages} page${maxPages !== 1 ? 's' : ''}.\n\nUpgrade to Premium for up to 20 pages.`,
        [
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription', { restaurant }) },
          { text: 'Continue with current pages', onPress: handleDoneScanning },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:  0.9,
        base64:   false,
        skipProcessing: false,
      });

      const pageNum = scannedPages.length + 1;
      setScannedPages(prev => [
        ...prev,
        { uri: photo.uri, pageNum, cloudinaryUrl: null, text: '' },
      ]);

      Alert.alert(
        `✅ Page ${pageNum} Captured`,
        scannedPages.length + 1 >= maxPages
          ? `You've reached your ${maxPages}-page limit. Tap "Done Scanning" to process.`
          : 'Scan another page or tap "Done Scanning" to process.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [cameraRef, scannedPages, maxPages, currentPlan]);

  // ─────────────────────────────────────────
  // STEP 2: PROCESS PAGES
  // ─────────────────────────────────────────
  const handleDoneScanning = useCallback(async () => {
    if (scannedPages.length === 0) {
      Alert.alert('No Pages', 'Please scan at least one menu page first.');
      return;
    }

    setStep(STEPS.PROCESSING);
    let allItems = [];

    for (let i = 0; i < scannedPages.length; i++) {
      const page    = scannedPages[i];
      const pageNum = i + 1;

      // ── Upload to Cloudinary ──────────────
      setProcessingMsg(`Uploading page ${pageNum}/${scannedPages.length}...`);
      setProcessingPct(Math.round(((i * 3) / (scannedPages.length * 3)) * 100));

      const uploadResult = await uploadScanToCloudinary(page.uri, pageNum);
      if (uploadResult.success) {
        setScannedPages(prev =>
          prev.map((p, idx) =>
            idx === i ? { ...p, cloudinaryUrl: uploadResult.url } : p
          )
        );
      }

      // ── Compress & convert to base64 for OCR
      setProcessingMsg(`Reading page ${pageNum}/${scannedPages.length}...`);
      setProcessingPct(Math.round(((i * 3 + 1) / (scannedPages.length * 3)) * 100));

      let rawText = '';
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          page.uri,
          [{ resize: { width: 1200 } }],
          {
            compress: 0.8,
            format:   ImageManipulator.SaveFormat.JPEG,
            base64:   true,
          }
        );

        rawText = await callGoogleVision(compressed.base64);
      } catch (err) {
        console.warn(`OCR failed for page ${pageNum}:`, err.message);
        rawText = '';
      }

      // ── Parse items from OCR text ─────────
      setProcessingMsg(`Extracting items from page ${pageNum}...`);
      setProcessingPct(Math.round(((i * 3 + 2) / (scannedPages.length * 3)) * 100));

      if (rawText) {
        const pageItems = parseMenuText(rawText);
        allItems = [...allItems, ...pageItems];
      }
    }

    setProcessingPct(100);
    setProcessingMsg('Done!');

    // ✅ Remove duplicates across pages
    const unique = allItems.filter((item, idx) =>
      !allItems.slice(0, idx).some(
        prev => prev.name.toLowerCase() === item.name.toLowerCase()
      )
    );

    await new Promise(r => setTimeout(r, 500)); // show 100%

    if (unique.length === 0) {
      Alert.alert(
        '⚠️ No Items Found',
        'Could not extract menu items from the scanned pages.\n\n' +
        'Tips:\n' +
        '• Make sure the menu is well-lit\n' +
        '• Hold the camera steady\n' +
        '• Ensure text is in focus\n' +
        '• Try scanning one page at a time',
        [
          { text: 'Try Again', onPress: () => setStep(STEPS.CAPTURE) },
          { text: 'Add Manually', onPress: () => {
            navigation.navigate('AddMenuItem', { restaurantId });
          }},
        ]
      );
      setStep(STEPS.CAPTURE);
      return;
    }

    setExtractedItems(unique);
    setStep(STEPS.REVIEW);
  }, [scannedPages, restaurantId]);

  // ─────────────────────────────────────────
  // STEP 3: REVIEW — ITEM ACTIONS
  // ─────────────────────────────────────────
  const toggleItemSelected = useCallback((itemId) => {
    setExtractedItems(prev =>
      prev.map(i =>
        i.id === itemId ? { ...i, isSelected: !i.isSelected } : i
      )
    );
  }, []);

  const deleteItem = useCallback((itemId) => {
    setExtractedItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const openEditItem = useCallback((item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  }, []);

  const saveEditedItem = useCallback(() => {
    if (!editingItem?.name?.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    if (!editingItem?.price || isNaN(parseFloat(editingItem.price))) {
      Alert.alert('Error', 'Valid price is required');
      return;
    }
    setExtractedItems(prev =>
      prev.map(i =>
        i.id === editingItem.id
          ? { ...editingItem, price: parseFloat(editingItem.price), isEdited: true }
          : i
      )
    );
    setShowEditModal(false);
    setEditingItem(null);
  }, [editingItem]);

  const addManualItem = useCallback(() => {
    const newItem = {
      id:          `manual_${Date.now()}`,
      name:        '',
      price:       0,
      description: '',
      category:    'main_course',
      confidence:  1,
      isEdited:    true,
      isSelected:  true,
    };
    setEditingItem(newItem);
    setShowEditModal(true);
  }, []);

  const saveNewItem = useCallback(() => {
    if (!editingItem?.name?.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    if (!editingItem?.price || isNaN(parseFloat(editingItem.price))) {
      Alert.alert('Error', 'Valid price is required');
      return;
    }
    const isNew = !extractedItems.find(i => i.id === editingItem.id);
    if (isNew) {
      setExtractedItems(prev => [
        ...prev,
        { ...editingItem, price: parseFloat(editingItem.price) },
      ]);
    } else {
      setExtractedItems(prev =>
        prev.map(i =>
          i.id === editingItem.id
            ? { ...editingItem, price: parseFloat(editingItem.price), isEdited: true }
            : i
        )
      );
    }
    setShowEditModal(false);
    setEditingItem(null);
  }, [editingItem, extractedItems]);

  // ─────────────────────────────────────────
  // SAVE TO FIRESTORE
  // ─────────────────────────────────────────
  const handleAddToMenu = useCallback(async () => {
    const selectedItems = extractedItems.filter(i => i.isSelected);

    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to add.');
      return;
    }

    Alert.alert(
      '✅ Add to Menu',
      `Add ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} to your menu?\n\nYou can edit photos and details later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Menu',
          onPress: async () => {
            setSaving(true);
            try {
              const results = await addScannedMenuItems(
                selectedItems.map(item => ({
                  name:        item.name,
                  price:       item.price,
                  description: item.description,
                  category:    item.category,
                  dietaryInfo: {},
                  tags:        [],
                }))
              );

              const successCount = results.success.length;
              const failCount    = results.failed.length;

              Alert.alert(
                '🎉 Done!',
                `✅ ${successCount} item${successCount !== 1 ? 's' : ''} added to your menu.\n` +
                (failCount > 0 ? `⚠️ ${failCount} failed — you can add them manually.` : '') +
                '\n\nYou can add photos to each item from Manage Menu.',
                [
                  {
                    text: 'View Menu',
                    onPress: () => {
                      navigation.navigate('ManageMenu');
                    },
                  },
                  {
                    text: 'Scan More',
                    onPress: () => {
                      setStep(STEPS.CAPTURE);
                      setScannedPages([]);
                      setExtractedItems([]);
                    },
                  },
                ]
              );
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to save items');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [extractedItems, addScannedMenuItems, navigation]);

  // ─────────────────────────────────────────
  // CATEGORY OPTIONS
  // ─────────────────────────────────────────
  const CATEGORIES = [
    { id: 'appetizer',   label: '🥗 Appetizer'  },
    { id: 'soup',        label: '🍲 Soup'        },
    { id: 'salad',       label: '🥙 Salad'       },
    { id: 'main_course', label: '🍽️ Main Course' },
    { id: 'side_dish',   label: '🍟 Side Dish'   },
    { id: 'dessert',     label: '🧁 Dessert'     },
    { id: 'beverage',    label: '🥤 Beverage'    },
    { id: 'breakfast',   label: '🍳 Breakfast'   },
    { id: 'combo_meal',  label: '🎁 Combo Meal'  },
    { id: 'snack',       label: '🍿 Snack'       },
  ];

  // ─────────────────────────────────────────
  // RENDER: STEP 1 — CAPTURE
  // ─────────────────────────────────────────
  const renderCapture = () => (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* ── Top Bar ──────────────────────── */}
      <View style={[
        styles.cameraTopBar,
        { paddingTop: insets.top + SIZES.sm },
      ]}>
        <TouchableOpacity
          style={styles.cameraBackBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.cameraTopCenter}>
          <Text style={styles.cameraTitle}>📷 Scan Menu</Text>
          <Text style={styles.cameraSubtitle}>
            Page {scannedPages.length + 1}
            {maxPages < 20 ? ` / ${maxPages}` : ''}
          </Text>
        </View>

        {/* Flip camera */}
        <TouchableOpacity
          style={styles.cameraBackBtn}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Guide Overlay ─────────────────── */}
      <View style={styles.guideOverlay}>
        <View style={styles.guideFrame}>
          {/* Corner marks */}
          {[
            { top: 0,    left: 0,    borderTopWidth: 3,    borderLeftWidth: 3  },
            { top: 0,    right: 0,   borderTopWidth: 3,    borderRightWidth: 3 },
            { bottom: 0, left: 0,    borderBottomWidth: 3, borderLeftWidth: 3  },
            { bottom: 0, right: 0,   borderBottomWidth: 3, borderRightWidth: 3 },
          ].map((corner, i) => (
            <View
              key={i}
              style={[styles.guideCorner, corner, { borderColor: COLORS.primary }]}
            />
          ))}
        </View>
        <Text style={styles.guideText}>
          Align menu page within the frame
        </Text>
      </View>

      {/* ── Scanned Pages Thumbnails ──────── */}
      {scannedPages.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailContent}
          >
            {scannedPages.map((page, idx) => (
              <View key={idx} style={styles.thumbnail}>
                <Image
                  source={{ uri: page.uri }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>
                    {idx + 1}
                  </Text>
                </View>
                {/* Remove page */}
                <TouchableOpacity
                  style={styles.thumbnailRemove}
                  onPress={() => {
                    setScannedPages(prev => prev.filter((_, i) => i !== idx));
                  }}
                >
                  <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Tips ─────────────────────────── */}
      <View style={styles.cameraTips}>
        {[
          '💡 Good lighting helps accuracy',
          '📐 Keep menu flat and straight',
          '🔍 Make sure text is in focus',
        ].map((tip, i) => (
          <Text key={i} style={styles.cameraTipText}>{tip}</Text>
        ))}
      </View>

      {/* ── Bottom Controls ───────────────── */}
      <View style={[
        styles.cameraControls,
        { paddingBottom: insets.bottom + SIZES.md },
      ]}>
        {/* Capture Button */}
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={handleCapture}
          activeOpacity={0.8}
        >
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>

        {/* Done Scanning */}
        {scannedPages.length > 0 && (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleDoneScanning}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.doneBtnText}>
              Done ({scannedPages.length} page
              {scannedPages.length !== 1 ? 's' : ''})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ─────────────────────────────────────────
  // RENDER: STEP 2 — PROCESSING
  // ─────────────────────────────────────────
  const renderProcessing = () => (
    <View style={[
      styles.processingContainer,
      { paddingTop: insets.top, paddingBottom: insets.bottom },
    ]}>
      {/* Animated icon */}
      <View style={styles.processingIconBg}>
        <Ionicons name="scan-outline" size={60} color={COLORS.primary} />
      </View>

      <Text style={styles.processingTitle}>Reading Your Menu...</Text>
      <Text style={styles.processingMsg}>{processingMsg}</Text>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[
          styles.progressBarFill,
          { width: `${processingPct}%` },
        ]} />
      </View>
      <Text style={styles.progressPct}>{processingPct}%</Text>

      {/* Page previews */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.processingPages}
      >
        {scannedPages.map((page, idx) => (
          <View key={idx} style={styles.processingPage}>
            <Image
              source={{ uri: page.uri }}
              style={styles.processingPageImage}
              resizeMode="cover"
            />
            <Text style={styles.processingPageLabel}>
              Page {idx + 1}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.processingHint}>
        Please wait — do not close the app
      </Text>
    </View>
  );

  // ─────────────────────────────────────────
  // RENDER: STEP 3 — REVIEW
  // ─────────────────────────────────────────
  const renderReview = () => {
    const selectedCount = extractedItems.filter(i => i.isSelected).length;
    const editedCount   = extractedItems.filter(i => i.isEdited).length;

    return (
      <View style={styles.container}>
        {/* ── Review Header ──────────────── */}
        <View style={[
          styles.reviewHeader,
          { paddingTop: insets.top + SIZES.sm },
        ]}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Go Back?',
                'You\'ll lose the extracted items. Scan again?',
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Go Back', onPress: () => {
                    setStep(STEPS.CAPTURE);
                    setExtractedItems([]);
                  }},
                ]
              );
            }}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: SIZES.sm }}>
            <Text style={styles.reviewTitle}>
              Review Items
            </Text>
            <Text style={styles.reviewSubtitle}>
              {extractedItems.length} found ·{' '}
              {selectedCount} selected
              {editedCount > 0 ? ` · ${editedCount} edited` : ''}
            </Text>
          </View>

          {/* Add manual item */}
          <TouchableOpacity
            style={styles.addManualBtn}
            onPress={addManualItem}
          >
            <Ionicons name="add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Info Banner ────────────────── */}
        <View style={styles.reviewInfoBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.reviewInfoText}>
            Review each item, fix any errors, then tap
            "Add to Menu". You can add photos later.
          </Text>
        </View>

        {/* ── Select All / Deselect All ───── */}
        <View style={styles.reviewControls}>
          <TouchableOpacity
            onPress={() => setExtractedItems(prev =>
              prev.map(i => ({ ...i, isSelected: true }))
            )}
          >
            <Text style={styles.reviewControlBtn}>Select All</Text>
          </TouchableOpacity>
          <Text style={styles.reviewControlDot}>·</Text>
          <TouchableOpacity
            onPress={() => setExtractedItems(prev =>
              prev.map(i => ({ ...i, isSelected: false }))
            )}
          >
            <Text style={[
              styles.reviewControlBtn,
              { color: COLORS.error },
            ]}>
              Deselect All
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Items List ─────────────────── */}
        <FlatList
          data={extractedItems}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.reviewList,
            { paddingBottom: insets.bottom + 100 },
          ]}
          ListEmptyComponent={
            <View style={styles.reviewEmpty}>
              <Text style={styles.reviewEmptyText}>
                No items yet. Tap + to add manually.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              styles.reviewItem,
              !item.isSelected && styles.reviewItemDeselected,
              item.isEdited && styles.reviewItemEdited,
            ]}>
              {/* Checkbox */}
              <TouchableOpacity
                style={[
                  styles.reviewCheckbox,
                  item.isSelected && styles.reviewCheckboxActive,
                ]}
                onPress={() => toggleItemSelected(item.id)}
              >
                {item.isSelected && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              {/* Item Info */}
              <View style={{ flex: 1 }}>
                <View style={styles.reviewItemHeader}>
                  <Text style={[
                    styles.reviewItemName,
                    !item.isSelected && styles.reviewItemNameDim,
                  ]}>
                    {item.name || 'Unnamed Item'}
                  </Text>
                  {item.isEdited && (
                    <View style={styles.editedBadge}>
                      <Text style={styles.editedBadgeText}>edited</Text>
                    </View>
                  )}
                </View>

                <View style={styles.reviewItemMeta}>
                  <Text style={styles.reviewItemPrice}>
                    ${parseFloat(item.price || 0).toFixed(2)}
                  </Text>
                  <View style={styles.reviewItemCategory}>
                    <Text style={styles.reviewItemCategoryText}>
                      {item.category?.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                {item.description ? (
                  <Text
                    style={styles.reviewItemDesc}
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                ) : null}

                {/* Confidence indicator */}
                {item.confidence < 0.9 && (
                  <Text style={styles.reviewItemConfidence}>
                    ⚠️ Low confidence — please verify
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.reviewItemActions}>
                <TouchableOpacity
                  style={styles.reviewEditBtn}
                  onPress={() => openEditItem(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reviewDeleteBtn}
                  onPress={() => deleteItem(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={COLORS.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* ── Add to Menu Button ──────────── */}
        <View style={[
          styles.reviewFooter,
          { paddingBottom: insets.bottom + SIZES.sm },
        ]}>
          <View style={styles.reviewFooterInfo}>
            <Text style={styles.reviewFooterCount}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.reviewFooterSub}>
              ready to add
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addToMenuBtn,
              (saving || selectedCount === 0) && { opacity: 0.6 },
            ]}
            onPress={handleAddToMenu}
            disabled={saving || selectedCount === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.addToMenuBtnText}>
                  Add to Menu
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────
  // RENDER: EDIT ITEM MODAL
  // ─────────────────────────────────────────
  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[
          styles.editModal,
          { paddingBottom: insets.bottom + SIZES.md },
        ]}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>
            {extractedItems.find(i => i.id === editingItem?.id)
              ? 'Edit Item'
              : 'Add Item'}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <Text style={styles.modalLabel}>
              Item Name <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editingItem?.name || ''}
              onChangeText={v => setEditingItem(p => ({ ...p, name: v }))}
              placeholder="e.g. Jerk Chicken"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              autoFocus
            />

            {/* Price */}
            <Text style={styles.modalLabel}>
              Price ($) <Text style={{ color: COLORS.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editingItem?.price?.toString() || ''}
              onChangeText={v => setEditingItem(p => ({ ...p, price: v }))}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />

            {/* Description */}
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={editingItem?.description || ''}
              onChangeText={v => setEditingItem(p => ({ ...p, description: v }))}
              placeholder="Optional description..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />

            {/* Category */}
            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalCategories}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.modalCategoryBtn,
                    editingItem?.category === cat.id &&
                      styles.modalCategoryBtnActive,
                  ]}
                  onPress={() =>
                    setEditingItem(p => ({ ...p, category: cat.id }))
                  }
                >
                  <Text style={[
                    styles.modalCategoryText,
                    editingItem?.category === cat.id &&
                      styles.modalCategoryTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Save / Cancel */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={
                  extractedItems.find(i => i.id === editingItem?.id)
                    ? saveEditedItem
                    : saveNewItem
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalSaveText}>Save Item</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <>
      {step === STEPS.CAPTURE    && renderCapture()}
      {step === STEPS.PROCESSING && renderProcessing()}
      {step === STEPS.REVIEW     && renderReview()}
      {renderEditModal()}
    </>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#000' },

  // ── Locked / No Permission ────────────────
  lockedContainer: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         SIZES.xl,
    backgroundColor: COLORS.background,
    gap:             SIZES.md,
  },
  lockedTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
    textAlign:  'center',
  },
  lockedDesc: {
    fontSize:   FONTS.md,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 22,
  },
  planCompare: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    width:           '100%',
    gap:             SIZES.sm,
    ...SHADOW,
  },
  planCompareRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: SIZES.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  planComparePlan: { fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  planCompareScan: { fontSize: FONTS.sm, color: COLORS.textMuted },
  lockedUpgradeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
    marginTop:         SIZES.sm,
  },
  lockedUpgradeBtnText: {
    color:      '#FFFFFF',
    fontWeight: 'bold',
    fontSize:   FONTS.md,
  },
  lockedPayText: {
    fontSize: FONTS.sm,
    color:    COLORS.textMuted,
  },

  // ── Camera ────────────────────────────────
  cameraTopBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.md,
    backgroundColor:   'rgba(0,0,0,0.5)',
  },
  cameraBackBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  cameraTopCenter: { alignItems: 'center' },
  cameraTitle: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      '#FFFFFF',
  },
  cameraSubtitle: {
    fontSize: FONTS.sm,
    color:    'rgba(255,255,255,0.8)',
  },

  // ── Guide Frame ───────────────────────────
  guideOverlay: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  guideFrame: {
    width:           '85%',
    height:          '60%',
    borderRadius:    RADIUS.lg,
    position:        'relative',
  },
  guideCorner: {
    position:     'absolute',
    width:         24,
    height:        24,
    borderColor:   COLORS.primary,
    borderRadius:  4,
  },
  guideText: {
    color:     'rgba(255,255,255,0.8)',
    fontSize:  FONTS.sm,
    marginTop: SIZES.md,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.xs,
    borderRadius:      RADIUS.round,
  },

  // ── Thumbnails ────────────────────────────
  thumbnailStrip: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: SIZES.sm,
  },
  thumbnailContent: {
    paddingHorizontal: SIZES.md,
    gap:               SIZES.sm,
    alignItems:        'center',
  },
  thumbnail: {
    width:        60,
    height:       80,
    borderRadius: RADIUS.md,
    overflow:     'hidden',
    position:     'relative',
    borderWidth:  2,
    borderColor:  COLORS.primary,
  },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailBadge: {
    position:        'absolute',
    bottom:          4,
    left:            4,
    backgroundColor: COLORS.primary,
    borderRadius:    8,
    width:           16,
    height:          16,
    justifyContent:  'center',
    alignItems:      'center',
  },
  thumbnailBadgeText: {
    color:      '#FFFFFF',
    fontSize:   9,
    fontWeight: 'bold',
  },
  thumbnailRemove: {
    position: 'absolute',
    top:      2,
    right:    2,
  },

  // ── Camera Tips ───────────────────────────
  cameraTips: {
    backgroundColor:   'rgba(0,0,0,0.6)',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    gap:               4,
  },
  cameraTipText: {
    color:    'rgba(255,255,255,0.8)',
    fontSize: FONTS.xs,
  },

  // ── Camera Controls ───────────────────────
  cameraControls: {
    alignItems:        'center',
    paddingTop:        SIZES.md,
    paddingHorizontal: SIZES.md,
    backgroundColor:   'rgba(0,0,0,0.7)',
    gap:               SIZES.md,
  },
  captureBtn: {
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     4,
    borderColor:     '#FFFFFF',
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureBtnInner: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: '#FFFFFF',
  },
  doneBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.success,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
  },
  doneBtnText: {
    color:      '#FFFFFF',
    fontWeight: 'bold',
    fontSize:   FONTS.md,
  },

  // ── Processing ────────────────────────────
  processingContainer: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    padding:         SIZES.xl,
    gap:             SIZES.md,
  },
  processingIconBg: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: COLORS.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SIZES.sm,
  },
  processingTitle: {
    fontSize:   FONTS.xxl,
    fontWeight: 'bold',
    color:      COLORS.text,
  },
  processingMsg: {
    fontSize:  FONTS.md,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
  progressBarBg: {
    width:           '100%',
    height:          8,
    backgroundColor: COLORS.border,
    borderRadius:    RADIUS.round,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          '100%',
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.round,
  },
  progressPct: {
    fontSize:   FONTS.lg,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },
  processingPages: {
    gap:               SIZES.sm,
    paddingHorizontal: SIZES.md,
  },
  processingPage: { alignItems: 'center', gap: 4 },
  processingPageImage: {
    width:        60,
    height:       80,
    borderRadius: RADIUS.md,
    borderWidth:  1,
    borderColor:  COLORS.border,
  },
  processingPageLabel: {
    fontSize: FONTS.xs,
    color:    COLORS.textMuted,
  },
  processingHint: {
    fontSize:  FONTS.sm,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Review ────────────────────────────────
  reviewHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingBottom:     SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW,
  },
  reviewTitle:    { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  reviewSubtitle: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  addManualBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: COLORS.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.primary + '30',
  },
  reviewInfoBanner: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SIZES.sm,
    backgroundColor: COLORS.primary + '08',
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  reviewInfoText: {
    flex:      1,
    fontSize:  FONTS.xs,
    color:     COLORS.primary,
    lineHeight: 18,
  },
  reviewControls: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewControlBtn: {
    fontSize:   FONTS.sm,
    color:      COLORS.primary,
    fontWeight: '600',
  },
  reviewControlDot: { color: COLORS.textMuted },
  reviewList:        { padding: SIZES.md, gap: SIZES.sm },
  reviewEmpty: {
    alignItems: 'center',
    padding:    SIZES.xl,
  },
  reviewEmptyText: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Review Item ───────────────────────────
  reviewItem: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    padding:         SIZES.md,
    gap:             SIZES.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
    ...SHADOW,
  },
  reviewItemDeselected: {
    opacity:     0.5,
    borderColor: COLORS.border,
  },
  reviewItemEdited: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '05',
  },
  reviewCheckbox: {
    width:           24,
    height:          24,
    borderRadius:    6,
    borderWidth:     2,
    borderColor:     COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       2,
  },
  reviewCheckboxActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.xs,
    flexWrap:      'wrap',
  },
  reviewItemName: {
    fontSize:   FONTS.md,
    fontWeight: '700',
    color:      COLORS.text,
    flex:       1,
  },
  reviewItemNameDim: { color: COLORS.textMuted },
  editedBadge: {
    backgroundColor:   COLORS.primary + '20',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  editedBadgeText: {
    fontSize:   9,
    color:      COLORS.primary,
    fontWeight: '700',
  },
  reviewItemMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SIZES.sm,
    marginTop:     4,
  },
  reviewItemPrice: {
    fontSize:   FONTS.md,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },
  reviewItemCategory: {
    backgroundColor:   COLORS.border,
    paddingHorizontal: SIZES.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.round,
  },
  reviewItemCategoryText: {
    fontSize:        FONTS.xs,
    color:           COLORS.textMuted,
    textTransform:   'capitalize',
    fontWeight:      '500',
  },
  reviewItemDesc: {
    fontSize:  FONTS.xs,
    color:     COLORS.textMuted,
    marginTop: 4,
  },
  reviewItemConfidence: {
    fontSize:  FONTS.xs,
    color:     '#F39C12',
    marginTop: 4,
    fontWeight: '600',
  },
  reviewItemActions: {
    gap: SIZES.sm,
  },
  reviewEditBtn: {
    padding:         SIZES.sm,
    backgroundColor: COLORS.primary + '15',
    borderRadius:    RADIUS.md,
  },
  reviewDeleteBtn: {
    padding:         SIZES.sm,
    backgroundColor: COLORS.error + '15',
    borderRadius:    RADIUS.md,
  },

  // ── Review Footer ─────────────────────────
  reviewFooter: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingTop:        SIZES.md,
    borderTopWidth:    1,
    borderTopColor:    COLORS.border,
    ...SHADOW,
  },
  reviewFooterCount: {
    fontSize:   FONTS.xl,
    fontWeight: 'bold',
    color:      COLORS.primary,
  },
  reviewFooterSub:   { fontSize: FONTS.xs, color: COLORS.textMuted },
  addToMenuBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SIZES.sm,
    backgroundColor:   COLORS.primary,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    borderRadius:      RADIUS.lg,
  },
  addToMenuBtnText: {
    color:      '#FFFFFF',
    fontWeight: 'bold',
    fontSize:   FONTS.lg,
  },

  // ── Edit Modal ────────────────────────────
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  editModal: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              SIZES.lg,
    maxHeight:            '85%',
  },
  modalHandle: {
    width:           40,
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    SIZES.md,
  },
  modalTitle: {
    fontSize:     FONTS.xl,
    fontWeight:   'bold',
    color:        COLORS.text,
    marginBottom: SIZES.md,
  },
  modalLabel: {
    fontSize:     FONTS.md,
    fontWeight:   '600',
    color:        COLORS.text,
    marginBottom: SIZES.xs,
    marginTop:    SIZES.sm,
  },
  modalInput: {
    backgroundColor:   COLORS.background,
    borderRadius:      RADIUS.md,
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.md,
    fontSize:          FONTS.md,
    color:             COLORS.text,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  modalCategories: {
    gap:               SIZES.sm,
    paddingVertical:   SIZES.sm,
  },
  modalCategoryBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical:   SIZES.sm,
    borderRadius:      RADIUS.round,
    backgroundColor:   COLORS.background,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  modalCategoryBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  modalCategoryText:       { fontSize: FONTS.sm, color: COLORS.textMuted },
  modalCategoryTextActive: { color: '#FFFFFF', fontWeight: '600' },
  modalActions: {
    flexDirection:  'row',
    gap:            SIZES.md,
    marginTop:      SIZES.lg,
  },
  modalCancelBtn: {
    flex:            1,
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    alignItems:      'center',
    backgroundColor: COLORS.border,
  },
  modalCancelText: {
    fontSize:   FONTS.md,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex:            2,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SIZES.sm,
    paddingVertical: SIZES.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  modalSaveText: {
    color:      '#FFFFFF',
    fontSize:   FONTS.md,
    fontWeight: 'bold',
  },
});