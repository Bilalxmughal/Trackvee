import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TablerIcon } from '../src/components/TablerIcon';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';
import {
  downloadRegion, getCacheSize, clearCache,
  type DownloadProgress,
} from '../src/lib/offlineMapCache';

// Pakistan bounding boxes for common cities
const PRESETS = [
  { label: 'Lahore', bounds: { north: 31.65, south: 31.40, east: 74.45, west: 74.20 } },
  { label: 'Karachi', bounds: { north: 24.98, south: 24.75, east: 67.20, west: 66.90 } },
  { label: 'Islamabad', bounds: { north: 33.80, south: 33.60, east: 73.20, west: 72.95 } },
  { label: 'Faisalabad', bounds: { north: 31.50, south: 31.35, east: 73.15, west: 72.95 } },
  { label: 'Rawalpindi', bounds: { north: 33.70, south: 33.52, east: 73.12, west: 72.90 } },
  { label: 'Multan', bounds: { north: 30.25, south: 30.12, east: 71.55, west: 71.40 } },
  { label: 'Gujranwala', bounds: { north: 32.23, south: 32.10, east: 74.25, west: 74.10 } },
  { label: 'Peshawar', bounds: { north: 34.06, south: 33.95, east: 71.65, west: 71.45 } },
];

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function OfflineMapScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [cacheInfo, setCacheInfo] = useState<{ count: number; bytes: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const loadCacheInfo = useCallback(async () => {
    const info = await getCacheSize();
    setCacheInfo(info);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCacheInfo();
  }, [loadCacheInfo]));

  const startDownload = async (preset: (typeof PRESETS)[0]) => {
    setActivePreset(preset.label);
    setDownloading(true);
    setProgress({ downloaded: 0, total: 0, failed: 0 });
    cancelRef.current = { cancelled: false };
    try {
      const result = await downloadRegion(
        preset.bounds,
        12, 16,
        p => setProgress(p),
        cancelRef.current,
      );
      setProgress(result);
      await loadCacheInfo();
      Alert.alert(
        'Download Complete',
        `${result.downloaded} tiles cached for ${preset.label}.${result.failed > 0 ? ` ${result.failed} tiles failed.` : ''}`,
      );
    } catch {
      Alert.alert('Error', 'Download failed. Check your internet connection.');
    } finally {
      setDownloading(false);
      setActivePreset(null);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Offline Cache',
      'This will delete all downloaded map tiles. You will need to re-download them to use offline maps.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          await clearCache();
          await loadCacheInfo();
          Alert.alert('Cleared', 'Offline map cache has been cleared.');
        }},
      ],
    );
  };

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/more'); };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <TablerIcon name="arrow-left" size={19} color={t.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Offline Maps</Text>
          <Text style={styles.headerSubtitle}>Download map tiles for use without internet</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cache Status */}
        <View style={[styles.card, { borderColor: t.border }]}>
          <View style={styles.cardHeader}>
            <TablerIcon name="database" size={16} color={t.secondary} />
            <Text style={[styles.cardTitle, { color: t.ink }]}>Cache Status</Text>
          </View>
          {cacheInfo ? (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: t.ink }]}>{cacheInfo.count.toLocaleString()}</Text>
                <Text style={[styles.statLabel, { color: t.secondary }]}>Tiles Cached</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: t.ink }]}>{fmtBytes(cacheInfo.bytes)}</Text>
                <Text style={[styles.statLabel, { color: t.secondary }]}>Storage Used</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator color={t.red} style={{ margin: 16 }} />
          )}
          {cacheInfo && cacheInfo.count > 0 && (
            <Pressable onPress={handleClear} style={[styles.clearBtn, { borderColor: t.red }]} accessibilityRole="button">
              <TablerIcon name="trash" size={14} color={t.red} />
              <Text style={[styles.clearBtnText, { color: t.red }]}>Clear Cache</Text>
            </Pressable>
          )}
        </View>

        {/* Download Progress */}
        {downloading && progress && (
          <View style={[styles.card, { borderColor: t.red }]}>
            <View style={styles.cardHeader}>
              <ActivityIndicator size="small" color={t.red} />
              <Text style={[styles.cardTitle, { color: t.ink }]}>Downloading {activePreset}…</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={[styles.progressBar, { backgroundColor: t.border }]}>
                <View style={[styles.progressFill, {
                  width: progress.total > 0 ? `${Math.round((progress.downloaded / progress.total) * 100)}%` as any : '0%',
                  backgroundColor: t.red,
                }]} />
              </View>
              <Text style={[styles.progressText, { color: t.secondary }]}>
                {progress.downloaded} / {progress.total > 0 ? progress.total : '…'} tiles
                {progress.failed > 0 ? ` (${progress.failed} failed)` : ''}
              </Text>
              <Pressable onPress={() => { cancelRef.current.cancelled = true; }} style={styles.cancelBtn} accessibilityRole="button">
                <Text style={[styles.cancelBtnText, { color: t.secondary }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Benefit Info */}
        <View style={[styles.benefitCard, { backgroundColor: `${t.red}0d` }]}>
          <View style={[styles.benefitIconWrap, { backgroundColor: `${t.red}18` }]}>
            <TablerIcon name="map-pin" size={18} color={t.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.benefitTitle, { color: t.ink }]}>Works without internet</Text>
            <Text style={[styles.benefitText, { color: t.secondary }]}>Vehicle GPS still updates live — only the map background needs a connection. Pre-load your city to track vehicles in remote areas, industrial zones, or wherever mobile data is unreliable.</Text>
          </View>
        </View>

        {/* City Presets */}
        <Text style={[styles.sectionLabel, { color: t.secondary }]}>DOWNLOAD AREA</Text>
        <Text style={[styles.sectionNote, { color: t.muted }]}>
          Downloads OSM tiles at zoom levels 12–16 (up to ~2000 tiles, 5–15 MB per city).
        </Text>

        <View style={[styles.presetsCard, { backgroundColor: t.card }]}>
          {PRESETS.map((preset, index) => (
            <View key={preset.label}>
              {index > 0 && <View style={[styles.presetDivider, { backgroundColor: t.border }]} />}
              <View style={styles.presetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.presetName, { color: t.ink }]}>{preset.label}</Text>
                  <Text style={[styles.presetBounds, { color: t.muted }]}>
                    {preset.bounds.south.toFixed(2)}–{preset.bounds.north.toFixed(2)}°N, {preset.bounds.west.toFixed(2)}–{preset.bounds.east.toFixed(2)}°E
                  </Text>
                </View>
                <Pressable
                  onPress={() => { void startDownload(preset); }}
                  disabled={downloading}
                  style={[styles.dlBtn, { backgroundColor: t.red, opacity: downloading ? 0.5 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Download ${preset.label}`}
                >
                  {activePreset === preset.label ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <TablerIcon name="download" size={13} color="#fff" />
                      <Text style={styles.dlBtnText}>Download</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.note, { color: t.muted }]}>
          Map data from OpenStreetMap. Tiles are used automatically when offline and cleared on app updates.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, gap: 12 },
    back: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2 },
    headerCopy: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
    headerSubtitle: { fontSize: 11, color: t.secondary, marginTop: 1 },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 32 },
    card: { borderRadius: 16, backgroundColor: t.card, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
    cardTitle: { fontSize: 14, fontWeight: '700' },
    statsRow: { flexDirection: 'row', padding: 16, gap: 20 },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
    clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 14, marginBottom: 14, padding: 10, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
    clearBtnText: { fontSize: 13, fontWeight: '600' },
    progressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
    cancelBtn: { alignItems: 'center', paddingVertical: 6 },
    cancelBtnText: { fontSize: 13 },
    benefitCard: { borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    benefitIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    benefitTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
    benefitText: { fontSize: 12, lineHeight: 18 },
    sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginTop: 4, marginBottom: 2 },
    sectionNote: { fontSize: 11, marginBottom: 4 },
    presetsCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    presetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
    presetDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
    presetName: { fontSize: 14, fontWeight: '600' },
    presetBounds: { fontSize: 10, marginTop: 2 },
    dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
    dlBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    note: { fontSize: 10.5, textAlign: 'center', marginTop: 4 },
  });
}
