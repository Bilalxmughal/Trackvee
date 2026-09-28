import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';

const STATUS_COLOR = { moving: theme.moving, idle: theme.idle, parked: theme.secondary, offline: theme.offline };
type Filter = 'all' | 'moving' | 'idle' | 'parked' | 'offline';
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
type ListRow = { kind: 'group'; key: string; title: string; count: number } | { kind: 'vehicle'; key: string; item: FleetItem };

function ageLabel(timestamp?: string | null) {
  if (!timestamp) return 'No update';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export default function VehiclesScreen() {
  const { items, loading, error, reload } = useFleet();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  useEffect(() => { if (!permissionsLoading && !canDo('vehicles')) router.replace('/map'); }, [canDo, permissionsLoading]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupVehicleIds, setGroupVehicleIds] = useState<string[]>([]);
  const [groupVehicleSearch, setGroupVehicleSearch] = useState('');
  const [collapsedVehicleGroups, setCollapsedVehicleGroups] = useState<Record<string, boolean>>({});
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [menuImei, setMenuImei] = useState<string | null>(null);
  const [cutItem, setCutItem] = useState<FleetItem | null>(null);
  const [immobilizerOverride, setImmobilizerOverride] = useState<Record<string, boolean>>({});

  useEffect(() => { let active = true; api.get<VehicleGroup[]>('/vehicle-groups').then(r => { if (active) setGroups(r.data); }).catch(() => { if (active) setGroups([]); }); return () => { active = false; }; }, []);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(item => {
      const text = `${item.vehicle?.licensePlate ?? ''} ${item.vehicle?.displayId ?? ''} ${item.vehicle?.name ?? ''} ${item.vehicle?.make ?? ''} ${item.vehicle?.model ?? ''}`.toLowerCase();
      return text.includes(q) && (filter === 'all' || getFleetStatus(item.point) === filter);
    });
    const assigned = new Set<string>();
    const output: ListRow[] = [];
    for (const group of groups) {
      const members = filtered.filter(item => group.vehicleIds.includes(item.vehicle?.id ?? '') && !assigned.has(item.device.imei));
      if (!members.length) continue;
      members.forEach(item => assigned.add(item.device.imei));
      output.push({ kind: 'group', key: `group-${group.id}`, title: group.name, count: members.length });
      members.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
    }
    const ungrouped = filtered.filter(item => !assigned.has(item.device.imei));
    if (ungrouped.length) {
      output.push({ kind: 'group', key: 'group-other', title: 'Other Vehicles', count: ungrouped.length });
      ungrouped.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
    }
    return output;
  }, [items, groups, query, filter]);

  const menuItem = items.find(item => item.device.imei === menuImei);
  const plateFor = (item: FleetItem) => item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;
  const openNewGroup = () => { setEditingGroup(null); setGroupName(''); setGroupVehicleIds([]); setGroupVehicleSearch(''); setCollapsedVehicleGroups({}); setGroupError(''); setGroupModalOpen(true); };
  const openEditGroup = (group: VehicleGroup) => { setEditingGroup(group); setGroupName(group.name); setGroupVehicleIds([...group.vehicleIds]); setGroupVehicleSearch(''); setCollapsedVehicleGroups({}); setGroupError(''); setGroupModalOpen(true); };
  const saveGroup = async () => {
    if (!groupName.trim() || !groupVehicleIds.length) { setGroupError('Enter a group name and select at least one vehicle.'); return; }
    setGroupSaving(true); setGroupError('');
    try {
      if (editingGroup) {
        const visibleIds = new Set(items.map(item => item.vehicle?.id).filter((id): id is string => !!id));
        const retainedIds = editingGroup.vehicleIds.filter(id => !visibleIds.has(id));
        const selectedIds = [...new Set([...groupVehicleIds, ...retainedIds])];
        const result = await api.put<VehicleGroup>(`/vehicle-groups/${editingGroup.id}`, { name: groupName.trim(), vehicleIds: selectedIds });
        const selectedSet = new Set(selectedIds);
        setGroups(current => current.map(group => group.id === editingGroup.id ? result.data : { ...group, vehicleIds: group.vehicleIds.filter(id => !selectedSet.has(id)) }));
      } else {
        const result = await api.post<VehicleGroup>('/vehicle-groups', { name: groupName.trim(), vehicleIds: groupVehicleIds });
        const selectedSet = new Set(groupVehicleIds);
        setGroups(current => [...current.map(group => ({ ...group, vehicleIds: group.vehicleIds.filter(id => !selectedSet.has(id)) })), result.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setGroupModalOpen(false);
    } catch { setGroupError('The vehicle group could not be saved. Please try again.'); }
    finally { setGroupSaving(false); }
  };
  const deleteGroup = (group: VehicleGroup) => Alert.alert('Delete Vehicle Group', `Delete “${group.name}”? Vehicles will remain in your fleet.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      try { await api.delete(`/vehicle-groups/${group.id}`); setGroups(current => current.filter(entry => entry.id !== group.id)); setGroupModalOpen(false); }
      catch { setGroupError('The vehicle group could not be deleted. Please try again.'); }
    })(); } },
  ]);
  const go = (item: FleetItem, route: 'detail' | 'replay' | 'history', preset?: string) => {
    setMenuImei(null);
    const params = { imei: item.device.imei, ...(preset ? { preset } : {}) };
    if (route === 'detail') router.push({ pathname: '/vehicle/[imei]', params: { ...params, ...(preset === 'follow' ? { follow: '1' } : {}) } });
    else if (route === 'replay') router.push({ pathname: '/vehicle/[imei]/replay', params });
    else router.push({ pathname: '/vehicle/[imei]/history', params });
  };

  return <SafeAreaView style={s.container} edges={['top']}>
    <View style={s.header}><Text style={s.title}>Vehicles</Text><View style={s.headerRight}><Text style={s.count}>{items.length} vehicles</Text>{canDo('vehicles','add') && <Pressable onPress={openNewGroup} style={s.addGroup} accessibilityRole="button" accessibilityLabel="Create vehicle group"><TablerIcon name="plus" size={19} color={theme.red}/><Text style={s.addGroupText}>Group</Text></Pressable>}</View></View>
    <View style={s.search}><TablerIcon name="search" size={17} color={theme.secondary}/><TextInput value={query} onChangeText={setQuery} placeholder="Search vehicle or plate..." placeholderTextColor={theme.muted} style={s.searchInput} accessibilityLabel="Search vehicles" /></View>
    <View style={s.filters}>{(['all','moving','idle','parked','offline'] as Filter[]).map(value => <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && s.filterTextActive]}>{value[0]!.toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
    {error ? <Pressable onPress={reload} style={s.error}><Text style={s.errorText}>{error}  Retry</Text></Pressable> : null}
    <FlatList data={sections} keyExtractor={row => row.key} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.red} />} contentContainerStyle={!sections.length ? s.empty : undefined} renderItem={({ item: row }) => {
      if (row.kind === 'group') {
        const group = groups.find(entry => `group-${entry.id}` === row.key);
        return <View style={s.groupHeader}><Text style={s.groupTitle}>{row.title}</Text><Text style={s.groupCount}> · {row.count}</Text>{group && canDo('vehicles','edit') && <Pressable onPress={() => openEditGroup(group)} style={s.groupEdit}><Text style={s.groupEditText}>Edit</Text></Pressable>}{group && canDo('vehicles','delete') && <Pressable onPress={() => deleteGroup(group)} style={s.groupEdit}><Text style={s.groupDeleteText}>Delete</Text></Pressable>}</View>;
      }
      const item = row.item;
      const point = item.point;
      const status = getFleetStatus(point);
      const plate = plateFor(item);
      const ignition = point?.ignition;
      const voltage = point?.voltageLevel;
      const signal = point?.gsmSignal;
      return <View style={s.row}>
        <View style={[s.stateBorder, { backgroundColor: STATUS_COLOR[status] }]} />
        <Pressable onPress={() => go(item, 'detail')} style={s.rowMain} accessibilityRole="button" accessibilityLabel={`Open ${plate}`}>
          <Text numberOfLines={1} style={s.plate}>{plate}</Text><Text numberOfLines={1} style={s.name}>{displayVehicleName(item.vehicle)}</Text>
          <View style={s.telemetry}>
            <TablerIcon name="power" size={13} color={ignition === true ? theme.moving : ignition === false ? theme.secondary : theme.muted}/>
            <TablerIcon name="map-pin" size={13} color={point?.gpsValid ? theme.secondary : theme.muted}/><Text style={s.metaText}>{point?.satellites ?? 0}</Text>
            <TablerIcon name="battery" size={13} color={theme.secondary}/><Text style={s.metaText}>{voltage != null ? `${voltage.toFixed(1)}V` : '—'}</Text>
            <TablerIcon name="signal" size={13} color={theme.secondary}/>
            <Text style={s.metaText}>{signal == null ? '—' : `${signal}%`}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => go(item, 'detail')} style={s.rowRight} accessibilityRole="button" accessibilityLabel={`View ${status} status and speed`}>
          <Text style={[s.speed, { color: status === 'offline' ? theme.secondary : theme.ink }]}>{status === 'offline' ? 'Offline' : `${Math.round(point?.speedKmh ?? 0)} km/h`}</Text>
          <Text style={s.updated}>{ageLabel(point?.timestamp)}</Text>
        </Pressable>
        <Pressable onPress={() => setMenuImei(item.device.imei)} style={s.menuButton} accessibilityLabel={`Actions for ${plate}`}><TablerIcon name="more-vertical" size={19} color={theme.ink}/></Pressable>
      </View>;
    }} ListEmptyComponent={<View><Text style={s.emptyTitle}>{loading ? 'Loading vehicles…' : 'No vehicles found'}</Text><Text style={s.emptySubtitle}>{loading ? '' : 'Try another search or status filter.'}</Text></View>} />

    <Modal visible={!!menuItem} transparent animationType="fade" onRequestClose={() => setMenuImei(null)}>
      <Pressable onPress={() => setMenuImei(null)} style={s.menuShade}>
        <Pressable onPress={event => event.stopPropagation()} style={s.menuCard}>
          <Text style={s.menuTitle}>{menuItem ? plateFor(menuItem) : 'Vehicle actions'}</Text>
          {menuItem && <>
            <MenuAction icon="follow" label="Follow" onPress={() => go(menuItem, 'detail', 'follow')}/>
            <MenuAction icon="replay" label="Trip Replay" onPress={() => go(menuItem, 'replay')}/>
            <View style={s.menuDivider}/><Text style={s.menuSection}>History</Text>
            <MenuAction icon="report" label="Last Hour" onPress={() => go(menuItem, 'history', 'lastHour')}/>
            <MenuAction icon="report" label="Today" onPress={() => go(menuItem, 'history', 'today')}/>
            <MenuAction icon="report" label="Yesterday" onPress={() => go(menuItem, 'history', 'yesterday')}/>
            {(canDo('alerts','add') || canDo('alerts','edit')) && <><View style={s.menuDivider}/><MenuAction icon="bell" label="Edit Alert" onPress={() => { const imei = menuItem.device.imei; setMenuImei(null); router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } }); }}/></>}
            {canDo('engine_cut') && <MenuAction icon="engine" label={(immobilizerOverride[menuItem.device.imei] ?? menuItem.point?.immobilizer) ? 'Restore Engine' : 'Cut Engine'} destructive onPress={() => { const selected = menuItem; setMenuImei(null); setCutItem(selected); }}/ >}
          </>}
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={groupModalOpen} transparent animationType="slide" onRequestClose={() => setGroupModalOpen(false)}>
      <View style={s.groupShade}><View style={s.groupCard}>
        <View style={s.groupModalHeader}><Text style={s.groupModalTitle}>{editingGroup ? 'Edit Group' : 'Create Group'}</Text><Pressable onPress={() => setGroupModalOpen(false)} accessibilityLabel="Close group editor"><TablerIcon name="close" size={19} color={theme.secondary}/></Pressable></View>
        <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={theme.muted} style={s.groupNameInput} maxLength={80}/>
        <View style={s.selectionTools}><Text style={s.selectionCount}>{groupVehicleIds.length}/{items.length} selected</Text><View style={{ flex: 1 }}/><Pressable onPress={() => setGroupVehicleIds(items.flatMap(item => item.vehicle ? [item.vehicle.id] : []))}><Text style={s.toolText}>Select all</Text></Pressable><Pressable onPress={() => setGroupVehicleIds([])}><Text style={s.toolText}>Deselect all</Text></Pressable></View>
        <View style={s.groupSearch}><TablerIcon name="search" size={15} color={theme.secondary}/><TextInput value={groupVehicleSearch} onChangeText={setGroupVehicleSearch} placeholder="Search vehicles" placeholderTextColor={theme.muted} style={s.groupSearchInput}/></View>
        <ScrollView style={s.groupVehicleList} keyboardShouldPersistTaps="handled">
          {(() => {
            const search = groupVehicleSearch.trim().toLowerCase();
            const visibleItems = items.filter(item => `${plateFor(item)} ${displayVehicleName(item.vehicle)} ${item.vehicle?.name ?? ''}`.toLowerCase().includes(search));
            const groupedIds = new Set(groups.filter(group => group.id !== editingGroup?.id).flatMap(group => group.vehicleIds));
            const sections = [
              { key: 'unassigned', name: 'Unassigned', members: visibleItems.filter(item => !groupedIds.has(item.vehicle?.id ?? '')) },
              ...groups.filter(group => group.id !== editingGroup?.id).map(group => ({ key: group.id, name: group.name, members: visibleItems.filter(item => group.vehicleIds.includes(item.vehicle?.id ?? '')) })),
            ].filter(section => section.members.length > 0);
            const toggleMany = (ids: string[]) => setGroupVehicleIds(current => ids.every(id => current.includes(id)) ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
            return sections.length ? sections.map(section => {
              const ids = section.members.flatMap(item => item.vehicle ? [item.vehicle.id] : []);
              const allChecked = ids.length > 0 && ids.every(id => groupVehicleIds.includes(id));
              const collapsed = !!collapsedVehicleGroups[section.key];
              return <View key={section.key}>
                <View style={s.vehicleGroupHeading}>
                  <Pressable onPress={() => toggleMany(ids)} style={s.groupCheckboxButton} accessibilityRole="checkbox" accessibilityState={{ checked: allChecked }} accessibilityLabel={`Select all vehicles in ${section.name}`}><View style={[s.checkBox, allChecked && s.checkBoxActive]}>{allChecked && <Text style={s.checkMark}>✓</Text>}</View></Pressable>
                  <Pressable onPress={() => setCollapsedVehicleGroups(current => ({ ...current, [section.key]: !current[section.key] }))} style={s.vehicleGroupToggle} accessibilityRole="button" accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${section.name}`}><Text style={s.vehicleGroupTitle}>{section.name}</Text><Text style={s.vehicleGroupCount}>{section.members.length}</Text><View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}><TablerIcon name="down" size={15} color={theme.secondary}/></View></Pressable>
                </View>
                {!collapsed && section.members.map(item => {
                  const vehicleId = item.vehicle!.id;
                  const selected = groupVehicleIds.includes(vehicleId);
                  return <Pressable key={item.device.imei} onPress={() => setGroupVehicleIds(current => selected ? current.filter(id => id !== vehicleId) : [...current, vehicleId])} style={s.vehicleChoice}>
                    <View style={[s.checkBox, selected && s.checkBoxActive]}>{selected && <Text style={s.checkMark}>✓</Text>}</View><View style={{ flex: 1 }}><Text style={s.choicePlate}>{plateFor(item)}</Text><Text style={s.choiceName}>{displayVehicleName(item.vehicle)}</Text></View>
                  </Pressable>;
                })}
              </View>;
            }) : <Text style={s.noGroupVehicles}>{items.length ? 'No matching vehicles.' : 'No vehicles are available.'}</Text>;
          })()}
        </ScrollView>
        {groupError ? <Text style={s.groupError}>{groupError}</Text> : null}
        <View style={s.groupFooter}>
          {editingGroup && canDo('vehicles','delete') && <Pressable disabled={groupSaving} onPress={() => deleteGroup(editingGroup)} style={s.deleteGroupButton}><Text style={s.deleteGroupText}>Delete Group</Text></Pressable>}
          <View style={{ flex: 1 }}/><Pressable disabled={groupSaving} onPress={() => setGroupModalOpen(false)} style={s.cancelButton}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={groupSaving} onPress={() => void saveGroup()} style={[s.saveGroupButton, groupSaving && { opacity: 0.65 }]}><Text style={s.saveGroupText}>{groupSaving ? 'Saving…' : editingGroup ? 'Save' : 'Create'}</Text></Pressable>
        </View>
      </View></View>
    </Modal>
    {cutItem && <EngineCutDialog visible imei={cutItem.device.imei} plate={plateFor(cutItem)} immobilized={immobilizerOverride[cutItem.device.imei] ?? !!cutItem.point?.immobilizer} onClose={() => setCutItem(null)} onSuccess={value => setImmobilizerOverride(previous => ({ ...previous, [cutItem.device.imei]: value }))} />}
  </SafeAreaView>;
}

function MenuAction({ icon, label, onPress, destructive = false }: { icon: string; label: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable style={s.menuAction} onPress={onPress}><TablerIcon name={icon} size={17} color={destructive ? theme.red : theme.secondary}/><Text style={[s.menuText, destructive && { color: theme.red }]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { fontSize: 23, fontWeight: '700', color: theme.ink }, count: { fontSize: 11, color: theme.secondary }, addGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 }, addGroupText: { color: theme.red, fontSize: 11, fontWeight: '600' },
  search: { height: 42, marginHorizontal: 14, marginBottom: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, color: theme.ink, fontSize: 12 },
  filters: { height: 38, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch', borderBottomWidth: 1, borderColor: theme.border, paddingHorizontal: 8 }, filter: { minWidth: 48, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, filterActive: { borderBottomColor: theme.red }, filterText: { color: theme.secondary, fontSize: 10 }, filterTextActive: { color: theme.red, fontWeight: '700' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 14, paddingBottom: 8 }, groupTitle: { color: theme.ink, fontSize: 11, fontWeight: '700' }, groupCount: { color: theme.secondary, fontSize: 11 }, groupEdit: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4 }, groupEditText: { color: theme.red, fontSize: 10, fontWeight: '600' }, groupDeleteText: { color: theme.secondary, fontSize: 10, fontWeight: '600' },
  row: { minHeight: 68, paddingLeft: 9, paddingRight: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8 }, stateBorder: { width: 3, height: 48, borderRadius: 1.5 }, rowMain: { flex: 1, minWidth: 0, paddingVertical: 7, justifyContent: 'center' }, plate: { fontSize: 12, fontWeight: '700', color: theme.ink }, name: { fontSize: 10, color: theme.secondary, marginTop: 1 }, telemetry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, metaText: { fontSize: 9, color: theme.secondary, marginRight: 3 }, rowRight: { minWidth: 65, alignItems: 'flex-end', gap: 3 }, speed: { fontSize: 10, fontWeight: '600', color: theme.ink }, updated: { fontSize: 9, color: theme.secondary }, menuButton: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  menuShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end', padding: 14 }, menuCard: { backgroundColor: '#fff', borderRadius: 9, paddingBottom: 7, marginBottom: 20, overflow: 'hidden' }, menuTitle: { color: theme.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: theme.border }, menuSection: { color: theme.secondary, fontSize: 10, fontWeight: '700', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, textTransform: 'uppercase' }, menuDivider: { height: 1, backgroundColor: theme.border, marginTop: 5 }, menuAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 }, menuText: { color: theme.ink, fontSize: 12 },
  groupShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', justifyContent: 'flex-end' }, groupCard: { backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 17, paddingHorizontal: 16, paddingBottom: 22, maxHeight: '88%' }, groupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, groupModalTitle: { color: theme.ink, fontSize: 17, fontWeight: '700' }, groupNameInput: { height: 42, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 11, color: theme.ink, fontSize: 13 }, selectionTools: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }, selectionCount: { color: theme.secondary, fontSize: 11 }, toolText: { color: theme.red, fontSize: 11, fontWeight: '600' }, groupSearch: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: theme.border, borderRadius: 5, paddingHorizontal: 9, marginBottom: 8 }, groupSearchInput: { flex: 1, color: theme.ink, fontSize: 11 }, groupVehicleList: { flexGrow: 0, maxHeight: 310, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border }, vehicleGroupHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: theme.border }, groupCheckboxButton: { minWidth: 36, height: 38, justifyContent: 'center', paddingLeft: 5 }, vehicleGroupToggle: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 }, vehicleGroupTitle: { flex: 1, color: theme.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }, vehicleGroupCount: { color: theme.secondary, fontSize: 10 }, vehicleChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, borderBottomWidth: 1, borderColor: theme.border }, checkBox: { width: 19, height: 19, borderWidth: 1, borderColor: theme.muted, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }, checkBoxActive: { borderColor: theme.red, backgroundColor: theme.red }, checkMark: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '700' }, choicePlate: { color: theme.ink, fontSize: 12, fontWeight: '600' }, choiceName: { color: theme.secondary, fontSize: 10, marginTop: 2 }, noGroupVehicles: { padding: 18, textAlign: 'center', color: theme.secondary, fontSize: 12 }, groupError: { color: theme.red, fontSize: 11, paddingTop: 8 }, groupFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 13 }, deleteGroupButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 }, deleteGroupText: { color: theme.red, fontSize: 11, fontWeight: '600' }, cancelButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 }, cancelText: { color: theme.secondary, fontSize: 12 }, saveGroupButton: { height: 38, minWidth: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, backgroundColor: theme.red, borderRadius: 6 }, saveGroupText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, emptyTitle: { color: theme.ink, textAlign: 'center', fontSize: 15, fontWeight: '600' }, emptySubtitle: { color: theme.secondary, textAlign: 'center', fontSize: 12, marginTop: 7 }, error: { padding: 12 }, errorText: { color: theme.red, fontSize: 12 },
});
