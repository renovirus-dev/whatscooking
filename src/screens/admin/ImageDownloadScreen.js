// ============================================
// FILE: src/screens/admin/ImageDownloadScreen.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ProgressBarAndroid,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  downloadAndStoreAllImages,
  loadImageCache,
  IMAGE_POOLS,
} from '../../utils/imageUpload';
import { COLORS, SIZES, FONTS, RADIUS, SHADOW } from '../../theme';

export default function ImageDownloadScreen() {
  const insets = useSafeAreaInsets();

  const [downloading, setDownloading]   = useState(false);
  const [progress, setProgress]         = useState(0);
  const [total, setTotal]               = useState(0);
  const [current, setCurrent]           = useState('');
  const [status, setStatus]             = useState('idle');
  const [results, setResults]           = useState(null);
  const [storedCount, setStoredCount]   = useState(0);
  const [poolCount, setPoolCount]       = useState(0);
  const [log, setLog]                   = useState([]);

  // Count unique photos
  const totalUniquePhotos = (() => {
    const ids = new Set();
    Object.values(IMAGE_POOLS).forEach(pool =>
      pool.forEach(id => ids.add(id))
    );
    return ids.size;
  })();

  useEffect(() => {
    checkExisting();
  }, []);

  const checkExisting = async () => {
    try {
      const filesSnap = await getDocs(
        collection(db, 'foodImageFiles')
      );
      const poolsSnap = await getDocs(
        collection(db, 'foodImages')
      );
      setStoredCount(filesSnap.size);
      setPoolCount(poolsSnap.size);
    } catch (err) {
      console.error(err);
    }
  };

  const addLog = (msg, type = 'info') => {
    setLog(prev => [
      { msg, type, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 49),
    ]);
  };

  const handleDownload = async () => {
    Alert.alert(
      '📥 Download All Images',
      `This will download ${totalUniquePhotos} food photos from Unsplash and store them permanently in your Firebase Storage.\n\nThis only needs to be done ONCE.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download Now',
          onPress: async () => {
            setDownloading(true);
            setStatus('downloading');
            setProgress(0);
            setLog([]);
            setResults(null);

            const result = await downloadAndStoreAllImages(
              (processed, tot, photoId, statusType) => {
                setProgress(processed);
                setTotal(tot);
                setCurrent(photoId);
                addLog(
                  `${statusType === 'success'  ? '✅' :
                     statusType === 'skipped'  ? '⏭️' :
                     statusType === 'failed'   ? '❌' : '📥'
                  } ${photoId.substring(6, 20)}...`,
                  statusType
                );
              }
            );

            setResults(result);
            setStatus('done');
            setDownloading(false);
            await checkExisting();

            // Reload cache
            await loadImageCache();

            Alert.alert(
              '✅ Download Complete!',
              `Downloaded: ${result.success}\nSkipped: ${result.skipped}\nFailed: ${result.failed}\n\nAll food images are now stored in your Firebase Storage and will load fast!`
            );
          },
        },
      ]
    );
  };

  const handleReloadCache = async () => {
    try {
      const cache = await loadImageCache();
      if (cache) {
        Alert.alert(
          '✅ Cache Reloaded',
          `Loaded ${Object.keys(cache).length} image pools from Firestore`
        );
      } else {
        Alert.alert(
          '⚠️ No Cache',
          'No images found in Firestore. Please download first.'
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const pct = total > 0
    ? Math.round((progress / total) * 100)
    : 0;

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
            Download once — use forever
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalUniquePhotos}
            </Text>
            <Text style={styles.statLabel}>Total Photos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[
              styles.statValue,
              { color: storedCount >= totalUniquePhotos
                  ? COLORS.success
                  : COLORS.warning },
            ]}>
              {storedCount}
            </Text>
            <Text style={styles.statLabel}>In Firebase</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{poolCount}</Text>
            <Text style={styles.statLabel}>Pools Saved</Text>
          </View>
        </View>

        {/* Status banner */}
        {storedCount >= totalUniquePhotos ? (
          <View style={[styles.banner, styles.bannerSuccess]}>
            <Text style={styles.bannerText}>
              ✅ All images stored in Firebase!
              App will use fast Firebase URLs.
            </Text>
          </View>
        ) : storedCount > 0 ? (
          <View style={[styles.banner, styles.bannerWarning]}>
            <Text style={styles.bannerText}>
              ⚠️ {totalUniquePhotos - storedCount} images still
              need to be downloaded.
            </Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.bannerInfo]}>
            <Text style={styles.bannerText}>
              📥 No images stored yet.
              Download them to make the app work offline
              and load images faster.
            </Text>
          </View>
        )}

        {/* Progress */}
        {downloading && (
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>
              Downloading... {pct}% ({progress}/{total})
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                { width: `${pct}%` },
              ]} />
            </View>
            <Text style={styles.progressCurrent}
              numberOfLines={1}
            >
              {current}
            </Text>
          </View>
        )}

        {/* Results */}
        {results && !downloading && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>
              📊 Download Results
            </Text>
            <View style={styles.resultsRow}>
              <Text style={[styles.resultItem, { color: COLORS.success }]}>
                ✅ Success: {results.success}
              </Text>
              <Text style={[styles.resultItem, { color: COLORS.textMuted }]}>
                ⏭️ Skipped: {results.skipped}
              </Text>
              <Text style={[styles.resultItem, { color: COLORS.error }]}>
                ❌ Failed: {results.failed}
              </Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Download button */}
          <TouchableOpacity
            style={[
              styles.downloadBtn,
              downloading && styles.downloadBtnDisabled,
            ]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>
                  Downloading... {pct}%
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.downloadBtnIcon}>📥</Text>
                <Text style={styles.downloadBtnText}>
                  {storedCount > 0
                    ? 'Download Missing Images'
                    : 'Download All Images Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Reload cache button */}
          <TouchableOpacity
            style={styles.cacheBtn}
            onPress={handleReloadCache}
            activeOpacity={0.8}
          >
            <Text style={styles.cacheBtnText}>
              🔄 Reload Image Cache
            </Text>
          </TouchableOpacity>

          {/* Refresh stats */}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={checkExisting}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshBtnText}>
              📊 Check Stats
            </Text>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            ℹ️ How It Works
          </Text>
          {[
            '1. Tap "Download All Images"',
            '2. App downloads all food photos from Unsplash',
            '3. Photos are stored in your Firebase Storage',
            '4. Firestore stores the Firebase URLs by category',
            '5. App pulls images from Firebase — fast & reliable',
            '6. Only needs to be done ONCE',
          ].map((step, i) => (
            <Text key={i} style={styles.infoStep}>{step}</Text>
          ))}
        </View>

        {/* Log */}
        {log.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>📋 Download Log</Text>
            {log.slice(0, 20).map((entry, i) => (
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
    fontSize: FONTS.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    padding: SIZES.md,
    gap: SIZES.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    alignItems: 'center',
    ...SHADOW,
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.xs,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
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
  progressSection: {
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SIZES.md,
    ...SHADOW,
  },
  progressTitle: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.sm,
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
  },
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
    marginBottom: SIZES.sm,
  },
  resultsRow: { gap: SIZES.xs },
  resultItem: {
    fontSize: FONTS.md,
    fontWeight: '600',
  },
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
  downloadBtnDisabled: { opacity: 0.7 },
  downloadBtnIcon:     { fontSize: 22 },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.lg,
    fontWeight: 'bold',
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
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});