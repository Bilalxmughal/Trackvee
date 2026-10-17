import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFleet, displayVehicleName, getFleetStatus } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { AppTheme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';
import carIcon from '../../assets/car-icon.png';

type Stats = { stopDuration: number | null; odometer: number; engineHours: number };
type MapStyle = 'street' | 'satellite' | 'hybrid' | 'terrain';
const relativeTime = (value: string) => { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds} sec ago` : seconds < 3600 ? `${Math.floor(seconds / 60)} min ago` : `${Math.floor(seconds / 3600)} hr ago`; };
const duration = (seconds: number | null | undefined) => { if (seconds == null || !Number.isFinite(seconds)) return '—'; const total = Math.max(0, Math.floor(seconds)); const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };

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
  const COLORS = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: t.offline };
  const statusColor = COLORS[status];
  const plate = item?.vehicle?.licensePlate || (item ? `#${item.vehicle?.displayId ?? item.device.displayId}` : 'Vehicle');

  useEffect(() => { initialized.current = false; setStats(null); setFollowing(follow === '1'); }, [imei, follow]);
  useEffect(() => { if (point?.immobilizer != null && new Date(point.timestamp).getTime() > lastCut.current) setImmobilized(point.immobilizer); }, [point?.immobilizer, point?.timestamp]);
  useEffect(() => {
    if (!imei) return;
    let active = true;
    const getStats = async () => { try { const result = await api.get<Stats>(`/telemetry/${encodeURIComponent(imei)}/stats`); if (active) setStats(result.data); } catch { if (active) setStats(null); } };
    void getStats(); const timer = setInterval(() => void getStats(), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [imei]);
  useEffect(() => {
    if (!validPoint || !point) return;
    const coordinate = { latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 };
    if (!initialized.current) { animated.setValue(coordinate); initialized.current = true; }
    else animated.timing({ toValue: 0, ...coordinate, duration: 1800, useNativeDriver: false }).start();
    if (following) map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 240);
  }, [validPoint, point?.latitude, point?.longitude, following, animated]);
  useEffect(() => { if (!permsLoading && !canDo('map') && !canDo('vehicles')) router.replace('/map'); }, [canDo, permsLoading]);

  if (permsLoading || (loading && !item)) return <View style={s.center}><ActivityIndicator color={t.red}/><Text style={s.secondary}>Loading vehicle…</Text></View>;
  if (!item) return <SafeAreaView style={s.center} edges={['top']}><Pressable onPress={() => router.back()} accessibilityLabel="Back"><TablerIcon name="back"/></Pressable><Text style={s.secondary}>Vehicle not found</Text></SafeAreaView>;
  const mapTypes: MapStyle[] = Platform.OS === 'ios' ? ['street','satellite','hybrid'] : ['street','satellite','hybrid','terrain'];
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

  return <View style={s.screen}>
    <View style={s.mapArea}>
      {validPoint && point ? <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={{ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }} mapType={mapStyle === 'street' ? 'none' : mapStyle} showsCompass={false} toolbarEnabled={false} moveOnMarkerPress={false}>
        {mapStyle === 'street' && <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0}/>}
        <Marker.Animated coordinate={animated as unknown as LatLng} tracksViewChanges={false} stopPropagation>
          <View style={s.marker}><Image source={carIcon} resizeMode="contain" style={[s.car, { transform: [{ rotate: `${((point.heading ?? 0) + 180) % 360}deg` }] }]}/><View style={s.plateTag}><View style={[s.statusBar,{ backgroundColor: statusColor }]}/><Text style={s.plateTagText}>{plate}</Text></View></View>
        </Marker.Animated>
      </MapView> : <View style={s.noLocation}><TablerIcon name="map" size={28} color={t.muted}/><Text style={s.secondary}>No valid location available</Text></View>}
      <SafeAreaView edges={['top']} style={s.topBar}><Pressable onPress={() => router.back()} style={s.topButton} accessibilityLabel="Back"><TablerIcon name="back" size={20}/></Pressable><Text style={s.headerPlate}>{plate}</Text>{canDo('alerts') ? <Pressable onPress={() => router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } })} style={s.topButton} accessibilityLabel="Vehicle alerts"><TablerIcon name="bell" size={19}/></Pressable> : <View style={s.topButton}/>}</SafeAreaView>
      <View style={[s.mapControls, { top: insets.top + 54 }]}>
        <Pressable onPress={() => setStyleOpen(v => !v)} style={s.mapButton} accessibilityLabel="Map type"><TablerIcon name="layers" size={18}/></Pressable>
        {styleOpen && <View style={s.mapMenu}>{mapTypes.map(type => <Pressable key={type} onPress={() => { setMapStyle(type); setStyleOpen(false); }} style={s.mapOption}><Text style={[s.mapOptionText, mapStyle === type && s.activeMapOption]}>{type[0]!.toUpperCase() + type.slice(1)}</Text></Pressable>)}</View>}
        <Pressable onPress={() => zoom(0.55)} style={s.mapButton} accessibilityLabel="Zoom in"><Text style={s.zoomPlus}>+</Text></Pressable>
        <Pressable onPress={() => zoom(1.8)} style={s.mapButton} accessibilityLabel="Zoom out"><Text style={s.zoomMinus}>−</Text></Pressable>
        <Pressable onPress={centerVehicle} style={s.mapButton} accessibilityLabel="Center vehicle"><TablerIcon name="locate" size={18} color={following ? t.red : t.ink}/></Pressable>
      </View>
    </View>

    <View style={[s.sheet,{ paddingBottom: Math.max(insets.bottom - 8, 4) }]}>
      <View style={s.sheetHandle}/>
      <View style={s.vehicleHeader}><View style={{ flex: 1 }}><Text style={s.vehiclePlate}>{plate}</Text><Text style={s.vehicleModel}>{displayVehicleName(item.vehicle)}</Text><Text style={[s.vehicleStatus,{ color: statusColor }]}>{status[0]!.toUpperCase()+status.slice(1)} · {Math.round(point?.speedKmh ?? 0)} km/h</Text></View>{canDo('engine_cut') && <Pressable onPress={() => setCutOpen(true)} style={s.engineButton} accessibilityLabel={immobilized ? 'Restore engine' : 'Cut engine'}><TablerIcon name="engine" size={18} color={t.red}/></Pressable>}</View>
      <View style={s.infoGrid}>
        <InfoRow><Info label="Ignition" value={point?.ignition === true ? 'On' : point?.ignition === false ? 'Off' : '—'}/><Info label="GPS" value={point?.gpsValid ? `${point.satellites ?? 0} satellites` : 'No signal'}/></InfoRow>
        <InfoRow><Info label="Battery" value={point?.voltageLevel != null ? `${point.voltageLevel.toFixed(1)} V` : '—'}/><Info label="Signal" value={point?.gsmSignal != null ? `${point.gsmSignal}%` : '—'}/></InfoRow>
        <InfoRow><Info label="Last update" value={point ? relativeTime(point.timestamp) : 'No data'}/><Info label="Coordinates" value={point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : '—'} onPress={openCoordinates}/></InfoRow>
        <InfoRow><Info label="Stop duration" value={duration(stats?.stopDuration)}/><Info label="Odometer" value={stats ? `${Math.round(stats.odometer).toLocaleString('en-US')} km` : '—'}/></InfoRow>
      </View>
      <View style={s.actions}>
        <Action icon="follow" label={following ? 'Following' : 'Follow'} active={following} onPress={() => { setFollowing(v => !v); centerVehicle(); }}/>
        <Action icon="replay" label="Replay" onPress={() => router.push({ pathname: '/vehicle/[imei]/replay', params: { imei } })}/>
        <Action icon="report" label="History" onPress={() => router.push({ pathname: '/vehicle/[imei]/history', params: { imei } })}/>
        {canDo('alerts') && <Action icon="bell" label="Alert" onPress={() => router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } })}/>}
      </View>
    </View>
    <EngineCutDialog visible={cutOpen} imei={item.device.imei} plate={plate} immobilized={immobilized} onClose={() => setCutOpen(false)} onSuccess={value => { lastCut.current = Date.now(); setImmobilized(value); }}/>
  </View>;
}

function InfoRow({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  const t = useTheme(); const s = useMemo(() => createStyles(t), [t]);
  return <View style={s.infoRow}>{children}<View pointerEvents="none" style={s.centerDivider}/></View>;
}
function Info({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const t = useTheme(); const s = useMemo(() => createStyles(t), [t]);
  const content = <><Text style={s.infoLabel}>{label}</Text><Text numberOfLines={1} style={s.infoValue}>{value}</Text></>;
  return onPress ? <Pressable onPress={onPress} disabled={value === '—'} style={s.infoCell} accessibilityRole="link" accessibilityLabel="Open coordinates in Google Maps">{content}</Pressable> : <View style={s.infoCell}>{content}</View>;
}
function Action({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const t = useTheme(); const s = useMemo(() => createStyles(t), [t]);
  return <Pressable onPress={onPress} style={s.action} accessibilityRole="button" accessibilityLabel={label}><TablerIcon name={icon} size={19} color={active ? t.red : t.ink}/><Text style={[s.actionText, active && s.actionTextActive]}>{label}</Text></Pressable>;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  screen:{flex:1,backgroundColor:t.bg}, center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:t.bg},secondary:{fontSize:11,color:t.secondary}, mapArea:{flex:1,backgroundColor:'#e9edf0'}, noLocation:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:8}, topBar:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:12,minHeight:49,flexDirection:'row',alignItems:'center',gap:10}, topButton:{width:38,height:38,borderWidth:1,borderColor:t.border,borderRadius:8,backgroundColor:t.card,alignItems:'center',justifyContent:'center'},headerPlate:{flex:1,color:t.ink,fontWeight:'700',fontSize:14}, mapControls:{position:'absolute',right:10,top:58,alignItems:'center',gap:5}, mapButton:{width:37,height:37,borderWidth:1,borderColor:t.border,borderRadius:8,backgroundColor:t.card,alignItems:'center',justifyContent:'center',elevation:2}, zoomPlus:{fontSize:23,color:t.red,lineHeight:26},zoomMinus:{fontSize:23,color:t.ink,lineHeight:26},mapMenu:{position:'absolute',right:43,top:0,width:105,backgroundColor:t.card,borderWidth:1,borderColor:t.border,borderRadius:7,elevation:4,zIndex:3},mapOption:{padding:9,borderBottomWidth:1,borderColor:t.border},mapOptionText:{fontSize:11,color:t.ink},activeMapOption:{color:t.red,fontWeight:'700'}, marker:{alignItems:'center'},car:{width:28,height:35},plateTag:{flexDirection:'row',backgroundColor:'#fff',marginTop:1,borderRadius:3,overflow:'hidden',elevation:2},statusBar:{width:3,marginRight:4},plateTagText:{fontSize:9,color:'#111827',fontWeight:'700',paddingHorizontal:4,paddingVertical:2},locationHint:{position:'absolute',left:10,bottom:10,flexDirection:'row',gap:10,alignItems:'center',backgroundColor:t.card,paddingHorizontal:10,paddingVertical:7,borderRadius:6},hintText:{color:t.ink,fontSize:10},
  sheet:{minHeight:350,maxHeight:'54%',backgroundColor:t.card,borderTopLeftRadius:13,borderTopRightRadius:13,marginTop:-8,paddingHorizontal:14,elevation:7},sheetHandle:{width:42,height:3,borderRadius:3,backgroundColor:t.border,alignSelf:'center',marginTop:6,marginBottom:7},vehicleHeader:{flexDirection:'row',alignItems:'center',minHeight:50},engineButton:{width:36,height:36,alignItems:'center',justifyContent:'center'},vehiclePlate:{fontSize:18,color:t.ink,fontWeight:'700'},vehicleModel:{fontSize:11,color:t.ink,marginTop:1},vehicleStatus:{fontSize:11,fontWeight:'700',marginTop:2},infoGrid:{borderTopWidth:1,borderColor:t.border,marginTop:6},infoRow:{height:39,flexDirection:'row',borderBottomWidth:1,borderColor:t.border,position:'relative'},infoCell:{width:'50%',justifyContent:'center',paddingHorizontal:3,paddingVertical:3},centerDivider:{position:'absolute',width:1,top:6,bottom:6,left:'50%',backgroundColor:t.border},infoLabel:{fontSize:9,color:t.secondary},infoValue:{fontSize:10,color:t.ink,fontWeight:'600',marginTop:1},actions:{height:66,flexDirection:'row',justifyContent:'space-around',alignItems:'center',borderBottomWidth:1,borderColor:t.border,marginBottom:0},action:{flex:1,alignItems:'center',justifyContent:'center',gap:3},actionText:{fontSize:9,color:t.secondary},actionTextActive:{color:t.red,fontWeight:'700'}
}); }
