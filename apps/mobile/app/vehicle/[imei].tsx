import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, Polyline, UrlTile, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFleet, displayVehicleName, getFleetStatus } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { VehicleAlertsPanel } from '../../src/components/VehicleAlertsPanel';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';
import carIcon from '../../assets/car-icon.png';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
type VehicleStats = { stopDuration: number | null; odometer: number; engineHours: number };
type HistoryPoint = { latitude: number; longitude: number; timestamp: string; speedKmh: number; heading: number; ignition?: boolean | null; gpsValid: boolean };
type Range = '1h' | '24h' | '7d';
const RANGE_MS: Record<Range, number> = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 };
const PK_DATE = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' });
const PK_TIME = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const addressCache = new Map<string, string>();

function validPoint(p: HistoryPoint) { return p.gpsValid && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180; }
function bearing(a: HistoryPoint, b: HistoryPoint) {
  const r = Math.PI / 180; const dl = (b.longitude - a.longitude) * r;
  const y = Math.sin(dl) * Math.cos(b.latitude * r);
  const x = Math.cos(a.latitude * r) * Math.sin(b.latitude * r) - Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos(dl);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}
function duration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds)); const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function relativeTime(value: string) { const s = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return s < 60 ? `${s} sec ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} hr ago`; }
async function addressOf(point: HistoryPoint) {
  const key = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key)!;
  if (Platform.OS === 'android') {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (!requested.granted) return 'Address unavailable (location permission required)';
    }
  }
  const matches = await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude });
  const match = matches[0];
  const result = match ? [match.name, match.street, match.district, match.city, match.region].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(', ') : 'Address unavailable';
  addressCache.set(key, result);
  return result;
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { imei } = useLocalSearchParams<{ imei: string }>();
  const { items, loading } = useFleet();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const mapRef = useRef<MapView>(null);
  const markerCoord = useRef(new AnimatedRegion({ latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const markerInitialized = useRef(false);
  const requestId = useRef(0);
  const addressId = useRef(0);
  const progressWidth = useRef(1);
  const lastCommandAt = useRef(0);
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [mode, setMode] = useState<'history' | 'replay' | null>(null);
  const [range, setRange] = useState<Range>('24h');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<HistoryPoint | null>(null);
  const [address, setAddress] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [cutOpen, setCutOpen] = useState(false);
  const [immobilized, setImmobilized] = useState(false);
  const [following, setFollowing] = useState(false);
  const item = items.find(entry => entry.device.imei === imei);
  const point = item?.point ?? null;
  const coordinate = point?.gpsValid && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? { latitude: point.latitude, longitude: point.longitude } : null;
  const status = getFleetStatus(point);
  const statusColor = STATUS_COLOR[status];
  const route = useMemo(() => history.filter(validPoint), [history]);
  const routeCoords = useMemo<LatLng[]>(() => route.map(p => ({ latitude: p.latitude, longitude: p.longitude })), [route]);
  const arrows = useMemo(() => route.filter((p, i) => i > 0 && i % Math.max(1, Math.ceil(route.length / 80)) === 0 && p.speedKmh >= 5).map(p => { const i = route.indexOf(p); return { point: p, angle: bearing(route[i - 1]!, p), index: i }; }), [route]);
  const replayPoint = mode === 'replay' ? route[frame] : null;

  useEffect(() => { if (!permissionsLoading && !canDo('map') && !canDo('vehicles')) router.replace('/map'); }, [canDo, permissionsLoading]);
  useEffect(() => { if (point?.immobilizer != null && new Date(point.timestamp).getTime() > lastCommandAt.current) setImmobilized(point.immobilizer); }, [point?.immobilizer, point?.timestamp]);
  useEffect(() => { requestId.current++; addressId.current++; markerInitialized.current = false; setStats(null); setHistory([]); setMode(null); setPlaying(false); setFrame(0); setSelectedPoint(null); setAlertsOpen(false); setFollowing(false); }, [imei]);
  useEffect(() => {
    if (!imei) return;
    let active = true;
    const load = async () => { try { const response = await api.get<VehicleStats>(`/telemetry/${imei}/stats`); if (active) setStats(response.data); } catch { if (active) setStats(null); } };
    void load(); const timer = setInterval(() => { void load(); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [imei]);
  useEffect(() => {
    const current = replayPoint ?? coordinate;
    if (!current) return;
    if (!markerInitialized.current || (mode === 'replay' && frame === 0)) {
      markerCoord.setValue({ latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0, longitudeDelta: 0 });
      markerInitialized.current = true;
    } else markerCoord.timing({ toValue: 0, latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0, longitudeDelta: 0, duration: mode === 'replay' ? 170 : 2000, useNativeDriver: false }).start();
    if (following) mapRef.current?.animateToRegion({ ...current, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 280);
  }, [coordinate?.latitude, coordinate?.longitude, replayPoint?.latitude, replayPoint?.longitude, mode, frame, following, markerCoord]);
  useEffect(() => {
    if (!playing || mode !== 'replay' || route.length < 2) return;
    const timer = setInterval(() => setFrame(index => Math.min(route.length - 1, index + 1)), 180);
    return () => clearInterval(timer);
  }, [playing, mode, route.length]);
  useEffect(() => { if (playing && route.length > 1 && frame >= route.length - 1) setPlaying(false); }, [playing, frame, route.length]);
  useEffect(() => { return () => { requestId.current++; addressId.current++; }; }, []);

  const loadHistory = useCallback(async (nextMode: 'history' | 'replay', nextRange: Range) => {
    if (!imei) return;
    const id = ++requestId.current;
    setMode(nextMode); setRange(nextRange); setPlaying(false); setFrame(0); setHistory([]); setSelectedPoint(null); setHistoryError(''); setHistoryLoading(true);
    const to = new Date(); const from = new Date(to.getTime() - RANGE_MS[nextRange]);
    try {
      const response = await api.get<HistoryPoint[]>(`/telemetry/${imei}/history`, { params: { from: from.toISOString(), to: to.toISOString(), limit: 5000 } });
      if (id !== requestId.current) return;
      const points = (response.data ?? []).filter(validPoint);
      setHistory(points);
      if (points.length > 1) mapRef.current?.fitToCoordinates(points.map(p => ({ latitude: p.latitude, longitude: p.longitude })), { edgePadding: { top: 85, right: 50, bottom: 160, left: 50 }, animated: true });
    } catch { if (id === requestId.current) setHistoryError('History could not be loaded. Try again.'); }
    finally { if (id === requestId.current) setHistoryLoading(false); }
  }, [imei]);
  const closeHistory = () => { requestId.current++; addressId.current++; setMode(null); setPlaying(false); setHistory([]); setSelectedPoint(null); setHistoryError(''); setFollowing(false); };
  const selectArrow = (p: HistoryPoint) => {
    const id = ++addressId.current;
    setSelectedPoint(p); setAddress('Finding address…');
    void addressOf(p).then(value => { if (id === addressId.current) setAddress(value); }).catch(() => { if (id === addressId.current) setAddress('Address unavailable'); });
  };
  const seek = (fraction: number) => { if (!route.length) return; setPlaying(false); setFrame(Math.max(0, Math.min(route.length - 1, Math.round(fraction * (route.length - 1))))); };

  if (permissionsLoading || (loading && !item)) return <View style={s.loading}><ActivityIndicator color={theme.red} /><Text style={s.muted}>Loading vehicle…</Text></View>;
  if (!item) return <SafeAreaView style={s.loading}><Pressable onPress={() => router.back()} accessibilityLabel="Back"><TablerIcon name="back" /></Pressable><Text style={s.muted}>Vehicle not found</Text></SafeAreaView>;
  const plate = item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;
  const markerPosition = replayPoint ?? coordinate;
  const mapOrigin = coordinate ?? routeCoords[0];
  return <View style={s.screen}>
    <View style={s.mapArea}>
      {mapOrigin ? <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ ...mapOrigin, latitudeDelta: 0.025, longitudeDelta: 0.025 }} mapType="none" showsCompass={false} toolbarEnabled={false} moveOnMarkerPress={false} onMapReady={() => { if (!coordinate && routeCoords.length > 1) mapRef.current?.fitToCoordinates(routeCoords, { edgePadding: { top: 85, right: 50, bottom: 160, left: 50 }, animated: true }); }}>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />
        {routeCoords.length > 1 && <Polyline coordinates={routeCoords} strokeColor={theme.red} strokeWidth={3} />}
        {mode === 'history' && arrows.map(({ point: p, angle, index }) => <Marker key={`${imei}-${p.timestamp}-${index}`} coordinate={{ latitude: p.latitude, longitude: p.longitude }} onPress={() => selectArrow(p)} tracksViewChanges={false} stopPropagation>
          <View style={[s.arrow, { transform: [{ rotate: `${angle}deg` }] }]}><Text style={s.arrowText}>▲</Text></View>
        </Marker>)}
        {markerPosition && <Marker.Animated coordinate={markerCoord as unknown as LatLng} tracksViewChanges={false} stopPropagation>
          <View style={s.mapMarker}><Image source={carIcon} resizeMode="contain" style={{ width: 30, height: 39, transform: [{ rotate: `${(((replayPoint?.heading ?? point?.heading ?? 0) + 180) % 360)}deg` }] }} /><View style={s.markerLabel}><View style={[s.labelBar, { backgroundColor: statusColor }]} /><Text style={s.markerLabelText}>{plate}</Text></View></View>
        </Marker.Animated>}
      </MapView> : <View style={[StyleSheet.absoluteFill, s.noMap]}><TablerIcon name="map" size={28} color={theme.muted} /><Text style={s.muted}>No valid location available</Text></View>}
      <SafeAreaView style={s.mapHeader} edges={['top']}><Pressable onPress={() => router.back()} style={s.iconBox} accessibilityLabel="Back"><TablerIcon name="back" size={19} /></Pressable><Text style={s.headerPlate}>{plate}</Text>{canDo('alerts') ? <Pressable onPress={() => setAlertsOpen(true)} style={s.iconBox} accessibilityLabel="Vehicle alerts"><TablerIcon name="bell" size={19} /></Pressable> : <View style={s.iconBox} />}</SafeAreaView>
      {selectedPoint && <View style={s.pointPanel}><View style={s.panelHead}><Text style={s.panelTitle}>History point · PKT</Text><Pressable onPress={() => { addressId.current++; setSelectedPoint(null); }} accessibilityLabel="Close history point"><TablerIcon name="close" size={16} /></Pressable></View><Text style={s.pointText}>{address}</Text><Text style={s.pointText}>{selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)} · {Math.round(selectedPoint.speedKmh)} km/h</Text><Text style={s.pointText}>{PK_DATE.format(new Date(selectedPoint.timestamp))} · {PK_TIME.format(new Date(selectedPoint.timestamp))} PKT</Text></View>}
      {mode === 'replay' && <View style={s.replayPanel}><View style={s.panelHead}><Text style={s.panelTitle}>Trip Replay · {range}</Text><Pressable onPress={closeHistory} accessibilityLabel="Close replay"><TablerIcon name="close" size={17} /></Pressable></View>{historyLoading ? <ActivityIndicator color={theme.red} /> : route.length < 2 ? <Text style={s.muted}>{historyError || 'No history for this period.'}</Text> : <><View style={s.replayControls}><Pressable onPress={() => { if (frame >= route.length - 1) setFrame(0); setPlaying(v => !v); }} accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}><TablerIcon name={playing ? 'pause' : 'play'} color={theme.red} size={25} /></Pressable><Text style={s.replayTime}>{PK_TIME.format(new Date(route[frame]!.timestamp))} PKT</Text><Text style={s.muted}>{frame + 1}/{route.length}</Text></View><View style={s.progressTrack} onLayout={event => { progressWidth.current = event.nativeEvent.layout.width; }} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={event => seek(event.nativeEvent.locationX / progressWidth.current)} onResponderMove={event => seek(event.nativeEvent.locationX / progressWidth.current)}><View style={[s.progressFill, { width: `${(frame / (route.length - 1)) * 100}%` }]} /></View></>}</View>}
    </View>
    <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}><View style={s.handle} /><ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.heading}><View style={{ flex: 1 }}><Text style={s.plate}>{plate}</Text><Text style={s.name}>{displayVehicleName(item.vehicle)}</Text><Text style={[s.status, { color: statusColor }]}>{status[0]!.toUpperCase() + status.slice(1)} · {Math.round(point?.speedKmh ?? 0)} km/h</Text></View><Pressable onPress={() => router.push('/more')} accessibilityLabel="Vehicle options"><TablerIcon name="more" size={19} /></Pressable></View>
      <View style={s.cardRow}><Info label="Ignition" value={point?.ignition === true ? 'On' : point?.ignition === false ? 'Off' : '—'} /><Info label="GPS" value={point?.gpsValid ? `${point.satellites ?? 0} satellites` : 'No signal'} /></View>
      <View style={s.cardRow}><Info label="Battery" value={point?.voltageLevel != null ? `${point.voltageLevel.toFixed(1)} V` : '—'} /><Info label="Last update" value={point ? relativeTime(point.timestamp) : 'No data'} /></View>
      <View style={s.cardRow}><Info label="Stop duration" value={status === 'idle' || status === 'parked' ? duration(stats?.stopDuration) : '—'} /><Info label="Odometer" value={stats ? `${stats.odometer.toFixed(1)} km` : '—'} /></View>
      <View style={s.cardRow}><Info label="Engine hours" value={stats ? `${stats.engineHours.toFixed(1)} h` : '—'} /><View style={{ flex: 1 }} /></View>
      <View style={s.actionRow}><Action name="follow" label={following ? 'Following' : 'Follow'} onPress={() => { setFollowing(v => !v); if (coordinate) mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350); }} /><Action name="replay" label="Replay" onPress={() => void loadHistory('replay', '24h')} /><Action name="report" label="History" onPress={() => void loadHistory('history', '24h')} />{canDo('alerts') && <Action name="bell" label="Alert" onPress={() => setAlertsOpen(true)} />}</View>
      {mode && <View style={s.historySection}><View style={s.panelHead}><Text style={s.panelTitle}>{mode === 'history' ? 'Vehicle History' : 'Trip Replay'}</Text><Pressable onPress={closeHistory}><Text style={s.redText}>Close</Text></Pressable></View><View style={s.rangeRow}>{(['1h', '24h', '7d'] as const).map(option => <Pressable key={option} onPress={() => void loadHistory(mode, option)} style={[s.range, option === range && s.rangeActive]}><Text style={s.rangeText}>{option === '1h' ? 'Last hour' : option === '24h' ? 'Last 24 hours' : 'Last 7 days'}</Text></Pressable>)}</View>{mode === 'history' && <Text style={s.muted}>{historyLoading ? 'Loading route…' : historyError || (route.length ? `${route.length} GPS points · tap a direction arrow for details` : 'No history for this period.')}</Text>}</View>}
      {canDo('engine_cut') && <Pressable onPress={() => setCutOpen(true)} style={s.engineButton}><TablerIcon name="engine" size={17} color={theme.red} /><Text style={s.redText}>{immobilized ? 'Restore Engine' : 'Cut Engine'}</Text></Pressable>}
      <Text style={s.coordinates}>{point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · ${PK_DATE.format(new Date(point.timestamp))} ${PK_TIME.format(new Date(point.timestamp))} PKT` : 'Waiting for vehicle telemetry'}</Text>
    </ScrollView></View>
    <EngineCutDialog visible={cutOpen} imei={item.device.imei} plate={plate} immobilized={immobilized} onClose={() => setCutOpen(false)} onSuccess={value => { lastCommandAt.current = Date.now(); setImmobilized(value); }} />
    <VehicleAlertsPanel visible={alertsOpen && canDo('alerts')} imei={imei} onClose={() => setAlertsOpen(false)} />
  </View>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>; }
function Action({ name, label, onPress }: { name: string; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.action} accessibilityRole="button" accessibilityLabel={label}><TablerIcon name={name} size={19} color={theme.ink} /><Text style={s.actionLabel}>{label}</Text></Pressable>; }
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#fff' }, loading: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { color: theme.secondary, fontSize: 11 }, mapArea: { flex: 1, minHeight: 240 }, mapHeader: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, iconBox: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, headerPlate: { flex: 1, color: theme.ink, fontWeight: '700', fontSize: 14 }, noMap: { backgroundColor: theme.canvas, alignItems: 'center', justifyContent: 'center', gap: 8 }, mapMarker: { alignItems: 'center' }, markerLabel: { backgroundColor: '#fff', flexDirection: 'row', borderRadius: 3, overflow: 'hidden', marginTop: 1 }, labelBar: { width: 3, marginRight: 4 }, markerLabelText: { color: theme.ink, fontSize: 9, fontWeight: '700', paddingVertical: 2, paddingRight: 4 }, arrow: { width: 27, height: 27, backgroundColor: '#fff', borderColor: theme.border, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: '#2563eb', fontSize: 17, lineHeight: 21 }, pointPanel: { position: 'absolute', left: 14, right: 14, bottom: 10, padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 8 }, pointText: { color: theme.secondary, fontSize: 11, marginTop: 3 }, replayPanel: { position: 'absolute', left: 12, right: 12, bottom: 10, padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 8 }, panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, panelTitle: { color: theme.ink, fontSize: 12, fontWeight: '700' }, replayControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 }, replayTime: { color: theme.ink, fontSize: 12, flex: 1 }, progressTrack: { height: 16, borderRadius: 8, backgroundColor: '#f3f4f6', justifyContent: 'center' }, progressFill: { height: 5, backgroundColor: theme.red, borderRadius: 3 }, sheet: { maxHeight: 380, minHeight: 225, backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, marginTop: -10, paddingHorizontal: 16, elevation: 8 }, handle: { height: 3, width: 44, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginTop: 7, marginBottom: 10 }, heading: { flexDirection: 'row', alignItems: 'center' }, plate: { color: theme.ink, fontSize: 19, fontWeight: '700' }, name: { color: theme.ink, fontSize: 12, marginTop: 2 }, status: { fontSize: 12, fontWeight: '700', marginTop: 4 }, cardRow: { flexDirection: 'row', gap: 8, marginTop: 8 }, info: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 }, infoLabel: { color: theme.secondary, fontSize: 10 }, infoValue: { color: theme.ink, fontSize: 12, fontWeight: '600', marginTop: 2 }, actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border }, action: { minWidth: 54, alignItems: 'center', gap: 3 }, actionLabel: { color: theme.secondary, fontSize: 10 }, historySection: { paddingVertical: 11, borderBottomWidth: 1, borderColor: theme.border, gap: 8 }, rangeRow: { flexDirection: 'row', gap: 5 }, range: { paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: theme.border, borderRadius: 6 }, rangeActive: { borderColor: theme.red, backgroundColor: '#fff5f5' }, rangeText: { color: theme.ink, fontSize: 10 }, redText: { color: theme.red, fontSize: 12, fontWeight: '600' }, engineButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 12 }, coordinates: { color: theme.muted, fontSize: 10, textAlign: 'center', paddingBottom: 5 } });
