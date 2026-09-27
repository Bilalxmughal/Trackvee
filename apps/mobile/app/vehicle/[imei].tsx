import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type LatLng } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleet, displayVehicleName, getFleetStatus, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';
import carIcon from '../../assets/car-icon.png';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
type VehicleStats = { stopDuration: number | null; odometer: number; engineHours: number };
type HistoryPoint = { latitude: number; longitude: number; timestamp: string; speedKmh: number; heading: number; ignition?: boolean | null; gpsValid: boolean };
function dateTime(value?: string) {
  if (!value) return 'No recent data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'No recent data';
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()];
  return `${String(date.getDate()).padStart(2, '0')}-${month}-${date.getFullYear()} ${String(date.getHours() % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
}
function duration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400); const hours = Math.floor((total % 86400) / 3600); const mins = Math.floor((total % 3600) / 60);
  return days ? `${days}d ${hours}h ${mins}m` : hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { imei } = useLocalSearchParams<{ imei: string }>();
  const { items, loading } = useFleet();
  const { canDo } = usePortalPermissions();
  const mapRef = useRef<MapView>(null);
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyMode, setHistoryMode] = useState<'history' | 'replay' | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cutOpen, setCutOpen] = useState(false);
  const [digits, setDigits] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [immobilized, setImmobilized] = useState(false);
  useEffect(() => { if (!canDo('vehicles')) router.replace('/map'); }, [canDo]);
  const item = items.find(entry => entry.device.imei === imei);
  const point = item?.point ?? null;
  useEffect(() => { if (point?.immobilizer != null) setImmobilized(point.immobilizer); }, [point?.immobilizer]);
  const status = getFleetStatus(point);
  const statusColor = STATUS_COLOR[status];
  const routeCoords = useMemo<LatLng[]>(() => history.filter(p => p.gpsValid && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map(p => ({ latitude: p.latitude, longitude: p.longitude })), [history]);

  const loadStats = useCallback(async () => {
    if (!imei) return;
    try { const response = await api.get<VehicleStats>(`/telemetry/${imei}/stats`); setStats(response.data); } catch { setStats(null); }
  }, [imei]);
  useEffect(() => { void loadStats(); const timer = setInterval(() => { void loadStats(); }, 30_000); return () => clearInterval(timer); }, [loadStats]);

  const loadHistory = async (mode: 'history' | 'replay') => {
    if (!imei) return;
    setHistoryLoading(true); setHistoryMode(mode);
    try {
      const to = new Date(); const from = new Date(to.getTime() - (mode === 'replay' ? 3_600_000 : 24 * 3_600_000));
      const response = await api.get<HistoryPoint[]>(`/telemetry/${imei}/history`, { params: { from: from.toISOString(), to: to.toISOString(), limit: 2000 } });
      const points = (response.data ?? []).filter(p => p.gpsValid && Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      setHistory(points);
      if (points.length) mapRef.current?.fitToCoordinates(points.map(p => ({ latitude: p.latitude, longitude: p.longitude })), { edgePadding: { top: 80, right: 45, bottom: 280, left: 45 }, animated: true });
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const sendEngineCommand = async () => {
    if (!item || digits !== item.device.imei.slice(-4)) { setCommandError('Incorrect digits — please try again'); return; }
    setCommandBusy(true); setCommandError('');
    try {
      await api.post(`/devices/${item.device.imei}/command`, { action: immobilized ? 'activate' : 'immobilize' });
      setImmobilized(!immobilized); setCutOpen(false); setDigits('');
    } catch { setCommandError('The command could not be sent. Please try again.'); }
    finally { setCommandBusy(false); }
  };

  if (loading && !item) return <View style={styles.loading}><ActivityIndicator color={theme.red} /><Text style={styles.loadingText}>Loading vehicle…</Text></View>;
  if (!item) return <SafeAreaView style={styles.safe}><Pressable onPress={() => router.back()} style={styles.back}><TablerIcon name="back" /></Pressable><Text style={styles.notFound}>Vehicle not found</Text></SafeAreaView>;
  const plate = item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;
  const coordinate = point?.gpsValid ? { latitude: point.latitude, longitude: point.longitude } : null;
  return (
    <View style={styles.safe}>
      <View style={styles.mapArea}>
        {coordinate ? <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ ...coordinate, latitudeDelta: 0.025, longitudeDelta: 0.025 }} mapType="none" showsCompass={false}>
          <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />
          {routeCoords.length > 1 && <Polyline coordinates={routeCoords} strokeColor={theme.red} strokeWidth={3} />}
          <Marker coordinate={coordinate} title={plate} description={`${Math.round(point?.speedKmh ?? 0)} km/h`} tracksViewChanges={false}>
            <View style={styles.mapMarker}><Image source={carIcon} resizeMode="contain" style={{ width: 30, height: 39, transform: [{ rotate: `${((point?.heading ?? 0) + 180) % 360}deg` }] }} /><View style={styles.markerLabel}><View style={[styles.labelBar, { backgroundColor: statusColor }]} /><Text style={styles.markerLabelText}>{plate}</Text></View></View>
          </Marker>
        </MapView> : <View style={[StyleSheet.absoluteFill, styles.noMap]}><TablerIcon name="map" size={28} color={theme.muted} /><Text style={styles.noMapText}>No valid location available</Text></View>}
        <SafeAreaView style={styles.mapHeader} edges={['top']}><Pressable onPress={() => router.back()} style={styles.mapBack} accessibilityLabel="Back"><TablerIcon name="back" size={19} /></Pressable><Text style={styles.mapHeaderPlate}>{plate}</Text><Pressable onPress={() => router.push('/alerts')} style={styles.mapBack} accessibilityLabel="Alerts"><TablerIcon name="bell" size={18} /></Pressable></SafeAreaView>
        {historyMode && <View style={styles.routeBanner}><Text style={styles.routeBannerText}>{historyLoading ? 'Loading route…' : historyMode === 'replay' ? 'Last hour replay route' : 'Last 24 hours history'}</Text><Pressable onPress={() => { setHistoryMode(null); setHistory([]); }}><Text style={styles.routeClose}>Close</Text></Pressable></View>}
      </View>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.vehicleHeading}>
          <View style={{ flex: 1 }}><Text style={styles.plate}>{plate}</Text><Text style={styles.name}>{displayVehicleName(item.vehicle)}</Text><Text style={[styles.status, { color: statusColor }]}>{status[0]!.toUpperCase() + status.slice(1)} · {Math.round(point?.speedKmh ?? 0)} km/h</Text></View>
          <Pressable onPress={() => router.push('/more')} style={styles.moreButton} accessibilityLabel="Vehicle options"><TablerIcon name="more" size={19} /></Pressable>
        </View>
        <View style={styles.telemetryGrid}>
          <Telemetry label="Ignition" value={point?.ignition === true ? 'On' : point?.ignition === false ? 'Off' : '—'} />
          <Telemetry label="GPS" value={point?.gpsValid ? `${point.satellites ?? 0} satellites` : 'No signal'} />
          <Telemetry label="Battery" value={point?.voltageLevel != null ? `${point.voltageLevel.toFixed(1)} V` : '—'} />
          <Telemetry label="Last update" value={point ? relativeTime(point.timestamp) : 'No data'} />
          <Telemetry label="Stop duration" value={status === 'idle' || status === 'parked' ? duration(stats?.stopDuration) : '—'} last />
        </View>
        <View style={styles.actionRow}>
          <Action name="locate" label="Follow" onPress={() => coordinate && mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 350)} />
          <Action name="history" label="Replay" onPress={() => void loadHistory('replay')} />
          <Action name="report" label="History" onPress={() => void loadHistory('history')} />
          <Action name="bell" label="Alert" onPress={() => router.push('/alerts')} />
        </View>
        {canDo('engine_cut') && <Pressable onPress={() => { setDigits(''); setCommandError(''); setCutOpen(true); }} style={styles.engineButton}><TablerIcon name="engine" size={17} color={theme.red} /><Text style={styles.engineText}>{immobilized ? 'Restore Engine' : 'Cut Engine'}</Text></Pressable>}
        <Text style={styles.coordinates}>{point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · ${dateTime(point.timestamp)}` : 'Waiting for vehicle telemetry'}</Text>
      </View>
      <Modal visible={cutOpen} transparent animationType="fade" onRequestClose={() => setCutOpen(false)}>
        <View style={styles.modalShade}><View style={styles.confirmCard}><Text style={styles.confirmTitle}>{immobilized ? 'Engine Restore Confirm' : 'Engine Cut Confirm'}</Text><Text style={styles.confirmBody}>Enter the last four digits of this device IMEI to continue.</Text><TextInput value={digits} onChangeText={value => setDigits(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} autoFocus style={styles.digitInput} accessibilityLabel="Last four IMEI digits" />{commandError ? <Text style={styles.commandError}>{commandError}</Text> : null}<View style={styles.confirmActions}><Pressable onPress={() => setCutOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={digits.length !== 4 || commandBusy} onPress={() => void sendEngineCommand()} style={[styles.confirmButton, (digits.length !== 4 || commandBusy) && styles.disabledButton]}>{commandBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Confirm</Text>}</Pressable></View></View></View>
      </Modal>
    </View>
  );
}

function relativeTime(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds} sec ago` : seconds < 3600 ? `${Math.floor(seconds / 60)} min ago` : `${Math.floor(seconds / 3600)} hr ago`; }
function Telemetry({ label, value, last }: { label: string; value: string; last?: boolean }) { return <View style={[styles.telemetryCell, last && styles.fullCell]}><Text style={styles.telemetryLabel}>{label}</Text><Text style={styles.telemetryValue}>{value}</Text></View>; }
function Action({ name, label, onPress }: { name: 'locate' | 'history' | 'report' | 'bell'; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={label}><TablerIcon name={name} size={19} color={theme.ink} /><Text style={styles.actionLabel}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.surface }, mapArea: { flex: 1.05, minHeight: 250 }, mapHeader: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, mapBack: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, mapHeaderPlate: { flex: 1, color: theme.ink, fontSize: 14, fontWeight: '700' }, mapMarker: { alignItems: 'center' }, markerLabel: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'stretch', borderRadius: 3, elevation: 2, overflow: 'hidden', marginTop: 1 }, labelBar: { width: 3, marginRight: 4 }, markerLabelText: { color: theme.ink, fontSize: 9, fontWeight: '700', paddingVertical: 2, paddingRight: 4 }, routeBanner: { position: 'absolute', top: 60, left: 12, right: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9, flexDirection: 'row', justifyContent: 'space-between' }, routeBannerText: { color: theme.ink, fontSize: 11, fontWeight: '600' }, routeClose: { color: theme.red, fontSize: 11, fontWeight: '600' }, sheet: { backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, marginTop: -10, paddingHorizontal: 16, paddingBottom: 10, elevation: 8 }, sheetHandle: { height: 3, width: 44, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginTop: 7, marginBottom: 10 }, vehicleHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, plate: { color: theme.ink, fontSize: 19, fontWeight: '700' }, name: { color: theme.ink, fontSize: 12, marginTop: 1 }, status: { fontSize: 12, fontWeight: '700', marginTop: 4 }, moreButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, telemetryGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, marginTop: 10, paddingVertical: 5 }, telemetryCell: { width: '50%', minHeight: 43, paddingVertical: 5, paddingHorizontal: 5, borderBottomWidth: 1, borderRightWidth: 1, borderColor: theme.border }, fullCell: { width: '100%', borderRightWidth: 0, borderBottomWidth: 0 }, telemetryLabel: { color: theme.secondary, fontSize: 10 }, telemetryValue: { color: theme.ink, fontSize: 12, fontWeight: '600', marginTop: 2 }, actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 9 }, action: { minWidth: 54, alignItems: 'center', gap: 3 }, actionLabel: { color: theme.secondary, fontSize: 10 }, engineButton: { minHeight: 35, borderTopWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, engineText: { color: theme.red, fontSize: 12, fontWeight: '600' }, coordinates: { color: theme.muted, fontSize: 9, textAlign: 'center', marginTop: 3 }, noMap: { backgroundColor: theme.canvas, alignItems: 'center', justifyContent: 'center', gap: 8 }, noMapText: { color: theme.secondary, fontSize: 12 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 10 }, loadingText: { color: theme.secondary, fontSize: 13 }, notFound: { textAlign: 'center', color: theme.secondary, marginTop: 35, fontSize: 14 }, back: { height: 40, width: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }, modalShade: { flex: 1, padding: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }, confirmCard: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 12, backgroundColor: '#fff' }, confirmTitle: { color: theme.ink, fontSize: 17, fontWeight: '700' }, confirmBody: { color: theme.secondary, fontSize: 12, marginTop: 8 }, digitInput: { height: 52, marginTop: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 8, textAlign: 'center', fontSize: 22, letterSpacing: 8, color: theme.ink }, commandError: { color: theme.red, fontSize: 12, marginTop: 8 }, confirmActions: { flexDirection: 'row', gap: 10, marginTop: 16 }, cancelButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 7 }, cancelText: { color: theme.ink, fontSize: 13, fontWeight: '600' }, confirmButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.red, borderRadius: 7 }, confirmText: { color: '#fff', fontSize: 13, fontWeight: '700' }, disabledButton: { opacity: 0.5 } });
