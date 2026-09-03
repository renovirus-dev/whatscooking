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
import { doc, getDoc }       from 'firebase/firestore';
import { db }                from '../../firebase/config';
import { useMenu }           from '../../hooks/useMenu';
import { useSubscription }   from '../../hooks/useSubscription';
import { CLOUDINARY_CONFIG } from '../../config/cloudinary';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';
import { checkSubscriptionStatus } from '../../utils/subscriptionHelper'; // ✅ Strict mode helper

// ✅ Safe ML Kit import
let TextRecognition;
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch (e) {
  console.log('ML Kit not available:', e.message);
  TextRecognition = null;
}

const { cloudName, uploadPreset, folders } = CLOUDINARY_CONFIG;

// ─── Safe Platform Alerts ─────────────────────
const showSafeAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
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

// ─── Category Keywords ────────────────────────
const CATEGORY_KEYWORDS = {
  appetizer:   ['appetizer', 'starter', 'starters', 'appetizers', 'small plates'],
  soup:        ['soup', 'soups', 'broth', 'chowder'],
  salad:       ['salad', 'salads'],
  main_course: ['main', 'mains', 'entree', 'entrees', 'dinner', 'lunch', 'main course'],
  side_dish:   ['side', 'sides', 'side dish', 'extras'],
  dessert:     ['dessert', 'desserts', 'sweet', 'sweets', 'pudding'],
  beverage:    ['drink', 'drinks', 'beverage', 'beverages', 'juice', 'cocktail', 'smoothie'],
  breakfast:   ['breakfast', 'brunch', 'morning'],
  combo_meal:  ['combo', 'combos', 'meal deal', 'bundle', 'special'],
  snack:       ['snack', 'snacks', 'bite', 'bites'],
};

const MAX_PAGES = {
  free_trial: 0,
  basic:      2,
  premium:    20,
};

const STEPS = {
  CAPTURE:    'capture',
  PROCESSING: 'processing',
  REVIEW:     'review',
};

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

// ─────────────────────────────────────────────
// OCR
// ─────────────────────────────────────────────
const runOCR = async (imageUri) => {
  if (!TextRecognition) return '';
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    const result = await TextRecognition.recognize(compressed.uri);
    return result.text || '';
  } catch (err) {
    console.error('ML Kit OCR error:', err);
    return '';
  }
};

// ─────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────
const parseMenuText = (rawText) => {
  if (!rawText?.trim()) return [];
  const lines         = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items         = [];
  let currentCategory = 'main_course';

  const isSectionHeader = (line) => {
    const lower    = line.toLowerCase().trim();
    const isShort  = line.split(' ').length <= 5;
    const isAllCaps = line === line.toUpperCase() && line.length > 2 && /[A-Z]/.test(line);
    const isKeyword = Object.values(CATEGORY_KEYWORDS).flat().some(kw => lower.includes(kw));
    const hasPrice  = /\d+\.\d{2}/.test(line) || /\$\d+/.test(line);
    return (isAllCaps || isKeyword) && isShort && !hasPrice;
  };

  const detectCategory = (line) => {
    const lower = line.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) return cat;
    }
    return currentCategory;
  };

  const extractPrice = (line) => {
    const dollarMatch = line.match(/J?\$\s*(\d{1,4}(?:[.,]\d{2})?)/);
    if (dollarMatch) {
      const val = parseFloat(dollarMatch[1].replace(',', '.'));
      if (val >= 0.5 && val <= 9999) return val;
    }
    const decimalMatch = line.match(/\b(\d{1,3}\.\d{2})\b/);
    if (decimalMatch) {
      const val = parseFloat(decimalMatch[1]);
      if (val >= 0.5 && val <= 999) return val;
    }
    return null;
  };

  const stripPrice = (line) =>
    line
      .replace(/J?\$\s*\d{1,4}(?:[.,]\d{2,3})?/g, '')
      .replace(/\b\d{1,3}\.\d{2}\b/g, '')
      .replace(/\.{2,}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.length < 2) { i++; continue; }
    if (isSectionHeader(line)) {
      currentCategory = detectCategory(line);
      i++;
      continue;
    }
    const price = extractPrice(line);
    if (price !== null) {
      const namePart   = stripPrice(line);
      const isValidName =
        namePart.length >= 2 &&
        !/^\d+$/.test(namePart) &&
        !/^[^a-zA-Z]*$/.test(namePart);
      if (isValidName) {
        let description = '';
        if (
          i + 1 < lines.length &&
          extractPrice(lines[i + 1]) === null &&
          !isSectionHeader(lines[i + 1]) &&
          lines[i + 1].length > 3 &&
          lines[i + 1].length < 150
        ) {
          description = lines[i + 1].trim();
          i++;
        }
        items.push({
          id:         `scan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name:       namePart
                        .replace(/^[-•*·]+\s*/, '')
                        .replace(/\s+/g, ' ')
                        .trim(),
          price:      Math.round(price * 100) / 100,
          description,
          category:   currentCategory,
          confidence: price > 0.5 ? 0.9 : 0.7,
          isEdited:   false,
          isSelected: true,
        });
      }
    }
    i++;
  }

  const seen = new Set();
  return items.filter(item => {
    const key = item.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ─────────────────────────────────────────────
// UPLOAD SCAN TO CLOUDINARY
// ─────────────────────────────────────────────
const uploadScanToCloudinary = (imageUri, pageNum) => {
  return new Promise(async (resolve) => {
    try {
      let finalUri = imageUri;

      try {
        const compressed = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1600 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = compressed.uri;
      } catch (err) {
        console.warn('Scan compression bypassed:', err.message);
      }

      const formData = new FormData();
      const fileName = `menu_scan_p${pageNum}_${Date.now()}.jpg`;

      if (Platform.OS === 'web') {
        const response = await fetch(finalUri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', {
          uri:  finalUri,
          type: 'image/jpeg',
          name: fileName,
        });
      }

      formData.append('upload_preset', uploadPreset);
      formData.append('folder',        folders.menus);

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve({ success: true, url: data.secure_url });
        } else {
          let errMsg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errMsg = errData.error?.message || errMsg;
          } catch {}
          console.error('Scan upload failed:', errMsg);
          resolve({ success: false, error: errMsg });
        }
      };

      xhr.onerror = () => {
        console.error('Scan upload network error');
        resolve({ success: false, error: 'Network error' });
      };

      xhr.ontimeout = () => {
        console.error('Scan upload timed out');
        resolve({ success: false, error: 'Upload timed out' });
      };

      xhr.timeout = 60000;
      xhr.send(formData);

    } catch (err) {
      console.error('uploadScanToCloudinary error:', err);
      resolve({ success: false, error: err.message });
    }
  });
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function MenuScannerScreen({ route, navigation }) {
  const insets     = useSafeAreaInsets();
  const { restaurantId, restaurant: passedRestaurant } = route.params || {};

  // ── All hooks positioned cleanly at top ─────
  const { addScannedMenuItems }      = useMenu(restaurantId);
  const { getCurrentPlan, hasBasic } = useSubscription();
  const [permission, requestPermission] = useCameraPermissions();

  const [restaurant, setRestaurant]     = useState(passedRestaurant || null);
  const [loadingResto, setLoadingResto] = useState(!passedRestaurant);

  const [step, setStep]                     = useState(STEPS.CAPTURE);
  const [scannedPages, setScannedPages]     = useState([]);
  const [extractedItems, setExtractedItems] = useState([]);
  const [processingMsg, setProcessingMsg]   = useState('');
  const [processingPct, setProcessingPct]   = useState(0);
  const [saving, setSaving]                 = useState(false);
  const [editingItem, setEditingItem]       = useState(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [facing, setFacing]                 = useState('back');
  const [torchOn, setTorchOn]               = useState(false);

  const cameraRef = useRef(null);

  // ── Load restaurant if not passed ─────────
  useEffect(() => {
    if (passedRestaurant) {
      setRestaurant(passedRestaurant);
      setLoadingResto(false);
      return;
    }
    if (!restaurantId) {
      setLoadingResto(false);
      return;
    }
    getDoc(doc(db, 'restaurants', restaurantId))
      .then(snap => {
        if (snap.exists()) setRestaurant({ id: snap.id, ...snap.data() });
        setLoadingResto(false);
      })
      .catch(() => setLoadingResto(false));
  }, [restaurantId, passedRestaurant]);

  // Calculate Subscription & Strict Mode Status
  const subStatus = checkSubscriptionStatus(restaurant);

  // ── Capture ───────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    const currentPlan = getCurrentPlan(restaurant);
    const maxPages    = MAX_PAGES[currentPlan?.id || 'free_trial'];

    if (scannedPages.length >= maxPages) {
      showSafeAlert(
        '📄 Page Limit Reached',
        `Your ${currentPlan.name} plan allows up to ${maxPages} page${maxPages !== 1 ? 's' : ''}.\n\nUpgrade to Premium for up to 20 pages.`,
        [
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription', { restaurant }) },
          { text: 'Process Current Pages', onPress: handleDoneScanning },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:         0.9,
        base64:          false,
        skipProcessing:  false,
      });
      setScannedPages(prev => [
        ...prev,
        { uri: photo.uri, pageNum: prev.length + 1, cloudinaryUrl: null },
      ]);
    } catch (err) {
      showSafeAlert('Error', 'Failed to capture. Please try again.');
    }
  }, [cameraRef, scannedPages, restaurant, getCurrentPlan, handleDoneScanning, navigation]);

  // ── Done Scanning ─────────────────────────
  const handleDoneScanning = useCallback(async () => {
    if (scannedPages.length === 0) {
      showSafeAlert('No Pages Scanned', 'Please scan at least one menu page first.');
      return;
    }
    setStep(STEPS.PROCESSING);
    let allItems = [];

    for (let i = 0; i < scannedPages.length; i++) {
      const page    = scannedPages[i];
      const pageNum = i + 1;
      const total   = scannedPages.length;

      setProcessingMsg(`Uploading page ${pageNum}/${total}...`);
      setProcessingPct(Math.round(((i * 3) / (total * 3)) * 100));

      uploadScanToCloudinary(page.uri, pageNum).then(result => {
        if (result.success) {
          setScannedPages(prev =>
            prev.map((p, idx) =>
              idx === i ? { ...p, cloudinaryUrl: result.url } : p
            )
          );
        }
      });

      setProcessingMsg(`📖 Reading page ${pageNum}/${total}...`);
      setProcessingPct(Math.round(((i * 3 + 1) / (total * 3)) * 100));

      const rawText = await runOCR(page.uri);

      setProcessingMsg(`🔍 Extracting items from page ${pageNum}...`);
      setProcessingPct(Math.round(((i * 3 + 2) / (total * 3)) * 100));

      if (rawText) {
        const pageItems = parseMenuText(rawText);
        allItems = [...allItems, ...pageItems];
      }

      await new Promise(r => setTimeout(r, 300));
    }

    setProcessingPct(100);
    setProcessingMsg('✅ Done!');

    const seen   = new Set();
    const unique = allItems.filter(item => {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await new Promise(r => setTimeout(r, 600));

    if (unique.length === 0) {
      showSafeAlert(
        '⚠️ No Items Found',
        'Could not extract menu items.\n\nTips:\n• Ensure good lighting 💡\n• Hold camera steady 📷\n• Make sure text is sharp 🔍',
        [
          {
            text:    '📷 Try Again',
            onPress: () => {
              setStep(STEPS.CAPTURE);
              setScannedPages([]);
            },
          },
          {
            text:    '✏️ Add Manually',
            onPress: () => navigation.navigate('AddMenuItem', { restaurantId }),
          },
        ]
      );
      setStep(STEPS.CAPTURE);
      return;
    }

    setExtractedItems(unique);
    setStep(STEPS.REVIEW);
  }, [scannedPages, restaurantId, navigation]);

  // ── Item Actions ──────────────────────────
  const toggleSelected = useCallback((id) => {
    setExtractedItems(prev =>
      prev.map(i => i.id === id ? { ...i, isSelected: !i.isSelected } : i)
    );
  }, []);

  const deleteItem = useCallback((id) => {
    setExtractedItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const openEdit = useCallback((item) => {
    setEditingItem({ ...item, price: item.price?.toString() });
    setShowEditModal(true);
  }, []);

  const openAddNew = useCallback(() => {
    setEditingItem({
      id:         `manual_${Date.now()}`,
      name:       '',
      price:      '',
      description:'',
      category:   'main_course',
      confidence: 1,
      isEdited:   true,
      isSelected: true,
      isNew:      true,
    });
    setShowEditModal(true);
  }, []);

  const saveItem = useCallback(() => {
    if (!editingItem?.name?.trim()) {
      showSafeAlert('Required', 'Please enter an item name');
      return;
    }
    const price = parseFloat(editingItem.price);
    if (isNaN(price) || price < 0) {
      showSafeAlert('Required', 'Please enter a valid price');
      return;
    }
    const updated = { ...editingItem, price: Math.round(price * 100) / 100, isEdited: true };
    delete updated.isNew;
    const exists = extractedItems.some(i => i.id === updated.id);
    if (exists) {
      setExtractedItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } else {
      setExtractedItems(prev => [...prev, updated]);
    }
    setShowEditModal(false);
    setEditingItem(null);
  }, [editingItem, extractedItems]);

  // ── Add to Menu ───────────────────────────
  const handleAddToMenu = useCallback(async () => {
    const selected = extractedItems.filter(i => i.isSelected);
    if (selected.length === 0) {
      showSafeAlert('Nothing Selected', 'Please select at least one item.');
      return;
    }
    showSafeAlert(
      '✅ Add to Menu',
      `Add ${selected.length} item${selected.length !== 1 ? 's' : ''} to your menu?\n\nYou can add photos later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Menu',
          onPress: async () => {
            setSaving(true);
            try {
              const results = await addScannedMenuItems(
                selected.map(item => ({
                  name:        item.name.trim(),
                  price:       item.price,
                  description: item.description?.trim() || '',
                  category:    item.category || 'main_course',
                  dietaryInfo: {},
                  tags:        [],
                  servingSize: '',
                }))
              );
              const ok   = results.success.length;
              const fail = results.failed.length;
              showSafeAlert(
                '🎉 Menu Updated!',
                `✅ ${ok} item${ok !== 1 ? 's' : ''} added.\n` +
                (fail > 0 ? `⚠️ ${fail} failed — add manually.\n\n` : '\n') +
                'Add photos from Manage Menu.',
                [
                  { text: '📋 View Menu', onPress: () => navigation.navigate('ManageMenu') },
                  {
                    text: '📷 Scan More',
                    onPress: () => {
                      setStep(STEPS.CAPTURE);
                      setScannedPages([]);
                      setExtractedItems([]);
                    },
                  },
                ]
              );
            } catch (err) {
              showSafeAlert('Error', err.message || 'Failed to save items');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [extractedItems, addScannedMenuItems, navigation]);

  // ─────────────────────────────────────────
  // EARLY RENDERS / STRICT MODE BLOCKS
  // ─────────────────────────────────────────

  if (loadingResto) {
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textMuted, marginTop: SIZES.sm }}>
          Loading...
        </Text>
      </View>
    );
  }

  // ✅ STRICT MODE LOCKOUT: Checks if subscription is active, suspended, or expired
  if (!subStatus.isValid) {
    const isSuspended = subStatus.status === 'suspended';
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <View style={[styles.lockedIconBg, isSuspended && { backgroundColor: COLORS.error + '15' }]}>
          <Ionicons 
            name={isSuspended ? "ban-outline" : "calendar-outline"} 
            size={50} 
            color={isSuspended ? COLORS.error : COLORS.primary} 
          />
        </View>
        <Text style={styles.lockedTitle}>
          {isSuspended ? 'Account Suspended' : 'Subscription Expired'}
        </Text>
        <Text style={[styles.lockedDesc, { paddingHorizontal: SIZES.lg }]}>
          {subStatus.message}
        </Text>
        
        {isSuspended ? (
          <TouchableOpacity
            style={[styles.lockedUpgradeBtn, { backgroundColor: DARK }]}
            onPress={() =>
              showSafeAlert(
                '📧 Contact Admin',
                'For support, please email our team at:\nrenogooden@outlook.com',
                [{ text: 'OK' }]
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lockedUpgradeBtnText}>Contact Support</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.lockedUpgradeBtn}
            onPress={() => navigation.navigate('Subscription', { restaurant })}
            activeOpacity={0.8}
          >
            <Ionicons name="diamond-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lockedUpgradeBtnText}>💳 Renew / Upgrade Plan</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Fallback check: Block free trial (allows 0 pages) or basic limit checks
  if (!hasBasic(restaurant)) {
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <View style={styles.lockedIconBg}>
          <Ionicons name="scan-outline" size={50} color={COLORS.primary} />
        </View>
        <Text style={styles.lockedTitle}>Menu Scanner</Text>
        <Text style={styles.lockedDesc}>
          Scan your physical menu pages to automatically extract
          and upload items.
        </Text>
        <View style={styles.planCompare}>
          {[
            { plan: '🆓 Free Trial', scan: '❌ Not available',  color: COLORS.error   },
            { plan: '⭐ Basic',      scan: '✅ Up to 2 pages',  color: COLORS.success },
            { plan: '👑 Premium',   scan: '✅ Up to 20 pages', color: COLORS.success },
          ].map((row, i) => (
            <View
              key={i}
              style={[
                styles.planCompareRow,
                i === 2 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.planComparePlan}>{row.plan}</Text>
              <Text style={[styles.planCompareScan, { color: row.color }]}>
                {row.scan}
              </Text>
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

  if (!permission?.granted) {
    return (
      <View style={[
        styles.lockedContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
        <Ionicons name="camera-outline" size={60} color={COLORS.textMuted} />
        <Text style={styles.lockedTitle}>Camera Access Needed</Text>
        <Text style={styles.lockedDesc}>
          Please allow camera access to scan your menu pages
        </Text>
        <TouchableOpacity
          style={styles.lockedUpgradeBtn}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
          <Text style={styles.lockedUpgradeBtnText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDERS
  // ─────────────────────────────────────────────

  const renderCapture = () => (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={torchOn}
      />

      <View style={[styles.cameraTopBar, { paddingTop: insets.top + SIZES.sm }]}>
        <TouchableOpacity
          style={styles.camIconBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.cameraTopCenter}>
          <Text style={styles.cameraTitle}>📷 Scan Menu</Text>
          <Text style={styles.cameraSubtitle}>
            {scannedPages.length > 0
              ? `${scannedPages.length}/${maxPages} pages captured`
              : 'Point at a menu page'}
          </Text>
        </View>
        <View style={styles.camTopRight}>
          <TouchableOpacity
            style={[
              styles.camIconBtn,
              torchOn && { backgroundColor: '#FFD700' + '60' },
            ]}
            onPress={() => setTorchOn(t => !t)}
          >
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.camIconBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.guideOverlay} pointerEvents="none">
        <View style={styles.guideFrame}>
          {[
            { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3  },
            { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3 },
            { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3  },
            { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
          ].map((pos, i) => (
            <View
              key={i}
              style={[styles.guideCorner, pos, { borderColor: COLORS.primary }]}
            />
          ))}
        </View>
        <Text style={styles.guideText}>
          Align menu page within the frame
        </Text>
      </View>

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
                  style={styles.thumbnailImg}
                  resizeMode="cover"
                />
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>{idx + 1}</Text>
                </View>
                <TouchableOpacity
                  style={styles.thumbnailRemove}
                  onPress={() =>
                    setScannedPages(prev => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.cameraTips}>
        <Text style={styles.cameraTipText}>
          💡 Good lighting · 📐 Keep flat · 🔍 Stay focused
        </Text>
      </View>

      <View style={[
        styles.cameraControls,
        { paddingBottom: insets.bottom + SIZES.md },
      ]}>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={handleCapture}
          activeOpacity={0.8}
        >
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>
        {scannedPages.length > 0 && (
          <TouchableOpacity
            style={styles.processBtn}
            onPress={handleDoneScanning}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.processBtnText}>
              Process {scannedPages.length} page
              {scannedPages.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderProcessing = () => (
    <View style={[
      styles.processingContainer,
      { paddingTop: insets.top, paddingBottom: insets.bottom },
    ]}>
      <View style={styles.processingIconBg}>
        <Ionicons name="scan-outline" size={56} color={COLORS.primary} />
      </View>
      <Text style={styles.processingTitle}>Reading Your Menu...</Text>
      <Text style={styles.processingMsg}>{processingMsg}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${processingPct}%` }]} />
      </View>
      <Text style={styles.progressPct}>{processingPct}%</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.processingPages}
      >
        {scannedPages.map((page, idx) => (
          <View key={idx} style={styles.processingPage}>
            <Image
              source={{ uri: page.uri }}
              style={styles.processingPageImg}
              resizeMode="cover"
            />
            <Text style={styles.processingPageLabel}>Page {idx + 1}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.processingNote}>
        <Ionicons name="phone-portrait-outline" size={16} color={COLORS.primary} />
        <Text style={styles.processingNoteText}>
          Reading text on-device · No internet required
        </Text>
      </View>
      <Text style={styles.processingHint}>Please keep the app open</Text>
    </View>
  );

  const renderReview = () => {
    const selectedCount = extractedItems.filter(i => i.isSelected).length;
    const editedCount   = extractedItems.filter(i => i.isEdited).length;

    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={[styles.reviewHeader, { paddingTop: insets.top + SIZES.sm }]}>
          <TouchableOpacity
            onPress={() => showSafeAlert(
              'Go Back?',
              'Extracted items will be lost.',
              [
                { text: 'Stay', style: 'cancel' },
                {
                  text:    'Go Back',
                  onPress: () => {
                    setStep(STEPS.CAPTURE);
                    setExtractedItems([]);
                  },
                },
              ]
            )}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: SIZES.sm }}>
            <Text style={styles.reviewTitle}>Review Items</Text>
            <Text style={styles.reviewSubtitle}>
              {extractedItems.length} found · {selectedCount} selected
              {editedCount > 0 ? ` · ${editedCount} edited` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.addManualBtn} onPress={openAddNew}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.reviewBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.reviewBannerText}>
            Tap ✏️ to fix errors · Tap + to add missed items
          </Text>
        </View>

        <View style={styles.reviewControls}>
          <TouchableOpacity
            onPress={() =>
              setExtractedItems(p => p.map(i => ({ ...i, isSelected: true })))
            }
          >
            <Text style={styles.reviewCtrlBtn}>Select All</Text>
          </TouchableOpacity>
          <Text style={styles.reviewCtrlDot}>·</Text>
          <TouchableOpacity
            onPress={() =>
              setExtractedItems(p => p.map(i => ({ ...i, isSelected: false })))
            }
          >
            <Text style={[styles.reviewCtrlBtn, { color: COLORS.error }]}>
              Deselect All
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={styles.reviewCtrlCount}>
            {selectedCount}/{extractedItems.length}
          </Text>
        </View>

        <FlatList
          data={extractedItems}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.reviewList,
            { paddingBottom: insets.bottom + 110 },
          ]}
          ListEmptyComponent={
            <View style={styles.reviewEmpty}>
              <Text style={{ fontSize: 40 }}>🍴</Text>
              <Text style={styles.reviewEmptyText}>No items yet</Text>
              <Text style={styles.reviewEmptySubtext}>
                Tap + to add items manually
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              styles.reviewItem,
              !item.isSelected && styles.reviewItemOff,
              item.isEdited   && styles.reviewItemEdited,
            ]}>
              <TouchableOpacity
                style={[styles.checkbox, item.isSelected && styles.checkboxOn]}
                onPress={() => toggleSelected(item.id)}
              >
                {item.isSelected && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={styles.reviewItemTop}>
                  <Text
                    style={[
                      styles.reviewItemName,
                      !item.isSelected && { color: COLORS.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name || 'Unnamed Item'}
                  </Text>
                  {item.isEdited && (
                    <View style={styles.editedTag}>
                      <Text style={styles.editedTagText}>✏️ edited</Text>
                    </View>
                  )}
                </View>
                <View style={styles.reviewItemRow}>
                  <Text style={styles.reviewItemPrice}>
                    ${Number(item.price || 0).toFixed(2)}
                  </Text>
                  <View style={styles.reviewItemCat}>
                    <Text style={styles.reviewItemCatText}>
                      {item.category?.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                {!!item.description && (
                  <Text style={styles.reviewItemDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                {item.confidence < 0.85 && (
                  <Text style={styles.reviewItemWarn}>
                    ⚠️ Please verify this item
                  </Text>
                )}
              </View>
              <View style={styles.reviewActions}>
                <TouchableOpacity
                  style={styles.reviewEditBtn}
                  onPress={() => openEdit(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reviewDeleteBtn}
                  onPress={() => deleteItem(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={[
          styles.reviewFooter,
          { paddingBottom: insets.bottom + SIZES.sm },
        ]}>
          <View>
            <Text style={styles.reviewFooterCount}>
              {selectedCount} item{selectedCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.reviewFooterSub}>ready to add</Text>
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
                <Text style={styles.addToMenuBtnText}>Add to Menu</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent
      onRequestClose={() => {
        setShowEditModal(false);
        setEditingItem(null);
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[
          styles.editModal,
          { paddingBottom: insets.bottom + SIZES.md },
        ]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {editingItem?.isNew ? '➕ Add Item' : '✏️ Edit Item'}
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalLabel}>
              Name <Text style={{ color: COLORS.error }}>*</Text>
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

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={editingItem?.description || ''}
              onChangeText={v => setEditingItem(p => ({ ...p, description: v }))}
              placeholder="Optional..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalCats}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.modalCatBtn,
                    editingItem?.category === cat.id && styles.modalCatBtnActive,
                  ]}
                  onPress={() =>
                    setEditingItem(p => ({ ...p, category: cat.id }))
                  }
                >
                  <Text style={[
                    styles.modalCatText,
                    editingItem?.category === cat.id && styles.modalCatTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtns}>
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
                onPress={saveItem}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

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
  container: { flex: 1 },

  // ── Locked / Permission ───────────────────
  lockedContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SIZES.xl, backgroundColor: COLORS.background, gap: SIZES.md,
  },
  lockedIconBg: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
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
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SIZES.md, width: '100%', gap: SIZES.sm, ...SHADOW,
  },
  planCompareRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: SIZES.xs,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  planComparePlan: { fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  planCompareScan: { fontSize: FONTS.sm, fontWeight: '600' },
  lockedUpgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
  },
  lockedUpgradeBtnText: {
    color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md,
  },
  lockedPayText: { fontSize: FONTS.sm, color: COLORS.textMuted },

  // ── Camera ────────────────────────────────
  cameraTopBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.md, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  camIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  camTopRight:     { flexDirection: 'row', gap: SIZES.sm },
  cameraTopCenter: { alignItems: 'center' },
  cameraTitle:     { fontSize: FONTS.lg, fontWeight: 'bold', color: '#FFFFFF' },
  cameraSubtitle:  {
    fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2,
  },

  // ── Guide Frame ───────────────────────────
  guideOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guideFrame:   { width: '88%', height: '65%', position: 'relative' },
  guideCorner:  { position: 'absolute', width: 28, height: 28, borderRadius: 4 },
  guideText: {
    color: 'rgba(255,255,255,0.85)', fontSize: FONTS.sm, marginTop: SIZES.md,
    textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: SIZES.md, paddingVertical: 6, borderRadius: RADIUS.round,
  },

  // ── Thumbnails ────────────────────────────
  thumbnailStrip:   {
    backgroundColor: 'rgba(0,0,0,0.65)', paddingVertical: SIZES.sm,
  },
  thumbnailContent: {
    paddingHorizontal: SIZES.md, gap: SIZES.sm, alignItems: 'center',
  },
  thumbnail: {
    width: 56, height: 76, borderRadius: RADIUS.md,
    overflow: 'hidden', position: 'relative',
    borderWidth: 2, borderColor: COLORS.primary,
  },
  thumbnailImg:       { width: '100%', height: '100%' },
  thumbnailBadge: {
    position: 'absolute', bottom: 3, left: 3,
    backgroundColor: COLORS.primary, borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  thumbnailBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: 'bold' },
  thumbnailRemove:    { position: 'absolute', top: 2, right: 2 },

  // ── Camera Tips + Controls ────────────────
  cameraTips: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    alignItems: 'center',
  },
  cameraTipText: {
    color: 'rgba(255,255,255,0.8)', fontSize: FONTS.xs, textAlign: 'center',
  },
  cameraControls: {
    alignItems: 'center', paddingTop: SIZES.md,
    paddingHorizontal: SIZES.md,
    backgroundColor: 'rgba(0,0,0,0.75)', gap: SIZES.md,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  captureBtnInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF',
  },
  processBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.success, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
  },
  processBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.md },

  // ── Processing ────────────────────────────
  processingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: SIZES.xl, gap: SIZES.md,
  },
  processingIconBg: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: SIZES.sm,
  },
  processingTitle: {
    fontSize: FONTS.xxl, fontWeight: 'bold',
    color: COLORS.text, textAlign: 'center',
  },
  processingMsg: { fontSize: FONTS.md, color: COLORS.textMuted, textAlign: 'center' },
  progressBg: {
    width: '100%', height: 8, backgroundColor: COLORS.border,
    borderRadius: RADIUS.round, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.round,
  },
  progressPct:     { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.primary },
  processingPages: {
    gap: SIZES.sm, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
  },
  processingPage:    { alignItems: 'center', gap: 4 },
  processingPageImg: {
    width: 56, height: 76, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  processingPageLabel: { fontSize: FONTS.xs, color: COLORS.textMuted },
  processingNote: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.xs,
    backgroundColor: COLORS.primary + '10', paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm, borderRadius: RADIUS.round,
  },
  processingNoteText: {
    fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '600',
  },
  processingHint: {
    fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center',
  },

  // ── Review Header ─────────────────────────
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.md, borderBottomWidth: 1,
    borderBottomColor: COLORS.border, ...SHADOW,
  },
  reviewTitle:    { fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.text },
  reviewSubtitle: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  addManualBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.primary + '30',
  },
  reviewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary + '08', paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm, borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  reviewBannerText: {
    flex: 1, fontSize: FONTS.xs, color: COLORS.primary, lineHeight: 18,
  },
  reviewControls: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewCtrlBtn:   { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  reviewCtrlDot:   { color: COLORS.textMuted },
  reviewCtrlCount: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  reviewList:      { padding: SIZES.md, gap: SIZES.sm },
  reviewEmpty:     { alignItems: 'center', padding: SIZES.xl, gap: SIZES.sm },
  reviewEmptyText:    { fontSize: FONTS.lg, fontWeight: 'bold', color: COLORS.text },
  reviewEmptySubtext: { fontSize: FONTS.md, color: COLORS.textMuted },

  // ── Review Items ──────────────────────────
  reviewItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SIZES.md, gap: SIZES.sm,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW,
  },
  reviewItemOff:    { opacity: 0.45 },
  reviewItemEdited: {
    borderColor:     COLORS.primary + '50',
    backgroundColor: COLORS.primary + '04',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reviewItemTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: SIZES.xs, flexWrap: 'wrap',
  },
  reviewItemName: {
    fontSize: FONTS.md, fontWeight: '700', color: COLORS.text, flex: 1,
  },
  editedTag: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.round,
  },
  editedTagText:    { fontSize: 9, color: COLORS.primary, fontWeight: '700' },
  reviewItemRow:    {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: 4,
  },
  reviewItemPrice:  { fontSize: FONTS.md, fontWeight: 'bold', color: COLORS.primary },
  reviewItemCat: {
    backgroundColor: COLORS.border, paddingHorizontal: SIZES.sm,
    paddingVertical: 2, borderRadius: RADIUS.round,
  },
  reviewItemCatText: {
    fontSize: FONTS.xs, color: COLORS.textMuted, textTransform: 'capitalize',
  },
  reviewItemDesc:    { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 4 },
  reviewItemWarn:    {
    fontSize: FONTS.xs, color: '#F39C12', marginTop: 4, fontWeight: '600',
  },
  reviewActions: { gap: SIZES.sm },
  reviewEditBtn: {
    padding: SIZES.sm, backgroundColor: COLORS.primary + '15',
    borderRadius: RADIUS.md,
  },
  reviewDeleteBtn: {
    padding: SIZES.sm, backgroundColor: COLORS.error + '15',
    borderRadius: RADIUS.md,
  },

  // ── Review Footer ─────────────────────────
  reviewFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface, paddingHorizontal: SIZES.md,
    paddingTop: SIZES.md, borderTopWidth: 1,
    borderTopColor: COLORS.border, ...SHADOW,
  },
  reviewFooterCount: {
    fontSize: FONTS.xl, fontWeight: 'bold', color: COLORS.primary,
  },
  reviewFooterSub: { fontSize: FONTS.xs, color: COLORS.textMuted },
  addToMenuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
  },
  addToMenuBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.lg },

  // ── Edit Modal ────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: SIZES.lg, maxHeight: '88%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: SIZES.md,
  },
  modalTitle: {
    fontSize: FONTS.xl, fontWeight: 'bold',
    color: COLORS.text, marginBottom: SIZES.md,
  },
  modalLabel: {
    fontSize: FONTS.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SIZES.xs, marginTop: SIZES.sm,
  },
  modalInput: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.md,
    fontSize: FONTS.md, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalTextarea: { height: 80, textAlignVertical: 'top' },
  modalCats:     { gap: SIZES.sm, paddingVertical: SIZES.sm },
  modalCatBtn: {
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: RADIUS.round, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalCatBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalCatText:       { fontSize: FONTS.sm, color: COLORS.textMuted },
  modalCatTextActive: { color: '#FFFFFF', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.lg },
  modalCancelBtn: {
    flex: 1, paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
    alignItems: 'center', backgroundColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: FONTS.md, color: COLORS.textMuted, fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: SIZES.sm,
    paddingVertical: SIZES.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  modalSaveText: { color: '#FFFFFF', fontSize: FONTS.md, fontWeight: 'bold' },
});