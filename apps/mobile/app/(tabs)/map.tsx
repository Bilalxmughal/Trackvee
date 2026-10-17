import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { useTheme } from '../../src/hooks/useTheme';
import type { AppTheme } from '../../src/theme';
import api from '../../src/lib/api';
import logo from '../../assets/trackvee-logo.png';
import carIcon from '../../assets/car-icon.png';

interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };

function VehicleMarker({ item, onPress }: { item: FleetItem; onPress: () => void }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const point = item.point as LivePoint;
  const coordinate = useRef(new AnimatedRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const state = getFleetStatus(point);
  const statusColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: t.offline };
  const color = statusColors[state] ?? t.offline;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const lastPress = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastPress.current < 700) return;
    lastPress.current = now;
    onPress();
  };
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 450);
    return () => clearTimeout(timer);
  }, [color, point.heading, point.speedKmh]);
  useEffect(() => {
    coordinate.timing({ toValue: 0, latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0, duration: 4200, useNativeDriver: false }).start();
  }, [coordinate, point.latitude, point.longitude]);
  return (
    <Marker.Animated coordinate={coordinate as unknown as LatLng} onPress={handlePress} onSelect={handlePress} tracksViewChanges={tracksViewChanges} stopPropagation>
      <View style={styles.markerWrap}>
        <Image source={carIcon} resizeMode="contain" style={[styles.carImage, { transform: [{ rotate: `${((point.heading ?? 0) + 180) % 360}deg` }] }]} />
        <View style={styles.plateLabel}>
          <View style={[styles.plateStatusBar, { backgroundColor: color }]} />
          <Text style={styles.plateText}>{item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`}</Text>
        </View>
      </View>
    </Marker.Animated>
  );
}

export default function LiveMapScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { items, error, reload } = useFleet();
  const { canDo } = usePortalPermissions();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'hybrid' | 'terrain'>('street');
  const [styleOpen, setStyleOpen] = useState(false);

  useEffect(() => { api.get<VehicleGroup[]>('/vehicle-groups').then(r => setGroups(r.data)).catch(() => {}); }, []);
  const [fitted, setFitted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const fittingRef = useRef(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const regionRef = useRef<Region>(DEFAULT_REGION);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const groupVehicleIds = useMemo(() => {
    if (!selectedGroupId) return null;
    const group = groups.find(g => g.id === selectedGroupId);
    return group ? new Set(group.vehicleIds) : null;
  }, [groups, selectedGroupId]);

  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.vehicle?.licensePlate ?? ''} ${displayVehicleName(item.vehicle)}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesGroup = !groupVehicleIds || groupVehicleIds.has(item.vehicle?.id ?? '');
    return matchesQuery && matchesGroup && !!item.point?.gpsValid && Number.isFinite(item.point.latitude) && Number.isFinite(item.point.longitude);
  }), [items, query, groupVehicleIds]);
  const clustered = useMemo(() => {
    if (!mapSize.width || !mapSize.height) return filtered.map(item => ({ key: item.device.imei, items: [item], latitude: item.point!.latitude, longitude: item.point!.longitude }));
    const latCell = Math.max(region.latitudeDelta * 64 / mapSize.height, 0.00008);
    const lngCell = Math.max(region.longitudeDelta * 64 / mapSize.width, 0.00008);
    const bins = new Map<string, FleetItem[]>();
    for (const item of filtered) {
      const p = item.point!;
      const key = `${Math.floor((p.latitude - (region.latitude - region.latitudeDelta / 2)) / latCell)}:${Math.floor((p.longitude - (region.longitude - region.longitudeDelta / 2)) / lngCell)}`;
      bins.set(key, [...(bins.get(key) ?? []), item]);
    }
    return [...bins.entries()].map(([key, grouped]) => ({
      key,
      items: grouped,
      latitude: grouped.reduce((sum, item) => sum + item.point!.latitude, 0) / grouped.length,
      longitude: grouped.reduce((sum, item) => sum + item.point!.longitude, 0) / grouped.length,
    }));
  }, [filtered, mapSize, region]);

  const openVehicle = useCallback((imei: string) => {
    router.push({ pathname: '/vehicle/[imei]', params: { imei } });
  }, []);

  const zoomCluster = useCallback((latitude: number, longitude: number) => {
    const next: Region = { latitude, longitude, latitudeDelta: Math.max(regionRef.current.latitudeDelta * 0.45, 0.002), longitudeDelta: Math.max(regionRef.current.longitudeDelta * 0.45, 0.002) };
    regionRef.current = next;
    mapRef.current?.animateToRegion(next, 350);
  }, []);
  const zoom = useCallback(async (factor: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const bounds = await map.getMapBoundaries();
      const current = {
        latitude: (bounds.northEast.latitude + bounds.southWest.latitude) / 2,
        longitude: (bounds.northEast.longitude + bounds.southWest.longitude) / 2,
        latitudeDelta: Math.abs(bounds.northEast.latitude - bounds.southWest.latitude),
        longitudeDelta: Math.abs(bounds.northEast.longitude - bounds.southWest.longitude),
      };
      const next = { ...current, latitudeDelta: Math.max(0.0006, Math.min(100, current.latitudeDelta * factor)), longitudeDelta: Math.max(0.0006, Math.min(100, current.longitudeDelta * factor)) };
      regionRef.current = next;
      map.animateToRegion(next, 250);
    } catch {
      const current = regionRef.current;
      const next = { ...current, latitudeDelta: Math.max(0.0006, Math.min(100, current.latitudeDelta * factor)), longitudeDelta: Math.max(0.0006, Math.min(100, current.longitudeDelta * factor)) };
      regionRef.current = next;
      map.animateToRegion(next, 250);
    }
  }, []);

  const fitFleet = useCallback(() => {
    const coords = filtered.filter(item => !!item.point?.gpsValid).map(item => ({ latitude: item.point!.latitude, longitude: item.point!.longitude }));
    if (!coords.length) return;
    fittingRef.current = true;
    if (coords.length === 1) {
      const next = { ...coords[0]!, latitudeDelta: 0.035, longitudeDelta: 0.035 };
      regionRef.current = next;
      mapRef.current?.animateToRegion(next, 450);
    } else mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 130, right: 52, bottom: 210, left: 52 }, animated: true });
    setFitted(true);
  }, [filtered]);

  useEffect(() => {
    if (mapReady && !fitted && filtered.length) fitFleet();
  }, [mapReady, fitted, filtered, fitFleet]);

  return (
    <View style={styles.fill}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={DEFAULT_REGION} mapType={mapStyle === 'street' ? 'none' : mapStyle} showsCompass={false} showsUserLocation={false} toolbarEnabled={false} moveOnMarkerPress={false} onMapReady={() => setMapReady(true)} onLayout={event => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} onRegionChange={next => { regionRef.current = next; }} onRegionChangeComplete={next => { regionRef.current = next; setRegion(next); fittingRef.current = false; }}>
        {mapStyle === 'street' && <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />}
        {clustered.map(group => group.items.length === 1 ? (
          <VehicleMarker key={group.items[0]!.device.imei} item={group.items[0]!} onPress={() => openVehicle(group.items[0]!.device.imei)} />
        ) : (
          <Marker key={`cluster-${group.key}`} coordinate={{ latitude: group.latitude, longitude: group.longitude }} onPress={() => zoomCluster(group.latitude, group.longitude)} tracksViewChanges={false} accessibilityLabel={`${group.items.length} vehicles; zoom in`}>
            <View style={styles.clusterMarker}><Text style={styles.clusterCount}>{group.items.length}</Text></View>
          </Marker>
        ))}
      </MapView>

      <View pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? 'Close search' : 'Search vehicles'} onPress={() => { if (searchOpen) setQuery(''); setSearchOpen(value => !value); }} style={styles.iconButton}>
              <TablerIcon name={searchOpen ? 'close' : 'search'} size={20} color={t.ink} />
            </Pressable>
            {canDo('alerts') && <Pressable accessibilityRole="button" accessibilityLabel="Open alerts" onPress={() => router.push('/alerts')} style={styles.iconButton}>
              <TablerIcon name="bell" size={21} color={t.ink} />
            </Pressable>}
          </View>
        </View>
        {searchOpen && <View style={styles.searchBar}>
          <TablerIcon name="search" size={19} color={t.secondary} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search plate or vehicle" placeholderTextColor={t.muted} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search vehicles" />
          <Text style={styles.vehicleCount}>{filtered.length}</Text>
        </View>}
        {groups.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupPillsScroll} contentContainerStyle={styles.groupPillsContent}>
          <Pressable onPress={() => setSelectedGroupId(null)} style={[styles.groupPill, !selectedGroupId && styles.groupPillActive]}>
            <Text style={[styles.groupPillText, !selectedGroupId && styles.groupPillTextActive]}>All</Text>
          </Pressable>
          {groups.map(group => (
            <Pressable key={group.id} onPress={() => setSelectedGroupId(prev => prev === group.id ? null : group.id)} style={[styles.groupPill, selectedGroupId === group.id && styles.groupPillActive]}>
              <Text style={[styles.groupPillText, selectedGroupId === group.id && styles.groupPillTextActive]}>{group.name}</Text>
            </Pressable>
          ))}
        </ScrollView>}
      </View>

      <View style={[styles.mapActions, { top: Math.max(insets.top, 10) + (searchOpen ? 160 : 110) + (groups.length > 0 ? 44 : 0) }]}>
        <Pressable onPress={() => setStyleOpen(value => !value)} style={styles.mapButton} accessibilityRole="button" accessibilityLabel="Map type"><TablerIcon name="layers" size={19} color={t.ink} /></Pressable>
        {styleOpen && <View style={styles.styleMenu}>
          {(Platform.OS === 'ios' ? ['street', 'satellite', 'hybrid'] : ['street', 'satellite', 'hybrid', 'terrain']).map(style => <Pressable key={style} onPress={() => { setMapStyle(style as typeof mapStyle); setStyleOpen(false); }} style={styles.styleOption} accessibilityRole="button" accessibilityLabel={`${style[0]!.toUpperCase() + style.slice(1)} map`}><Text style={[styles.styleOptionText, mapStyle === style && styles.styleOptionSelected]}>{style[0]!.toUpperCase() + style.slice(1)}</Text></Pressable>)}
        </View>}
        <Pressable onPress={() => void zoom(0.5)} style={styles.mapButton} accessibilityLabel="Zoom in"><Text style={styles.zoomInText}>+</Text></Pressable>
        <Pressable onPress={() => void zoom(2)} style={styles.mapButton} accessibilityLabel="Zoom out"><Text style={styles.zoomOutText}>−</Text></Pressable>
        <Pressable onPress={fitFleet} style={styles.mapButton} accessibilityLabel="Fit vehicles"><TablerIcon name="locate" size={19} color={t.ink} /></Pressable>
      </View>

      <View style={[styles.bottomOverlay, { bottom: 3 }]}>
        <View style={styles.statusRow}>
          {(['moving', 'idle', 'parked', 'offline'] as const).map(status => {
            const dotColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: t.offline };
            const count = items.filter(item => getFleetStatus(item.point) === status).length;
            return <View key={status} style={styles.statusItem}><View style={styles.statusMetric}><View style={[styles.statusDot, { backgroundColor: dotColors[status] }]} /><Text style={styles.statusValue}>{count}</Text></View><Text style={styles.statusLabel}>{status[0]!.toUpperCase() + status.slice(1)}</Text>{status !== 'offline' && <View pointerEvents="none" style={styles.statusDivider}/>}</View>;
          })}
        </View>
        {error ? <Pressable onPress={reload}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : null}
        {mapStyle === 'street' && <Text style={styles.attribution}>© OpenStreetMap contributors</Text>}
      </View>
    </View>
  );
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#e9edf0' },
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16 },
  topRow: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { height: 34, width: 135 },
  iconButton: { width: 42, height: 42, borderRadius: 10, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border },
  searchBar: { height: 48, paddingHorizontal: 13, backgroundColor: t.card, borderRadius: 10, borderWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  searchInput: { flex: 1, padding: 0, color: t.ink, fontSize: 14 },
  vehicleCount: { fontSize: 12, color: t.secondary, fontVariant: ['tabular-nums'] },
  mapActions: { position: 'absolute', right: 14, alignItems: 'flex-end', gap: 7 },
  styleMenu: { position: 'absolute', right: 50, top: 0, width: 110, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 8, elevation: 4, overflow: 'hidden' },
  styleOption: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: t.border },
  styleOptionText: { fontSize: 12, color: t.ink },
  styleOptionSelected: { color: t.red, fontWeight: '700' },
  mapButton: { height: 42, width: 42, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
  zoomInText: { fontSize: 25, lineHeight: 28, color: t.red, fontWeight: '400' },
  zoomOutText: { fontSize: 25, lineHeight: 28, color: t.ink, fontWeight: '400' },
  markerWrap: { alignItems: 'center' }, carImage: { width: 27, height: 35 },
  plateLabel: { backgroundColor: '#fff', borderRadius: 4, paddingRight: 5, flexDirection: 'row', alignItems: 'stretch', marginTop: 2, elevation: 2, overflow: 'hidden' },
  plateStatusBar: { width: 3, marginRight: 4 },
  plateText: { color: '#111827', fontSize: 9, fontWeight: '700', paddingVertical: 3 },
  clusterMarker: { height: 38, minWidth: 38, paddingHorizontal: 7, borderRadius: 20, backgroundColor: t.red, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  clusterCount: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  fleetSummary: { backgroundColor: t.card, minHeight: 38, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fleetSummaryTitle: { color: t.ink, fontSize: 13, fontWeight: '700' }, viewList: { color: t.secondary, fontSize: 11, fontWeight: '600' },
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
  statusRow: { flexDirection: 'row', marginBottom: 5, minHeight: 62, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 8, overflow:'hidden' },
  statusItem: { flex: 1, minHeight: 60, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', position:'relative' }, statusMetric: { minHeight: 22, flexDirection:'row', alignItems:'center', justifyContent:'center', columnGap:5 }, statusDot: { height: 6, width: 6, borderRadius: 3 }, statusLabel: { fontSize: 9, lineHeight: 13, color: t.secondary, textAlign: 'center', marginTop: 2 }, statusValue: { fontSize: 13, color: t.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusDivider:{position:'absolute',right:0,height:30,width:1,backgroundColor:t.border,top:'50%',marginTop:-15},
  errorText: { color: t.red, fontSize: 12, marginTop: 5 },
  attribution: { alignSelf: 'flex-end', fontSize: 9, color: '#475569', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 4, marginTop: 4 },
  groupPillsScroll: { marginTop: 8 },
  groupPillsContent: { paddingRight: 8, gap: 6, flexDirection: 'row' },
  groupPill: { height: 32, paddingHorizontal: 13, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  groupPillActive: { backgroundColor: t.red, borderColor: t.red },
  groupPillText: { fontSize: 11, fontWeight: '600', color: t.ink },
  groupPillTextActive: { color: '#fff' },
}); }
