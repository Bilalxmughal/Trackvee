import { useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFleet, displayVehicleName, getFleetStatus } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
function dateTime(value?: string) {
  if (!value) return 'No recent data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'No recent data';
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()];
  return `${String(date.getDate()).padStart(2, '0')}-${month}-${date.getFullYear()} ${String(date.getHours() % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
}

export default function VehicleDetailScreen() {
  const { imei } = useLocalSearchParams<{ imei: string }>();
  const { items, loading } = useFleet();
  const { canDo } = usePortalPermissions();
  useEffect(() => { if (!canDo('vehicles')) router.replace('/map'); }, [canDo]);
  const item = items.find(entry => entry.device.imei === imei);
  if (loading && !item) return <View style={styles.loading}><ActivityIndicator color={theme.red} /><Text style={styles.loadingText}>Loading vehicle…</Text></View>;
  if (!item) return <SafeAreaView style={styles.safe}><Pressable onPress={() => router.back()} style={styles.back}><TablerIcon name="back" /></Pressable><Text style={styles.notFound}>Vehicle not found</Text></SafeAreaView>;
  const status = getFleetStatus(item.point);
  const statusColor = STATUS_COLOR[status];
  const point = item.point;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><TablerIcon name="back" /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.plate}>{item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`}</Text><Text style={styles.name}>{displayVehicleName(item.vehicle)}</Text></View>
        <Text style={[styles.status, { color: statusColor }]}>{status[0]!.toUpperCase() + status.slice(1)}</Text>
      </View>
      {point?.gpsValid && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? <MapView style={styles.map} initialRegion={{ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }} mapType="none" showsCompass={false}>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />
        <Marker coordinate={{ latitude: point.latitude, longitude: point.longitude }} title={item.vehicle?.licensePlate ?? 'Vehicle'} description={`${Math.round(point.speedKmh)} km/h`} pinColor={theme.red} />
      </MapView> : <View style={[styles.map, styles.noMap]}><TablerIcon name="map" size={28} color={theme.muted} /><Text style={styles.noMapText}>No valid location available</Text></View>}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.metrics}>
          <Metric label="Speed" value={`${Math.round(point?.speedKmh ?? 0)}`} unit="km/h" />
          <Metric label="Ignition" value={point?.ignition === true ? 'On' : point?.ignition === false ? 'Off' : '—'} />
          <Metric label="Heading" value={`${Math.round(point?.heading ?? 0)}°`} />
        </View>
        <Text style={styles.sectionTitle}>Latest Position</Text>
        <DetailRow label="Last update" value={dateTime(point?.timestamp)} />
        <DetailRow label="Coordinates" value={point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : '—'} />
        <DetailRow label="Satellites" value={point ? String(point.satellites ?? '—') : '—'} />
        <DetailRow label="GPS status" value={point?.gpsValid ? 'Valid' : 'No signal'} last />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}{unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}</Text></View>; }
function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) { return <View style={[styles.detailRow, last && styles.lastRow]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fff' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 10 }, loadingText: { color: theme.secondary, fontSize: 13 }, notFound: { textAlign: 'center', color: theme.secondary, marginTop: 35, fontSize: 14 }, header: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: theme.border }, back: { height: 40, width: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }, plate: { color: theme.ink, fontSize: 16, fontWeight: '700' }, name: { color: theme.secondary, fontSize: 12, marginTop: 3 }, status: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }, map: { height: 270, width: '100%' }, noMap: { backgroundColor: theme.canvas, alignItems: 'center', justifyContent: 'center', gap: 8 }, noMapText: { color: theme.secondary, fontSize: 12 }, body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30 }, metrics: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, paddingVertical: 16, marginBottom: 22 }, metric: { flex: 1, paddingHorizontal: 8, borderRightWidth: 1, borderColor: theme.border }, metricLabel: { fontSize: 11, color: theme.secondary }, metricValue: { fontSize: 19, fontWeight: '700', color: theme.ink, marginTop: 5 }, metricUnit: { fontSize: 11, color: theme.secondary, fontWeight: '500' }, sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.ink, marginBottom: 4 }, detailRow: { minHeight: 44, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 }, lastRow: { borderBottomWidth: 0 }, detailLabel: { fontSize: 12, color: theme.secondary }, detailValue: { flexShrink: 1, textAlign: 'right', fontSize: 12, color: theme.ink, fontWeight: '500' }, note: { marginTop: 18, color: theme.muted, fontSize: 11, lineHeight: 17 } });
