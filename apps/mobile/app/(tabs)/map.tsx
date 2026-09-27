import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import logo from '../../assets/trackvee-logo.png';
import carIcon from '../../assets/car-icon.png';

const STATUS: Record<string, string> = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };

function VehicleMarker({ item, selected, onPress }: { item: FleetItem; selected: boolean; onPress: () => void }) {
  const point = item.point as LivePoint;
  const coordinate = useRef(new AnimatedRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const state = getFleetStatus(point);
  const color = STATUS[state] ?? theme.offline;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 450);
    return () => clearTimeout(timer);
  }, [color, point.heading, point.speedKmh, selected]);
  useEffect(() => {
    coordinate.timing({ toValue: 0, latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0, duration: 4200, useNativeDriver: false }).start();
  }, [coordinate, point.latitude, point.longitude]);
  return (
    <Marker.Animated coordinate={coordinate as unknown as LatLng} onPress={onPress} tracksViewChanges={tracksViewChanges} title={item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`} description={`${state[0]!.toUpperCase() + state.slice(1)} · ${point.speedKmh.toFixed(1)} km/h · Ignition ${point.ignition === true ? 'On' : point.ignition === false ? 'Off' : '—'}`}>
      <View style={styles.markerWrap}>
        <Image source={carIcon} resizeMode="contain" style={[styles.carImage, { transform: [{ rotate: `${((point.heading ?? 0) + 180) % 360}deg` }] }]} />
        <View style={[styles.plateLabel, selected && styles.plateLabelSelected]}>
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
  const { items, loading, error, reload } = useFleet();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [fitted, setFitted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
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
    setSelected(imei);
    router.push({ pathname: '/vehicle/[imei]', params: { imei } });
  }, []);

  const zoomCluster = useCallback((latitude: number, longitude: number) => {
    const next: Region = { latitude, longitude, latitudeDelta: Math.max(region.latitudeDelta * 0.45, 0.002), longitudeDelta: Math.max(region.longitudeDelta * 0.45, 0.002) };
    mapRef.current?.animateToRegion(next, 350);
  }, [region]);

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
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={DEFAULT_REGION} mapType="none" showsCompass={false} showsUserLocation={false} toolbarEnabled={false} onMapReady={() => setMapReady(true)} onLayout={event => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} onRegionChangeComplete={setRegion}>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />
        {clustered.map(group => group.items.length === 1 ? (
          <VehicleMarker key={group.items[0]!.device.imei} item={group.items[0]!} selected={selected === group.items[0]!.device.imei} onPress={() => openVehicle(group.items[0]!.device.imei)} />
        ) : (
          <Marker key={`cluster-${group.key}`} coordinate={{ latitude: group.latitude, longitude: group.longitude }} onPress={() => zoomCluster(group.latitude, group.longitude)} tracksViewChanges={false} accessibilityLabel={`${group.items.length} vehicles; zoom in`}>
            <View style={styles.clusterMarker}><Text style={styles.clusterCount}>{group.items.length}</Text></View>
          </Marker>
        ))}
      </MapView>

      <View pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <Pressable accessibilityRole="button" accessibilityLabel="Open alerts" onPress={() => router.push('/alerts')} style={styles.iconButton}>
            <TablerIcon name="bell" size={21} color={theme.ink} />
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <TablerIcon name="search" size={19} color={theme.secondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search plate or vehicle" placeholderTextColor={theme.muted} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search vehicles" />
          <Text style={styles.vehicleCount}>{filtered.length}</Text>
        </View>
      </View>

      <View style={[styles.mapActions, { top: Math.max(insets.top, 10) + 120 }]}>
        <Pressable onPress={() => mapRef.current?.getCamera().then(camera => mapRef.current?.animateCamera({ zoom: (camera.zoom ?? 12) + 1 }))} style={styles.mapButton} accessibilityLabel="Zoom in"><Text style={styles.zoomInText}>+</Text></Pressable>
        <Pressable onPress={() => mapRef.current?.getCamera().then(camera => mapRef.current?.animateCamera({ zoom: Math.max(3, (camera.zoom ?? 12) - 1) }))} style={styles.mapButton} accessibilityLabel="Zoom out"><Text style={styles.zoomOutText}>−</Text></Pressable>
        <Pressable onPress={fitFleet} style={styles.mapButton} accessibilityLabel="Fit vehicles"><TablerIcon name="locate" size={19} color={theme.ink} /></Pressable>
      </View>

      <View style={[styles.bottomOverlay, { bottom: 8 }]}>
        <Pressable onPress={() => router.push('/vehicles')} style={styles.fleetSummary}>
          <Text style={styles.fleetSummaryTitle}>{items.length} {items.length === 1 ? 'Vehicle' : 'Vehicles'}</Text>
          <Text style={styles.viewList}>View list ›</Text>
        </Pressable>
        <View style={styles.statusRow}>
          {(['moving', 'idle', 'parked', 'offline'] as const).map(status => {
            const count = items.filter(item => getFleetStatus(item.point) === status).length;
            return <View key={status} style={styles.statusItem}><View style={[styles.statusDot, { backgroundColor: STATUS[status] }]} /><Text style={styles.statusLabel}>{status[0]!.toUpperCase() + status.slice(1)}</Text><Text style={styles.statusValue}>{count}</Text></View>;
          })}
        </View>
        {error ? <Pressable onPress={reload}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : null}
        <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#e9edf0' },
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16 },
  topRow: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { height: 34, width: 135 },
  iconButton: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  searchBar: { height: 48, paddingHorizontal: 13, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  searchInput: { flex: 1, padding: 0, color: theme.ink, fontSize: 14 },
  vehicleCount: { fontSize: 12, color: theme.secondary, fontVariant: ['tabular-nums'] },
  mapActions: { position: 'absolute', right: 14, gap: 7 },
  mapButton: { height: 42, width: 42, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  zoomInText: { fontSize: 25, lineHeight: 28, color: theme.red, fontWeight: '400' },
  zoomOutText: { fontSize: 25, lineHeight: 28, color: theme.ink, fontWeight: '400' },
  markerWrap: { alignItems: 'center' }, carImage: { width: 23, height: 30 },
  plateLabel: { backgroundColor: '#fff', borderRadius: 4, paddingRight: 5, flexDirection: 'row', alignItems: 'stretch', marginTop: 2, elevation: 2, overflow: 'hidden' },
  plateLabelSelected: { borderWidth: 1, borderColor: theme.ink },
  plateStatusBar: { width: 3, marginRight: 4 },
  plateText: { color: theme.ink, fontSize: 9, fontWeight: '700', paddingVertical: 3 },
  clusterMarker: { height: 38, minWidth: 38, paddingHorizontal: 7, borderRadius: 20, backgroundColor: theme.red, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  clusterCount: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  fleetSummary: { backgroundColor: '#fff', minHeight: 38, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fleetSummaryTitle: { color: theme.ink, fontSize: 13, fontWeight: '700' }, viewList: { color: theme.secondary, fontSize: 11, fontWeight: '600' },
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
  statusRow: { backgroundColor: '#fff', minHeight: 43, borderWidth: 1, borderColor: theme.border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 8 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, statusDot: { height: 7, width: 7, borderRadius: 4 }, statusLabel: { fontSize: 10, color: theme.secondary }, statusValue: { fontSize: 11, color: theme.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  errorText: { color: theme.red, fontSize: 12, marginTop: 5 },
  attribution: { alignSelf: 'flex-end', fontSize: 9, color: '#475569', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 4, marginTop: 4 },
});
