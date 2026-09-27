import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { theme } from '../../src/theme';
import logo from '../../assets/trackvee-logo.png';
import carIcon from '../../assets/car-icon.png';

const STATUS: Record<string, string> = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };

function VehicleMarker({ item, onPress }: { item: FleetItem; onPress: () => void }) {
  const point = item.point as LivePoint;
  const coordinate = useRef(new AnimatedRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const state = getFleetStatus(point);
  const color = STATUS[state] ?? theme.offline;
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
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { items, error, reload } = useFleet();
  const { canDo } = usePortalPermissions();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'hybrid' | 'terrain'>('street');
  const [styleOpen, setStyleOpen] = useState(false);
  const [fitted, setFitted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const regionRef = useRef<Region>(DEFAULT_REGION);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.vehicle?.licensePlate ?? ''} ${displayVehicleName(item.vehicle)}`.toLowerCase();
    return text.includes(query.toLowerCase()) && !!item.point?.gpsValid && Number.isFinite(item.point.latitude) && Number.isFinite(item.point.longitude);
  }), [items, query]);
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
    const next: Region = { latitude, longitude, latitudeDelta: Math.max(region.latitudeDelta * 0.45, 0.002), longitudeDelta: Math.max(region.longitudeDelta * 0.45, 0.002) };
    mapRef.current?.animateToRegion(next, 350);
  }, [region]);
  const zoom = useCallback((factor: number) => {
    const current = regionRef.current;
    const next = {
      ...current,
      latitudeDelta: Math.max(0.0006, Math.min(100, current.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.0006, Math.min(100, current.longitudeDelta * factor)),
    };
    regionRef.current = next;
    mapRef.current?.animateToRegion(next, 250);
  }, []);

  const fitFleet = useCallback(() => {
    const coords = filtered.filter(item => !!item.point?.gpsValid).map(item => ({ latitude: item.point!.latitude, longitude: item.point!.longitude }));
    if (!coords.length) return;
    if (coords.length === 1) mapRef.current?.animateToRegion({ ...coords[0]!, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 450);
    else mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 130, right: 52, bottom: 210, left: 52 }, animated: true });
    setFitted(true);
  }, [filtered]);

  useEffect(() => {
    if (mapReady && !fitted && filtered.length) fitFleet();
  }, [mapReady, fitted, filtered, fitFleet]);

  return (
    <View style={styles.fill}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={DEFAULT_REGION} mapType={mapStyle === 'street' ? 'none' : mapStyle} showsCompass={false} showsUserLocation={false} toolbarEnabled={false} moveOnMarkerPress={false} onMapReady={() => setMapReady(true)} onLayout={event => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} onRegionChangeComplete={next => { regionRef.current = next; setRegion(next); }}>
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
              <TablerIcon name={searchOpen ? 'close' : 'search'} size={20} color={theme.ink} />
            </Pressable>
            {canDo('alerts') && <Pressable accessibilityRole="button" accessibilityLabel="Open alerts" onPress={() => router.push('/alerts')} style={styles.iconButton}>
              <TablerIcon name="bell" size={21} color={theme.ink} />
            </Pressable>}
          </View>
        </View>
        {searchOpen && <View style={styles.searchBar}>
          <TablerIcon name="search" size={19} color={theme.secondary} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search plate or vehicle" placeholderTextColor={theme.muted} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search vehicles" />
          <Text style={styles.vehicleCount}>{filtered.length}</Text>
        </View>}
      </View>

      <View style={[styles.mapActions, { top: Math.max(insets.top, 10) + (searchOpen ? 160 : 110) }]}>
        <Pressable onPress={() => setStyleOpen(value => !value)} style={styles.mapButton} accessibilityRole="button" accessibilityLabel="Map type"><TablerIcon name="layers" size={19} color={theme.ink} /></Pressable>
        {styleOpen && <View style={styles.styleMenu}>
          {(Platform.OS === 'ios' ? ['street', 'satellite', 'hybrid'] : ['street', 'satellite', 'hybrid', 'terrain']).map(style => <Pressable key={style} onPress={() => { setMapStyle(style as typeof mapStyle); setStyleOpen(false); }} style={styles.styleOption} accessibilityRole="button" accessibilityLabel={`${style[0]!.toUpperCase() + style.slice(1)} map`}><Text style={[styles.styleOptionText, mapStyle === style && styles.styleOptionSelected]}>{style[0]!.toUpperCase() + style.slice(1)}</Text></Pressable>)}
        </View>}
        <Pressable onPress={() => zoom(0.5)} style={styles.mapButton} accessibilityLabel="Zoom in"><Text style={styles.zoomInText}>+</Text></Pressable>
        <Pressable onPress={() => zoom(2)} style={styles.mapButton} accessibilityLabel="Zoom out"><Text style={styles.zoomOutText}>−</Text></Pressable>
        <Pressable onPress={fitFleet} style={styles.mapButton} accessibilityLabel="Fit vehicles"><TablerIcon name="locate" size={19} color={theme.ink} /></Pressable>
      </View>

      <View style={[styles.bottomOverlay, { bottom: 8 }]}>
        {canDo('vehicles') && <Pressable onPress={() => router.push('/vehicles')} style={styles.fleetSummary}>
          <Text style={styles.fleetSummaryTitle}>{items.length} {items.length === 1 ? 'Vehicle' : 'Vehicles'}</Text>
          <Text style={styles.viewList}>View list ›</Text>
        </Pressable>}
        <View style={styles.statusRow}>
          {(['moving', 'idle', 'parked', 'offline'] as const).map(status => {
            const count = items.filter(item => getFleetStatus(item.point) === status).length;
            return <View key={status} style={styles.statusItem}><View style={[styles.statusDot, { backgroundColor: STATUS[status] }]} /><Text style={styles.statusValue}>{count}</Text><Text style={styles.statusLabel}>{status[0]!.toUpperCase() + status.slice(1)}</Text></View>;
          })}
        </View>
        {error ? <Pressable onPress={reload}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : null}
        {mapStyle === 'street' && <Text style={styles.attribution}>© OpenStreetMap contributors</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#e9edf0' },
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16 },
  topRow: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { height: 34, width: 135 },
  iconButton: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  searchBar: { height: 48, paddingHorizontal: 13, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  searchInput: { flex: 1, padding: 0, color: theme.ink, fontSize: 14 },
  vehicleCount: { fontSize: 12, color: theme.secondary, fontVariant: ['tabular-nums'] },
  mapActions: { position: 'absolute', right: 14, alignItems: 'flex-end', gap: 7 },
  styleMenu: { position: 'absolute', right: 50, top: 0, width: 110, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 8, elevation: 4, overflow: 'hidden' },
  styleOption: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.border },
  styleOptionText: { fontSize: 12, color: theme.ink },
  styleOptionSelected: { color: theme.red, fontWeight: '700' },
  mapButton: { height: 42, width: 42, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  zoomInText: { fontSize: 25, lineHeight: 28, color: theme.red, fontWeight: '400' },
  zoomOutText: { fontSize: 25, lineHeight: 28, color: theme.ink, fontWeight: '400' },
  markerWrap: { alignItems: 'center' }, carImage: { width: 27, height: 35 },
  plateLabel: { backgroundColor: '#fff', borderRadius: 4, paddingRight: 5, flexDirection: 'row', alignItems: 'stretch', marginTop: 2, elevation: 2, overflow: 'hidden' },
  plateStatusBar: { width: 3, marginRight: 4 },
  plateText: { color: theme.ink, fontSize: 9, fontWeight: '700', paddingVertical: 3 },
  clusterMarker: { height: 38, minWidth: 38, paddingHorizontal: 7, borderRadius: 20, backgroundColor: theme.red, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  clusterCount: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  fleetSummary: { backgroundColor: '#fff', minHeight: 38, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fleetSummaryTitle: { color: theme.ink, fontSize: 13, fontWeight: '700' }, viewList: { color: theme.secondary, fontSize: 11, fontWeight: '600' },
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
  statusRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  statusItem: { flex: 1, minHeight: 47, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 4 }, statusDot: { height: 6, width: 6, borderRadius: 3 }, statusLabel: { width: '100%', fontSize: 9, color: theme.secondary, textAlign: 'center' }, statusValue: { fontSize: 13, color: theme.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  errorText: { color: theme.red, fontSize: 12, marginTop: 5 },
  attribution: { alignSelf: 'flex-end', fontSize: 9, color: '#475569', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 4, marginTop: 4 },
});
