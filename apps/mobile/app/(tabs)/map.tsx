import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, UrlTile, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import logo from '../../assets/trackvee-logo.png';

const STATUS: Record<string, string> = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };

function VehicleMarker({ item, selected, onPress }: { item: FleetItem; selected: boolean; onPress: () => void }) {
  const point = item.point as LivePoint;
  const state = getFleetStatus(point);
  const color = STATUS[state] ?? theme.offline;
  return (
    <Marker coordinate={{ latitude: point.latitude, longitude: point.longitude }} onPress={onPress} tracksViewChanges={false} title={item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`} description={`${displayVehicleName(item.vehicle)} · ${Math.round(point.speedKmh)} km/h`}>
      <View style={styles.markerWrap}>
        <View style={[styles.marker, { borderColor: color, backgroundColor: '#fff' }, selected && styles.markerSelected]}>
          <View style={{ transform: [{ rotate: `${point.heading ?? 0}deg` }] }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M7 17h10l1.4-5.2a2 2 0 0 0-1.94-2.52H7.54a2 2 0 0 0-1.94 2.52L7 17Z" />
              <Path d="M6 14h12M8 17v2m8-2v2M8 9l1-3h6l1 3" />
              <Path d="M5 12h1m12 0h1" />
            </Svg>
          </View>
        </View>
        <View style={styles.plateLabel}><Text style={styles.plateText}>{item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`}</Text></View>
      </View>
    </Marker>
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
  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.vehicle?.licensePlate ?? ''} ${displayVehicleName(item.vehicle)}`.toLowerCase();
    return text.includes(query.toLowerCase()) && !!item.point?.gpsValid && Number.isFinite(item.point.latitude) && Number.isFinite(item.point.longitude);
  }), [items, query]);
  const selectedItem = items.find(item => item.device.imei === selected) ?? null;

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
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={DEFAULT_REGION} mapType="none" showsCompass={false} showsUserLocation={false} toolbarEnabled={false} onMapReady={() => setMapReady(true)}>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} zIndex={0} />
        {filtered.map(item => <VehicleMarker key={item.device.imei} item={item} selected={selected === item.device.imei} onPress={() => setSelected(item.device.imei)} />)}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: Math.max(insets.top, 7) }]}>
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
      </SafeAreaView>

      <View style={[styles.mapActions, { top: Math.max(insets.top, 10) + 120 }]}>
        <Pressable onPress={() => mapRef.current?.getCamera().then(camera => mapRef.current?.animateCamera({ zoom: (camera.zoom ?? 12) + 1 }))} style={styles.mapButton} accessibilityLabel="Zoom in"><Text style={styles.zoomText}>+</Text></Pressable>
        <Pressable onPress={() => mapRef.current?.getCamera().then(camera => mapRef.current?.animateCamera({ zoom: Math.max(3, (camera.zoom ?? 12) - 1) }))} style={styles.mapButton} accessibilityLabel="Zoom out"><Text style={styles.zoomText}>−</Text></Pressable>
        <Pressable onPress={fitFleet} style={styles.mapButton} accessibilityLabel="Fit vehicles"><TablerIcon name="locate" size={19} color={theme.ink} /></Pressable>
      </View>

      <View style={[styles.bottomOverlay, { bottom: 8 }]}>
        <View style={styles.statusRow}>
          {(['moving', 'idle', 'parked', 'offline'] as const).map(status => {
            const count = items.filter(item => getFleetStatus(item.point) === status).length;
            return <View key={status} style={styles.statusItem}><View style={[styles.statusDot, { backgroundColor: STATUS[status] }]} /><Text style={styles.statusLabel}>{status[0]!.toUpperCase() + status.slice(1)}</Text><Text style={styles.statusValue}>{count}</Text></View>;
          })}
        </View>
        {selectedItem ? (
          <Pressable onPress={() => router.push({ pathname: '/vehicle/[imei]', params: { imei: selectedItem.device.imei } })} style={styles.selectedVehicle}>
            <View style={styles.selectedMain}>
              <View style={[styles.statusLine, { backgroundColor: STATUS[getFleetStatus(selectedItem.point)] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedPlate}>{selectedItem.vehicle?.licensePlate || `#${selectedItem.vehicle?.displayId ?? selectedItem.device.displayId}`}</Text>
                <Text style={styles.selectedName}>{displayVehicleName(selectedItem.vehicle)}</Text>
              </View>
              <Text style={styles.speed}>{Math.round(selectedItem.point?.speedKmh ?? 0)} <Text style={styles.speedUnit}>km/h</Text></Text>
            </View>
            <Text style={styles.detailHint}>Tap for vehicle details</Text>
          </Pressable>
        ) : (
          <View style={styles.mapSummary}>
            <Text style={styles.mapSummaryTitle}>{loading ? 'Loading your fleet…' : `${items.length} vehicles in your fleet`}</Text>
            {error ? <Pressable onPress={reload}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : <Text style={styles.mapSummaryHint}>{filtered.length ? 'Select a vehicle to view live details' : 'No live vehicle positions available'}</Text>}
          </View>
        )}
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
  iconButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  searchBar: { height: 48, paddingHorizontal: 13, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  searchInput: { flex: 1, padding: 0, color: theme.ink, fontSize: 14 },
  vehicleCount: { fontSize: 12, color: theme.secondary, fontVariant: ['tabular-nums'] },
  mapActions: { position: 'absolute', right: 14, gap: 7 },
  mapButton: { height: 42, width: 42, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 25, lineHeight: 28, color: theme.ink, fontWeight: '400' },
  markerWrap: { alignItems: 'center' }, marker: { height: 38, width: 38, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  markerSelected: { borderWidth: 3, transform: [{ scale: 1.08 }] },
  plateLabel: { backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginTop: 3, elevation: 2 },
  plateText: { color: theme.ink, fontSize: 10, fontWeight: '700' },
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
  statusRow: { backgroundColor: '#fff', minHeight: 43, borderWidth: 1, borderColor: theme.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 8 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, statusDot: { height: 7, width: 7, borderRadius: 4 }, statusLabel: { fontSize: 10, color: theme.secondary }, statusValue: { fontSize: 11, color: theme.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mapSummary: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 13, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  mapSummaryTitle: { color: theme.ink, fontSize: 14, fontWeight: '700' }, mapSummaryHint: { color: theme.secondary, fontSize: 12, marginTop: 3 }, errorText: { color: theme.red, fontSize: 12, marginTop: 5 },
  selectedVehicle: { backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  selectedMain: { flexDirection: 'row', alignItems: 'center', gap: 10 }, statusLine: { width: 3, height: 36, borderRadius: 1.5 }, selectedPlate: { color: theme.ink, fontWeight: '700', fontSize: 14 }, selectedName: { color: theme.secondary, fontSize: 12, marginTop: 2 }, speed: { color: theme.ink, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }, speedUnit: { color: theme.secondary, fontSize: 10, fontWeight: '500' }, detailHint: { color: theme.muted, fontSize: 10, paddingLeft: 13, marginTop: 4 },
  attribution: { alignSelf: 'flex-end', fontSize: 9, color: '#475569', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 4, marginTop: 4 },
});
