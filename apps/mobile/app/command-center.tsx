import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

interface VehicleCmd {
  id: string;
  displayId: number;
  licensePlate: string | null;
  name: string | null;
  imei: string | null;
  lastImmobilizer: boolean | null;
  lastSeen: string | null;
}

export default function CommandCenterScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { canDo, loading: permsLoading } = usePortalPermissions();
  const canUse = !permsLoading && canDo('engine_cut');
  const [vehicles, setVehicles] = useState<VehicleCmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const busy = useRef(false);
  const focused = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    try {
      const r = await api.get<VehicleCmd[]>('/vehicles?includeDevice=true&limit=500');
      if (focused.current) setVehicles(Array.isArray(r.data) ? r.data : (r.data as any).items ?? []);
    } catch {} finally {
      busy.current = false;
      if (focused.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => { focused.current = false; };
  }, [load]));

  const sendCommand = (v: VehicleCmd, action: 'immobilize' | 'activate') => {
    const last4 = v.imei?.slice(-4) ?? '';
    const actionLabel = action === 'immobilize' ? 'Cut Engine' : 'Restore Engine';
    const color = action === 'immobilize' ? 'destructive' : 'default';

    Alert.prompt(
      action === 'immobilize' ? '⚠️ Engine Cut Confirm' : '✅ Engine Restore Confirm',
      `Vehicle: ${v.licensePlate || v.name || `#${v.displayId}`}\nEnter last 4 digits of IMEI to confirm:`,
      async (input) => {
        if (!input) return;
        if (input !== last4) { Alert.alert('Error', 'Incorrect IMEI digits'); return; }
        setSending(prev => ({ ...prev, [v.id]: true }));
        try {
          await api.post(`/devices/${v.imei}/command`, { action });
          setVehicles(prev => prev.map(vv => vv.id === v.id ? { ...vv, lastImmobilizer: action === 'immobilize' } : vv));
          Alert.alert('Success', action === 'immobilize' ? 'Engine cut command sent' : 'Engine restore command sent');
        } catch {
          Alert.alert('Error', 'Command could not be sent. Check your connection.');
        } finally { setSending(prev => { const n = { ...prev }; delete n[v.id]; return n; }); }
      },
      'plain-text',
      '',
      'numeric',
    );
  };

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/more'); };

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    return vehicles.filter(v => {
      if (!term) return true;
      return [v.licensePlate ?? '', v.name ?? '', v.imei ?? ''].some(s => s.toLowerCase().includes(term));
    });
  }, [vehicles, query]);

  if (permsLoading) return (
    <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color={t.red} /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <TablerIcon name="back" size={21} color={t.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Command Center</Text>
          <Text style={styles.headerSubtitle}>Engine cut &amp; restore commands</Text>
        </View>
        <Pressable onPress={() => { void load(true); }} disabled={refreshing} style={styles.refresh} accessibilityRole="button" accessibilityLabel="Refresh">
          {refreshing ? <ActivityIndicator size="small" color={t.red} /> : <TablerIcon name="refresh" size={19} color={t.red} />}
        </Pressable>
      </View>

      {!canUse && (
        <View style={{ margin: 16, padding: 14, backgroundColor: t.card, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
          <Text style={{ color: t.secondary, fontSize: 13, textAlign: 'center' }}>Your account does not have permission to send engine commands.</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total', value: vehicles.length, color: t.ink },
          { label: 'Active', value: vehicles.filter(v => !v.lastImmobilizer).length, color: t.moving },
          { label: 'Cut', value: vehicles.filter(v => v.lastImmobilizer).length, color: t.red },
        ].map(s => (
          <View key={s.label} style={[styles.statCell, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{loading ? '—' : s.value}</Text>
            <Text style={[styles.statLabel, { color: t.secondary }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.searchBox, { backgroundColor: t.card, borderColor: t.border }]}>
        <TablerIcon name="search" size={17} color={t.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by plate, name or IMEI"
          placeholderTextColor={t.muted} style={[styles.searchInput, { color: t.ink }]}
          autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 && <Pressable onPress={() => setQuery('')} accessibilityRole="button"><TablerIcon name="close" size={17} color={t.secondary} /></Pressable>}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={t.red} colors={[t.red]} />}
      >
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={t.red} /><Text style={[styles.stateText, { color: t.secondary }]}>Loading vehicles…</Text></View>
        ) : filtered.length === 0 ? (
          <View style={styles.state}><TablerIcon name="bolt" size={28} color={t.muted} /><Text style={[styles.emptyTitle, { color: t.ink }]}>No vehicles found</Text></View>
        ) : filtered.map(v => {
          const isImmobilized = !!v.lastImmobilizer;
          const noImei = !v.imei;
          return (
            <View key={v.id} style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.plate, { color: t.ink }]} numberOfLines={1}>{v.licensePlate || `#${v.displayId}`}</Text>
                {v.name && <Text style={[styles.name, { color: t.secondary }]} numberOfLines={1}>{v.name}</Text>}
                {v.imei && <Text style={[styles.imei, { color: t.muted }]} numberOfLines={1}>{v.imei}</Text>}
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.statusBadge, { backgroundColor: isImmobilized ? '#fef2f2' : '#f0fdf4' }]}>
                  <Text style={[styles.statusText, { color: isImmobilized ? t.red : t.moving }]}>{isImmobilized ? 'Cut' : 'Active'}</Text>
                </View>
                {noImei ? (
                  <Text style={[styles.noDevice, { color: t.muted }]}>No device</Text>
                ) : sending[v.id] ? (
                  <ActivityIndicator size="small" color={t.red} />
                ) : canUse ? (
                  <Pressable
                    onPress={() => sendCommand(v, isImmobilized ? 'activate' : 'immobilize')}
                    style={[styles.cmdBtn, { backgroundColor: isImmobilized ? '#f0fdf4' : '#fef2f2' }]}
                    accessibilityRole="button"
                    accessibilityLabel={isImmobilized ? 'Restore engine' : 'Cut engine'}
                  >
                    <TablerIcon name={isImmobilized ? 'bolt' : 'bolt-off'} size={13} color={isImmobilized ? t.moving : t.red} />
                    <Text style={[styles.cmdBtnText, { color: isImmobilized ? t.moving : t.red }]}>{isImmobilized ? 'Restore' : 'Cut'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, gap: 10 },
    back: { padding: 4 },
    headerCopy: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: t.ink },
    headerSubtitle: { fontSize: 11, color: t.secondary, marginTop: 1 },
    refresh: { padding: 6 },
    statsRow: { flexDirection: 'row', gap: 10, padding: 14 },
    statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
    searchInput: { flex: 1, fontSize: 14 },
    list: { paddingHorizontal: 14, paddingBottom: 20, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
    plate: { fontSize: 14, fontWeight: '700' },
    name: { fontSize: 11, marginTop: 1 },
    imei: { fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
    statusText: { fontSize: 11, fontWeight: '700' },
    cmdBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7 },
    cmdBtnText: { fontSize: 12, fontWeight: '700' },
    noDevice: { fontSize: 11 },
    state: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    stateText: { fontSize: 12 },
    emptyTitle: { fontSize: 14, fontWeight: '600' },
  });
}
