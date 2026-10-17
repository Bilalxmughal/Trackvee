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
const STATUS_BG = { moving: '#dcfce7', idle: '#fef9c3', parked: '#f1f5f9', offline: '#f1f5f9' };
const STATUS_TEXT_COLOR = { moving: '#16a34a', idle: '#b45309', parked: '#475569', offline: '#94a3b8' };
type Filter = 'all' | 'moving' | 'idle' | 'parked' | 'offline';
type ViewTab = 'list' | 'groups';
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
  const [viewTab, setViewTab] = useState<ViewTab>('list');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupVehicleIds, setGroupVehicleIds] = useState<string[]>([]);
  const [groupVehicleSearch, setGroupVehicleSearch] = useState('');
  const [collapsedVehicleGroups, setCollapsedVehicleGroups] = useState<Record<string, boolean>>({});
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [collapsedListGroups, setCollapsedListGroups] = useState<Record<string, boolean>>({});
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [menuImei, setMenuImei] = useState<string | null>(null);
  const [cutItem, setCutItem] = useState<FleetItem | null>(null);
  const [immobilizerOverride, setImmobilizerOverride] = useState<Record<string, boolean>>({});

  const loadGroups = () => { api.get<VehicleGroup[]>('/vehicle-groups').then(r => { setGroups(r.data); }).catch(() => { setGroups([]); }); };
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
      if (!collapsedListGroups[`group-${group.id}`]) {
        members.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
      }
    }
    const ungrouped = filtered.filter(item => !assigned.has(item.device.imei));
    if (ungrouped.length) {
      output.push({ kind: 'group', key: 'group-other', title: 'Other Vehicles', count: ungrouped.length });
      if (!collapsedListGroups['group-other']) {
        ungrouped.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
      }
    }
    return output;
  }, [items, groups, query, filter, collapsedListGroups]);

  const groupsTabData = useMemo(() => {
    return groups.map(group => {
      const members = items.filter(item => group.vehicleIds.includes(item.vehicle?.id ?? ''));
      const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
      members.forEach(item => { counts[getFleetStatus(item.point)]++; });
      return { group, members, counts };
    });
  }, [groups, items]);

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
  const deleteGroup = (group: VehicleGroup) => Alert.alert('Delete Vehicle Group', `Delete "${group.name}"? Vehicles will remain in your fleet.`, [
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

  const renderVehicleCard = (item: FleetItem) => {
    const point = item.point;
    const status = getFleetStatus(point);
    const plate = plateFor(item);
    const ignition = point?.ignition;
    const voltage = point?.voltageLevel;
    const signal = point?.gsmSignal;
    const gpsValid = point?.gpsValid;
    const sats = point?.satellites ?? 0;
    const accentColor = ignition === true ? '#16a34a' : STATUS_COLOR[status];
    return (
      <View style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: accentColor }]} />
        <Pressable onPress={() => go(item, 'detail')} style={s.cardBody} accessibilityRole="button" accessibilityLabel={`Open ${plate}`}>
          <View style={s.cardTop}>
            <View style={s.cardTopLeft}>
              <Text numberOfLines={1} style={s.plate}>{plate}</Text>
              <Text numberOfLines={1} style={s.vehicleName}>{displayVehicleName(item.vehicle)}</Text>
            </View>
            <Text style={s.speedText}>{status === 'offline' ? 'Offline' : `${Math.round(point?.speedKmh ?? 0)} km/h`}</Text>
          </View>
          <View style={s.cardChips}>
            <View style={[s.chip, { backgroundColor: ignition === true ? '#dcfce7' : '#f1f5f9' }]}>
              <TablerIcon name="power" size={12} color={ignition === true ? '#16a34a' : theme.muted} />
              <Text style={[s.chipText, { color: ignition === true ? '#16a34a' : theme.muted }]}>{ignition === true ? 'ON' : ignition === false ? 'OFF' : '—'}</Text>
            </View>
            <View style={s.chip}>
              <TablerIcon name="map-pin" size={12} color={gpsValid ? theme.secondary : theme.muted} />
              <Text style={[s.chipText, { color: gpsValid ? theme.secondary : theme.muted }]}>{sats} sat</Text>
            </View>
            <View style={s.chip}>
              <TablerIcon name="battery" size={12} color={theme.secondary} />
              <Text style={s.chipText}>{voltage != null ? `${voltage.toFixed(1)}V` : '—'}</Text>
            </View>
            <View style={s.chip}>
              <TablerIcon name="signal" size={12} color={theme.secondary} />
              <Text style={s.chipText}>{signal == null ? '—' : `${signal}%`}</Text>
            </View>
            <Text style={s.updatedText}>{ageLabel(point?.timestamp)}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenuImei(item.device.imei)} style={s.cardMenu} accessibilityLabel={`Actions for ${plate}`}>
          <TablerIcon name="more-vertical" size={18} color={theme.secondary} />
        </Pressable>
      </View>
    );
  };

  const renderGroupVehicleRow = (item: FleetItem) => {
    const point = item.point;
    const status = getFleetStatus(point);
    const plate = plateFor(item);
    const ignition = point?.ignition;
    const accentColor = ignition === true ? '#16a34a' : STATUS_COLOR[status];
    return (
      <View key={item.device.imei} style={s.groupVehicleRow}>
        <View style={[s.groupVehicleAccent, { backgroundColor: accentColor }]} />
        <Pressable onPress={() => go(item, 'detail')} style={s.groupVehicleBody} accessibilityRole="button">
          <Text numberOfLines={1} style={s.plate}>{plate}</Text>
          <Text numberOfLines={1} style={s.vehicleName}>{displayVehicleName(item.vehicle)}</Text>
        </Pressable>
        <Text style={s.groupVehicleSpeed}>{status === 'offline' ? 'Offline' : `${Math.round(point?.speedKmh ?? 0)} km/h`}</Text>
        <Pressable onPress={() => setMenuImei(item.device.imei)} style={s.cardMenu} accessibilityLabel={`Actions for ${plate}`}>
          <TablerIcon name="more-vertical" size={17} color={theme.secondary} />
        </Pressable>
      </View>
    );
  };

  return <SafeAreaView style={s.container} edges={['top']}>
    <View style={s.header}>
      <Text style={s.title}>Vehicles</Text>
      <View style={s.headerRight}>
        <Text style={s.count}>{items.length} vehicles</Text>
        {canDo('vehicles', 'add') && <Pressable onPress={openNewGroup} style={s.addGroup} accessibilityRole="button" accessibilityLabel="Create vehicle group">
          <TablerIcon name="plus" size={17} color={theme.red} />
          <Text style={s.addGroupText}>Group</Text>
        </Pressable>}
      </View>
    </View>

    <View style={s.tabs}>
      <Pressable onPress={() => setViewTab('list')} style={[s.tab, viewTab === 'list' && s.tabActive]}>
        <TablerIcon name="list" size={14} color={viewTab === 'list' ? theme.red : theme.secondary} />
        <Text style={[s.tabText, viewTab === 'list' && s.tabTextActive]}>All Vehicles</Text>
      </Pressable>
      <Pressable onPress={() => setViewTab('groups')} style={[s.tab, viewTab === 'groups' && s.tabActive]}>
        <TablerIcon name="layout-grid" size={14} color={viewTab === 'groups' ? theme.red : theme.secondary} />
        <Text style={[s.tabText, viewTab === 'groups' && s.tabTextActive]}>Groups</Text>
        {groups.length > 0 && <View style={[s.tabBadge, viewTab === 'groups' && s.tabBadgeActive]}><Text style={[s.tabBadgeText, viewTab === 'groups' && s.tabBadgeTextActive]}>{groups.length}</Text></View>}
      </Pressable>
    </View>

    {viewTab === 'list' && <>
      <View style={s.search}><TablerIcon name="search" size={16} color={theme.secondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search vehicle or plate..." placeholderTextColor={theme.muted} style={s.searchInput} accessibilityLabel="Search vehicles" /></View>
      <View style={s.filters}>{(['all', 'moving', 'idle', 'parked', 'offline'] as Filter[]).map(value => <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && s.filterTextActive]}>{value[0]!.toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
      {error ? <Pressable onPress={reload} style={s.error}><Text style={s.errorText}>{error}  Retry</Text></Pressable> : null}
      <FlatList
        data={sections}
        keyExtractor={row => row.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { reload(); loadGroups(); }} tintColor={theme.red} />}
        contentContainerStyle={[s.listContent, !sections.length && s.empty]}
        renderItem={({ item: row }) => {
          if (row.kind === 'group') {
            const collapsed = !!collapsedListGroups[row.key];
            return (
              <Pressable onPress={() => setCollapsedListGroups(prev => ({ ...prev, [row.key]: !collapsed }))} style={s.groupHeader}>
                <View style={s.groupHeaderLeft}>
                  <TablerIcon name="folder" size={14} color={theme.red} />
                  <Text style={s.groupTitle}>{row.title}</Text>
                  <View style={s.groupCountBadge}><Text style={s.groupCountText}>{row.count}</Text></View>
                </View>
                <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
                  <TablerIcon name="down" size={14} color={theme.secondary} />
                </View>
              </Pressable>
            );
          }
          return renderVehicleCard(row.item);
        }}
        ListEmptyComponent={<View><Text style={s.emptyTitle}>{loading ? 'Loading vehicles…' : 'No vehicles found'}</Text><Text style={s.emptySubtitle}>{loading ? '' : 'Try another search or status filter.'}</Text></View>}
      />
    </>}

    {viewTab === 'groups' && (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { reload(); loadGroups(); }} tintColor={theme.red} />}
      >
        {groupsTabData.length === 0 ? (
          <View style={s.emptyGroups}>
            <TablerIcon name="folder-open" size={40} color={theme.muted} />
            <Text style={s.emptyTitle}>No groups yet</Text>
            <Text style={s.emptySubtitle}>Tap + Group to create your first vehicle group.</Text>
          </View>
        ) : groupsTabData.map(({ group, members, counts }) => {
          const expanded = !!expandedGroupIds[group.id];
          return (
            <View key={group.id} style={s.groupCard}>
              <Pressable onPress={() => setExpandedGroupIds(prev => ({ ...prev, [group.id]: !expanded }))} style={s.groupCardHeader}>
                <View style={s.groupCardHeaderLeft}>
                  <View style={s.groupIconWrap}><TablerIcon name="folder" size={18} color={theme.red} /></View>
                  <View>
                    <Text style={s.groupCardName}>{group.name}</Text>
                    <Text style={s.groupCardCount}>{members.length} vehicle{members.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={s.groupCardRight}>
                  {canDo('vehicles', 'edit') && <Pressable onPress={() => openEditGroup(group)} style={s.groupCardActionBtn} accessibilityLabel="Edit group">
                    <TablerIcon name="edit" size={16} color={theme.red} />
                  </Pressable>}
                  {canDo('vehicles', 'delete') && <Pressable onPress={() => deleteGroup(group)} style={s.groupCardActionBtn} accessibilityLabel="Delete group">
                    <TablerIcon name="trash" size={16} color={theme.secondary} />
                  </Pressable>}
                  <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                    <TablerIcon name="down" size={16} color={theme.secondary} />
                  </View>
                </View>
              </Pressable>
              <View style={s.groupStatusRow}>
                {counts.moving > 0 && <View style={[s.statusChip, { backgroundColor: '#dcfce7' }]}><View style={[s.statusDot, { backgroundColor: theme.moving }]} /><Text style={[s.statusChipText, { color: '#16a34a' }]}>{counts.moving} Moving</Text></View>}
                {counts.idle > 0 && <View style={[s.statusChip, { backgroundColor: '#fef9c3' }]}><View style={[s.statusDot, { backgroundColor: theme.idle }]} /><Text style={[s.statusChipText, { color: '#b45309' }]}>{counts.idle} Idle</Text></View>}
                {counts.parked > 0 && <View style={[s.statusChip, { backgroundColor: '#f1f5f9' }]}><View style={[s.statusDot, { backgroundColor: theme.secondary }]} /><Text style={[s.statusChipText, { color: '#475569' }]}>{counts.parked} Parked</Text></View>}
                {counts.offline > 0 && <View style={[s.statusChip, { backgroundColor: '#f8fafc' }]}><View style={[s.statusDot, { backgroundColor: theme.offline }]} /><Text style={[s.statusChipText, { color: '#94a3b8' }]}>{counts.offline} Offline</Text></View>}
              </View>
              {expanded && members.map(item => renderGroupVehicleRow(item))}
            </View>
          );
        })}
      </ScrollView>
    )}

    <Modal visible={!!menuItem} transparent animationType="fade" onRequestClose={() => setMenuImei(null)}>
      <Pressable onPress={() => setMenuImei(null)} style={s.menuShade}>
        <Pressable onPress={event => event.stopPropagation()} style={s.menuCard}>
          <Text style={s.menuTitle}>{menuItem ? plateFor(menuItem) : 'Vehicle actions'}</Text>
          {menuItem && <>
            <MenuAction icon="follow" label="Follow" onPress={() => go(menuItem, 'detail', 'follow')} />
            <MenuAction icon="replay" label="Trip Replay" onPress={() => go(menuItem, 'replay')} />
            <View style={s.menuDivider} /><Text style={s.menuSection}>History</Text>
            <MenuAction icon="report" label="Last Hour" onPress={() => go(menuItem, 'history', 'lastHour')} />
            <MenuAction icon="report" label="Today" onPress={() => go(menuItem, 'history', 'today')} />
            <MenuAction icon="report" label="Yesterday" onPress={() => go(menuItem, 'history', 'yesterday')} />
            {(canDo('alerts', 'add') || canDo('alerts', 'edit')) && <><View style={s.menuDivider} /><MenuAction icon="bell" label="Edit Alert" onPress={() => { const imei = menuItem.device.imei; setMenuImei(null); router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } }); }} /></>}
            {canDo('engine_cut') && <MenuAction icon="engine" label={(immobilizerOverride[menuItem.device.imei] ?? menuItem.point?.immobilizer) ? 'Restore Engine' : 'Cut Engine'} destructive onPress={() => { const selected = menuItem; setMenuImei(null); setCutItem(selected); }} />}
          </>}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={groupModalOpen} transparent animationType="slide" onRequestClose={() => setGroupModalOpen(false)}>
      <View style={s.groupShade}><View style={s.groupModalCard}>
        <View style={s.groupModalHeader}><Text style={s.groupModalTitle}>{editingGroup ? 'Edit Group' : 'Create Group'}</Text><Pressable onPress={() => setGroupModalOpen(false)} accessibilityLabel="Close group editor"><TablerIcon name="close" size={19} color={theme.secondary} /></Pressable></View>
        <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={theme.muted} style={s.groupNameInput} maxLength={80} />
        <View style={s.selectionTools}><Text style={s.selectionCount}>{groupVehicleIds.length}/{items.length} selected</Text><View style={{ flex: 1 }} /><Pressable onPress={() => setGroupVehicleIds(items.flatMap(item => item.vehicle ? [item.vehicle.id] : []))}><Text style={s.toolText}>Select all</Text></Pressable><Pressable onPress={() => setGroupVehicleIds([])}><Text style={s.toolText}>Deselect all</Text></Pressable></View>
        <View style={s.groupSearch}><TablerIcon name="search" size={15} color={theme.secondary} /><TextInput value={groupVehicleSearch} onChangeText={setGroupVehicleSearch} placeholder="Search vehicles" placeholderTextColor={theme.muted} style={s.groupSearchInput} /></View>
        <ScrollView style={s.groupVehicleList} keyboardShouldPersistTaps="handled">
          {(() => {
            const search = groupVehicleSearch.trim().toLowerCase();
            const visibleItems = items.filter(item => `${plateFor(item)} ${displayVehicleName(item.vehicle)} ${item.vehicle?.name ?? ''}`.toLowerCase().includes(search));
            const groupedIds = new Set(groups.filter(group => group.id !== editingGroup?.id).flatMap(group => group.vehicleIds));
            const modalSections = [
              { key: 'unassigned', name: 'Unassigned', members: visibleItems.filter(item => !groupedIds.has(item.vehicle?.id ?? '')) },
              ...groups.filter(group => group.id !== editingGroup?.id).map(group => ({ key: group.id, name: group.name, members: visibleItems.filter(item => group.vehicleIds.includes(item.vehicle?.id ?? '')) })),
            ].filter(section => section.members.length > 0);
            const toggleMany = (ids: string[]) => setGroupVehicleIds(current => ids.every(id => current.includes(id)) ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]);
            return modalSections.length ? modalSections.map(section => {
              const ids = section.members.flatMap(item => item.vehicle ? [item.vehicle.id] : []);
              const allChecked = ids.length > 0 && ids.every(id => groupVehicleIds.includes(id));
              const collapsed = !!collapsedVehicleGroups[section.key];
              return <View key={section.key}>
                <View style={s.vehicleGroupHeading}>
                  <Pressable onPress={() => toggleMany(ids)} style={s.groupCheckboxButton} accessibilityRole="checkbox" accessibilityState={{ checked: allChecked }} accessibilityLabel={`Select all vehicles in ${section.name}`}><View style={[s.checkBox, allChecked && s.checkBoxActive]}>{allChecked && <Text style={s.checkMark}>✓</Text>}</View></Pressable>
                  <Pressable onPress={() => setCollapsedVehicleGroups(current => ({ ...current, [section.key]: !current[section.key] }))} style={s.vehicleGroupToggle} accessibilityRole="button" accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${section.name}`}><Text style={s.vehicleGroupTitle}>{section.name}</Text><Text style={s.vehicleGroupCount}>{section.members.length}</Text><View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}><TablerIcon name="down" size={15} color={theme.secondary} /></View></Pressable>
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
          {editingGroup && canDo('vehicles', 'delete') && <Pressable disabled={groupSaving} onPress={() => deleteGroup(editingGroup)} style={s.deleteGroupButton}><Text style={s.deleteGroupText}>Delete Group</Text></Pressable>}
          <View style={{ flex: 1 }} /><Pressable disabled={groupSaving} onPress={() => setGroupModalOpen(false)} style={s.cancelButton}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={groupSaving} onPress={() => void saveGroup()} style={[s.saveGroupButton, groupSaving && { opacity: 0.65 }]}><Text style={s.saveGroupText}>{groupSaving ? 'Saving…' : editingGroup ? 'Save' : 'Create'}</Text></Pressable>
        </View>
      </View></View>
    </Modal>
    {cutItem && <EngineCutDialog visible imei={cutItem.device.imei} plate={plateFor(cutItem)} immobilized={immobilizerOverride[cutItem.device.imei] ?? !!cutItem.point?.immobilizer} onClose={() => setCutItem(null)} onSuccess={value => setImmobilizerOverride(previous => ({ ...previous, [cutItem.device.imei]: value }))} />}
  </SafeAreaView>;
}

function MenuAction({ icon, label, onPress, destructive = false }: { icon: string; label: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable style={s.menuAction} onPress={onPress}><TablerIcon name={icon} size={17} color={destructive ? theme.red : theme.secondary} /><Text style={[s.menuText, destructive && { color: theme.red }]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: theme.ink },
  count: { fontSize: 11, color: theme.secondary },
  addGroup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addGroupText: { color: theme.red, fontSize: 12, fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border, borderBottomWidth: 1, borderBottomColor: theme.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.red },
  tabText: { color: theme.secondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: theme.red },
  tabBadge: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: '#fff5f5' },
  tabBadgeText: { fontSize: 10, color: theme.secondary, fontWeight: '700' },
  tabBadgeTextActive: { color: theme.red },

  search: { height: 42, marginHorizontal: 14, marginTop: 10, marginBottom: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc' },
  searchInput: { flex: 1, color: theme.ink, fontSize: 13 },
  filters: { height: 38, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: theme.border, paddingHorizontal: 8 },
  filter: { minWidth: 48, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterActive: { borderBottomColor: theme.red },
  filterText: { color: theme.secondary, fontSize: 10 },
  filterTextActive: { color: theme.red, fontWeight: '700' },

  listContent: { paddingBottom: 20 },

  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, marginTop: 6, backgroundColor: '#f8fafc' },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { color: theme.ink, fontSize: 12, fontWeight: '700' },
  groupCountBadge: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  groupCountText: { fontSize: 10, color: theme.secondary, fontWeight: '700' },
  groupActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupActionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },

  card: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'stretch' },
  cardAccent: { width: 3 },
  cardBody: { flex: 1, paddingVertical: 11, paddingLeft: 11, paddingRight: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  cardTopLeft: { flex: 1, minWidth: 0 },
  plate: { fontSize: 14, fontWeight: '700', color: theme.ink },
  vehicleName: { fontSize: 11, color: theme.secondary, marginTop: 2 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  speedText: { fontSize: 11, fontWeight: '600', color: theme.secondary, marginLeft: 8 },
  cardChips: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' },
  chipText: { fontSize: 10, fontWeight: '600', color: theme.secondary },
  updatedText: { fontSize: 9, color: theme.muted, marginLeft: 'auto' },
  cardMenu: { width: 36, alignItems: 'center', justifyContent: 'center' },
  groupVehicleRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, paddingRight: 4 },
  groupVehicleAccent: { width: 3, alignSelf: 'stretch' },
  groupVehicleBody: { flex: 1, paddingVertical: 11, paddingLeft: 11, paddingRight: 4 },
  groupVehicleSpeed: { fontSize: 11, fontWeight: '600', color: theme.secondary },

  groupCard: { marginHorizontal: 12, marginTop: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  groupCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  groupCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIconWrap: { width: 34, height: 34, backgroundColor: '#fff5f5', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  groupCardName: { fontSize: 14, fontWeight: '700', color: theme.ink },
  groupCardCount: { fontSize: 11, color: theme.secondary, marginTop: 1 },
  groupCardRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupCardActionBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  groupStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusChipText: { fontSize: 10, fontWeight: '600' },

  emptyGroups: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },

  menuShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end', padding: 14 },
  menuCard: { backgroundColor: '#fff', borderRadius: 9, paddingBottom: 7, marginBottom: 20, overflow: 'hidden' },
  menuTitle: { color: theme.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: theme.border },
  menuSection: { color: theme.secondary, fontSize: 10, fontWeight: '700', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, textTransform: 'uppercase' },
  menuDivider: { height: 1, backgroundColor: theme.border, marginTop: 5 },
  menuAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  menuText: { color: theme.ink, fontSize: 12 },

  groupShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', justifyContent: 'flex-end' },
  groupModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 17, paddingHorizontal: 16, paddingBottom: 22, maxHeight: '88%' },
  groupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  groupModalTitle: { color: theme.ink, fontSize: 17, fontWeight: '700' },
  groupNameInput: { height: 42, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 11, color: theme.ink, fontSize: 13 },
  selectionTools: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  selectionCount: { color: theme.secondary, fontSize: 11 },
  toolText: { color: theme.red, fontSize: 11, fontWeight: '600' },
  groupSearch: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: theme.border, borderRadius: 5, paddingHorizontal: 9, marginBottom: 8 },
  groupSearchInput: { flex: 1, color: theme.ink, fontSize: 11 },
  groupVehicleList: { flexGrow: 0, maxHeight: 310, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border },
  vehicleGroupHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: theme.border },
  groupCheckboxButton: { minWidth: 36, height: 38, justifyContent: 'center', paddingLeft: 5 },
  vehicleGroupToggle: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleGroupTitle: { flex: 1, color: theme.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  vehicleGroupCount: { color: theme.secondary, fontSize: 10 },
  vehicleChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, borderBottomWidth: 1, borderColor: theme.border },
  checkBox: { width: 19, height: 19, borderWidth: 1, borderColor: theme.muted, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { borderColor: theme.red, backgroundColor: theme.red },
  checkMark: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  choicePlate: { color: theme.ink, fontSize: 12, fontWeight: '600' },
  choiceName: { color: theme.secondary, fontSize: 10, marginTop: 2 },
  noGroupVehicles: { padding: 18, textAlign: 'center', color: theme.secondary, fontSize: 12 },
  groupError: { color: theme.red, fontSize: 11, paddingTop: 8 },
  groupFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 13 },
  deleteGroupButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 },
  deleteGroupText: { color: theme.red, fontSize: 11, fontWeight: '600' },
  cancelButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 },
  cancelText: { color: theme.secondary, fontSize: 12 },
  saveGroupButton: { height: 38, minWidth: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, backgroundColor: theme.red, borderRadius: 6 },
  saveGroupText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: theme.ink, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  emptySubtitle: { color: theme.secondary, textAlign: 'center', fontSize: 12, marginTop: 7 },
  error: { padding: 12 },
  errorText: { color: theme.red, fontSize: 12 },
});
