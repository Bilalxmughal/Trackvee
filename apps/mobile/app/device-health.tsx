import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { theme } from '../src/theme';

type Connection = 'online' | 'delayed' | 'offline' | 'never_seen';
type Gps = 'good' | 'weak' | 'no_fix' | 'stale' | 'unknown';
type Signal = 'good' | 'fair' | 'weak' | 'unknown';
interface DeviceHealth {
  deviceId: string;
  imei: string;
  deviceName: string | null;
  vehicle: { id: string; displayId: number; licensePlate: string | null; name: string } | null;
  connection: Connection;
  lastPacketAt: string | null;
  lastGpsReceivedAt: string | null;
  trackerLagSeconds: number | null;
  gps: Gps;
  satellites: number | null;
  gsm: Signal;
  gsmSignal: number | null;
  externalPower: 'connected' | 'disconnected' | 'unknown';
  voltageLevel: string | null;
  ignition: boolean | null;
  issues: string[];
}
type Filter = 'all' | 'attention' | 'offline';

const CONNECTION_LABEL: Record<Connection, string> = {
  online: 'Online', delayed: 'Delayed', offline: 'Offline', never_seen: 'Never connected',
};
const CONNECTION_COLOR: Record<Connection, string> = {
  online: theme.moving, delayed: theme.idle, offline: theme.red, never_seen: theme.secondary,
};
const GPS_LABEL: Record<Gps, string> = {
  good: 'Good fix', weak: 'Weak fix', no_fix: 'No fix', stale: 'Stale', unknown: 'No data',
};

function ageLabel(value: string | null): string {
  if (!value) return 'Never';
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return 'Unknown';
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}m ago` : `${Math.floor(hours / 24)}d ago`;
}

function vehicleLabel(row: DeviceHealth): string {
  if (!row.vehicle) return 'Unassigned device';
  return row.vehicle.licensePlate || row.vehicle.name || `Vehicle #${row.vehicle.displayId}`;
}

export default function DeviceHealthScreen() {
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const canView = !permissionsLoading && canDo('vehicles', 'view');
  const [rows, setRows] = useState<DeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const busy = useRef(false);
  const focused = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (!canView || busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    try {
      const response = await api.get<DeviceHealth[]>('/telemetry/device-health');
      if (focused.current) {
        setRows(Array.isArray(response.data) ? response.data : []);
        setError('');
      }
    } catch {
      if (focused.current) setError('Device health could not be loaded. Check your connection and try again.');
    } finally {
      busy.current = false;
      if (focused.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [canView]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (canView) {
      void load();
      const timer = setInterval(() => { void load(); }, 30_000);
      return () => { focused.current = false; clearInterval(timer); };
    }
    return () => { focused.current = false; };
  }, [canView, load]));

  const counts = useMemo(() => ({
    online: rows.filter(row => row.connection === 'online').length,
    delayed: rows.filter(row => row.connection === 'delayed').length,
    offline: rows.filter(row => row.connection === 'offline' || row.connection === 'never_seen').length,
    issues: rows.filter(row => row.issues.length > 0).length,
  }), [rows]);

  const visibleRows = useMemo(() => rows.filter(row => {
    const term = query.trim().toLowerCase();
    if (term && ![row.imei, row.deviceName ?? '', row.vehicle?.licensePlate ?? '', row.vehicle?.name ?? ''].some(value => value.toLowerCase().includes(term))) return false;
    if (filter === 'offline' && row.connection !== 'offline' && row.connection !== 'never_seen') return false;
    if (filter === 'attention' && row.connection === 'online' && row.issues.length === 0) return false;
    return true;
  }).sort((a, b) => {
    const rank: Record<Connection, number> = { offline: 0, never_seen: 1, delayed: 2, online: 3 };
    return rank[a.connection] - rank[b.connection] || b.issues.length - a.issues.length;
  }), [rows, query, filter]);

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/map'); };

  if (permissionsLoading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color={theme.red} /></SafeAreaView>;
  if (!canView) return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}><Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><TablerIcon name="back" size={21} color={theme.ink} /></Pressable><Text style={styles.headerTitle}>Device Health</Text></View>
      <View style={styles.centerContent}><Text style={styles.emptyTitle}>Access unavailable</Text><Text style={styles.emptyText}>Your account does not have permission to view device health.</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><TablerIcon name="back" size={21} color={theme.ink} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Device Health</Text><Text style={styles.headerSubtitle}>Connection, GPS, signal and power</Text></View>
        <Pressable onPress={() => { void load(true); }} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh device health" style={styles.refresh}>
          {refreshing ? <ActivityIndicator size="small" color={theme.red} /> : <TablerIcon name="refresh" size={19} color={theme.red} />}
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={theme.red} colors={[theme.red]} />}
      >
        <View style={styles.summaryGrid}>
          {[
            { label: 'Online', value: counts.online, color: theme.moving },
            { label: 'Delayed', value: counts.delayed, color: theme.idle },
            { label: 'Offline', value: counts.offline, color: theme.red },
            { label: 'With issues', value: counts.issues, color: theme.ink },
          ].map(item => <View key={item.label} style={styles.summaryCell}><Text style={[styles.summaryValue, { color: item.color }]}>{loading ? '—' : item.value}</Text><Text style={styles.summaryLabel}>{item.label}</Text></View>)}
        </View>

        <View style={styles.searchBox}>
          <TablerIcon name="search" size={17} color={theme.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search vehicle or IMEI" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
          {query.length > 0 ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search"><TablerIcon name="close" size={17} color={theme.secondary} /></Pressable> : null}
        </View>

        <View style={styles.filters}>
          {([
            ['all', `All (${rows.length})`],
            ['attention', `Needs attention (${counts.issues})`],
            ['offline', `Offline (${counts.offline})`],
          ] as [Filter, string][]).map(([value, label]) => (
            <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]} accessibilityRole="button" accessibilityState={{ selected: filter === value }}>
              <Text numberOfLines={1} style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { void load(true); }}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
        {loading ? <View style={styles.state}><ActivityIndicator color={theme.red} /><Text style={styles.stateText}>Loading device health…</Text></View>
          : visibleRows.length === 0 ? <View style={styles.state}><TablerIcon name="cpu" size={28} color={theme.muted} /><Text style={styles.emptyTitle}>{rows.length ? 'No matching devices' : 'No devices found'}</Text><Text style={styles.emptyText}>{rows.length ? 'Try another search or filter.' : 'Devices assigned to your account will appear here.'}</Text></View>
            : visibleRows.map(row => <DeviceRow key={row.deviceId} row={row} />)}

        <Text style={styles.refreshNote}>Updated automatically every 30 seconds while this screen is open.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceRow({ row }: { row: DeviceHealth }) {
  const connectionColor = CONNECTION_COLOR[row.connection];
  const gpsColor = row.gps === 'good' ? theme.moving : row.gps === 'unknown' ? theme.secondary : theme.idle;
  const signalColor = row.gsm === 'good' ? theme.moving : row.gsm === 'unknown' ? theme.secondary : theme.idle;
  const powerText = row.externalPower === 'unknown' ? 'Unknown' : row.externalPower === 'connected' ? 'Connected' : 'Disconnected';
  return (
    <View style={[styles.deviceRow, { borderLeftColor: connectionColor }]}>
      <View style={styles.deviceHeading}>
        <View style={styles.deviceTitleBlock}><Text style={styles.vehicleName} numberOfLines={1}>{vehicleLabel(row)}</Text><Text style={styles.deviceId} numberOfLines={1}>{row.deviceName ? `${row.deviceName} · ` : ''}{row.imei}</Text></View>
        <View style={styles.connectionBlock}><Text style={[styles.connection, { color: connectionColor }]}>{CONNECTION_LABEL[row.connection]}</Text><Text style={styles.ignition}>Ignition: {row.ignition == null ? 'Unknown' : row.ignition ? 'On' : 'Off'}</Text></View>
      </View>
      <View style={styles.metrics}>
        <Metric label="GPS" value={GPS_LABEL[row.gps]} detail={row.satellites == null ? 'No satellite data' : `${row.satellites} satellites`} color={gpsColor} />
        <Metric label="GSM" value={row.gsm === 'unknown' ? 'No data' : `${row.gsm[0]!.toUpperCase()}${row.gsm.slice(1)}`} detail={row.gsmSignal == null ? 'No signal level' : `Level ${row.gsmSignal} / 4`} color={signalColor} />
        <Metric label="External power" value={powerText} detail={row.voltageLevel ?? 'No voltage data'} color={row.externalPower === 'disconnected' ? theme.red : theme.ink} />
        <Metric label="Last packet" value={ageLabel(row.lastPacketAt)} detail={row.lastGpsReceivedAt ? `GPS received ${ageLabel(row.lastGpsReceivedAt)}` : 'No GPS packet'} color={theme.ink} />
      </View>
      {row.trackerLagSeconds != null && row.trackerLagSeconds > 120 ? <Text style={styles.trackerLag}>Tracker clock is {Math.round(row.trackerLagSeconds / 60)} min behind receipt</Text> : null}
      {row.issues.length > 0 ? <Text style={styles.issues}>{row.issues.join(' · ')}</Text> : <Text style={styles.healthy}>No health issues detected</Text>}
    </View>
  );
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color }]} numberOfLines={1}>{value}</Text><Text style={styles.metricDetail} numberOfLines={1}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.surface },
  center: { flex: 1, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  back: { width: 34, height: 42, justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { color: theme.ink, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: theme.secondary, fontSize: 11, marginTop: 2 },
  refresh: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 14, paddingBottom: 30 },
  summaryGrid: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
  summaryCell: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.border },
  summaryValue: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: theme.secondary, fontSize: 10, marginTop: 3 },
  searchBox: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  searchInput: { flex: 1, minHeight: 40, paddingVertical: 0, color: theme.ink, fontSize: 13 },
  filters: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: theme.border },
  filter: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterActive: { borderBottomColor: theme.red },
  filterText: { color: theme.secondary, fontSize: 10.5 },
  filterTextActive: { color: theme.red, fontWeight: '600' },
  deviceRow: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: theme.border, borderLeftWidth: 3 },
  deviceHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceTitleBlock: { flex: 1, minWidth: 0 },
  vehicleName: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  deviceId: { color: theme.secondary, fontSize: 10.5, marginTop: 3 },
  connectionBlock: { alignItems: 'flex-end', maxWidth: '42%' },
  connection: { fontSize: 11, fontWeight: '700' },
  ignition: { color: theme.secondary, fontSize: 10, marginTop: 3 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f2f4', paddingTop: 8 },
  metric: { width: '50%', paddingVertical: 5, paddingRight: 7 },
  metricLabel: { color: theme.secondary, fontSize: 9.5 },
  metricValue: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  metricDetail: { color: theme.muted, fontSize: 9.5, marginTop: 2 },
  trackerLag: { color: '#b45309', fontSize: 10, marginTop: 7 },
  issues: { color: '#b45309', fontSize: 10, lineHeight: 15, marginTop: 7 },
  healthy: { color: theme.moving, fontSize: 10, marginTop: 7 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  errorText: { flex: 1, color: theme.red, fontSize: 11 },
  retry: { color: theme.red, fontSize: 12, fontWeight: '700', padding: 5 },
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 25, gap: 9 },
  stateText: { color: theme.secondary, fontSize: 12 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 8 },
  emptyTitle: { color: theme.ink, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: theme.secondary, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  refreshNote: { color: theme.muted, textAlign: 'center', paddingVertical: 14, fontSize: 10 },
});
