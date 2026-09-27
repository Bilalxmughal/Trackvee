import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFleet, displayVehicleName, getFleetStatus } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };

export default function VehiclesScreen() {
  const { items, loading, error, reload } = useFleet();
  const { canDo } = usePortalPermissions();
  useEffect(() => { if (!canDo('vehicles')) router.replace('/map'); }, [canDo]);
  const [query, setQuery] = useState('');
  const vehicles = useMemo(() => items.filter(item => `${item.vehicle?.licensePlate ?? ''} ${displayVehicleName(item.vehicle)}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Vehicles</Text><Text style={styles.count}>{vehicles.length} vehicles</Text></View>
      <View style={styles.search}><TablerIcon name="search" size={18} color={theme.secondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search plate or vehicle" placeholderTextColor={theme.muted} style={styles.searchInput} accessibilityLabel="Search vehicles" /></View>
      {error ? <Pressable onPress={reload} style={styles.error}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : null}
      <FlatList data={vehicles} keyExtractor={item => item.device.imei} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.red} />} contentContainerStyle={vehicles.length ? undefined : styles.empty} renderItem={({ item }) => {
        const status = getFleetStatus(item.point);
        return <Pressable onPress={() => router.push({ pathname: '/vehicle/[imei]', params: { imei: item.device.imei } })} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <View style={[styles.stateBorder, { backgroundColor: STATUS_COLOR[status] }]} />
          <View style={styles.rowText}>
            <Text style={styles.plate}>{item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`}</Text>
            <Text style={styles.name}>{displayVehicleName(item.vehicle)}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={[styles.status, { color: STATUS_COLOR[status] }]}>{status[0]!.toUpperCase() + status.slice(1)}</Text>
            <Text style={styles.speed}>{item.point ? `${Math.round(item.point.speedKmh)} km/h` : 'No data'}</Text>
          </View>
          <TablerIcon name="back" size={18} color={theme.muted} />
        </Pressable>;
      }} ListEmptyComponent={<View><Text style={styles.emptyTitle}>{loading ? 'Loading vehicles…' : 'No vehicles found'}</Text><Text style={styles.emptySubtitle}>{loading ? '' : 'Vehicles assigned to your organization will appear here.'}</Text></View>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 13, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, title: { fontSize: 25, fontWeight: '700', color: theme.ink }, count: { fontSize: 12, color: theme.secondary }, search: { height: 44, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: theme.ink, fontSize: 14 }, row: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 }, rowPressed: { backgroundColor: '#fafafa' }, stateBorder: { width: 3, height: 42, borderRadius: 2 }, rowText: { flex: 1 }, plate: { fontSize: 14, fontWeight: '700', color: theme.ink }, name: { fontSize: 12, color: theme.secondary, marginTop: 3 }, rowRight: { alignItems: 'flex-end', gap: 4, marginRight: 3 }, status: { fontSize: 12, fontWeight: '600' }, speed: { fontSize: 11, color: theme.secondary }, empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, emptyTitle: { color: theme.ink, textAlign: 'center', fontSize: 16, fontWeight: '600' }, emptySubtitle: { color: theme.secondary, textAlign: 'center', fontSize: 13, marginTop: 8 }, error: { padding: 12 }, errorText: { color: theme.red, fontSize: 12 } });
