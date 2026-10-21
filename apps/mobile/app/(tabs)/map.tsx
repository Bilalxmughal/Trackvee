import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem, type LivePoint } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { useTheme } from '../../src/hooks/useTheme';
import { useIsOffline } from '../../src/hooks/useIsOffline';
import type { AppTheme } from '../../src/theme';
import api from '../../src/lib/api';
import logo from '../../assets/trackvee-logo.png';
import carIcon from '../../assets/car-icon.png';

interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
interface Geofence {
  id: string; name: string; type: 'circle' | 'polygon';
  latitude?: number; longitude?: number; radius?: number;
  coordinates?: { latitude: number; longitude: number }[];
  color?: string;
}
interface Poi { id: string; name: string; latitude: number; longitude: number; description?: string; }

const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };
type StatusType = 'moving' | 'idle' | 'parked' | 'offline';
type StatusFilter = 'all' | StatusType;

function speedHeatColor(speed: number) {
  if (speed > 80) return 'rgba(220,38,38,0.22)';
  if (speed > 40) return 'rgba(245,158,11,0.22)';
  return 'rgba(34,197,94,0.22)';
}

function predictDRMobile(lat: number, lng: number, speedKmh: number, headingDeg: number, elapsedMs: number): { latitude: number; longitude: number } {
  if (speedKmh < 3) return { latitude: lat, longitude: lng };
  const distM = (speedKmh / 3.6) * (elapsedMs / 1000);
  const headRad = (headingDeg * Math.PI) / 180;
  const R = 6371000;
  const dLat = (distM * Math.cos(headRad)) / R * (180 / Math.PI);
  const cosLat = Math.cos(lat * Math.PI / 180);
  const dLng = cosLat > 0.001 ? (distM * Math.sin(headRad)) / (R * cosLat) * (180 / Math.PI) : 0;
  return { latitude: lat + dLat, longitude: lng + dLng };
}

function VehicleMarker({ item, onPress }: { item: FleetItem; onPress: () => void }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const point = item.point as LivePoint;
  const coordinate = useRef(new AnimatedRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const state = getFleetStatus(point);
  const statusColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: '#e21d48' };
  const color = statusColors[state] ?? t.offline;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const lastPress = useRef(0);
  const drBaseRef = useRef({ lat: point.latitude, lng: point.longitude, at: Date.now(), speedKmh: point.speedKmh ?? 0, heading: point.heading ?? 0 });
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
  // On real GPS update: reset dead-reckoning base and animate to new position
  useEffect(() => {
    drBaseRef.current = { lat: point.latitude, lng: point.longitude, at: Date.now(), speedKmh: point.speedKmh ?? 0, heading: point.heading ?? 0 };
    coordinate.timing({ toValue: 0, latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0, longitudeDelta: 0, duration: 4200, useNativeDriver: false }).start();
  }, [coordinate, point.latitude, point.longitude]);
  // Dead reckoning: keep marker moving between GPS updates
  useEffect(() => {
    const id = setInterval(() => {
      const b = drBaseRef.current;
      if (b.speedKmh < 3) return;
      const elapsed = Date.now() - b.at;
      if (elapsed < 500) return; // let the GPS animation lead
      const { latitude, longitude } = predictDRMobile(b.lat, b.lng, b.speedKmh, b.heading, elapsed);
      coordinate.timing({ toValue: 0, latitude, longitude, latitudeDelta: 0, longitudeDelta: 0, duration: 220, useNativeDriver: false }).start();
    }, 200);
    return () => clearInterval(id);
  }, [coordinate]);
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

function PoiMarker({ name }: { name: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.red, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
        <TablerIcon name="map-pin" size={13} color={t.red} />
      </View>
      <View style={{ width: 2, height: 5, backgroundColor: t.red }} />
      <View style={{ backgroundColor: t.card, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 1, borderWidth: 0.5, borderColor: t.border, maxWidth: 72 }}>
        <Text style={{ fontSize: 8, color: t.ink, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

export default function LiveMapScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { items, error, reload } = useFleet();
  const { canDo } = usePortalPermissions();
  const isOffline = useIsOffline();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'hybrid' | 'terrain'>('street');
  const [trafficOn, setTrafficOn] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [sheetVehicle, setSheetVehicle] = useState<FleetItem | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [odoEdit, setOdoEdit] = useState(false);
  const [odoInput, setOdoInput] = useState('');
  const [odoSaving, setOdoSaving] = useState(false);

  // Advanced map feature states
  const [showGeofences, setShowGeofences] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fullscreen, setFullscreen] = useState(false);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);

  const openSheet = useCallback((item: FleetItem) => {
    setSheetVehicle(item);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    setOdoEdit(false);
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setSheetVehicle(null));
  }, [sheetAnim]);

  const saveOdometer = useCallback(async (vehicleId: string) => {
    const km = parseFloat(odoInput);
    if (!Number.isFinite(km) || km < 0) return;
    setOdoSaving(true);
    try {
      await api.patch(`/vehicles/${vehicleId}/odometer`, { odometerKm: km });
      setSheetVehicle(prev => prev && prev.vehicle ? { ...prev, vehicle: { ...prev.vehicle, odometerKm: km } } : prev);
      setOdoEdit(false);
    } catch { /* ignore */ } finally { setOdoSaving(false); }
  }, [odoInput]);

  useEffect(() => { api.get<VehicleGroup[]>('/vehicle-groups').then(r => setGroups(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (canDo('geofences')) api.get<Geofence[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {});
    if (canDo('pois')) api.get<Poi[]>('/pois').then(r => setPois(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const vehicleGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) for (const id of g.vehicleIds) map.set(id, g.name.toLowerCase());
    return map;
  }, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      const plate = (item.vehicle?.licensePlate ?? '').toLowerCase();
      const name = displayVehicleName(item.vehicle).toLowerCase();
      const groupName = vehicleGroupMap.get(item.vehicle?.id ?? '') ?? '';
      const matchesQuery = !q || plate.includes(q) || name.includes(q) || groupName.includes(q);
      const matchesGroup = !groupVehicleIds || groupVehicleIds.has(item.vehicle?.id ?? '');
      const matchesStatus = statusFilter === 'all' || getFleetStatus(item.point) === statusFilter;
      return matchesQuery && matchesGroup && matchesStatus && !!item.point?.gpsValid && Number.isFinite(item.point.latitude) && Number.isFinite(item.point.longitude);
    });
  }, [items, query, groupVehicleIds, vehicleGroupMap, statusFilter]);

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

  const openVehicleDetails = useCallback((imei: string) => {
    closeSheet();
    setTimeout(() => router.push({ pathname: '/vehicle/[imei]', params: { imei } }), 230);
  }, [closeSheet]);

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

  const mapTypes = (Platform.OS === 'ios' ? ['street', 'satellite', 'hybrid'] : ['street', 'satellite', 'hybrid', 'terrain']) as (typeof mapStyle)[];

  const toggleStatusFilter = (status: StatusType) => {
    setStatusFilter(prev => prev === status ? 'all' : status);
  };

  const actionsTop = Math.max(insets.top, 10) + (searchOpen ? (groups.length > 0 ? 180 : 120) : 112);

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        mapType={mapStyle === 'street' ? 'none' : mapStyle}
        showsCompass={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        showsScale={false}
        legalLabelInsets={{ bottom: -999, left: -999, top: 0, right: 0 }}
        moveOnMarkerPress={false}
        onMapReady={() => setMapReady(true)}
        onLayout={event => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        onRegionChange={next => { regionRef.current = next; }}
        onRegionChangeComplete={next => { regionRef.current = next; setRegion(next); fittingRef.current = false; }}
      >
        {mapStyle === 'street' && <UrlTile urlTemplate={isOffline ? `${FileSystem.cacheDirectory}map-tiles/{z}_{x}_{y}.png` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} maximumZ={19} tileSize={256} zIndex={0} />}
        {trafficOn && process.env.EXPO_PUBLIC_HERE_API_KEY ? <UrlTile urlTemplate={`https://traffic.maps.ls.hereapi.com/mapviewer/v1/traffictiles/flow/6/{z}/{x}/{y}/256/png8?apiKey=${process.env.EXPO_PUBLIC_HERE_API_KEY}`} maximumZ={19} tileSize={256} zIndex={450} opacity={0.7} /> : null}

        {/* Speed heatmap — colored vehicle markers when active */}
        {showHeatmap && filtered.map(item => item.point ? (
          <Marker
            key={`heat-${item.device.imei}`}
            coordinate={{ latitude: item.point.latitude, longitude: item.point.longitude }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: speedHeatColor(item.point.speedKmh ?? 0), borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' }} />
          </Marker>
        ) : null)}

        {/* Vehicle markers */}
        {clustered.map(group => group.items.length === 1 ? (
          <VehicleMarker key={group.items[0]!.device.imei} item={group.items[0]!} onPress={() => openSheet(group.items[0]!)} />
        ) : (
          <Marker key={`cluster-${group.key}`} coordinate={{ latitude: group.latitude, longitude: group.longitude }} onPress={() => zoomCluster(group.latitude, group.longitude)} tracksViewChanges={false} accessibilityLabel={`${group.items.length} vehicles; zoom in`}>
            <View style={styles.clusterMarker}><Text style={styles.clusterCount}>{group.items.length}</Text></View>
          </Marker>
        ))}

        {/* POI markers */}
        {showPois && pois.map(poi => (
          <Marker key={`poi-${poi.id}`} coordinate={{ latitude: poi.latitude, longitude: poi.longitude }} tracksViewChanges={false} accessibilityLabel={poi.name}>
            <PoiMarker name={poi.name} />
          </Marker>
        ))}
      </MapView>

      {/* Top overlay */}
      {!fullscreen && <View pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={searchOpen ? 'Close search' : 'Search vehicles'}
              onPress={() => { if (searchOpen) { setQuery(''); setSelectedGroupId(null); } setSearchOpen(v => !v); }}
              style={styles.iconButton}
            >
              <TablerIcon name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? t.red : t.ink} />
              {!searchOpen && (query || selectedGroupId) ? <View style={styles.searchActiveDot} /> : null}
            </Pressable>
            {canDo('alerts') && <Pressable accessibilityRole="button" accessibilityLabel="Open alerts" onPress={() => router.push('/alerts')} style={styles.iconButton}>
              <TablerIcon name="bell" size={21} color={t.ink} />
            </Pressable>}
          </View>
        </View>

        {searchOpen && <View style={styles.searchPanel}>
          <View style={styles.searchInputRow}>
            <TablerIcon name="search" size={17} color={t.secondary} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search plate or vehicle name"
              placeholderTextColor={t.muted}
              style={[styles.searchInput, { color: t.ink }]}
              returnKeyType="search"
            />
            <Text style={styles.vehicleCount}>{filtered.length}</Text>
          </View>

          {groups.length > 0 && <>
            <View style={styles.searchDivider} />
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={styles.groupList}>
              <Pressable onPress={() => setSelectedGroupId(null)} style={[styles.groupListItem, !selectedGroupId && styles.groupListItemActive]}>
                <TablerIcon name="users" size={15} color={!selectedGroupId ? t.red : t.secondary} />
                <Text style={[styles.groupListText, !selectedGroupId && styles.groupListTextActive]}>All Vehicles</Text>
                {!selectedGroupId && <TablerIcon name="check" size={14} color={t.red} />}
              </Pressable>
              {groups.map(g => (
                <Pressable key={g.id} onPress={() => setSelectedGroupId(prev => prev === g.id ? null : g.id)} style={[styles.groupListItem, selectedGroupId === g.id && styles.groupListItemActive]}>
                  <TablerIcon name="users" size={15} color={selectedGroupId === g.id ? t.red : t.secondary} />
                  <Text style={[styles.groupListText, selectedGroupId === g.id && styles.groupListTextActive]} numberOfLines={1}>{g.name}</Text>
                  {selectedGroupId === g.id && <TablerIcon name="check" size={14} color={t.red} />}
                </Pressable>
              ))}
            </ScrollView>
          </>}
        </View>}
      </View>}

      {/* Map action buttons */}
      <View style={[styles.mapActions, { top: fullscreen ? Math.max(insets.top, 10) + 8 : actionsTop }]}>
        {/* Layers panel */}
        <Pressable
          onPress={() => setLayersOpen(v => !v)}
          style={[styles.mapButton, layersOpen && { backgroundColor: t.red }]}
          accessibilityRole="button"
          accessibilityLabel="Map layers"
        >
          <TablerIcon name="layers" size={19} color={layersOpen ? '#fff' : t.ink} />
        </Pressable>

        {layersOpen && <View style={styles.layersPanel}>
          <Text style={[styles.layersSectionTitle, { color: t.secondary }]}>MAP TYPE</Text>
          {mapTypes.map(style => (
            <Pressable
              key={style}
              onPress={() => { setMapStyle(style); }}
              style={[styles.layersOption, mapStyle === style && { backgroundColor: `${t.red}0d` }]}
              accessibilityRole="button"
              accessibilityLabel={`${style[0]!.toUpperCase() + style.slice(1)} map`}
            >
              <Text style={[styles.layersOptionText, { color: mapStyle === style ? t.red : t.ink }]}>{style[0]!.toUpperCase() + style.slice(1)}</Text>
              {mapStyle === style && <TablerIcon name="check" size={13} color={t.red} />}
            </Pressable>
          ))}

          <View style={[styles.layersDivider, { backgroundColor: t.border }]} />
          <Text style={[styles.layersSectionTitle, { color: t.secondary }]}>OVERLAYS</Text>

          {canDo('geofences') && <Pressable onPress={() => setShowGeofences(v => !v)} style={styles.layersToggleRow}>
            <TablerIcon name="geofence" size={15} color={showGeofences ? t.red : t.secondary} />
            <Text style={[styles.layersToggleLabel, { color: showGeofences ? t.ink : t.secondary }]}>Geofences</Text>
            <View style={[styles.togglePill, { backgroundColor: showGeofences ? t.red : t.border2 }]}>
              <View style={[styles.toggleDot, { left: showGeofences ? 14 : 3 }]} />
            </View>
          </Pressable>}

          {canDo('pois') && <Pressable onPress={() => setShowPois(v => !v)} style={styles.layersToggleRow}>
            <TablerIcon name="map-pin" size={15} color={showPois ? t.red : t.secondary} />
            <Text style={[styles.layersToggleLabel, { color: showPois ? t.ink : t.secondary }]}>POI Markers</Text>
            <View style={[styles.togglePill, { backgroundColor: showPois ? t.red : t.border2 }]}>
              <View style={[styles.toggleDot, { left: showPois ? 14 : 3 }]} />
            </View>
          </Pressable>}

          <Pressable onPress={() => setShowHeatmap(v => !v)} style={styles.layersToggleRow}>
            <TablerIcon name="gauge" size={15} color={showHeatmap ? t.red : t.secondary} />
            <Text style={[styles.layersToggleLabel, { color: showHeatmap ? t.ink : t.secondary }]}>Speed Heatmap</Text>
            <View style={[styles.togglePill, { backgroundColor: showHeatmap ? t.red : t.border2 }]}>
              <View style={[styles.toggleDot, { left: showHeatmap ? 14 : 3 }]} />
            </View>
          </Pressable>

          {!!process.env.EXPO_PUBLIC_HERE_API_KEY && <Pressable onPress={() => setTrafficOn(v => !v)} style={styles.layersToggleRow}>
            <TablerIcon name="traffic-lights" size={15} color={trafficOn ? t.red : t.secondary} />
            <Text style={[styles.layersToggleLabel, { color: trafficOn ? t.ink : t.secondary }]}>Live Traffic</Text>
            <View style={[styles.togglePill, { backgroundColor: trafficOn ? t.red : t.border2 }]}>
              <View style={[styles.toggleDot, { left: trafficOn ? 14 : 3 }]} />
            </View>
          </Pressable>}

          <View style={[styles.layersDivider, { backgroundColor: t.border }]} />
          <Pressable onPress={() => { setLayersOpen(false); router.push('/offline-map'); }} style={[styles.layersToggleRow, { paddingVertical: 9 }]}>
            <TablerIcon name="download" size={15} color={isOffline ? t.red : t.secondary} />
            <Text style={[styles.layersToggleLabel, { color: isOffline ? t.red : t.ink }]}>
              {isOffline ? 'Offline Mode' : 'Offline Maps'}
            </Text>
            <TablerIcon name="chevron-right" size={14} color={t.secondary} />
          </Pressable>
        </View>}

        <Pressable onPress={() => void zoom(0.5)} style={styles.mapButton} accessibilityLabel="Zoom in"><Text style={styles.zoomInText}>+</Text></Pressable>
        <Pressable onPress={() => void zoom(2)} style={styles.mapButton} accessibilityLabel="Zoom out"><Text style={styles.zoomOutText}>−</Text></Pressable>
        <Pressable onPress={fitFleet} style={styles.mapButton} accessibilityLabel="Fit vehicles"><TablerIcon name="locate" size={19} color={t.ink} /></Pressable>
        <Pressable
          onPress={() => { setFullscreen(v => !v); setLayersOpen(false); }}
          style={styles.mapButton}
          accessibilityLabel={fullscreen ? 'Exit full screen' : 'Full screen'}
        >
          <TablerIcon name={fullscreen ? 'minimize' : 'maximize'} size={18} color={fullscreen ? t.red : t.ink} />
        </Pressable>
      </View>

      {/* Floating pill strip */}
      {!sheetVehicle && !fullscreen && (
        <View style={styles.pillOverlay}>
          {error && !isOffline ? (
            <Pressable onPress={reload} style={[styles.pillStrip, { backgroundColor: t.card }]}>
              <Text style={[styles.errorText, { color: t.red }]}>{error}  Retry</Text>
            </Pressable>
          ) : (
            <View style={[styles.pillStrip, { backgroundColor: t.card }]}>
              {(['moving', 'idle', 'parked', 'offline'] as const).map((status, i) => {
                const dotColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: t.offline };
                const count = items.filter(item => getFleetStatus(item.point) === status).length;
                const isActive = statusFilter === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => toggleStatusFilter(status)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${status}`}
                    style={[styles.pillItem, isActive && { backgroundColor: `${t.red}12` }]}
                  >
                    {i > 0 && !isActive && statusFilter !== (['moving','idle','parked','offline'] as const)[i - 1] && (
                      <View pointerEvents="none" style={[styles.pillDivider, { backgroundColor: t.border }]} />
                    )}
                    <View style={[styles.pillDot, { backgroundColor: isActive ? t.red : dotColors[status] }]} />
                    <Text style={[styles.pillCount, { color: isActive ? t.red : t.ink }]}>{count}</Text>
                    <Text style={[styles.pillLabel, { color: isActive ? t.red : t.secondary }]}>
                      {status[0]!.toUpperCase() + status.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {statusFilter !== 'all' && (
            <Pressable onPress={() => setStatusFilter('all')} style={styles.filterResetRow}>
              <TablerIcon name="close" size={12} color={t.red} />
              <Text style={[styles.filterResetText, { color: t.red }]}>Clear filter · {filtered.length} shown</Text>
            </Pressable>
          )}
        </View>
      )}

      {sheetVehicle && <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />}
      {sheetVehicle && (() => {
        const item = sheetVehicle;
        const point = item.point!;
        const state = getFleetStatus(point);
        const statusColors: Record<string, string> = { moving: t.moving, idle: t.idle, parked: t.secondary, offline: '#e21d48' };
        const statusColor = statusColors[state] ?? '#e21d48';
        const plate = item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;
        const name = displayVehicleName(item.vehicle);
        const speedKmh = Math.round(point.speedKmh ?? 0);
        const ignitionRaw = (point as unknown as Record<string, unknown>).ignition;
        const ignition = speedKmh >= 5 ? true : (ignitionRaw as boolean | null | undefined) ?? null;
        const ignitionText = ignition === true ? 'ON' : ignition === false ? 'OFF' : '—';
        const ignitionColor = ignition === true ? t.moving : ignition === false ? t.offline : t.secondary;
        const ts = (point as unknown as Record<string, unknown>).timestamp ?? (point as unknown as Record<string, unknown>).updatedAt;
        const updatedAgo = ts ? (() => { const diff = Math.floor((Date.now() - new Date(ts as string).getTime()) / 1000); if (diff < 60) return `${diff}s`; if (diff < 3600) return `${Math.floor(diff / 60)}m`; return `${Math.floor(diff / 3600)}h`; })() : '—';
        const driverName = (item.vehicle as unknown as Record<string, unknown>)?.driverName as string | undefined;

        return (
          <Animated.View style={[styles.sheet, { bottom: insets.bottom, transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }] }]}>
            <View style={styles.sheetHandle} />

            {(() => {
              const statusIcons: Record<string, string> = { moving: 'power', idle: 'pause', parked: 'map-pin', offline: 'power' };
              return (
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetPlate, { color: t.ink }]}>{plate}</Text>
                    <Text style={[styles.sheetName, { color: t.secondary }]} numberOfLines={1}>{name}{driverName ? ` · ${driverName}` : ''}</Text>
                  </View>
                  <TablerIcon name={statusIcons[state] ?? 'power'} size={20} color={statusColor} strokeWidth={2.2} />
                </View>
              );
            })()}

            {(() => {
              const sw = Dimensions.get('window').width - 32;
              const sh = sw * 0.30 + 14;
              const maxSpeed = 200;
              const pct = Math.min(speedKmh / maxSpeed, 1);
              const VW = 390; const VH = Math.round(VW * 0.30) + 14;
              const R = 76; const CX = VW / 2; const CY = VH - 12;
              const arcLen = Math.PI * R;
              const dashOffset = arcLen - pct * arcLen;
              const needleRad = (180 + pct * 180) * Math.PI / 180;
              const nx = CX + (R - 14) * Math.cos(needleRad);
              const ny = CY + (R - 14) * Math.sin(needleRad);
              const speedArcColor = speedKmh < 60 ? '#16a34a' : speedKmh < 100 ? '#f59e0b' : '#e21d48';

              const pt = (s: number, r: number) => {
                const a = (180 + (s / maxSpeed) * 180) * Math.PI / 180;
                return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
              };
              const anchor = (s: number): 'middle' | 'start' | 'end' => {
                const cosA = Math.cos((180 + (s / maxSpeed) * 180) * Math.PI / 180);
                return cosA < -0.25 ? 'end' : cosA > 0.25 ? 'start' : 'middle';
              };
              const majorSpeeds = [0, 40, 80, 120, 160, 200];
              const minorSpeeds = [20, 60, 100, 140, 180];

              return (
                <View style={styles.speedoWrap}>
                  <Svg width={sw} height={sh} viewBox={`0 0 ${VW} ${VH}`}>
                    <Path d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`} fill="none" stroke={t.bg2} strokeWidth="10" strokeLinecap="butt" />
                    {(() => { const s = 150; const a = (180 + (s/maxSpeed)*180)*Math.PI/180; const ex = CX + R; const ey = CY; const sx = CX + R * Math.cos(a); const sy = CY + R * Math.sin(a); return <Path d={`M ${sx},${sy} A ${R},${R} 0 0,1 ${ex},${ey}`} fill="none" stroke="#e21d4820" strokeWidth="10" strokeLinecap="butt" />; })()}
                    <Path d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`} fill="none" stroke={speedArcColor} strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${arcLen} ${arcLen}`} strokeDashoffset={dashOffset} />
                    {minorSpeeds.map(s => { const o = pt(s, R + 2); const i = pt(s, R - 7); return <Path key={s} d={`M ${o.x},${o.y} L ${i.x},${i.y}`} stroke={t.secondary} strokeWidth="1" strokeLinecap="round" />; })}
                    {majorSpeeds.map(s => { const o = pt(s, R + 2); const i = pt(s, R - 11); return <Path key={s} d={`M ${o.x},${o.y} L ${i.x},${i.y}`} stroke={t.ink} strokeWidth="1.5" strokeLinecap="round" />; })}
                    {majorSpeeds.map(s => { const p = pt(s, R + 18); const dy = anchor(s) === 'middle' ? 0 : 3; return <SvgText key={s} x={p.x} y={p.y + dy} textAnchor={anchor(s)} fontSize="10" fill={t.secondary} fontWeight="500">{s}</SvgText>; })}
                    <Path d={`M ${CX},${CY} L ${nx},${ny}`} stroke={t.ink} strokeWidth="2" strokeLinecap="round" />
                    <Path d={`M ${CX - 5},${CY} A 5,5 0 1,1 ${CX + 5},${CY} Z`} fill={t.ink} />
                    <Path d={`M ${CX - 3},${CY} A 3,3 0 1,1 ${CX + 3},${CY} Z`} fill={t.card} />
                    <SvgText x={CX} y={CY - 24} textAnchor="middle" fontSize="34" fontWeight="700" fill={t.ink}>{speedKmh}</SvgText>
                    <SvgText x={CX} y={CY - 10} textAnchor="middle" fontSize="10" fill={t.secondary}>km/h</SvgText>
                  </Svg>

                  <View style={styles.speedoInfoRow}>
                    <View style={styles.speedoInfoItem}>
                      <View style={[styles.speedoSideDot, { backgroundColor: ignitionColor }]} />
                      <Text style={[styles.speedoSideValue, { color: t.ink }]}>{ignitionText}</Text>
                      <Text style={[styles.speedoSideLabel, { color: t.secondary }]}>Ignition</Text>
                    </View>
                    <View style={styles.speedoInfoItem}>
                      <TablerIcon name="gauge" size={14} color={t.secondary} />
                      <Text style={[styles.speedoSideValue, { color: t.ink }]}>{Number(item.vehicle?.odometerKm ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                      <Text style={[styles.speedoSideLabel, { color: t.secondary }]}>km</Text>
                    </View>
                    <View style={styles.speedoInfoItem}>
                      <TablerIcon name="clock" size={14} color={t.secondary} />
                      <Text style={[styles.speedoSideValue, { color: t.ink }]}>{updatedAgo}</Text>
                      <Text style={[styles.speedoSideLabel, { color: t.secondary }]}>Updated</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {item.vehicle && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                {odoEdit ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.bg2, borderRadius: 8, padding: 8 }}>
                    <TablerIcon name="gauge" size={14} color={t.secondary} />
                    <TextInput
                      autoFocus keyboardType="numeric" value={odoInput}
                      onChangeText={setOdoInput}
                      style={{ flex: 1, height: 32, fontSize: 13, color: t.ink, borderWidth: 1, borderColor: t.border, borderRadius: 6, paddingHorizontal: 8, backgroundColor: t.card }}
                      placeholder="km"
                      placeholderTextColor={t.secondary}
                    />
                    <Pressable onPress={() => item.vehicle && void saveOdometer(item.vehicle.id)} disabled={odoSaving}
                      style={{ height: 32, paddingHorizontal: 12, backgroundColor: t.red, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{odoSaving ? '…' : 'Save'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setOdoEdit(false)}
                      style={{ height: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: t.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: t.secondary, fontSize: 12 }}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => { setOdoInput(String(item.vehicle?.odometerKm ?? 0)); setOdoEdit(true); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.bg2, borderRadius: 8, padding: 8 }}>
                    <TablerIcon name="gauge" size={14} color={t.secondary} />
                    <Text style={{ flex: 1, fontSize: 12, color: t.secondary }}>Set Odometer</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563eb' }}>{Number(item.vehicle?.odometerKm ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km</Text>
                    <TablerIcon name="pencil" size={13} color={t.secondary} />
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.sheetButtons}>
              <Pressable onPress={closeSheet}>
                <Text style={[styles.sheetBtnText, { color: t.secondary }]}>Close</Text>
              </Pressable>
              <Pressable onPress={() => openVehicleDetails(item.device.imei)}>
                <Text style={[styles.sheetBtnPrimaryText, { color: t.red }]}>Full Details</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })()}
    </View>
  );
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.canvas },
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, zIndex: 10 },
  topRow: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { height: 32, width: 128 },
  iconButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  searchActiveDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: t.red, borderWidth: 1.5, borderColor: t.card },
  searchPanel: { marginTop: 6, backgroundColor: t.card, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4, overflow: 'hidden' },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, height: 46 },
  searchInput: { flex: 1, padding: 0, fontSize: 14 },
  vehicleCount: { fontSize: 12, color: t.secondary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  searchDivider: { height: 1, backgroundColor: t.border, marginHorizontal: 0 },
  mapActions: { position: 'absolute', right: 12, alignItems: 'flex-end', gap: 7, zIndex: 5 },
  mapButton: { height: 40, width: 40, borderRadius: 10, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  zoomInText: { fontSize: 24, lineHeight: 27, color: t.red, fontWeight: '500' },
  zoomOutText: { fontSize: 24, lineHeight: 27, color: t.ink, fontWeight: '300' },
  // Layers panel
  layersPanel: { position: 'absolute', right: 48, top: 0, width: 168, backgroundColor: t.card, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6, overflow: 'hidden', paddingBottom: 6 },
  layersSectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 4 },
  layersOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: 13 },
  layersOptionText: { fontSize: 13 },
  layersDivider: { height: 1, marginHorizontal: 0, marginTop: 4 },
  layersToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 9 },
  layersToggleLabel: { flex: 1, fontSize: 12, fontWeight: '500' },
  togglePill: { width: 30, height: 18, borderRadius: 9, justifyContent: 'center' },
  toggleDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', top: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  // Markers
  markerWrap: { alignItems: 'center' }, carImage: { width: 27, height: 35 },
  plateLabel: { backgroundColor: t.card, borderRadius: 4, paddingRight: 5, flexDirection: 'row', alignItems: 'stretch', marginTop: 2, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, overflow: 'hidden' },
  plateStatusBar: { width: 3, marginRight: 4 },
  plateText: { color: t.ink, fontSize: 9, fontWeight: '700', paddingVertical: 3 },
  clusterMarker: { height: 38, minWidth: 38, paddingHorizontal: 7, borderRadius: 20, backgroundColor: t.red, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  clusterCount: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  // Bottom overlay
  pillOverlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center', bottom: 10 },
  pillStrip: { flexDirection: 'row', borderRadius: 50, paddingVertical: 7, paddingHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6, overflow: 'hidden' },
  pillItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 3, borderRadius: 50, position: 'relative' },
  pillDivider: { position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1 },
  pillDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  pillCount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillLabel: { fontSize: 11, fontWeight: '500' },
  filterResetRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingVertical: 4 },
  filterResetText: { fontSize: 11, fontWeight: '600' },
  errorText: { color: t.red, fontSize: 12, fontWeight: '500' },
  // Sheet
  sheetBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 19 },
  sheet: { position: 'absolute', left: 10, right: 10, backgroundColor: t.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, paddingHorizontal: 16, paddingBottom: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12, zIndex: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, alignSelf: 'center', marginTop: 6, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sheetTitleWrap: { flex: 1, minWidth: 0 },
  sheetPlate: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  sheetName: { fontSize: 11, marginTop: 1 },
  sheetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  sheetBadgeText: { fontSize: 12, fontWeight: '600' },
  speedoWrap: { marginHorizontal: -16, marginBottom: 2 },
  speedoInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 2, marginTop: -18 },
  speedoInfoItem: { alignItems: 'center', gap: 1 },
  speedoSideDot: { width: 6, height: 6, borderRadius: 3 },
  speedoSideValue: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  speedoSideLabel: { fontSize: 10 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  sheetBtnText: { fontSize: 13, fontWeight: '600' },
  sheetBtnPrimaryText: { fontSize: 13, fontWeight: '600' },
  groupList: { maxHeight: 220 },
  groupListItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
  groupListItemActive: { backgroundColor: `${t.red}0d` },
  groupListText: { flex: 1, fontSize: 13, color: t.ink },
  groupListTextActive: { color: t.red, fontWeight: '600' },
}); }
