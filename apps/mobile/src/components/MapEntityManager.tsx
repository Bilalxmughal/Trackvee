import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, Polygon, UrlTile, type MapPressEvent, type Region } from 'react-native-maps';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import api from '../lib/api';
import { POI_ICONS } from '../lib/poi-icons';
import { TablerIcon } from './TablerIcon';
import { usePortalPermissions } from '../auth/PortalPermissionsProvider';
import { useTheme } from '../hooks/useTheme';
import type { AppTheme } from '../theme';

type Coordinate = [number, number];
type GeoShape = 'circle' | 'polygon';
type Geofence = { id: string; name: string; type: GeoShape; coordinates: { center: Coordinate; radius: number } | { points: Coordinate[] }; color: string; triggerOnEnter: boolean; triggerOnExit: boolean };
type Poi = { id: string; name: string; description: string | null; group: string | null; icon: string; latitude: number; longitude: number; radius: number };
type Kind = 'geofences' | 'pois';
type Draft = { id?: string; name: string; shape: GeoShape; color: string; center: Coordinate | null; radius: string; points: Coordinate[]; triggerOnEnter: boolean; triggerOnExit: boolean; description: string; group: string; icon: string; latitude: string; longitude: string };

const DEFAULT_REGION: Region = { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.14, longitudeDelta: 0.14 };
const EMPTY_DRAFT: Draft = { name: '', shape: 'circle', color: '#dc2626', center: null, radius: '500', points: [], triggerOnEnter: true, triggerOnExit: false, description: '', group: '', icon: 'map-pin', latitude: '', longitude: '' };
const isCoordinate = (point: unknown): point is Coordinate => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[0] >= -90 && point[0] <= 90 && point[1] >= -180 && point[1] <= 180;

function IconGlyph({ name, size = 18, color = '#6b7280' }: { name: string; size?: number; color?: string }) {
  const icon = POI_ICONS.find(item => item.id === name) ?? POI_ICONS[0]!;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d={icon.path}/></Svg>;
}

export default function MapEntityManager({ kind }: { kind: Kind }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const feature = kind;
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const [items, setItems] = useState<Array<Geofence | Poi>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [iconQuery, setIconQuery] = useState('');
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const mapRef = useRef<MapView | null>(null);
  const title = kind === 'geofences' ? 'Geofences' : 'Points of Interest';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Array<Geofence | Poi>>(`/${kind}`);
      setItems(response.data);
    } catch {
      setError(`${title} could not be loaded. Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }, [kind, title]);

  useFocusEffect(useCallback(() => {
    if (!permissionsLoading && canDo(feature)) void load();
  }, [canDo, feature, load, permissionsLoading]));

  const groups = useMemo(() => [...new Set(items.flatMap(item => kind === 'pois' && (item as Poi).group ? [(item as Poi).group!] : []))].sort(), [items, kind]);
  const filtered = useMemo(() => items.filter(item => {
    const name = item.name.toLowerCase();
    if (!name.includes(query.trim().toLowerCase())) return false;
    return kind !== 'pois' || !groupFilter || (item as Poi).group === groupFilter;
  }), [items, kind, query, groupFilter]);

  const startCreate = () => {
    setError('');
    setIconQuery('');
    setDraft({ ...EMPTY_DRAFT, shape: 'circle' });
  };

  const startEdit = (item: Geofence | Poi) => {
    setError('');
    setIconQuery('');
    if (kind === 'geofences') {
      const geofence = item as Geofence;
      const circle = geofence.type === 'circle' ? geofence.coordinates as { center: Coordinate; radius: number } : null;
      const polygon = geofence.type === 'polygon' ? ((geofence.coordinates as { points?: Coordinate[] })?.points ?? []).filter(isCoordinate) : [];
      setDraft({ ...EMPTY_DRAFT, id: geofence.id, name: geofence.name, shape: geofence.type, color: geofence.color || '#dc2626', center: circle?.center ?? null, radius: String(circle?.radius ?? 500), points: polygon, triggerOnEnter: geofence.triggerOnEnter, triggerOnExit: geofence.triggerOnExit });
      const coords = circle?.center ?? polygon[0];
      if (coords) setMapRegion({ latitude: coords[0], longitude: coords[1], latitudeDelta: 0.05, longitudeDelta: 0.05 });
    } else {
      const poi = item as Poi;
      setDraft({ ...EMPTY_DRAFT, id: poi.id, name: poi.name, description: poi.description ?? '', group: poi.group ?? '', icon: poi.icon || 'map-pin', latitude: String(poi.latitude), longitude: String(poi.longitude), radius: String(poi.radius || 200) });
      setMapRegion({ latitude: poi.latitude, longitude: poi.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    }
  };

  const updateDraft = (values: Partial<Draft>) => setDraft(previous => previous ? { ...previous, ...values } : previous);

  const addMapPoint = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    if (kind === 'pois') {
      updateDraft({ latitude: String(latitude), longitude: String(longitude) });
      return;
    }
    if (draft?.shape === 'circle') updateDraft({ center: [latitude, longitude] });
    else updateDraft({ points: [...(draft?.points ?? []), [latitude, longitude] as Coordinate] });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Name is required.'); return; }
    let payload: Record<string, unknown>;
    if (kind === 'geofences') {
      if (draft.shape === 'circle') {
        const radius = Number(draft.radius);
        if (!draft.center) { setError('Tap the map to choose the circle center.'); return; }
        if (!Number.isFinite(radius) || radius < 100 || radius > 50000) { setError('Radius must be between 100 m and 50 km.'); return; }
        if (!/^#[\da-fA-F]{6}$/.test(draft.color)) { setError('Enter a valid 6-digit hex color.'); return; }
        payload = { name: draft.name.trim(), type: 'circle', coordinates: { center: draft.center, radius }, color: draft.color, triggerOnEnter: draft.triggerOnEnter, triggerOnExit: draft.triggerOnExit };
      } else {
        if (draft.points.length < 3) { setError('Add at least 3 points to draw a polygon.'); return; }
        if (!/^#[\da-fA-F]{6}$/.test(draft.color)) { setError('Enter a valid 6-digit hex color.'); return; }
        payload = { name: draft.name.trim(), type: 'polygon', coordinates: { points: draft.points }, color: draft.color, triggerOnEnter: draft.triggerOnEnter, triggerOnExit: draft.triggerOnExit };
      }
    } else {
      const latitude = Number(draft.latitude), longitude = Number(draft.longitude), radius = Number(draft.radius);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { setError('Tap the map to choose a valid location.'); return; }
      if (!Number.isFinite(radius) || radius < 0) { setError('Radius must be zero or greater.'); return; }
      payload = { name: draft.name.trim(), description: draft.description.trim() || null, group: draft.group.trim() || null, icon: draft.icon, latitude, longitude, radius };
    }

    setSaving(true);
    setError('');
    try {
      const response = draft.id
        ? await api.put<Geofence | Poi>(`/${kind}/${draft.id}`, payload)
        : await api.post<Geofence | Poi>(`/${kind}`, payload);
      setItems(current => draft.id ? current.map(item => item.id === response.data.id ? response.data : item) : [response.data, ...current]);
      setDraft(null);
    } catch {
      setError(`${kind === 'geofences' ? 'Geofence' : 'POI'} could not be saved. Check your access and try again.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: Geofence | Poi) => Alert.alert(`Delete ${kind === 'geofences' ? 'geofence' : 'POI'}?`, `Delete “${item.name}”?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      try { await api.delete(`/${kind}/${item.id}`); setItems(current => current.filter(row => row.id !== item.id)); }
      catch { setError(`${kind === 'geofences' ? 'Geofence' : 'POI'} could not be deleted. Check your access and try again.`); }
    })(); } },
  ]);

  useEffect(() => {
    if (!permissionsLoading && !canDo(feature)) router.replace('/map');
  }, [canDo, feature, permissionsLoading]);
  if (!permissionsLoading && !canDo(feature)) return null;
  if (permissionsLoading || loading && !items.length && !draft) return <SafeAreaView style={styles.center}><ActivityIndicator color={t.red}/></SafeAreaView>;

  if (draft) {
    const poiLat = Number(draft.latitude), poiLng = Number(draft.longitude);
    const poiPoint: Coordinate | null = Number.isFinite(poiLat) && Number.isFinite(poiLng) && draft.latitude !== '' && draft.longitude !== '' ? [poiLat, poiLng] : null;
    const filteredIcons = POI_ICONS.filter(icon => !iconQuery.trim() || `${icon.label} ${icon.id}`.toLowerCase().includes(iconQuery.trim().toLowerCase()));
    const zoneColor = /^#[\da-fA-F]{6}$/.test(draft.color) ? draft.color : t.red;
    return <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => setDraft(null)} accessibilityLabel="Back to list" style={styles.headerBack}><TablerIcon name="arrow-left" size={19} color={t.ink}/></Pressable><Text style={styles.headerTitle}>{draft.id ? 'Edit' : 'New'} {kind === 'geofences' ? 'Geofence' : 'POI'}</Text><View style={{ width: 36 }}/></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorContent}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={draft.name} onChangeText={name => updateDraft({ name })} placeholder={kind === 'geofences' ? 'Zone name' : 'POI name'} placeholderTextColor={t.muted} style={styles.field}/>

        {kind === 'geofences' ? <>
          <Text style={styles.label}>Shape</Text>
          <View style={styles.segmentRow}>{(['circle', 'polygon'] as const).map(shape => <Pressable key={shape} onPress={() => updateDraft({ shape })} style={[styles.segment, draft.shape === shape && styles.segmentSelected]}><Text style={[styles.segmentText, draft.shape === shape && styles.segmentTextSelected]}>{shape === 'circle' ? 'Circle' : 'Polygon'}</Text></Pressable>)}</View>
          <Text style={styles.label}>Zone color · Hex</Text>
          <View style={styles.colorRow}><View style={[styles.colorSwatch, { backgroundColor: /^#[\da-fA-F]{6}$/.test(draft.color) ? draft.color : t.red }]}/><TextInput value={draft.color} onChangeText={color => updateDraft({ color })} autoCapitalize="none" placeholder="#dc2626" placeholderTextColor={t.muted} style={[styles.field, { flex: 1, fontFamily: 'monospace' }]}/></View>
          <Text style={styles.helper}>Tap the map to {draft.shape === 'circle' ? 'set the center.' : 'add polygon corners.'}</Text>
        </> : <>
          <Text style={styles.label}>Description</Text>
          <TextInput value={draft.description} onChangeText={description => updateDraft({ description })} placeholder="Optional details" placeholderTextColor={t.muted} style={[styles.field, styles.multiline]} multiline textAlignVertical="top"/>
          <Text style={styles.label}>Group</Text>
          <TextInput value={draft.group} onChangeText={group => updateDraft({ group })} placeholder="Optional group name" placeholderTextColor={t.muted} style={styles.field}/>
          <Text style={styles.label}>Location · Tap map to pin</Text>
        </>}

        <View style={styles.mapFrame}>
          <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={mapRegion} mapType="none" onPress={addMapPoint} onRegionChangeComplete={setMapRegion} toolbarEnabled={false} showsCompass={false}>
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={256}/>
            {kind === 'geofences' && draft.shape === 'circle' && draft.center && <><Circle center={{ latitude: draft.center[0], longitude: draft.center[1] }} radius={Math.max(0, Number(draft.radius) || 0)} strokeColor={zoneColor} fillColor={`${zoneColor}2A`} strokeWidth={2}/><Marker coordinate={{ latitude: draft.center[0], longitude: draft.center[1] }} pinColor={t.red} draggable onDragEnd={event => updateDraft({ center: [event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude] })}/></>}
            {kind === 'geofences' && draft.shape === 'polygon' && <>{draft.points.length >= 3 && <Polygon coordinates={draft.points.map(point => ({ latitude: point[0], longitude: point[1] }))} strokeColor={zoneColor} fillColor={`${zoneColor}2A`} strokeWidth={2} />}{draft.points.map((point, index) => <Marker key={`point-${index}`} coordinate={{ latitude: point[0], longitude: point[1] }} tracksViewChanges><View style={styles.pointMarker}><Text style={styles.pointMarkerText}>{index + 1}</Text></View></Marker>)}</>}
            {kind === 'pois' && poiPoint && <><Circle center={{ latitude: poiPoint[0], longitude: poiPoint[1] }} radius={Math.max(0, Number(draft.radius) || 0)} strokeColor={t.red} fillColor="#dc262622" strokeWidth={1}/><Marker coordinate={{ latitude: poiPoint[0], longitude: poiPoint[1] }} pinColor={t.red}><View style={styles.poiMarker}><IconGlyph name={draft.icon} size={17} color={t.red}/></View></Marker></>}
          </MapView>
          <View pointerEvents="none" style={styles.mapHint}><Text style={styles.mapHintText}>{kind === 'geofences' && draft.shape === 'polygon' ? `${draft.points.length} points · 3 minimum` : kind === 'geofences' ? draft.center ? `${draft.center[0].toFixed(5)}, ${draft.center[1].toFixed(5)}` : 'Tap to choose circle center' : poiPoint ? `${poiPoint[0].toFixed(5)}, ${poiPoint[1].toFixed(5)}` : 'Tap to choose POI location'}</Text></View>
        </View>

        {kind === 'geofences' && draft.shape === 'circle' ? <>
          <View style={styles.inlineLabel}><Text style={styles.label}>Radius</Text><Text style={styles.value}>{Number(draft.radius) >= 1000 ? `${(Number(draft.radius) / 1000).toFixed(1)} km` : `${draft.radius || 0} m`}</Text></View>
          <View style={styles.radiusRow}><Pressable onPress={() => updateDraft({ radius: String(Math.max(100, (Number(draft.radius) || 500) - 100)) })} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><TextInput value={draft.radius} onChangeText={radius => updateDraft({ radius: radius.replace(/[^\d]/g, '') })} keyboardType="number-pad" style={[styles.field, { flex: 1, textAlign: 'center' }]} accessibilityLabel="Radius in metres"/><Pressable onPress={() => updateDraft({ radius: String(Math.min(50000, (Number(draft.radius) || 500) + 100)) })} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>
        </> : null}
        {kind === 'geofences' && draft.shape === 'polygon' ? <>
          <View style={styles.inlineLabel}><Text style={styles.label}>Polygon points ({draft.points.length})</Text>{draft.points.length > 0 && <Pressable onPress={() => updateDraft({ points: [] })}><Text style={styles.textAction}>Clear</Text></Pressable>}</View>
          {draft.points.map((point, index) => <View key={`point-row-${index}`} style={styles.pointRow}><View style={styles.pointIndex}><Text style={styles.pointIndexText}>{index + 1}</Text></View><Text style={styles.pointCoordinates}>{point[0].toFixed(5)}, {point[1].toFixed(5)}</Text><Pressable onPress={() => updateDraft({ points: draft.points.filter((_, pointIndex) => pointIndex !== index) })} accessibilityLabel={`Remove point ${index + 1}`}><TablerIcon name="close" size={17} color={t.secondary}/></Pressable></View>)}
        </> : null}
        {kind === 'geofences' ? <>
          <Text style={styles.label}>Alerts</Text>
          <View style={styles.eventRow}>{([['triggerOnEnter', 'Enter'], ['triggerOnExit', 'Exit']] as const).map(([field, label]) => <Pressable key={field} onPress={() => updateDraft({ [field]: !draft[field] })} style={styles.eventToggle}><View style={[styles.checkbox, draft[field] && styles.checkboxOn]}>{draft[field] && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.eventText}>{label}</Text></Pressable>)}</View>
        </> : null}
        {kind === 'pois' ? <>
          <Text style={styles.label}>Radius (meters)</Text>
          <TextInput value={draft.radius} onChangeText={radius => updateDraft({ radius: radius.replace(/[^\d]/g, '') })} keyboardType="number-pad" style={styles.field}/>
          <View style={styles.inlineLabel}><Text style={styles.label}>Map icon</Text><Text style={styles.selectedIconName}>{POI_ICONS.find(icon => icon.id === draft.icon)?.label ?? 'Map Pin'}</Text></View>
          <TextInput value={iconQuery} onChangeText={setIconQuery} placeholder="Search icons" placeholderTextColor={t.muted} style={styles.field}/>
          <View style={styles.iconGrid}>{filteredIcons.map(icon => <Pressable key={icon.id} onPress={() => updateDraft({ icon: icon.id })} accessibilityRole="button" accessibilityState={{ selected: draft.icon === icon.id }} accessibilityLabel={icon.label} style={[styles.iconChoice, draft.icon === icon.id && styles.iconChoiceSelected]}><IconGlyph name={icon.id} size={20} color={draft.icon === icon.id ? t.red : t.secondary}/></Pressable>)}</View>
        </> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.footer}><Pressable disabled={saving} onPress={() => setDraft(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : draft.id ? 'Save changes' : `Create ${kind === 'geofences' ? 'geofence' : 'POI'}`}</Text></Pressable></View>
      </ScrollView>
    </SafeAreaView>;
  }

  if (!canDo(feature)) return null;
  return <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.headerBack}><TablerIcon name="arrow-left" size={19} color={t.ink}/></Pressable><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text></View>{canDo(feature, 'add') && <Pressable onPress={startCreate} accessibilityRole="button" accessibilityLabel={`Add ${kind === 'geofences' ? 'geofence' : 'POI'}`} style={styles.addButton}><TablerIcon name="plus" size={19} color="#fff"/></Pressable>}</View>
    <View style={styles.search}><TablerIcon name="search" size={17} color={t.secondary}/><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${kind === 'geofences' ? 'geofences' : 'POIs'}`} placeholderTextColor={t.muted} style={styles.searchInput}/></View>
    {kind === 'pois' && groups.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupFilters} contentContainerStyle={styles.groupFilterContent}>{['', ...groups].map(group => <Pressable key={group || 'all'} onPress={() => setGroupFilter(group)} style={[styles.groupFilter, groupFilter === group && styles.groupFilterSelected]}><Text style={[styles.groupFilterText, groupFilter === group && styles.groupFilterTextSelected]}>{group || 'All groups'}</Text></Pressable>)}</ScrollView> : null}
    {error ? <Pressable onPress={() => void load()} style={styles.errorBox}><Text style={styles.error}>{error}  Retry</Text></Pressable> : null}
    {loading && !items.length ? <ActivityIndicator style={{ marginTop: 32 }} color={t.red}/> : <FlatList data={filtered} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={t.red}/>} contentContainerStyle={!filtered.length ? styles.emptyList : styles.listContent} renderItem={({ item }) => <View style={styles.itemRow}>
      <View style={[styles.itemAccent, { backgroundColor: kind === 'geofences' ? (item as Geofence).color || t.red : t.red }]}/>
      {kind === 'pois' ? <View style={styles.itemIcon}><IconGlyph name={(item as Poi).icon} color={t.red}/></View> : <TablerIcon name="geofence" size={20} color={t.red}/>}
      <View style={styles.itemMain}><Text numberOfLines={1} style={styles.itemName}>{item.name}</Text><Text numberOfLines={1} style={styles.itemMeta}>{kind === 'geofences' ? geofenceSummary(item as Geofence) : poiSummary(item as Poi)}</Text></View>
      {canDo(feature, 'edit') && <Pressable onPress={() => startEdit(item)} style={styles.rowAction} accessibilityLabel={`Edit ${item.name}`}><TablerIcon name="edit" size={17} color={t.secondary}/></Pressable>}
      {canDo(feature, 'delete') && <Pressable onPress={() => remove(item)} style={styles.rowAction} accessibilityLabel={`Delete ${item.name}`}><TablerIcon name="trash" size={17} color={t.secondary}/></Pressable>}
    </View>} ListEmptyComponent={<View style={styles.emptyCopy}><TablerIcon name={kind === 'geofences' ? 'geofence' : 'map-pin'} size={28} color={t.muted}/><Text style={styles.emptyTitle}>{loading ? `Loading ${title.toLowerCase()}…` : `No ${kind === 'geofences' ? 'geofences' : 'POIs'} found`}</Text><Text style={styles.emptySubtitle}>{loading ? '' : canDo(feature, 'add') ? `Add a ${kind === 'geofences' ? 'geofence' : 'POI'} to see it here.` : 'Items shared with your organization will appear here.'}</Text></View>}/>}
  </SafeAreaView>;
}

function geofenceSummary(item: Geofence) {
  if (item.type === 'circle') {
    const radius = (item.coordinates as { radius?: number })?.radius ?? 0;
    return `Circle · ${radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}`;
  }
  return `Polygon · ${(item.coordinates as { points?: Coordinate[] })?.points?.length ?? 0} points`;
}
function poiSummary(item: Poi) { return [item.group, `${item.radius || 0} m`].filter(Boolean).join(' · '); }

function createStyles(t: AppTheme) {
  const inputStyle = { minHeight: 43, borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 11, color: t.ink, fontSize: 13, backgroundColor: t.inputBg } as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerBack: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2 },
    headerTitle: { color: t.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    headerSubtitle: { color: t.secondary, fontSize: 12, marginTop: 2 },
    addButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 2, color: t.ink },
    groupFilters: { maxHeight: 44 },
    groupFilterContent: { paddingHorizontal: 16, paddingVertical: 4, gap: 8, alignItems: 'center' },
    groupFilter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: t.bg2 },
    groupFilterSelected: { backgroundColor: `${t.red}14` },
    groupFilterText: { color: t.secondary, fontSize: 12 },
    groupFilterTextSelected: { color: t.red, fontWeight: '700' },
    itemRow: { minHeight: 70, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 16, marginVertical: 4, borderRadius: 14, backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    listContent: { paddingTop: 4, paddingBottom: 24 },
    itemAccent: { width: 3, height: 44, borderRadius: 2 },
    itemIcon: { width: 26, alignItems: 'center' },
    itemMain: { flex: 1, minWidth: 0 },
    itemName: { color: t.ink, fontSize: 13, fontWeight: '600' },
    itemMeta: { color: t.secondary, fontSize: 11, marginTop: 4 },
    rowAction: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
    emptyList: { flexGrow: 1, justifyContent: 'center' },
    emptyCopy: { alignItems: 'center', padding: 32 },
    emptyTitle: { marginTop: 13, color: t.ink, fontSize: 14, fontWeight: '600' },
    emptySubtitle: { marginTop: 6, color: t.secondary, fontSize: 12, textAlign: 'center' },
    errorBox: { paddingHorizontal: 16, paddingBottom: 10 },
    error: { color: t.red, fontSize: 12 },
    editorContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 0 },
    label: { marginTop: 14, marginBottom: 7, color: t.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.35, textTransform: 'uppercase' },
    field: inputStyle,
    multiline: { minHeight: 80, paddingVertical: 10, textAlignVertical: 'top' },
    helper: { marginTop: 7, color: t.secondary, fontSize: 11 },
    segmentRow: { flexDirection: 'row', gap: 8 },
    segment: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: t.bg2 },
    segmentSelected: { backgroundColor: t.red },
    segmentText: { color: t.secondary, fontSize: 13, fontWeight: '500' },
    segmentTextSelected: { color: '#fff', fontWeight: '600' },
    colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: t.border },
    mapFrame: { height: 290, marginTop: 12, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: '#eef1f2' },
    mapHint: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: t.border, borderRadius: 5 },
    mapHintText: { color: t.ink, fontSize: 10, fontWeight: '600' },
    pointMarker: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: t.red, borderWidth: 2, borderColor: '#fff' },
    pointMarkerText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    poiMarker: { minWidth: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, borderWidth: 2, borderColor: t.red, borderRadius: 16 },
    inlineLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 7 },
    value: { color: t.red, fontSize: 12, fontWeight: '700' },
    radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepButton: { width: 43, height: 43, borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.bg2, alignItems: 'center', justifyContent: 'center' },
    stepText: { color: t.red, fontSize: 22, lineHeight: 26 },
    pointRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: t.border },
    pointIndex: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red },
    pointIndexText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    pointCoordinates: { flex: 1, color: t.ink, fontFamily: 'monospace', fontSize: 10 },
    textAction: { color: t.red, fontSize: 12, fontWeight: '600' },
    eventRow: { flexDirection: 'row', gap: 22, paddingVertical: 10 },
    eventToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: t.border, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: t.red, borderColor: t.red },
    checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
    eventText: { color: t.ink, fontSize: 13 },
    selectedIconName: { color: t.red, fontSize: 12, fontWeight: '600' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
    iconChoice: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: t.bg2 },
    iconChoiceSelected: { backgroundColor: `${t.red}18`, borderWidth: 1.5, borderColor: t.red },
    footer: { flexDirection: 'row', gap: 10, marginTop: 20 },
    cancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.bg2 },
    cancelText: { color: t.secondary, fontSize: 13, fontWeight: '600' },
    saveButton: { flex: 2, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: t.red },
    saveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    disabled: { opacity: 0.6 },
  });
}
