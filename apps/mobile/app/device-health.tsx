import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

type Connection = 'online' | 'delayed' | 'offline' | 'never_seen';
type Gps = 'good' | 'weak' | 'no_fix' | 'stale' | 'unknown';
type Signal = 'good' | 'fair' | 'weak' | 'unknown';
interface DeviceHealth {
  deviceId: string;
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
interface ExpiringDevice { id: string; imei: string; expiresAt: string; vehicleLicensePlate: string | null; vehicleName: string | null; }

const CONNECTION_LABEL: Record<Connection, string> = {
  online: 'Online', delayed: 'Delayed', offline: 'Offline', never_seen: 'Never connected',
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const canView = !permissionsLoading && canDo('vehicles', 'view');
  const [rows, setRows] = useState<DeviceHealth[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDevice[]>([]);
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
      const [healthRes, expiringRes] = await Promise.all([
        api.get<DeviceHealth[]>('/telemetry/device-health'),
        api.get<ExpiringDevice[]>('/devices/expiring?days=30').catch(() => ({ data: [] as ExpiringDevice[] })),
      ]);
      if (focused.current) {
        setRows(Array.isArray(healthRes.data) ? healthRes.data : []);
        setExpiring(Array.isArray(expiringRes.data) ? expiringRes.data : []);
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
    if (term && ![row.vehicle?.licensePlate ?? '', row.vehicle?.name ?? ''].some(value => value.toLowerCase().includes(term))) return false;
    if (filter === 'offline' && row.connection !== 'offline' && row.connection !== 'never_seen') return false;
    if (filter === 'attention' && row.connection === 'online' && row.issues.length === 0) return false;
    return true;
  }).sort((a, b) => {
    const rank: Record<Connection, number> = { offline: 0, never_seen: 1, delayed: 2, online: 3 };
    return rank[a.connection] - rank[b.connection] || b.issues.length - a.issues.length;
  }), [rows, query, filter]);

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/map'); };

  if (permissionsLoading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color={t.red} /></SafeAreaView>;
  if (!canView) return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}><Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><TablerIcon name="arrow-left" size={19} color={t.ink} /></Pressable><Text style={styles.headerTitle}>Device Health</Text></View>
      <View style={styles.centerContent}><Text style={styles.emptyTitle}>Access unavailable</Text><Text style={styles.emptyText}>Your account does not have permission to view device health.</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><TablerIcon name="arrow-left" size={19} color={t.ink} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Device Health</Text><Text style={styles.headerSubtitle}>Connection, GPS, signal and power</Text></View>
        <Pressable onPress={() => { void load(true); }} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh device health" style={styles.refresh}>
          {refreshing ? <ActivityIndicator size="small" color={t.red} /> : <TablerIcon name="refresh" size={19} color={t.red} />}
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={t.red} colors={[t.red]} />}
      >
        <View style={styles.summaryGrid}>
          {[
            { label: 'Online', value: counts.online, color: t.moving },
            { label: 'Delayed', value: counts.delayed, color: t.idle },
            { label: 'Offline', value: counts.offline, color: t.red },
            { label: 'With issues', value: counts.issues, color: t.ink },
          ].map(item => <View key={item.label} style={styles.summaryCell}><Text style={[styles.summaryValue, { color: item.color }]}>{loading ? '—' : item.value}</Text><Text style={styles.summaryLabel}>{item.label}</Text></View>)}
        </View>

        <View style={styles.searchBox}>
          <TablerIcon name="search" size={17} color={t.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search vehicles" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
          {query.length > 0 ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search"><TablerIcon name="close" size={17} color={t.secondary} /></Pressable> : null}
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

        {expiring.length > 0 && (
          <View style={styles.expiringSection}>
            <Text style={styles.expiringSectionTitle}>Expiring Soon ({expiring.length})</Text>
            {expiring.map(dev => {
              const daysLeft = Math.ceil((new Date(dev.expiresAt).getTime() - Date.now()) / 86400000);
              const expired = daysLeft < 0;
              const urgent = !expired && daysLeft <= 7;
              const color = expired ? t.red : urgent ? t.idle : t.secondary;
              const label = expired ? `Expired ${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`;
              return (
                <View key={dev.id} style={[styles.expiringRow, { borderLeftColor: color }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expiringVehicle} numberOfLines={1}>{dev.vehicleLicensePlate || dev.vehicleName || dev.imei}</Text>
                    <Text style={styles.expiringImei} numberOfLines={1}>{dev.imei}</Text>
                  </View>
                  <Text style={[styles.expiringBadge, { color, borderColor: color }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { void load(true); }}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
        {loading ? <View style={styles.state}><ActivityIndicator color={t.red} /><Text style={styles.stateText}>Loading device health…</Text></View>
          : visibleRows.length === 0 ? <View style={styles.state}><TablerIcon name="cpu" size={28} color={t.muted} /><Text style={styles.emptyTitle}>{rows.length ? 'No matching devices' : 'No devices found'}</Text><Text style={styles.emptyText}>{rows.length ? 'Try another search or filter.' : 'Devices assigned to your account will appear here.'}</Text></View>
            : visibleRows.map(row => <DeviceRow key={row.deviceId} row={row} />)}

        <Text style={styles.refreshNote}>Updated automatically every 30 seconds while this screen is open.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceRow({ row }: { row: DeviceHealth }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const connectionColorMap: Record<Connection, string> = { online: t.moving, delayed: t.idle, offline: t.red, never_seen: t.secondary };
  const connectionColor = connectionColorMap[row.connection];
  const gpsColor = row.gps === 'good' ? t.moving : row.gps === 'unknown' ? t.secondary : t.idle;
  const signalColor = row.gsm === 'good' ? t.moving : row.gsm === 'unknown' ? t.secondary : t.idle;
  const powerText = row.externalPower === 'unknown' ? 'Unknown' : row.externalPower === 'connected' ? 'Connected' : 'Disconnected';
  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceHeading}>
        <View style={styles.deviceTitleBlock}><Text style={styles.vehicleName} numberOfLines={1}>{vehicleLabel(row)}</Text></View>
        <View style={styles.connectionBlock}><Text style={[styles.connection, { color: connectionColor }]}>{CONNECTION_LABEL[row.connection]}</Text><Text style={styles.ignition}>Ignition: {row.ignition == null ? 'Unknown' : row.ignition ? 'On' : 'Off'}</Text></View>
      </View>
      <View style={styles.metrics}>
        <Metric label="GPS" value={GPS_LABEL[row.gps]} detail={row.satellites == null ? 'No satellite data' : `${row.satellites} satellites`} color={gpsColor} />
        <Metric label="GSM" value={row.gsm === 'unknown' ? 'No data' : `${row.gsm[0]!.toUpperCase()}${row.gsm.slice(1)}`} detail={row.gsmSignal == null ? 'No signal level' : `Level ${row.gsmSignal} / 4`} color={signalColor} />
        <Metric label="External power" value={powerText} detail={row.voltageLevel ?? 'No voltage data'} color={row.externalPower === 'disconnected' ? t.red : t.ink} />
        <Metric label="Last packet" value={ageLabel(row.lastPacketAt)} detail={row.lastGpsReceivedAt ? `GPS received ${ageLabel(row.lastGpsReceivedAt)}` : 'No GPS packet'} color={t.ink} />
      </View>
      {row.trackerLagSeconds != null && row.trackerLagSeconds > 120 ? <Text style={styles.trackerLag}>Tracker clock is {Math.round(row.trackerLagSeconds / 60)} min behind receipt</Text> : null}
      {row.issues.length > 0 ? <Text style={styles.issues}>{row.issues.join(' · ')}</Text> : <Text style={styles.healthy}>No health issues detected</Text>}
    </View>
  );
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color }]} numberOfLines={1}>{value}</Text><Text style={styles.metricDetail} numberOfLines={1}>{detail}</Text></View>;
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.surface },
    center: { flex: 1, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    back: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2 },
    headerCopy: { flex: 1 },
    headerTitle: { color: t.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    headerSubtitle: { color: t.secondary, fontSize: 12, marginTop: 2 },
    refresh: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2 },
    content: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 4, gap: 8 },
    summaryGrid: { flexDirection: 'row', gap: 8 },
    summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    summaryValue: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
    summaryLabel: { color: t.secondary, fontSize: 10, marginTop: 3 },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    searchInput: { flex: 1, paddingVertical: 2, color: t.ink, fontSize: 13 },
    filters: { flexDirection: 'row', gap: 8 },
    filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: t.bg2 },
    filterActive: { backgroundColor: `${t.red}14` },
    filterText: { color: t.secondary, fontSize: 12 },
    filterTextActive: { color: t.red, fontWeight: '600' },
    deviceRow: { marginVertical: 4, borderRadius: 14, backgroundColor: t.card, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    deviceHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    deviceTitleBlock: { flex: 1, minWidth: 0 },
    vehicleName: { color: t.ink, fontSize: 13, fontWeight: '700' },
    deviceId: { color: t.secondary, fontSize: 10.5, marginTop: 3 },
    connectionBlock: { alignItems: 'flex-end', maxWidth: '42%' },
    connection: { fontSize: 11, fontWeight: '700' },
    ignition: { color: t.secondary, fontSize: 10, marginTop: 3 },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: 1, borderTopColor: t.border2, paddingTop: 8 },
    metric: { width: '50%', paddingVertical: 5, paddingRight: 7 },
    metricLabel: { color: t.secondary, fontSize: 9.5 },
    metricValue: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
    metricDetail: { color: t.muted, fontSize: 9.5, marginTop: 2 },
    trackerLag: { color: t.idle, fontSize: 10, marginTop: 7 },
    issues: { color: t.idle, fontSize: 10, lineHeight: 15, marginTop: 7 },
    healthy: { color: t.moving, fontSize: 10, marginTop: 7 },
    error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
    errorText: { flex: 1, color: t.red, fontSize: 11 },
    retry: { color: t.red, fontSize: 12, fontWeight: '700', padding: 5 },
    state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 25, gap: 9 },
    stateText: { color: t.secondary, fontSize: 12 },
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 8 },
    emptyTitle: { color: t.ink, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    emptyText: { color: t.secondary, fontSize: 11, textAlign: 'center', lineHeight: 16 },
    refreshNote: { color: t.muted, textAlign: 'center', paddingVertical: 14, fontSize: 10 },
    expiringSection: { backgroundColor: t.card, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    expiringSectionTitle: { fontSize: 11, fontWeight: '700', color: t.secondary, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border2 },
    expiringRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderLeftWidth: 3, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border2 },
    expiringVehicle: { fontSize: 13, fontWeight: '600', color: t.ink },
    expiringImei: { fontSize: 10, color: t.secondary, marginTop: 1 },
    expiringBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  });
}
