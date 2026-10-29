import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, Polyline, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFleet } from '../hooks/useFleet';
import { TablerIcon } from './TablerIcon';
import { useTheme } from '../hooks/useTheme';
import type { AppTheme } from '../theme';
import api from '../lib/api';
import { usePortalPermissions } from '../auth/PortalPermissionsProvider';
import carIcon from '../../assets/car-icon.png';
import { canContinueHistorySegment, canEstimateStopAcrossGap, fetchTelemetryHistory, isHistoryDataGap, isUsableHistoryPoint } from '../lib/telemetry-history';

type RouteMode = 'history' | 'replay';
type Point = { latitude: number; longitude: number; timestamp: string; speedKmh: number; heading: number; ignition?: boolean | null; gpsValid: boolean; satellites?: number };
type Period = 'lastHour'|'today'|'24h'|'yesterday'|'lastWeek'|'custom';
type HistoryEvent = { kind: 'Start'|'Driving'|'Idle'|'Parked'|'Gap'|'End'; point: Point; end: Point; duration: number; avgSpeed: number; estimatedGapSec?: number; stopEstimateIncluded?: boolean };
type MapStyle = 'street' | 'satellite' | 'hybrid' | 'terrain';
const PK_TIME = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true });
const PK_DATE = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtInputDate(val: string) {
  const [datePart = '', timePart = ''] = val.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return val;
  return `${String(d).padStart(2,'0')}-${MONTHS[m-1] ?? ''}-${y} ${timePart}`;
}
const valid = isUsableHistoryPoint;
const localInput = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
};
const fromInput = (value: string) => new Date(`${value.trim().replace(' ', 'T')}:00+05:00`);
function dateParts(value: string) { const [d = '', t = '00:00'] = value.split(' '); const [year, month, day] = d.split('-').map(Number); const [hour, minute] = t.split(':').map(Number); return { year: year || 2026, month: month || 1, day: day || 1, hour: hour || 0, minute: minute || 0 }; }
const dateValue = (year: number, month: number, day: number, hour: number, minute: number) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
function presetDates(preset: Exclude<Period, 'custom'>) {
  const now = new Date();
  if (preset === 'lastHour') return { from: localInput(new Date(now.getTime() - 3_600_000)), to: localInput(now) };
  if (preset === '24h') return { from: localInput(new Date(now.getTime() - 86_400_000)), to: localInput(now) };
  const local = dateParts(localInput(now));
  const startToday = fromInput(dateValue(local.year, local.month, local.day, 0, 0));
  if (preset === 'today') return { from: localInput(startToday), to: localInput(now) };
  if (preset === 'yesterday') return { from: localInput(new Date(startToday.getTime() - 86_400_000)), to: localInput(new Date(startToday.getTime() - 60_000)) };
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  const thisMonday = startToday.getTime() - ((weekday + 6) % 7) * 86_400_000;
  return { from: localInput(new Date(thisMonday - 7 * 86_400_000)), to: localInput(new Date(thisMonday - 60_000)) };
}
function buildHistoryEvents(route: Point[]): HistoryEvent[] {
  if (!route.length) return [];
  const events: HistoryEvent[] = [{ kind: 'Start', point: route[0]!, end: route[0]!, duration: 0, avgSpeed: route[0]!.speedKmh }];
  let start = 0;
  const kindAt = (point: Point): 'Driving'|'Idle'|'Parked' => point.speedKmh >= 5 ? 'Driving' : point.ignition === true ? 'Idle' : 'Parked';
  const pushSegment = (endIndex: number, estimatedGapSec?: number) => {
    if (endIndex < start) return;
    const first = route[start]!, last = route[endIndex]!, kind = kindAt(first);
    const slice = route.slice(start, estimatedGapSec ? endIndex : endIndex + 1); const avgSpeed = slice.reduce((sum, p) => sum + p.speedKmh, 0) / Math.max(1, slice.length);
    events.push({ kind, point: first, end: last, duration: Math.max(0, new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000, avgSpeed, estimatedGapSec });
  };
  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1]!, current = route[i]!;
    const gap = isHistoryDataGap(previous, current);
    const segmentType = kindAt(route[start]!) === 'Parked' ? 'parked' : kindAt(route[start]!) === 'Idle' ? 'idle' : 'driving';
    if (gap || kindAt(current) !== kindAt(route[start]!) || !canContinueHistorySegment(previous, current, segmentType)) {
      const gapSeconds = Math.max(0, new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;
      const estimateStop = gap && segmentType !== 'driving' && canEstimateStopAcrossGap(previous, current);
      pushSegment(estimateStop ? i : i - 1, estimateStop ? gapSeconds : undefined);
      if (gap) events.push({ kind: 'Gap', point: previous, end: current, duration: gapSeconds, avgSpeed: 0, stopEstimateIncluded: estimateStop });
      start = i;
    }
  }
  pushSegment(route.length - 1);
  const last = route[route.length - 1]!;
  events.push({ kind: 'End', point: last, end: last, duration: 0, avgSpeed: last.speedKmh });
  return events;
}
const addressCache = new Map<string, string>();

function direction(a: Point, b: Point) {
  const r = Math.PI / 180; const dl = (b.longitude - a.longitude) * r;
  const y = Math.sin(dl) * Math.cos(b.latitude * r);
  const x = Math.cos(a.latitude * r) * Math.sin(b.latitude * r) - Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos(dl);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}
async function reverseAddress(point: Point) {
  const key = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
  if (addressCache.has(key)) return addressCache.get(key)!;
  try {
    const Location = await import('expo-location');
    if (Platform.OS === 'android') {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return 'Address unavailable';
    }
    const result = (await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude }))[0];
    const label = result ? [result.name, result.street, result.district, result.city, result.region].filter(Boolean).filter((part, i, all) => all.indexOf(part) === i).join(', ') : 'Address unavailable';
    addressCache.set(key, label);
    return label;
  } catch { return 'Address unavailable'; }
}

export function VehicleRouteScreen({ mode }: { mode: RouteMode }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const extra = useMemo(() => createExtra(t), [t]);
  const params = useLocalSearchParams<{ imei?: string; preset?: 'lastHour'|'today'|'yesterday' }>();
  const { items } = useFleet();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const [imei, setImei] = useState(params.imei ?? '');
  const item = items.find(entry => entry.device.imei === imei);
  const mapRef = useRef<MapView>(null);
  const marker = useRef(new AnimatedRegion({ latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const loadRef = useRef(0);
  const addressRef = useRef(0);
  const progressWidth = useRef(1);
  const regionRef = useRef<Region>({ latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const [styleOpen, setStyleOpen] = useState(false);
  const initialRange = useRef(presetDates(params.preset ?? 'today')).current;
  const [range, setRange] = useState<Period>(params.preset ?? 'today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const initialPresetParam = useRef(params.preset);
  const [pickerTarget, setPickerTarget] = useState<'from'|'to'|null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Point | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const route = useMemo(() => points.filter(valid), [points]);
  const historyEvents = useMemo(() => buildHistoryEvents(route), [route]);
  const replayGapSeconds = mode === 'replay' && frame > 0 && route[frame] && isHistoryDataGap(route[frame - 1]!, route[frame]!)
    ? Math.round((new Date(route[frame]!.timestamp).getTime() - new Date(route[frame - 1]!.timestamp).getTime()) / 1000)
    : null;
  const track = useMemo(() => {
    const segments: Point[][] = []; const gaps: Array<{ from: Point; to: Point }> = [];
    let start = 0;
    for (let i = 1; i < route.length; i++) if (isHistoryDataGap(route[i - 1]!, route[i]!)) {
      segments.push(route.slice(start, i)); gaps.push({ from: route[i - 1]!, to: route[i]! }); start = i;
    }
    if (route.length) segments.push(route.slice(start));
    return { segments, gaps };
  }, [route]);
  const current = route[Math.min(frame, Math.max(0, route.length - 1))];
  const currentHeading = current && frame > 0 ? direction(route[frame - 1]!, current) : current?.heading ?? 0;
  const plate = item?.vehicle?.licensePlate || (item ? `#${item.vehicle?.displayId ?? item.device.displayId}` : 'Vehicle');
  const directions = useMemo(() => route.flatMap((point, index) => index > 0 && point.speedKmh >= 5 && index % Math.max(1, Math.ceil(route.length / 80)) === 0 ? [{ point, index, heading: direction(route[index - 1]!, point) }] : []), [route]);

  useEffect(() => { setImei(params.imei ?? ''); }, [params.imei]);
  useEffect(() => { if (!permissionsLoading && !canDo('map') && !canDo('vehicles')) router.replace('/map'); }, [canDo, permissionsLoading]);
  const load = useCallback(async (start = from, end = to, currentRange = range) => {
    if (!imei) return;
    const request = ++loadRef.current;
    setLoading(true); setError(''); setPoints([]); setSelected(null); setSelectedEvent(null); setPlaying(false); setFrame(0);
    const startDate = fromInput(start); const endDate = fromInput(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) {
      setError('Enter a valid date and time range.'); setLoading(false); return;
    }
    try {
      const history = await fetchTelemetryHistory<Point>(imei, startDate.toISOString(), endDate.toISOString());
      if (request !== loadRef.current) return;
      const next = history.filter(valid);
      if (!next.length && currentRange === 'today') {
        const yest = presetDates('yesterday');
        setRange('yesterday'); setFrom(yest.from); setTo(yest.to);
        const yHistory = await fetchTelemetryHistory<Point>(imei, fromInput(yest.from).toISOString(), fromInput(yest.to).toISOString());
        if (request !== loadRef.current) return;
        const yNext = yHistory.filter(valid);
        setPoints(yNext);
        if (!yNext.length) setError('No history available for today or yesterday.');
        if (yNext.length > 1) mapRef.current?.fitToCoordinates(yNext.map(p => ({ latitude: p.latitude, longitude: p.longitude })), { edgePadding: { top: 65, right: 45, bottom: 50, left: 45 }, animated: true });
        return;
      }
      setPoints(next);
      if (!next.length) setError('No history is available for this vehicle and period.');
      if (next.length > 1) mapRef.current?.fitToCoordinates(next.map(p => ({ latitude: p.latitude, longitude: p.longitude })), { edgePadding: { top: 65, right: 45, bottom: 50, left: 45 }, animated: true });
    } catch { if (request === loadRef.current) setError('History could not be loaded. Try again.'); }
    finally { if (request === loadRef.current) setLoading(false); }
  }, [imei, from, to, range]);

  useEffect(() => {
    if (!params.preset || initialPresetParam.current === params.preset) return;
    initialPresetParam.current = params.preset;
    const next = presetDates(params.preset);
    setRange(params.preset); setFrom(next.from); setTo(next.to); void load(next.from, next.to);
  }, [params.preset, load]);

  useEffect(() => {
    if (imei && !permissionsLoading && (canDo('map') || canDo('vehicles'))) void load(from, to, range);
    return () => { loadRef.current++; };
    // Date edits only fetch when Load History is pressed; do not trigger a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imei, permissionsLoading, canDo]);
  useEffect(() => () => { addressRef.current++; }, []);
  useEffect(() => {
    if (!playing || mode !== 'replay' || route.length < 2) return;
    const timer = setInterval(() => setFrame(n => Math.min(route.length - 1, n + 1)), Math.max(70, 450 / speed));
    return () => clearInterval(timer);
  }, [playing, mode, route.length, speed]);
  useEffect(() => {
    if (route.length > 1) mapRef.current?.fitToCoordinates(route.map(point => ({ latitude: point.latitude, longitude: point.longitude })), { edgePadding: { top: 58, right: 46, bottom: mode === 'replay' ? 190 : 40, left: 46 }, animated: true });
  }, [imei, route.length, mode]);
  useEffect(() => { if (frame >= route.length - 1) setPlaying(false); }, [frame, route.length]);
  useEffect(() => {
    if (!current) return;
    marker.timing({ toValue: 0, latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0, longitudeDelta: 0, duration: 180, useNativeDriver: false }).start();
    if (following) mapRef.current?.animateToRegion({ latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 240);
  }, [current?.latitude, current?.longitude, following, marker]);
  useEffect(() => { setFrame(0); setSelected(null); setPlaying(false); }, [imei]);

  const speedSegments = useMemo(() => {
    if (route.length < 2) return [];
    const N = Math.min(route.length, 300);
    const step = route.length / N;
    return Array.from({ length: N }, (_, i) => {
      const pt = route[Math.floor(i * step)]!;
      return Math.min(1, pt.speedKmh / 100);
    });
  }, [route]);

  const cycleSpeed = () => {
    const speeds = [0.5, 1, 2, 4, 8];
    setSpeed(prev => speeds[(speeds.indexOf(prev) + 1) % speeds.length]!);
  };

  const setPreset = (next: Period) => {
    if (next === 'custom') return;
    setRange(next);
    const { from: f, to: t } = presetDates(next); setFrom(f); setTo(t); void load(f, t);
  };
  const seek = (fraction: number) => { if (!route.length) return; setPlaying(false); setFrame(Math.max(0, Math.min(route.length - 1, Math.round(fraction * (route.length - 1))))); };
  const jump = (delta: number) => {
    if (!route.length || !current) return;
    const target = new Date(current.timestamp).getTime() + delta * 1000;
    let best = frame; let distance = Infinity;
    route.forEach((point, index) => { const d = Math.abs(new Date(point.timestamp).getTime() - target); if (d < distance) { distance = d; best = index; } });
    setFrame(best); setPlaying(false);
  };
  const choosePoint = (point: Point, event?: HistoryEvent | null) => {
    const addressRequest = ++addressRef.current;
    const chosenEvent = event ?? historyEvents.find(candidate => new Date(point.timestamp).getTime() >= new Date(candidate.point.timestamp).getTime() && new Date(point.timestamp).getTime() <= new Date(candidate.end.timestamp).getTime());
    const addressPoint = chosenEvent?.point ?? point;
    setSelected(point); setSelectedEvent(chosenEvent ?? null); setSelectedAddress('Finding address…');
    void reverseAddress(addressPoint).then(value => { if (addressRequest === addressRef.current) setSelectedAddress(value); });
    mapRef.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 250);
  };
  const zoom = async (factor: number) => {
    if (!current) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      const bounds = await map.getMapBoundaries();
      const region: Region = { latitude: (bounds.northEast.latitude + bounds.southWest.latitude) / 2, longitude: (bounds.northEast.longitude + bounds.southWest.longitude) / 2, latitudeDelta: Math.max(0.0005, Math.min(100, Math.abs(bounds.northEast.latitude - bounds.southWest.latitude) * factor)), longitudeDelta: Math.max(0.0005, Math.min(100, Math.abs(bounds.northEast.longitude - bounds.southWest.longitude) * factor)) };
      regionRef.current = region;
      map.animateToRegion(region, 200);
    } catch {
      const region: Region = { ...regionRef.current, latitudeDelta: Math.max(0.0005, Math.min(100, regionRef.current.latitudeDelta * factor)), longitudeDelta: Math.max(0.0005, Math.min(100, regionRef.current.longitudeDelta * factor)) };
      regionRef.current = region;
      map.animateToRegion(region, 200);
    }
  };
  const allowedStyles: MapStyle[] = Platform.OS === 'ios' ? ['street','satellite','hybrid'] : ['street','satellite','hybrid','terrain'];
  const periodOptions: { id: Period; label: string }[] = [{id:'today',label:'Today'},{id:'yesterday',label:'Yesterday'},{id:'lastWeek',label:'Last Week'}];

  if (permissionsLoading || (!canDo('map') && !canDo('vehicles'))) return <SafeAreaView style={s.screen} edges={['top']}><ActivityIndicator style={{ marginTop: 24 }} color={t.red}/></SafeAreaView>;
  return <SafeAreaView style={s.screen} edges={['top']}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <View style={s.header}>
      <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Back"><TablerIcon name="arrow-left" size={19} color={t.ink} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{mode === 'history' ? 'History' : 'Replay'}</Text>
        {mode === 'history' && <Text style={s.vehicleName}>{plate}</Text>}
      </View>
    </View>
    <View style={s.filters}>
      <View style={extra.segmentTrack}>{periodOptions.map(option => <Pressable key={option.id} onPress={() => setPreset(option.id)} style={[extra.segmentBtn, range === option.id && extra.segmentBtnActive]}><Text style={[extra.segmentText, range === option.id && extra.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>
      <View style={s.dateRow}>
        <Pressable onPress={() => setPickerTarget('from')} style={extra.dateChip}>
          <TablerIcon name="calendar" size={13} color={t.secondary} />
          <Text numberOfLines={1} style={s.dateValue}><Text style={s.dateCaption}>From: </Text>{fmtInputDate(from)}</Text>
        </Pressable>
        <Pressable onPress={() => setPickerTarget('to')} style={extra.dateChip}>
          <TablerIcon name="calendar" size={13} color={t.secondary} />
          <Text numberOfLines={1} style={s.dateValue}><Text style={s.dateCaption}>To: </Text>{fmtInputDate(to)}</Text>
        </Pressable>
        <Pressable style={s.loadButton} onPress={() => void load()} accessibilityLabel="Load history">
          <TablerIcon name="arrow-right" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
    <View style={[s.mapWrap, mode === 'history' && { flex: 1.15 }]}>
      {current ? <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }} mapType={mapStyle === 'street' ? 'none' : mapStyle} showsCompass={false} toolbarEnabled={false} moveOnMarkerPress={false} onRegionChangeComplete={region => { regionRef.current = region; }}>
        {mapStyle === 'street' && <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />}
        {track.segments.map((segment, index) => segment.length > 1 && <Polyline key={`route-${index}`} coordinates={segment.map(point => ({ latitude: point.latitude, longitude: point.longitude }))} strokeColor={t.red} strokeWidth={3} />)}
        {track.gaps.map((gap, index) => <Polyline key={`gap-${index}`} coordinates={[{ latitude: gap.from.latitude, longitude: gap.from.longitude }, { latitude: gap.to.latitude, longitude: gap.to.longitude }]} strokeColor="#6b7280" strokeWidth={3} lineDashPattern={[6, 7]} />)}
        {selectedEvent?.kind === 'Driving' && <Polyline coordinates={route.filter(p => new Date(p.timestamp).getTime() >= new Date(selectedEvent.point.timestamp).getTime() && new Date(p.timestamp).getTime() <= new Date(selectedEvent.end.timestamp).getTime()).map(p => ({latitude:p.latitude,longitude:p.longitude}))} strokeColor="#16a34a" strokeWidth={5} zIndex={3} />}
        {mode === 'history' && directions.map(({ point, index, heading }) => <Marker key={`${imei}-${index}`} coordinate={{ latitude: point.latitude, longitude: point.longitude }} onPress={() => choosePoint(point)} tracksViewChanges={false} stopPropagation><View style={[s.arrow, { transform: [{ rotate: `${heading}deg` }] }]}><Text style={s.arrowText}>▲</Text></View></Marker>)}
        {mode === 'history' && historyEvents.map((event, index) => {
          if (event.kind !== 'Idle' && event.kind !== 'Parked' || event.duration < 60) return null;
          return <Marker key={`${imei}-stop-${index}`} coordinate={{ latitude: event.point.latitude, longitude: event.point.longitude }} onPress={() => choosePoint(event.point,event)} tracksViewChanges={false}><View style={[s.stopMark, event.kind === 'Idle' ? s.idleMark : s.parkedMark]}><Text style={s.timelineLetter}>{event.kind === 'Idle' ? 'I' : 'P'}</Text></View></Marker>;
        })}
        {route.length > 0 && <><Marker coordinate={{ latitude: route[0]!.latitude, longitude: route[0]!.longitude }} zIndex={1000} tracksViewChanges={false}><View style={s.startMarker}><Text style={s.markerLetter}>S</Text></View></Marker><Marker coordinate={{ latitude: route[route.length-1]!.latitude, longitude: route[route.length-1]!.longitude }} zIndex={1000} tracksViewChanges={false}><View style={s.endMarker}><Text style={s.markerLetter}>E</Text></View></Marker></>}
        {current && <Marker.Animated coordinate={marker as unknown as LatLng} tracksViewChanges stopPropagation><View style={extra.replayCar}><Image source={carIcon} resizeMode="contain" style={[s.car, { transform: [{ rotate: `${(currentHeading + 180) % 360}deg` }] }]} /><View style={extra.carSpeedLabel}><Text style={extra.carSpeedText}>{Math.round(current.speedKmh)} km/h</Text></View></View></Marker.Animated>}
      </MapView> : <View style={s.mapEmpty}>{loading ? <ActivityIndicator color={t.red} /> : <TablerIcon name="map" size={25} color={t.muted} />}<Text style={s.muted}>{loading ? 'Loading route…' : error || 'Select a vehicle and load its history.'}</Text></View>}
      <View style={[s.mapControls, { top: 10 + 0 }]}>
        <Pressable onPress={() => setStyleOpen(v => !v)} style={s.mapButton} accessibilityLabel="Map type"><TablerIcon name="layers" size={18} color={t.ink} /></Pressable>
        {styleOpen && <View style={s.mapMenu}>{allowedStyles.map(value => <Pressable key={value} onPress={() => { setMapStyle(value); setStyleOpen(false); }} style={s.mapOption}><Text style={[s.mapOptionText, mapStyle === value && s.activeOption]}>{value[0]!.toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>}
        <Pressable onPress={() => zoom(0.55)} style={s.mapButton} accessibilityLabel="Zoom in"><Text style={s.plus}>+</Text></Pressable>
        <Pressable onPress={() => zoom(1.8)} style={s.mapButton} accessibilityLabel="Zoom out"><Text style={s.minus}>−</Text></Pressable>
        <Pressable onPress={() => { setFollowing(v => !v); if (current) mapRef.current?.animateToRegion({ latitude: current.latitude, longitude: current.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 250); }} style={s.mapButton} accessibilityLabel="Follow location"><TablerIcon name="locate" size={18} color={following ? t.red : t.ink} /></Pressable>
      </View>
      {mode === 'replay' && current && <View style={extra.floatingSpeed} pointerEvents="none">
        <Text style={extra.floatingSpeedVal}>{Math.round(current.speedKmh)}</Text>
        <Text style={extra.floatingSpeedUnit}>km/h</Text>
      </View>}
      {selected && <View style={extra.pointCardAuto}><Pressable style={s.closePoint} onPress={() => {setSelected(null);setSelectedEvent(null);}}><TablerIcon name="x" size={16} color={t.ink}/></Pressable><Text numberOfLines={2} style={[s.pointTitle, extra.addressTitle]}>{selectedEvent?.kind === 'Gap' ? 'GPS data gap' : selectedAddress}</Text>{selectedEvent ? <><Text style={s.muted}>From · {PK_DATE.format(new Date(selectedEvent.point.timestamp))} {PK_TIME.format(new Date(selectedEvent.point.timestamp))} PKT</Text><Text style={s.muted}>To · {PK_DATE.format(new Date(selectedEvent.end.timestamp))} {PK_TIME.format(new Date(selectedEvent.end.timestamp))} PKT</Text></> : <Text style={s.muted}>Time · {PK_DATE.format(new Date(selected.timestamp))} {PK_TIME.format(new Date(selected.timestamp))} PKT</Text>}{selectedEvent?.kind === 'Gap' && <Text style={extra.stopDuration}>No GPS updates · {formatDuration(selectedEvent.duration)}. {selectedEvent.stopEstimateIncluded ? 'Included in estimated stop duration.' : 'Stop duration is unconfirmed.'}</Text>}{selectedEvent && (selectedEvent.kind === 'Parked' || selectedEvent.kind === 'Idle') && <Text style={extra.stopDuration}>Stop duration · {selectedEvent.estimatedGapSec ? '~' : ''}{formatDuration(selectedEvent.duration)}{selectedEvent.estimatedGapSec ? ` (includes ${formatDuration(selectedEvent.estimatedGapSec)} GPS gap)` : ''}</Text>}{selectedEvent?.kind !== 'Gap' && <Text style={s.muted}>{Math.round(selectedEvent?.kind === 'Driving' ? selectedEvent.avgSpeed : selected.speedKmh)} km/h · Ignition {selectedEvent?.kind === 'Driving' || selected.speedKmh >= 5 ? 'On' : selected.ignition === true ? 'On' : selected.ignition === false ? 'Off' : '—'}</Text>}</View>}
    </View>
    {mode === 'replay' ? <View style={s.replayPanel}>
      {/* Header row */}
      <View style={s.replayHeading}>
        <View style={{ flex: 1 }}>
          <Text style={s.replayPlate}>{plate}</Text>
          <Text style={s.replayTime}>{current ? `${PK_TIME.format(new Date(current.timestamp))} → ${route.length ? PK_TIME.format(new Date(route[route.length - 1]!.timestamp)) : '--:--'}` : 'No replay data'}</Text>
        </View>
        <View style={s.replayStatRow}>
          <View style={s.replayStat}><Text style={[s.replayStatVal, { color: (current?.speedKmh ?? 0) >= 5 || current?.ignition === true ? t.moving : t.secondary }]}>{(current?.speedKmh ?? 0) >= 5 || current?.ignition === true ? 'On' : current?.ignition === false ? 'Off' : '—'}</Text><Text style={s.replayStatLbl}>Ignition</Text></View>
        </View>
      </View>
      {/* Scrubber */}
      <View style={s.seekHitArea} onLayout={e => { progressWidth.current = e.nativeEvent.layout.width; }} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false} onResponderGrant={e => seek(e.nativeEvent.locationX / progressWidth.current)} onResponderMove={e => seek(e.nativeEvent.locationX / progressWidth.current)}>
        {/* Waveform bars */}
        {speedSegments.length > 0 && <View style={s.waveformWrap} pointerEvents="none">
          {speedSegments.map((ratio, i) => <View key={i} style={[s.waveBar, { height: Math.max(2, Math.round(ratio * 16)), opacity: 0.2 + ratio * 0.75 }]} />)}
        </View>}
        {/* Played overlay on waveform */}
        {speedSegments.length > 0 && route.length > 1 && <View style={[s.waveformPlayed, { width: `${(frame / (route.length - 1)) * 100}%` }]} pointerEvents="none" />}
        {/* Base track (shown when no waveform) */}
        {speedSegments.length === 0 && <View style={s.seekTrack}><View style={[s.seekFill, { width: `${route.length > 1 ? (frame / (route.length - 1)) * 100 : 0}%` }]} /></View>}
        <View style={[s.seekThumb, speedSegments.length > 0 ? { bottom: 10 } : {}, { left: `${route.length > 1 ? (frame / (route.length - 1)) * 100 : 0}%` }]} />
      </View>
      {/* Controls */}
      <View style={extra.controlsWrap}>
        <View style={s.playControls}>
          <Pressable style={s.mediaButton} onPress={() => jump(-60)} accessibilityLabel="Back 1 min"><TablerIcon name="rewind" size={22} color={t.secondary} /></Pressable>
          <Pressable style={s.mediaButton} onPress={() => setFrame(n => Math.max(0, n - 1))} accessibilityLabel="Previous point"><TablerIcon name="track-back" size={22} color={t.ink} /></Pressable>
          <Pressable style={s.playButton} onPress={() => { if (frame >= route.length - 1) setFrame(0); setPlaying(v => !v); }} accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}>
            <TablerIcon name={playing ? 'pause' : 'play'} size={26} color="#fff" />
          </Pressable>
          <Pressable style={s.mediaButton} onPress={() => setFrame(n => Math.min(route.length - 1, n + 1))} accessibilityLabel="Next point"><TablerIcon name="track-forward" size={22} color={t.ink} /></Pressable>
          <Pressable style={s.mediaButton} onPress={() => jump(60)} accessibilityLabel="Forward 1 min"><TablerIcon name="fast-forward" size={22} color={t.secondary} /></Pressable>
        </View>
        <View style={extra.speedWrap}>
          <Pressable style={extra.speedChoiceWide} onPress={cycleSpeed} accessibilityLabel="Replay speed">
            <Text style={s.speedText}>{speed}×</Text>
          </Pressable>
        </View>
      </View>
      {replayGapSeconds != null && <Text style={extra.gapNotice}>GPS gap · No updates for {formatDuration(replayGapSeconds)}</Text>}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View> : <View style={s.historyList}>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!loading && historyEvents.length > 0 && (() => {
        const driving = historyEvents.filter(e => e.kind === 'Driving');
        const totalDist = Math.round(driving.reduce((sum, e) => sum + e.avgSpeed * e.duration / 3600, 0));
        const totalDur = historyEvents.filter(e => e.kind !== 'Start' && e.kind !== 'End' && e.kind !== 'Gap').reduce((sum, e) => sum + e.duration, 0);
        const maxSpd = Math.round(Math.max(0, ...historyEvents.map(e => e.avgSpeed)));
        return (
          <View style={extra.histSummary}>
            <View style={extra.histStat}><Text style={extra.histStatVal}>{totalDist}</Text><Text style={extra.histStatLbl}>km</Text></View>
            <View style={extra.histDivider} />
            <View style={extra.histStat}><Text style={extra.histStatVal}>{formatDuration(totalDur)}</Text><Text style={extra.histStatLbl}>duration</Text></View>
            <View style={extra.histDivider} />
            <View style={extra.histStat}><Text style={extra.histStatVal}>{maxSpd}</Text><Text style={extra.histStatLbl}>max km/h</Text></View>
          </View>
        );
      })()}
      <FlatRoute events={historyEvents} onPress={(point,event) => choosePoint(point,event)} selectedEvent={selectedEvent} loading={loading} />
    </View>}
    <DateTimePickerModal value={pickerTarget === 'from' ? from : to} visible={pickerTarget !== null} onClose={() => setPickerTarget(null)} onApply={value => { if (pickerTarget === 'from') setFrom(value); else setTo(value); setRange('custom'); setPickerTarget(null); }} />
  </SafeAreaView>;
}

function FlatRoute({ events, onPress, selectedEvent, loading }: { events: HistoryEvent[]; onPress: (point: Point, event: HistoryEvent) => void; selectedEvent: HistoryEvent | null; loading: boolean }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const extra = useMemo(() => createExtra(t), [t]);
  if (loading) return <ActivityIndicator style={{ margin: 15 }} color={t.red} />;
  if (!events.length) return null;
  const kindIcon: Record<string, string> = { Start: 'flag', End: 'flag-off', Driving: 'chevron-right', Idle: 'pause', Parked: 'map-pin', Gap: 'alert-triangle' };
  const kindColor: Record<string, string> = { Start: '#16a34a', End: '#dc2626', Driving: t.red, Idle: '#f59e0b', Parked: t.secondary, Gap: '#6b7280' };
  const renderEvent = ({ item: event }: { item: HistoryEvent }) => {
    const isSelected = selectedEvent?.point.timestamp === event.point.timestamp;
    const color = kindColor[event.kind] ?? t.secondary;
    const icon = kindIcon[event.kind] ?? 'circle';
    const timeStr = `${PK_TIME.format(new Date(event.point.timestamp))}${event.kind !== 'Start' && event.kind !== 'End' ? ` – ${PK_TIME.format(new Date(event.end.timestamp))}` : ''}`;
    const meta = event.kind === 'Gap' ? `No GPS · ${formatDuration(event.duration)}` : event.kind === 'Start' || event.kind === 'End' ? '' : `${event.estimatedGapSec ? '~' : ''}${formatDuration(event.duration)} · ${Math.round(event.avgSpeed)} km/h`;
    const dist = event.kind === 'Driving' ? Math.round(event.avgSpeed * event.duration / 3600) : null;
    return (
      <Pressable onPress={() => onPress(event.point, event)} style={[s.historyRow, isSelected && { backgroundColor: `${color}0d`, borderLeftColor: color }]}>
        <View style={[s.timelineBadge, { backgroundColor: `${color}20` }]}>
          <TablerIcon name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.historyKind, { color: t.ink }]}>{event.kind === 'Gap' ? 'GPS gap' : event.kind}</Text>
            {dist != null && <Text style={[s.historyMeta, { color: color, fontWeight: '600' }]}>{dist} km</Text>}
          </View>
          <Text style={[s.historyTime, { color: t.secondary }]}>{timeStr}</Text>
          {meta ? <Text style={[s.historyMeta, { color: t.muted ?? t.secondary }]}>{meta}</Text> : null}
        </View>
        {event.kind !== 'Start' && event.kind !== 'End' && (
          <Text style={[s.historyTime, { color: t.secondary, fontVariant: ['tabular-nums'], textAlign: 'right' }]}>{formatDuration(event.duration)}</Text>
        )}
      </Pressable>
    );
  };
  return <FlatList data={events} keyExtractor={(event, index) => `${event.kind}-${event.point.timestamp}-${index}`} renderItem={renderEvent} initialNumToRender={14} maxToRenderPerBatch={18} windowSize={7} contentContainerStyle={{ paddingBottom: 10 }} />;
}

function formatDuration(totalSeconds: number) { const total = Math.max(0, Math.floor(totalSeconds)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m`; }

function DateTimePickerModal({ value, visible, onClose, onApply }: { value: string; visible: boolean; onClose: () => void; onApply: (value: string) => void }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const extra = useMemo(() => createExtra(t), [t]);
  const initial = dateParts(value);
  const [draft, setDraft] = useState(initial);
  const [month, setMonth] = useState({ year: initial.year, month: initial.month });
  useEffect(() => { if (visible) { const next = dateParts(value); setDraft(next); setMonth({ year: next.year, month: next.month }); } }, [visible, value]);
  const firstWeekday = (new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const changeMonth = (delta: number) => { const d = new Date(Date.UTC(month.year, month.month - 1 + delta, 1)); setMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }); };
  const changeMinute = (delta: number) => { const date = fromInput(dateValue(draft.year,draft.month,draft.day,draft.hour,draft.minute)); date.setTime(date.getTime() + delta * 60_000); setDraft(dateParts(localInput(date))); };
  const changeHour12 = (delta: number) => { const isPm = draft.hour >= 12; const current = draft.hour % 12 || 12; const next = ((current - 1 + delta + 12) % 12) + 1; setDraft(v => ({...v,hour:(next%12)+(isPm?12:0)})); };
  const toggleMeridiem = () => setDraft(v => ({...v,hour:v.hour>=12?v.hour-12:v.hour+12}));
  const hour12 = draft.hour % 12 || 12;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.pickerScrim}><View style={s.pickerCard}>
    <View style={s.pickerHeader}><Pressable onPress={() => changeMonth(-1)} style={s.pickerArrow}><TablerIcon name="chevron-left" size={17} color={t.ink}/></Pressable><Text style={s.pickerTitle}>{new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(month.year,month.month-1,1)))}</Text><Pressable onPress={() => changeMonth(1)} style={s.pickerArrow}><TablerIcon name="chevron-right" size={17} color={t.ink}/></Pressable></View>
    <View style={s.calendarGrid}>{['M','T','W','T','F','S','S'].map((d,i)=><Text key={`${d}-${i}`} style={s.calendarWeekday}>{d}</Text>)}{Array.from({length:firstWeekday},(_,i)=><View key={`blank-${i}`} style={s.calendarDay}/>)}{Array.from({length:daysInMonth},(_,i)=>{const day=i+1;const active=draft.year===month.year&&draft.month===month.month&&draft.day===day;return <Pressable key={day} onPress={()=>setDraft(v=>({...v,year:month.year,month:month.month,day}))} style={[s.calendarDay,active&&s.calendarDayActive]}><Text style={[s.calendarDayText,active&&s.calendarDayTextActive]}>{day}</Text></Pressable>;})}</View>
    <View style={s.timePicker}><Text style={s.timeLabel}>Time (PKT)</Text><View style={s.timeUnit}><Pressable onPress={()=>changeHour12(1)} style={s.timeStep}><Text style={s.timeStepText}>+</Text></Pressable><Text style={s.timeNumber}>{String(hour12).padStart(2,'0')}</Text><Pressable onPress={()=>changeHour12(-1)} style={s.timeStep}><Text style={s.timeStepText}>−</Text></Pressable></View><Text style={s.timeColon}>:</Text><View style={s.timeUnit}><Pressable onPress={()=>changeMinute(5)} style={s.timeStep}><Text style={s.timeStepText}>+</Text></Pressable><Text style={s.timeNumber}>{String(draft.minute).padStart(2,'0')}</Text><Pressable onPress={()=>changeMinute(-5)} style={s.timeStep}><Text style={s.timeStepText}>−</Text></Pressable></View><Pressable onPress={toggleMeridiem} style={extra.meridiem}><Text style={extra.meridiemText}>{draft.hour>=12?'PM':'AM'}</Text></Pressable></View>
    <View style={s.pickerActions}><Pressable onPress={onClose} style={s.pickerCancel}><Text style={s.pickerCancelText}>Cancel</Text></Pressable><Pressable onPress={()=>onApply(dateValue(draft.year,draft.month,draft.day,draft.hour,draft.minute))} style={s.pickerApply}><Text style={s.pickerApplyText}>Apply</Text></Pressable></View>
  </View></View></Modal>;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  header: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: t.ink, fontWeight: '700', fontSize: 15 },
  vehicleName: { color: t.secondary, fontSize: 11, marginTop: 1 },
  filters: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 8 },
  periodChoices: { flexDirection: 'row', gap: 6 },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateCaption: { color: t.secondary, fontSize: 10, fontWeight: '500' },
  dateValue: { flex: 1, color: t.ink, fontSize: 11, fontWeight: '600' },
  rangeButton: { flex: 1, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 8, borderRadius: 9, backgroundColor: t.bg2, borderWidth: 1, borderColor: 'transparent' },
  rangeSelected: { backgroundColor: `${t.red}18`, borderColor: t.red },
  rangeText: { fontSize: 11, color: t.secondary },
  rangeTextSelected: { color: t.red, fontWeight: '700' },
  loadButton: { width: 40, height: 40, backgroundColor: t.red, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  loadText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  mapWrap: { flex: 1, minHeight: 190, backgroundColor: t.canvas },
  mapEmpty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 18 },
  muted: { color: t.secondary, fontSize: 10 },
  mapControls: { position: 'absolute', right: 10, top: 10, alignItems: 'center', gap: 5 },
  mapButton: { height: 37, width: 37, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  plus: { color: t.red, fontSize: 24, lineHeight: 27 },
  minus: { color: t.ink, fontSize: 24, lineHeight: 27 },
  mapMenu: { position: 'absolute', right: 43, top: 0, width: 110, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 7, elevation: 5, zIndex: 5 },
  mapOption: { padding: 10, borderBottomWidth: 1, borderColor: t.border },
  mapOptionText: { color: t.ink, fontSize: 11 },
  activeOption: { color: t.red, fontWeight: '700' },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: '#2563eb', fontSize: 17, lineHeight: 20 },
  car: { width: 29, height: 38 },
  stopMark: { width: 23, height: 23, borderRadius: 12, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  idleMark: { backgroundColor: '#f59e0b' },
  parkedMark: { backgroundColor: t.ink },
  startMarker: { width: 22, height: 22, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  endMarker: { width: 22, height: 22, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  markerLetter: { color: '#fff', fontWeight: '700', fontSize: 9 },
  pointCard: { position: 'absolute', left: 10, right: 54, bottom: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 7, padding: 10, elevation: 3 },
  closePoint: { position: 'absolute', right: 7, top: 7, zIndex: 2 },
  pointTitle: { color: t.ink, fontSize: 11, fontWeight: '700', paddingRight: 22, marginBottom: 3 },
  // Replay panel
  replayPanel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderTopWidth: 1, borderColor: t.border, backgroundColor: t.card },
  replayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  replayPlate: { color: t.ink, fontSize: 15, fontWeight: '700' },
  replayTime: { color: t.secondary, fontSize: 11, marginTop: 2 },
  replayStatRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  replayStat: { alignItems: 'center' },
  replayStatVal: { color: t.ink, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  replayStatLbl: { color: t.secondary, fontSize: 9, marginTop: 1 },
  replayStatDivider: { width: 1, height: 28 },
  seekHitArea: { height: 34, justifyContent: 'flex-end', paddingHorizontal: 2, marginBottom: 2, position: 'relative' },
  seekTrack: { height: 4, justifyContent: 'center', backgroundColor: t.bg2, borderRadius: 3 },
  seekFill: { height: 4, backgroundColor: t.red, borderRadius: 3 },
  seekThumb: { position: 'absolute', bottom: -6, width: 18, height: 18, marginLeft: -9, borderRadius: 9, borderWidth: 2.5, borderColor: '#fff', backgroundColor: t.red, elevation: 4 },
  waveformWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 18, gap: 1, overflow: 'hidden', borderRadius: 2, marginBottom: 4 },
  waveBar: { flex: 1, borderRadius: 1, backgroundColor: t.red },
  waveformPlayed: { position: 'absolute', left: 0, bottom: 4, height: 18, borderRadius: 2, backgroundColor: `${t.red}55` },
  playControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, paddingVertical: 10, paddingHorizontal: 56 },
  mediaButton: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  speedText: { color: t.secondary, fontSize: 13, fontWeight: '700' },
  speedOption: { paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  error: { color: t.red, fontSize: 10, paddingTop: 4 },
  // History list
  historyList: { flex: 1, borderTopWidth: 1, borderColor: t.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, gap: 11, borderBottomWidth: 1, borderBottomColor: t.border, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  timelineBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historyKind: { fontSize: 13, fontWeight: '700' },
  historyTime: { fontSize: 11, marginTop: 2 },
  historyMeta: { fontSize: 10, marginTop: 1 },
  timelineMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
  timelineStart: { backgroundColor: '#16a34a' },
  timelineEnd: { backgroundColor: '#dc2626' },
  timelineIdle: { backgroundColor: '#f59e0b' },
  timelineParked: { backgroundColor: '#6b7280' },
  timelineDriving: { backgroundColor: t.red },
  timelineLetter: { color: '#fff', fontWeight: '700', fontSize: 10 },
  replayOptions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentSpeed: { color: t.secondary, fontSize: 9, flex: 1 },
  pickerScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', padding: 22 },
  pickerCard: { backgroundColor: t.card, borderRadius: 14, padding: 16, elevation: 8 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerArrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: t.ink },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 7, color: t.secondary, fontSize: 10, fontWeight: '700' },
  calendarDay: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  calendarDayActive: { backgroundColor: t.red },
  calendarDayText: { fontSize: 12, color: t.ink },
  calendarDayTextActive: { color: '#fff', fontWeight: '700' },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, borderTopWidth: 1, borderColor: t.border, marginTop: 10, paddingTop: 8 },
  timeLabel: { position: 'absolute', left: 0, top: 8, color: t.secondary, fontSize: 10 },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeStep: { width: 38, height: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderRadius: 6 },
  timeStepText: { fontSize: 16, color: t.ink },
  timeNumber: { fontSize: 16, color: t.ink, fontWeight: '700' },
  timeColon: { fontSize: 18, fontWeight: '700' },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  pickerCancel: { paddingHorizontal: 15, paddingVertical: 10 },
  pickerCancelText: { color: t.secondary, fontSize: 12 },
  pickerApply: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: t.red, borderRadius: 8 },
  pickerApplyText: { color: '#fff', fontWeight: '700', fontSize: 12 },
}); }

function createExtra(t: AppTheme) { return StyleSheet.create({
  segmentTrack:{flexDirection:'row',backgroundColor:t.bg2,borderRadius:10,padding:3,gap:2},
  segmentBtn:{flex:1,alignItems:'center',paddingVertical:7,borderRadius:8},
  segmentBtnActive:{backgroundColor:t.card,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.08,shadowRadius:2,elevation:2},
  segmentText:{fontSize:12,color:t.secondary,fontWeight:'500'},
  segmentTextActive:{color:t.red,fontWeight:'700'},
  dateChip:{flex:1,minWidth:0,height:40,flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:t.border,borderRadius:10,paddingHorizontal:10,backgroundColor:t.card,overflow:'hidden'},
  controlsWrap:{position:'relative'},
  speedWrap:{position:'absolute',right:0,bottom:0,top:0,justifyContent:'center',zIndex:10},
  speedChoiceWide:{height:52,minWidth:48,borderWidth:0,borderRadius:9,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingHorizontal:8,backgroundColor:'transparent'},
  replayCar:{alignItems:'center'},carSpeedLabel:{backgroundColor:t.card,paddingHorizontal:5,paddingVertical:2,borderRadius:4,borderWidth:1,borderColor:t.border,elevation:2,marginTop:-1},carSpeedText:{color:t.ink,fontSize:9,fontWeight:'700'},
  pointCardAuto:{position:'absolute',alignSelf:'center',maxWidth:'92%',minWidth:'70%',bottom:10,backgroundColor:t.card,borderWidth:1,borderColor:t.border,borderRadius:8,padding:12,elevation:3},addressTitle:{marginBottom:5},stopDuration:{fontSize:11,color:t.red,fontWeight:'700',marginTop:5},
  historyRowSelected:{backgroundColor:t.surface,borderLeftWidth:3,borderLeftColor:t.red},timelineDrivingGreen:{backgroundColor:'#16a34a'},timelineParkedTheme:{backgroundColor:t.ink},timelineGap:{backgroundColor:'#6b7280'},gapNotice:{marginHorizontal:14,marginBottom:6,padding:8,borderLeftWidth:3,borderLeftColor:'#6b7280',backgroundColor:t.surface,color:t.secondary,fontSize:11},
  histSummary:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:16,backgroundColor:t.bg2,borderBottomWidth:1,borderBottomColor:t.border},
  histStat:{flex:1,alignItems:'center'},
  histStatVal:{fontSize:16,fontWeight:'800',color:t.ink,fontVariant:['tabular-nums']},
  histStatLbl:{fontSize:10,color:t.secondary,marginTop:1},
  histDivider:{width:1,height:28,backgroundColor:t.border},
  floatingSpeed:{position:'absolute',left:10,bottom:10,width:76,height:76,borderRadius:38,backgroundColor:t.card,alignItems:'center',justifyContent:'center',elevation:5,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.16,shadowRadius:6,borderWidth:2,borderColor:t.border},
  floatingSpeedVal:{color:t.ink,fontSize:24,fontWeight:'800',fontVariant:['tabular-nums'],lineHeight:26},
  floatingSpeedUnit:{color:t.secondary,fontSize:10,fontWeight:'600',marginTop:2},
  meridiem:{paddingHorizontal:10,paddingVertical:8,backgroundColor:t.surface,borderRadius:6},meridiemText:{fontSize:12,fontWeight:'700',color:t.ink},
}); }
