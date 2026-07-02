// ============================================
// FILE: src/screens/admin/ImageDownloadScreen.js
// ============================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, storage }        from '../../firebase/config';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
  loadImageCache,
  IMAGE_POOLS,
  NAME_KEYWORDS,
} from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

// ✅ Count unique photos across all pools
const getAllUniquePhotoIds = () => {
  const ids = new Set();
  Object.values(IMAGE_POOLS).forEach(pool =>
    pool.forEach(id => ids.add(id))
  );
  return Array.from(ids);
};

const ALL_PHOTO_IDS    = getAllUniquePhotoIds();
const TOTAL_PHOTOS     = ALL_PHOTO_IDS.length;
const POOL_COUNT       = Object.keys(IMAGE_POOLS).length;

export default function ImageDownloadScreen() {
  const insets = useSafeAreaInsets();

  const [downloading, setDownloading]   = useState(false);
  const [progress, setProgress]         = useState(0);
  const [currentPhoto, setCurrentPhoto] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [results, setResults]           = useState(null);
  const [storedCount, setStoredCount]   = useState(0);
  const [log, setLog]                   = useState([]);
  const [savingPools, setSavingPools]   = useState(false);

  // ✅ Ref to allow cancelling download
  const cancelRef = useRef(false);

  useEffect(() => {
    checkExisting();
  }, []);

  // ✅ Check how many images already stored
  const checkExisting = async () => {
    try {
      const snap = await getDocs(
        collection(db, 'foodImageFiles')
      );
      setStoredCount(snap.size);
    } catch (err) {
      console.error('checkExisting error:', err);
    }
  };

  const addLog = (msg, type = 'info') => {
    setLog(prev => [
      {
        msg,
        type,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 99),
    ]);
  };

  // ✅ Download a single image with retry
  const downloadSingleImage = async (photoId) => {
    const unsplashUrl =
      `https://images.unsplash.com/${photoId}` +
      `?w=400&h=300&fit=crop&q=80`;

    let blob      = null;
    let lastError = null;

    // ✅ Try up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(unsplashUrl, {
          headers: {
            'Accept': 'image/webp,image/jpeg,image/*',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        blob = await response.blob();

        if (!blob || blob.size === 0) {
          throw new Error('Empty blob');
        }

        return { success: true, blob };

      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          // Wait before retry — exponential backoff
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    return {
      success: false,
      error:   lastError?.message || 'Download failed',
    };
  };

  // ✅ Save pool structure to Firestore
  const savePoolsToFirestore = async () => {
    setSavingPools(true);
    addLog('💾 Saving pool structure...', 'info');

    try {
      // Get all stored URLs
      const snap      = await getDocs(collection(db, 'foodImageFiles'));
      const storedUrls = {};
      snap.docs.forEach(d => {
        if (d.data()?.url) storedUrls[d.id] = d.data().url;
      });

      addLog(
        `📊 Found ${Object.keys(storedUrls).length} stored images`,
        'info'
      );

      // Save each pool
      let saved = 0;
      for (const [poolName, photoIds] of Object.entries(IMAGE_POOLS)) {
        const urls = photoIds
          .map(id => storedUrls[id])
          .filter(Boolean);

        if (urls.length > 0) {
          await setDoc(
            doc(db, 'foodImages', poolName),
            {
              poolName,
              urls,
              count:     urls.length,
              updatedAt: new Date().toISOString(),
            }
          );
          saved++;
        }
      }

      addLog(`✅ Saved ${saved} pools to Firestore`, 'success');

      // Reload cache
      await loadImageCache();
      addLog('✅ Image cache reloaded', 'success');

      await checkExisting();

      Alert.alert(
        '✅ Pools Saved!',
        `Saved ${saved} image pools to Firestore.\n` +
        `App will now use Firebase Storage images.`
      );

    } catch (err) {
      console.error('savePoolsToFirestore error:', err);
      addLog(`❌ Save failed: ${err.message}`, 'failed');
      Alert.alert('Error', err.message);
    }

    setSavingPools(false);
  };

  // ✅ Main download function
  const handleDownload = () => {
    const remaining = TOTAL_PHOTOS - storedCount;

    Alert.alert(
      '📥 Download Food Images',
      storedCount > 0
        ? `${storedCount} already stored.\n` +
          `${remaining} remaining to download.\n\n` +
          `Continue downloading?`
        : `Download ${TOTAL_PHOTOS} food photos from Unsplash ` +
          `to Firebase Storage.\n\nThis only needs to be done ONCE.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: storedCount > 0 ? 'Continue' : 'Download',
          onPress: startDownload,
        },
      ]
    );
  };

  const startDownload = async () => {
    cancelRef.current = false;
    setDownloading(true);
    setProgress(0);
    setResults(null);
    setLog([]);

    const stats = {
      success: 0,
      skipped: 0,
      failed:  0,
      errors:  [],
    };

    addLog(
      `📥 Starting download of ${TOTAL_PHOTOS} images...`,
      'info'
    );

    let processed = 0;

    // ✅ Process in batches of 5
    const BATCH_SIZE = 5;

    for (
      let i = 0;
      i < ALL_PHOTO_IDS.length;
      i += BATCH_SIZE
    ) {
      // ✅ Check if cancelled
      if (cancelRef.current) {
        addLog('⛔ Download cancelled by user', 'info');
        break;
      }

      const batch = ALL_PHOTO_IDS.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (photoId) => {
          if (cancelRef.current) return;

          try {
            // ✅ Check if already downloaded
            const existing = await getDoc(
              doc(db, 'foodImageFiles', photoId)
            );

            if (existing.exists() && existing.data()?.url) {
              stats.skipped++;
              processed++;
              setProgress(processed);
              setCurrentPhoto(photoId);
              setCurrentStatus('skipped');
              return;
            }

            // ✅ Download from Unsplash
            setCurrentPhoto(photoId.substring(6, 26) + '...');
            setCurrentStatus('downloading');

            const downloadResult =
              await downloadSingleImage(photoId);

            if (!downloadResult.success) {
              throw new Error(downloadResult.error);
            }

            // ✅ Upload to Firebase Storage
            setCurrentStatus('uploading');
            const storagePath = `foodImages/${photoId}.jpg`;
            const storageRef  = ref(storage, storagePath);
            await uploadBytes(storageRef, downloadResult.blob);
            const firebaseUrl =
              await getDownloadURL(storageRef);

            // ✅ Save URL to Firestore
            await setDoc(
              doc(db, 'foodImageFiles', photoId),
              {
                photoId,
                url:         firebaseUrl,
                storagePath,
                createdAt:   new Date().toISOString(),
              }
            );

            stats.success++;
            processed++;
            setProgress(processed);
            setCurrentStatus('success');
            addLog(
              `✅ ${processed}/${TOTAL_PHOTOS} ${
                photoId.substring(6, 20)
              }`,
              'success'
            );

          } catch (err) {
            stats.failed++;
            stats.errors.push({
              photoId,
              error: err.message,
            });
            processed++;
            setProgress(processed);
            setCurrentStatus('failed');
            addLog(
              `❌ ${photoId.substring(6, 20)}: ${err.message}`,
              'failed'
            );
          }
        })
      );

      // ✅ Small delay between batches
      if (
        i + BATCH_SIZE < ALL_PHOTO_IDS.length &&
        !cancelRef.current
      ) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setResults(stats);
    setDownloading(false);
    setCurrentPhoto('');
    setCurrentStatus('');

    await checkExisting();

    // ✅ Auto-save pools after download
    addLog('💾 Auto-saving pool structure...', 'info');
    await savePoolsToFirestore();

    const msg = cancelRef.current
      ? `Download stopped.\n✅ ${stats.success} saved`
      : `✅ Downloaded: ${stats.success}\n` +
        `⏭️ Skipped: ${stats.skipped}\n` +
        `❌ Failed: ${stats.failed}`;

    Alert.alert(
      cancelRef.current ? '⛔ Stopped' : '✅ Complete!',
      msg
    );
  };

  const pct = TOTAL_PHOTOS > 0
    ? Math.round((progress / TOTAL_PHOTOS) * 100)
    : 0;

  const remaining = TOTAL_PHOTOS - storedCount;
  const isComplete = storedCount >= TOTAL_PHOTOS;

  return (
    <View style={[
      styles.container,
      { paddingBottom: insets.bottom },
    ]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            🖼️ Food Image Manager
          </Text>
          <Text style={styles.headerSubtitle}>
            Download once — serve from Firebase forever
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{TOTAL_PHOTOS}</Text>
            <Text style={styles.statLabel}>Total Photos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[
              styles.statValue,
              {
                color: isComplete
                  ? COLORS.success
                  : storedCount > 0
                  ? COLORS.warning
                  : COLORS.error,
              },
            ]}>
              {storedCount}
            </Text>
            <Text style={styles.statLabel}>In Firebase</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[
              styles.statValue,
              { color: remaining === 0 ? COLORS.success : COLORS.primary },
            ]}>
              {remaining}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{POOL_COUNT}</Text>
            <Text style={styles.statLabel}>Pools</Text>
          </View>
        </View>

        {/* Status banner */}
        {isComplete ? (
          <View style={[styles.banner, styles.bannerSuccess]}>
            <Text style={styles.bannerText}>
              ✅ All {TOTAL_PHOTOS} images stored in Firebase!
              App loads images fast from your own storage.
            </Text>
          </View>
        ) : storedCount > 0 ? (
          <View style={[styles.banner, styles.bannerWarning]}>
            <Text style={styles.bannerText}>
              ⚠️ {remaining} images still need downloading.
              Tap Continue to resume from where you left off.
            </Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.bannerInfo]}>
            <Text style={styles.bannerText}>
              📥 No images stored yet. Download them to make
              the app show correct food photos reliably.
            </Text>
          </View>
        )}

        {/* Progress */}
        {downloading && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                {pct}% Complete
              </Text>
              <Text style={styles.progressCount}>
                {progress}/{TOTAL_PHOTOS}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                { width: `${pct}%` },
              ]} />
            </View>
            <Text style={styles.progressCurrent} numberOfLines={1}>
              {currentStatus === 'downloading' ? '📥' :
               currentStatus === 'uploading'   ? '☁️' :
               currentStatus === 'success'     ? '✅' :
               currentStatus === 'skipped'     ? '⏭️' :
               currentStatus === 'failed'      ? '❌' : '🔄'}
              {' '}{currentPhoto}
            </Text>
          </View>
        )}

        {/* Results */}
        {results && !downloading && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>
              📊 Results
            </Text>
            <View style={styles.resultsGrid}>
              <View style={styles.resultItem}>
                <Text style={[
                  styles.resultValue,
                  { color: COLORS.success },
                ]}>
                  {results.success}
                </Text>
                <Text style={styles.resultLabel}>Downloaded</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[
                  styles.resultValue,
                  { color: COLORS.textMuted },
                ]}>
                  {results.skipped}
                </Text>
                <Text style={styles.resultLabel}>Skipped</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[
                  styles.resultValue,
                  { color: results.failed > 0 ? COLORS.error : COLORS.textMuted },
                ]}>
                  {results.failed}
                </Text>
                <Text style={styles.resultLabel}>Failed</Text>
              </View>
            </View>
            {results.failed > 0 && (
              <Text style={styles.retryNote}>
                ⚠️ {results.failed} failed. Tap Download again
                to retry — already downloaded ones are skipped.
              </Text>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>

          {/* Download / Stop button */}
          {downloading ? (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => { cancelRef.current = true; }}
              activeOpacity={0.8}
            >
              <Ionicons name="stop-circle" size={22} color="#FFFFFF" />
              <Text style={styles.stopBtnText}>
                Stop Download
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                isComplete && styles.downloadBtnComplete,
              ]}
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Text style={styles.downloadBtnIcon}>
                {isComplete ? '🔄' : '📥'}
              </Text>
              <Text style={styles.downloadBtnText}>
                {isComplete
                  ? 'Re-download All Images'
                  : storedCount > 0
                  ? `Continue Download (${remaining} left)`
                  : 'Download All Images Now'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Save pools button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              savingPools && { opacity: 0.6 },
            ]}
            onPress={savePoolsToFirestore}
            disabled={savingPools || downloading}
            activeOpacity={0.8}
          >
            {savingPools ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>
                💾 Save Pool Structure to Firestore
              </Text>
            )}
          </TouchableOpacity>

          {/* Reload cache */}
          <TouchableOpacity
            style={styles.cacheBtn}
            onPress={async () => {
              const cache = await loadImageCache();
              if (cache) {
                Alert.alert(
                  '✅ Cache Reloaded',
                  `Loaded ${Object.keys(cache).length} pools`
                );
              } else {
                Alert.alert(
                  '⚠️ No Cache Found',
                  'Download images first, then save pool structure.'
                );
              }
            }}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <Text style={styles.cacheBtnText}>
              🔄 Reload App Image Cache
            </Text>
          </TouchableOpacity>

          {/* Refresh stats */}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={checkExisting}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshBtnText}>
              📊 Refresh Stats
            </Text>
          </TouchableOpacity>

        </View>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ How It Works</Text>
          {[
            '1. Tap "Download All Images Now"',
            '2. Each photo downloads from Unsplash',
            '3. Stored in your Firebase Storage',
            '4. Firebase URLs saved to Firestore',
            '5. App loads images from Firebase — fast!',
            '6. If download stops — just tap Continue',
            '7. Already downloaded images are skipped',
          ].map((step, i) => (
            <Text key={i} style={styles.infoStep}>{step}</Text>
          ))}
        </View>

        {/* Log */}
        {log.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>
              📋 Log (latest first)
            </Text>
            {log.slice(0, 30).map((entry, i) => (
              <Text
                key={i}
                style={[
                  styles.logEntry,
                  entry.type === 'success' && { color: COLORS.success  },
                  entry.type === 'failed'  && { color: COLORS.error    },
                  entry.type === 'skipped' && { color: COLORS.textMuted },
                ]}
                numberOfLines={1}
              >
                {entry.time} {entry.msg}
              </Text>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// Need Ionicons for stop button
import { Ionicons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.secondary,
    padding: SIZES.lg,
    paddingTop: SIZES.xl,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FONTS.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Stats ────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.sm,
    alignItems: 'center',
    ...SHADOW,
  },
  statValue: {
    fontSize: FONTS.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Banners ──────────────────────────────
  banner: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
  },
  bannerSuccess: {
    backgroundColor: COLORS.success + '20',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  bannerWarning: {
    backgroundColor: COLORS.warning + '20',
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  bannerInfo: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  bannerText: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  // ── Progress ─────────────────────────────
  progressSection: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    ...SHADOW,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  progressTitle: {
    fontSize: FONTS.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  progressCount: {
    fontSize: FONTS.sm,
    color: COLORS.textMuted,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: SIZES.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressCurrent: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // ── Results ──────────────────────────────
  resultsCard: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    ...SHADOW,
  },
  resultsTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  resultsGrid: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SIZES.sm,
  },
  resultValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
  },
  resultLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  retryNote: {
    fontSize: FONTS.xs,
    color: COLORS.warning,
    marginTop: SIZES.sm,
    lineHeight: 18,
  },

  // ── Actions ──────────────────────────────
  actions: {
    padding: SIZES.md,
    gap: SIZES.md,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SIZES.lg,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  downloadBtnComplete: {
    backgroundColor: COLORS.secondary,
  },
  downloadBtnIcon: { fontSize: 22 },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    padding: SIZES.lg,
    borderRadius: RADIUS.lg,
    gap: SIZES.sm,
    ...SHADOW,
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: COLORS.success,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    ...SHADOW,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.md,
    fontWeight: '600',
  },
  cacheBtn: {
    backgroundColor: COLORS.secondary,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  cacheBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.md,
    fontWeight: '600',
  },
  refreshBtn: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshBtnText: {
    color: COLORS.text,
    fontSize: FONTS.md,
    fontWeight: '600',
  },

  // ── Info card ────────────────────────────
  infoCard: {
    margin: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    gap: SIZES.xs,
    ...SHADOW,
  },
  infoTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  infoStep: {
    fontSize: FONTS.sm,
    color: COLORS.textLight,
    lineHeight: 22,
  },

  // ── Log ──────────────────────────────────
  logCard: {
    margin: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    ...SHADOW,
  },
  logTitle: {
    fontSize: FONTS.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  logEntry: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});