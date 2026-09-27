import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
type Filter = 'all' | 'moving' | 'idle' | 'parked' | 'offline';
type Sort = 'plate' | 'name' | 'speed';
const FILTERS: Filter[] = ['all', 'moving', 'idle', 'parked', 'offline'];
const openVehicle = (item: FleetItem) => router.push({ pathname: '/vehicle/[imei]', params: { imei: item.device.imei } });

export default function VehiclesScreen() {
  const { items, loading, error, reload } = useFleet();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  useEffect(() => { if (!permissionsLoading && !canDo('vehicles')) router.replace('/map'); }, [canDo, permissionsLoading]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('plate');
  const [menuImei, setMenuImei] = useState<string | null>(null);
  const [cutItem, setCutItem] = useState<FleetItem | null>(null);
  const [immobilizerOverride, setImmobilizerOverride] = useState<Record<string, boolean>>({});
  const vehicles = useMemo(() => items.filter(item => {
    const text = `${item.vehicle?.licensePlate ?? ''} ${item.vehicle?.displayId ?? ''} ${displayVehicleName(item.vehicle)}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (filter === 'all' || getFleetStatus(item.point) === filter);
  }).sort((a, b) => sort === 'speed' ? (b.point?.speedKmh ?? -1) - (a.point?.speedKmh ?? -1) : sort === 'name' ? displayVehicleName(a.vehicle).localeCompare(displayVehicleName(b.vehicle)) : (a.vehicle?.licensePlate ?? '').localeCompare(b.vehicle?.licensePlate ?? '')), [items, query, filter, sort]);
  const menuItem = items.find(item => item.device.imei === menuImei);
  return <SafeAreaView style={s.container} edges={['top']}>
    <View style={s.header}><Text style={s.title}>Vehicles</Text><Text style={s.count}>{vehicles.length} / {items.length}</Text></View>
    <View style={s.search}><TablerIcon name="search" size={18} color={theme.secondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search ID, plate or vehicle" placeholderTextColor={theme.muted} style={s.searchInput} accessibilityLabel="Search vehicles" /></View>
    <View style={s.filters}><FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={value => value} renderItem={({ item }) => <Pressable onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterActive]}><Text style={[s.filterText, filter === item && s.filterTextActive]}>{item[0]!.toUpperCase() + item.slice(1)}</Text></Pressable>} /><Pressable onPress={() => setSort(current => current === 'plate' ? 'name' : current === 'name' ? 'speed' : 'plate')} style={s.sort} accessibilityLabel={`Sort by ${sort}. Change sorting`}><Text style={s.sortText}>{sort === 'plate' ? 'Plate' : sort === 'name' ? 'Name' : 'Speed'} ▾</Text></Pressable></View>
    {error ? <Pressable onPress={reload} style={s.error}><Text style={s.errorText}>{error}  Retry</Text></Pressable> : null}
    <FlatList data={vehicles} keyExtractor={item => item.device.imei} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.red} />} contentContainerStyle={!vehicles.length ? s.empty : undefined} renderItem={({ item }) => {
      const status = getFleetStatus(item.point);
      const plate = item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;
      return <View style={s.row}><View style={[s.stateBorder, { backgroundColor: STATUS_COLOR[status] }]} /><Pressable onPress={() => openVehicle(item)} style={s.rowMain} accessibilityLabel={`Open ${plate}`}>
        <Text style={s.id}>ID {item.vehicle?.displayId ?? '—'}</Text><Text style={s.plate}>{plate}</Text><Text style={s.name}>{displayVehicleName(item.vehicle)}</Text>
      </Pressable><View style={s.rowRight}><Text style={[s.status, { color: STATUS_COLOR[status] }]}>{status[0]!.toUpperCase() + status.slice(1)}</Text><Text style={s.speed}>{item.point ? `${Math.round(item.point.speedKmh)} km/h` : 'No data'}</Text></View>
      <Pressable onPress={() => setMenuImei(current => current === item.device.imei ? null : item.device.imei)} style={s.menuButton} accessibilityLabel={`Actions for ${plate}`}><TablerIcon name="more" size={20} color={theme.secondary} /></Pressable>
    </View>;
    }} ListEmptyComponent={<View><Text style={s.emptyTitle}>{loading ? 'Loading vehicles…' : 'No vehicles found'}</Text><Text style={s.emptySubtitle}>{loading ? '' : 'Try another search or status filter.'}</Text></View>} />
    <Modal visible={!!menuItem} transparent animationType="none" onRequestClose={() => setMenuImei(null)}><Pressable onPress={() => setMenuImei(null)} style={s.menuShade}><View style={s.menuCard}><Text style={s.menuTitle}>{menuItem?.vehicle?.licensePlate || 'Vehicle actions'}</Text><Pressable style={s.menuAction} onPress={() => { setMenuImei(null); if (menuItem) openVehicle(menuItem); }}><Text style={s.menuText}>View vehicle</Text></Pressable>{canDo('engine_cut') && <Pressable style={s.menuAction} onPress={() => { setMenuImei(null); if (menuItem) setCutItem(menuItem); }}><Text style={[s.menuText, { color: theme.red }]}>{menuItem && (immobilizerOverride[menuItem.device.imei] ?? menuItem.point?.immobilizer) ? 'Restore Engine' : 'Cut Engine'}</Text></Pressable>}<Pressable style={s.menuAction} onPress={() => setMenuImei(null)}><Text style={s.menuText}>Cancel</Text></Pressable></View></Pressable></Modal>
    {cutItem && <EngineCutDialog visible imei={cutItem.device.imei} plate={cutItem.vehicle?.licensePlate || `#${cutItem.vehicle?.displayId ?? cutItem.device.displayId}`} immobilized={immobilizerOverride[cutItem.device.imei] ?? !!cutItem.point?.immobilizer} onClose={() => setCutItem(null)} onSuccess={value => setImmobilizerOverride(previous => ({ ...previous, [cutItem.device.imei]: value }))} />}
  </SafeAreaView>;
}

const s = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 13, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, title: { fontSize: 25, fontWeight: '700', color: theme.ink }, count: { fontSize: 12, color: theme.secondary }, search: { height: 44, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: theme.ink, fontSize: 14 }, filters: { height: 42, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.border, paddingHorizontal: 12 }, filter: { paddingHorizontal: 10, height: 31, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, filterActive: { borderBottomColor: theme.red }, filterText: { color: theme.secondary, fontSize: 11 }, filterTextActive: { color: theme.red, fontWeight: '700' }, sort: { paddingHorizontal: 10 }, sortText: { color: theme.ink, fontSize: 11 }, row: { minHeight: 78, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10 }, stateBorder: { width: 3, height: 48, borderRadius: 2 }, rowMain: { flex: 1, paddingVertical: 11 }, id: { color: theme.muted, fontSize: 10 }, plate: { fontSize: 14, fontWeight: '700', color: theme.ink, marginTop: 2 }, name: { fontSize: 11, color: theme.secondary, marginTop: 2 }, rowRight: { alignItems: 'flex-end', gap: 4 }, status: { fontSize: 11, fontWeight: '600' }, speed: { fontSize: 10, color: theme.secondary }, menuButton: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' }, menuShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 16 }, menuCard: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 7, marginBottom: 24 }, menuTitle: { color: theme.ink, fontSize: 14, fontWeight: '700', padding: 13, borderBottomWidth: 1, borderColor: theme.border }, menuAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: theme.border }, menuText: { color: theme.ink, fontSize: 13 }, empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, emptyTitle: { color: theme.ink, textAlign: 'center', fontSize: 16, fontWeight: '600' }, emptySubtitle: { color: theme.secondary, textAlign: 'center', fontSize: 13, marginTop: 8 }, error: { padding: 12 }, errorText: { color: theme.red, fontSize: 12 } });
