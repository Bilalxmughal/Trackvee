import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useFleet, displayVehicleName, getFleetStatus } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { useTheme } from '../../src/hooks/useTheme';
import type { AppTheme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';
import carIcon from '../../assets/car-icon.png';

type Stats = { stopDuration: number | null; odometer: number; engineHours: number };
type MapStyle = 'street' | 'satellite' | 'hybrid' | 'terrain';

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
};
const duration = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function VehicleDetailScreen() {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { imei, follow } = useLocalSearchParams<{ imei: string; follow?: string }>();
  const { items, loading } = useFleet();
  const { canDo, loading: permsLoading } = usePortalPermissions();
  const map = useRef<MapView>(null);
  const animated = useRef(new AnimatedRegion({ latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const initialized = useRef(false);
  const lastCut = useRef(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cutOpen, setCutOpen] = useState(false);
  const [immobilized, setImmobilized] = useState(false);
  const [following, setFollowing] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const [styleOpen, setStyleOpen] = useState(false);

  const item = items.find(entry => entry.device.imei === imei);
  const point = item?.point ?? null;
  const validPoint = point?.gpsValid && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
  const status = getFleetStatus(point);
  const statusColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: '#e21d48' };
  const statusColor = statusColors[status] ?? '#e21d48';
  const plate = item?.vehicle?.licensePlate || (item ? `#${item.vehicle?.displayId ?? item.device.displayId}` : 'Vehicle');
  const vehicleName = item ? displayVehicleName(item.vehicle) : '';
  const speedKmh = Math.round(point?.speedKmh ?? 0);
  const ignitionResolved = speedKmh >= 5 ? true : (point?.ignition ?? null);
  const ignitionText = ignitionResolved === true ? 'On' : ignitionResolved === false ? 'Off' : '—';
  const ignitionColor = ignitionResolved === true ? '#16a34a' : ignitionResolved === false ? '#e21d48' : t.secondary;
  const updatedAgo = point ? relativeTime(point.timestamp) : '—';

  useEffect(() => { initialized.current = false; setStats(null); setFollowing(follow === '1'); }, [imei, follow]);
  useEffect(() => {
    if (point?.immobilizer != null && new Date(point.timestamp).getTime() > lastCut.current)
      setImmobilized(point.immobilizer);
  }, [point?.immobilizer, point?.timestamp]);
  useEffect(() => {
    if (!imei) return;
    let active = true;
    const getStats = async () => {
      try { const result = await api.get<Stats>(`/telemetry/${encodeURIComponent(imei)}/stats`); if (active) setStats(result.data); }
      catch { if (active) setStats(null); }
    };
    void getStats();
    const timer = setInterval(() => void getStats(), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [imei]);
  useEffect(() => {
    if (!validPoint || !point) return;
    const coordinate = { latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 };
    if (!initialized.current) { animated.setValue(coordinate); initialized.current = true; }
    else animated.timing({ toValue: 0, ...coordinate, duration: 1800, useNativeDriver: false }).start();
    if (following) map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 240);
  }, [validPoint, point?.latitude, point?.longitude, following, animated]);
  useEffect(() => {
    if (!permsLoading && !canDo('map') && !canDo('vehicles')) router.replace('/map');
  }, [canDo, permsLoading]);

  if (permsLoading || (loading && !item)) return (
    <View style={s.center}>
      <ActivityIndicator color={t.red} />
      <Text style={s.secondaryText}>Loading vehicle…</Text>
    </View>
  );
  if (!item) return (
    <SafeAreaView style={s.center} edges={['top']}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back"><TablerIcon name="back" color={t.ink} /></Pressable>
      <Text style={s.secondaryText}>Vehicle not found</Text>
    </SafeAreaView>
  );

  const mapTypes: MapStyle[] = Platform.OS === 'ios' ? ['street', 'satellite', 'hybrid'] : ['street', 'satellite', 'hybrid', 'terrain'];
  const zoom = (factor: number) => {
    if (!point || !validPoint) return;
    const next: Region = { latitude: point.latitude, longitude: point.longitude, latitudeDelta: Math.max(0.0005, Math.min(100, 0.025 * factor)), longitudeDelta: Math.max(0.0005, Math.min(100, 0.025 * factor)) };
    map.current?.animateToRegion(next, 220);
  };
  const centerVehicle = () => {
    if (point && validPoint) map.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 280);
  };
  const openCoordinates = () => {
    if (point && validPoint) void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`);
  };

  // Speedometer math
  const sw = Dimensions.get('window').width - 32;
  const sh = sw * 0.30 + 28;
  const maxSpeed = 200;
  const pct = Math.min(speedKmh / maxSpeed, 1);
  const VW = 390; const VH = Math.round(VW * 0.30) + 28;
  const R = 76; const CX = VW / 2; const CY = VH - 24;
  const arcLen = Math.PI * R;
  const dashOffset = arcLen - pct * arcLen;
  const needleRad = (180 + pct * 180) * Math.PI / 180;
  const nx = CX + (R - 14) * Math.cos(needleRad);
  const ny = CY + (R - 14) * Math.sin(needleRad);
  const speedArcColor = speedKmh < 60 ? '#16a34a' : speedKmh < 100 ? '#f59e0b' : '#e21d48';
  const pt = (sp: number, r: number) => { const a = (180 + (sp / maxSpeed) * 180) * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; };
  const anchor = (sp: number): 'middle' | 'start' | 'end' => { const c = Math.cos((180 + (sp / maxSpeed) * 180) * Math.PI / 180); return c < -0.25 ? 'end' : c > 0.25 ? 'start' : 'middle'; };
  const majorSpeeds = [0, 40, 80, 120, 160, 200];
  const minorSpeeds = [20, 60, 100, 140, 180];

  const statusIcons: Record<string, string> = { moving: 'arrow-right', idle: 'pause', parked: 'map-pin', offline: 'power' };

  return (
    <View style={s.screen}>
      {/* Map */}
      <View style={s.mapArea}>
        {validPoint && point
          ? <MapView ref={map} style={StyleSheet.absoluteFill}
              initialRegion={{ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
              mapType={mapStyle === 'street' ? 'none' : mapStyle}
              showsCompass={false} toolbarEnabled={false} moveOnMarkerPress={false}>
              {mapStyle === 'street' && <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />}
              <Marker.Animated coordinate={animated as unknown as LatLng} tracksViewChanges={false} stopPropagation>
                <View style={s.marker}>
                  <Image source={carIcon} resizeMode="contain" style={[s.car, { transform: [{ rotate: `${((point.heading ?? 0) + 180) % 360}deg` }] }]} />
                  <View style={s.plateTag}><View style={[s.statusBar, { backgroundColor: statusColor }]} /><Text style={s.plateTagText}>{plate}</Text></View>
                </View>
              </Marker.Animated>
            </MapView>
          : <View style={s.noLocation}><TablerIcon name="map" size={28} color={t.muted} /><Text style={s.secondaryText}>No valid location</Text></View>}

        {/* Top bar */}
        <SafeAreaView edges={['top']} style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.topButton} accessibilityLabel="Back">
            <TablerIcon name="back" size={20} color={t.ink} />
          </Pressable>
          <View style={{ flex: 1 }} />
          {canDo('alerts')
            ? <Pressable onPress={() => router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } })} style={s.topButton} accessibilityLabel="Alerts">
                <TablerIcon name="bell" size={19} color={t.ink} />
              </Pressable>
            : <View style={s.topButton} />}
        </SafeAreaView>

        {/* Map controls */}
        <View style={[s.mapControls, { top: insets.top + 54 }]}>
          <Pressable onPress={() => setStyleOpen(v => !v)} style={s.mapButton} accessibilityLabel="Map type"><TablerIcon name="layers" size={18} color={t.ink} /></Pressable>
          {styleOpen && (
            <View style={s.mapMenu}>
              {mapTypes.map(type => (
                <Pressable key={type} onPress={() => { setMapStyle(type); setStyleOpen(false); }} style={s.mapOption}>
                  <Text style={[s.mapOptionText, mapStyle === type && s.activeMapOption]}>{type[0]!.toUpperCase() + type.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable onPress={() => zoom(0.55)} style={s.mapButton} accessibilityLabel="Zoom in"><Text style={s.zoomPlus}>+</Text></Pressable>
          <Pressable onPress={() => zoom(1.8)} style={s.mapButton} accessibilityLabel="Zoom out"><Text style={s.zoomMinus}>−</Text></Pressable>
          <Pressable onPress={centerVehicle} style={s.mapButton} accessibilityLabel="Center vehicle"><TablerIcon name="locate" size={18} color={following ? t.red : t.ink} /></Pressable>
        </View>
      </View>

      {/* Bottom card */}
      <View style={[s.card, { paddingBottom: insets.bottom > 0 ? insets.bottom : 0 }]}>
        <View style={s.cardHandle} />

        {/* Header */}
        <View style={s.cardHeader}>
          <View style={s.cardTitleWrap}>
            <Text style={[s.cardPlate, { color: t.ink }]}>{plate}</Text>
            <Text style={[s.cardName, { color: t.secondary }]} numberOfLines={1}>{vehicleName}</Text>
          </View>
          <TablerIcon name={statusIcons[status] ?? 'power'} size={20} color={statusColor} strokeWidth={2.2} />
          {canDo('engine_cut') && (
            <Pressable onPress={() => setCutOpen(true)} style={s.engineBtn} accessibilityLabel={immobilized ? 'Restore engine' : 'Cut engine'}>
              <TablerIcon name="engine" size={18} color={t.red} />
            </Pressable>
          )}
        </View>

        {/* Speedometer */}
        <View style={s.speedoWrap}>
          <Svg width={sw} height={sh} viewBox={`0 0 ${VW} ${VH}`}>
            <Path d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`} fill="none" stroke={t.bg2} strokeWidth="10" strokeLinecap="butt" />
            {(() => { const sp = 150; const a = (180 + (sp / maxSpeed) * 180) * Math.PI / 180; const sx = CX + R * Math.cos(a); const sy = CY + R * Math.sin(a); return <Path d={`M ${sx},${sy} A ${R},${R} 0 0,1 ${CX + R},${CY}`} fill="none" stroke="#e21d4820" strokeWidth="10" strokeLinecap="butt" />; })()}
            <Path d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`} fill="none" stroke={speedArcColor} strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${arcLen} ${arcLen}`} strokeDashoffset={dashOffset} />
            {minorSpeeds.map(sp => { const o = pt(sp, R + 2); const i = pt(sp, R - 7); return <Path key={sp} d={`M ${o.x},${o.y} L ${i.x},${i.y}`} stroke={t.secondary} strokeWidth="1" strokeLinecap="round" />; })}
            {majorSpeeds.map(sp => { const o = pt(sp, R + 2); const i = pt(sp, R - 11); return <Path key={sp} d={`M ${o.x},${o.y} L ${i.x},${i.y}`} stroke={t.ink} strokeWidth="1.5" strokeLinecap="round" />; })}
            {majorSpeeds.map(sp => { const p = pt(sp, R + 18); const dy = anchor(sp) === 'middle' ? 0 : 3; return <SvgText key={sp} x={p.x} y={p.y + dy} textAnchor={anchor(sp)} fontSize="10" fill={t.secondary} fontWeight="500">{sp}</SvgText>; })}
            <Path d={`M ${CX},${CY} L ${nx},${ny}`} stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
            <Path d={`M ${CX - 5},${CY} A 5,5 0 1,1 ${CX + 5},${CY} Z`} fill={t.ink} />
            <Path d={`M ${CX - 3},${CY} A 3,3 0 1,1 ${CX + 3},${CY} Z`} fill={t.card} />
            <SvgText x={CX} y={CY - 24} textAnchor="middle" fontSize="34" fontWeight="700" fill={t.ink}>{speedKmh}</SvgText>
            <SvgText x={CX} y={CY - 10} textAnchor="middle" fontSize="10" fill={t.secondary}>km/h</SvgText>
            {stats && <SvgText x={CX} y={CY + 14} textAnchor="middle" fontSize="11" fill={t.secondary}>{Math.round(stats.odometer).toLocaleString('en-US')} km</SvgText>}
          </Svg>
          <View style={s.speedoInfoRow}>
            <View style={s.speedoInfoItem}>
              <View style={[s.speedoDot, { backgroundColor: ignitionColor }]} />
              <Text style={[s.speedoValue, { color: t.ink }]}>{ignitionText}</Text>
              <Text style={[s.speedoLabel, { color: t.secondary }]}>Ignition</Text>
            </View>
            <View style={s.speedoInfoItem}>
              <TablerIcon name="clock" size={13} color={t.secondary} />
              <Text style={[s.speedoValue, { color: t.ink }]}>{updatedAgo}</Text>
              <Text style={[s.speedoLabel, { color: t.secondary }]}>Updated</Text>
            </View>
          </View>
        </View>

        {/* Info grid */}
        <View style={s.clusterGrid}>
          <ClusterCard icon="satellite" label="GPS" value={point?.gpsValid ? `${point.satellites ?? 0} sat` : 'No fix'} badgeBg={`${t.moving}22`} badgeColor={t.moving} />
          <ClusterCard icon="battery" label="Battery" value={point?.voltageLevel != null ? `${point.voltageLevel.toFixed(1)}V` : '—'} badgeBg={`${t.idle}22`} badgeColor={t.idle} />
          <ClusterCard icon="signal" label="Signal" value={point?.gsmSignal != null ? `${point.gsmSignal}%` : '—'} badgeBg={`${t.red}18`} badgeColor={t.red} />
          <ClusterCard icon="clock" label="Stop time" value={duration(stats?.stopDuration)} badgeBg={`${t.secondary}22`} badgeColor={t.secondary} />
          <ClusterCard icon="engine" label="Eng. hours" value={stats?.engineHours != null ? `${Math.round(stats.engineHours)}h` : '—'} badgeBg={`${t.secondary}22`} badgeColor={t.secondary} />
          <ClusterCard icon="map-pin" label="Location" value={point && validPoint ? 'Google Maps' : '—'} badgeBg={`${t.red}18`} badgeColor={t.red} onPress={openCoordinates} />
        </View>

        {/* Actions */}
        <View style={[s.actions, { borderTopColor: t.border }]}>
          <ActionBtn icon="follow" label={following ? 'Following' : 'Follow'} active={following} onPress={() => { setFollowing(v => !v); centerVehicle(); }} />
          <ActionBtn icon="replay" label="Replay" onPress={() => router.push({ pathname: '/vehicle/[imei]/replay', params: { imei } })} />
          <ActionBtn icon="report" label="History" onPress={() => router.push({ pathname: '/vehicle/[imei]/history', params: { imei } })} />
          {canDo('alerts') && <ActionBtn icon="bell" label="Alerts" onPress={() => router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } })} />}
        </View>
      </View>

      <EngineCutDialog visible={cutOpen} imei={item.device.imei} plate={plate} immobilized={immobilized} onClose={() => setCutOpen(false)} onSuccess={value => { lastCut.current = Date.now(); setImmobilized(value); }} />
    </View>
  );
}

function ClusterCard({ icon, label, value, badgeBg, badgeColor, onPress }: { icon: string; label: string; value: string; badgeBg: string; badgeColor: string; onPress?: () => void }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const inner = (
    <View style={s.clusterCard}>
      <View style={[s.clusterBadge, { backgroundColor: badgeBg }]}>
        <TablerIcon name={icon} size={14} color={badgeColor} />
      </View>
      <View style={s.clusterText}>
        <Text numberOfLines={1} style={[s.clusterValue, { color: t.ink }]}>{value}</Text>
        <Text style={[s.clusterLabel, { color: t.secondary }]}>{label}</Text>
      </View>
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} disabled={value === '—'} style={s.clusterItem}>{inner}</Pressable>
    : <View style={s.clusterItem}>{inner}</View>;
}

function ActionBtn({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  return (
    <Pressable onPress={onPress} style={s.actionBtn} accessibilityRole="button" accessibilityLabel={label}>
      <TablerIcon name={icon} size={19} color={active ? t.red : t.ink} />
      <Text style={[s.actionLabel, { color: active ? t.red : t.secondary }]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.canvas },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: t.bg },
    secondaryText: { fontSize: 12, color: t.secondary },
    mapArea: { flex: 1, backgroundColor: t.canvas },
    noLocation: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10 },
    topButton: { width: 38, height: 38, borderWidth: 1, borderColor: t.border, borderRadius: 8, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    headerPlate: { flex: 1, color: t.ink, fontWeight: '700', fontSize: 14 },
    mapControls: { position: 'absolute', right: 10, alignItems: 'center', gap: 5 },
    mapButton: { width: 37, height: 37, borderWidth: 1, borderColor: t.border, borderRadius: 8, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    zoomPlus: { fontSize: 23, color: t.red, lineHeight: 26 },
    zoomMinus: { fontSize: 23, color: t.ink, lineHeight: 26 },
    mapMenu: { position: 'absolute', right: 43, top: 0, width: 105, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 7, elevation: 4, zIndex: 3 },
    mapOption: { padding: 9, borderBottomWidth: 1, borderColor: t.border },
    mapOptionText: { fontSize: 11, color: t.ink },
    activeMapOption: { color: t.red, fontWeight: '700' },
    marker: { alignItems: 'center' },
    car: { width: 28, height: 35 },
    plateTag: { flexDirection: 'row', backgroundColor: t.card, marginTop: 1, borderRadius: 3, overflow: 'hidden', elevation: 2 },
    statusBar: { width: 3, marginRight: 4 },
    plateTagText: { fontSize: 9, color: t.ink, fontWeight: '700', paddingHorizontal: 4, paddingVertical: 2 },
    // Card
    card: { backgroundColor: t.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 0, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
    cardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    cardTitleWrap: { flex: 1, minWidth: 0 },
    cardPlate: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    cardName: { fontSize: 11, marginTop: 1 },
    engineBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 8 },
    // Speedometer
    speedoWrap: { marginHorizontal: -16, marginBottom: 2 },
    speedoInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 2, marginTop: -40 },
    speedoInfoItem: { alignItems: 'center', gap: 1 },
    speedoDot: { width: 6, height: 6, borderRadius: 3 },
    speedoValue: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    speedoLabel: { fontSize: 10 },
    // Cluster grid
    clusterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6, marginBottom: 6 },
    clusterItem: { width: '30.5%' },
    clusterCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    clusterBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    clusterText: { flex: 1, minWidth: 0 },
    clusterValue: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    clusterLabel: { fontSize: 10, marginTop: 1 },
    // Actions
    actions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 10, paddingBottom: 2 },
    actionBtn: { flex: 1, alignItems: 'center', gap: 3 },
    actionLabel: { fontSize: 10, fontWeight: '500' },
  });
}
