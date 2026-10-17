import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { useFleet, displayVehicleName, getFleetStatus, type FleetItem } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { EngineCutDialog } from '../../src/components/EngineCutDialog';
import { useTheme } from '../../src/hooks/useTheme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import api from '../../src/lib/api';

const STATUS_COLOR_LIGHT = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af' };
const STATUS_BG = { moving: '#dcfce7', idle: '#fef3c7', parked: '#f1f5f9', offline: '#f1f5f9' };
const STATUS_TEXT = { moving: '#16a34a', idle: '#b45309', parked: '#475569', offline: '#94a3b8' };

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
  const t = useTheme();
  const { items, loading, error, reload } = useFleet();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  useEffect(() => { if (!permissionsLoading && !canDo('vehicles')) router.replace('/map'); }, [canDo, permissionsLoading]);

  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [viewTab, setViewTab] = useState<ViewTab>('list');
  const [groupSearch, setGroupSearch] = useState('');
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

  const s = useMemo(() => makeStyles(t), [t]);
  const statusColor = useMemo(() => ({ moving: t.moving, idle: t.idle, parked: t.secondary, offline: t.offline }), [t]);

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
      if (!collapsedListGroups[`group-${group.id}`]) members.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
    }
    const ungrouped = filtered.filter(item => !assigned.has(item.device.imei));
    if (ungrouped.length) {
      output.push({ kind: 'group', key: 'group-other', title: 'Other Vehicles', count: ungrouped.length });
      if (!collapsedListGroups['group-other']) ungrouped.forEach(item => output.push({ kind: 'vehicle', key: item.device.imei, item }));
    }
    return output;
  }, [items, groups, query, filter, collapsedListGroups]);

  const groupsTabData = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return groups
      .filter(group => !q || group.name.toLowerCase().includes(q))
      .map(group => {
        const members = items.filter(item => group.vehicleIds.includes(item.vehicle?.id ?? ''));
        const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
        members.forEach(item => { counts[getFleetStatus(item.point)]++; });
        return { group, members, counts };
      });
  }, [groups, items, groupSearch]);

  const menuItem = items.find(item => item.device.imei === menuImei);
  const plateFor = (item: FleetItem) => item.vehicle?.licensePlate || `#${item.vehicle?.displayId ?? item.device.displayId}`;

  const exportPDF = async () => {
    try {
      const asset = Asset.fromModule(require('../../assets/trackvee-logo.png'));
      await asset.downloadAsync();
      let logoSrc = '';
      if (asset.localUri) {
        const { FileSystem } = await import('expo-file-system');
        const b64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
        logoSrc = `data:image/png;base64,${b64}`;
      }
      const now = new Date().toLocaleString();
      const statusDot = (status: string) => {
        const colors: Record<string, string> = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af' };
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[status] ?? '#9ca3af'};margin-right:5px;vertical-align:middle"></span>`;
      };
      const rows = items.map(item => {
        const pt = item.point;
        const status = getFleetStatus(pt);
        const speed = status === 'offline' ? '—' : `${Math.round(pt?.speedKmh ?? 0)} km/h`;
        const ign = pt?.ignition === true ? '<span style="color:#16a34a;font-weight:600">ON</span>' : pt?.ignition === false ? '<span style="color:#dc2626;font-weight:600">OFF</span>' : '—';
        const lastUpdate = pt?.timestamp ? new Date(pt.timestamp).toLocaleString() : '—';
        return `<tr>
          <td>${plateFor(item)}</td>
          <td style="color:#64748b">${displayVehicleName(item.vehicle) ?? '—'}</td>
          <td>${statusDot(status)}${status.charAt(0).toUpperCase() + status.slice(1)}</td>
          <td style="text-align:center">${speed}</td>
          <td style="text-align:center">${ign}</td>
          <td style="text-align:center;color:#64748b">${lastUpdate}</td>
        </tr>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: -apple-system, Helvetica, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e21d48; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { height: 36px; }
        .meta { text-align: right; font-size: 11px; color: #64748b; }
        .meta strong { display: block; font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 9px 10px; text-align: left; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
        td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #fafafa; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
      </style></head><body>
      <div class="header">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" />` : '<span style="font-size:20px;font-weight:800;color:#e21d48">Trackvee</span>'}
        <div class="meta"><strong>Fleet Report</strong>Generated: ${now}<br>${items.length} vehicle${items.length !== 1 ? 's' : ''}</div>
      </div>
      <table>
        <thead><tr><th>Plate</th><th>Vehicle</th><th>Status</th><th style="text-align:center">Speed</th><th style="text-align:center">Ignition</th><th style="text-align:center">Last Update</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Trackvee Fleet Management &bull; ${now}</div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Fleet Report' });
      else Alert.alert('Sharing not available', 'PDF saved but sharing is not supported on this device.');
    } catch {
      Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
    }
  };

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

  const shareLiveLocation = async (item: FleetItem) => {
    setMenuImei(null);
    try {
      const res = await api.post<{ url: string }>(`/vehicles/${item.vehicle?.id ?? item.device.imei}/live-share`);
      await Share.share({ message: `Live location of ${plateFor(item)}: ${res.data.url}`, url: res.data.url });
    } catch {
      Alert.alert('Share Failed', 'Could not create a share link. Please try again.');
    }
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
    const accentColor = ignition === true ? '#16a34a' : statusColor[status];
    const ignBg = ignition === true ? '#dcfce7' : ignition === false ? '#fee2e2' : t.chipBg;
    const ignClr = ignition === true ? '#16a34a' : ignition === false ? '#dc2626' : t.muted;
    const gpsBg = !gpsValid ? t.chipBg : sats >= 6 ? '#dcfce7' : sats >= 3 ? '#fef3c7' : '#fee2e2';
    const gpsClr = !gpsValid ? t.muted : sats >= 6 ? '#16a34a' : sats >= 3 ? '#d97706' : '#dc2626';
    const batBg = voltage == null ? t.chipBg : voltage > 12 ? '#dcfce7' : voltage > 11 ? '#fef3c7' : '#fee2e2';
    const batClr = voltage == null ? t.muted : voltage > 12 ? '#16a34a' : voltage > 11 ? '#d97706' : '#dc2626';
    const sigBg = signal == null ? t.chipBg : signal >= 60 ? '#dcfce7' : signal >= 30 ? '#fef3c7' : '#fee2e2';
    const sigClr = signal == null ? t.muted : signal >= 60 ? '#16a34a' : signal >= 30 ? '#d97706' : '#dc2626';
    return (
      <View style={[s.card, { backgroundColor: t.card, borderBottomColor: t.cardBorder }]}>
        <View style={[s.cardAccent, { backgroundColor: accentColor }]} />
        <Pressable onPress={() => go(item, 'detail')} style={s.cardBody} accessibilityRole="button" accessibilityLabel={`Open ${plate}`}>
          <View style={s.cardTop}>
            <View style={s.cardTopLeft}>
              <Text numberOfLines={1} style={[s.plate, { color: t.ink }]}>{plate}</Text>
              <Text numberOfLines={1} style={[s.vehicleName, { color: t.secondary }]}>{displayVehicleName(item.vehicle)}</Text>
            </View>
            <Text style={[s.speedText, { color: t.secondary }]}>{status === 'offline' ? 'Offline' : `${Math.round(point?.speedKmh ?? 0)} km/h`}</Text>
          </View>
          <View style={s.cardChips}>
            <View style={[s.chip, { backgroundColor: ignBg }]}><TablerIcon name="power" size={12} color={ignClr} /><Text style={[s.chipText, { color: ignClr }]}>{ignition === true ? 'ON' : ignition === false ? 'OFF' : '—'}</Text></View>
            <View style={[s.chip, { backgroundColor: gpsBg }]}><TablerIcon name="map-pin" size={12} color={gpsClr} /><Text style={[s.chipText, { color: gpsClr }]}>{sats} sat</Text></View>
            <View style={[s.chip, { backgroundColor: batBg }]}><TablerIcon name="battery" size={12} color={batClr} /><Text style={[s.chipText, { color: batClr }]}>{voltage != null ? `${voltage.toFixed(1)}V` : '—'}</Text></View>
            <View style={[s.chip, { backgroundColor: sigBg }]}><TablerIcon name="signal" size={12} color={sigClr} /><Text style={[s.chipText, { color: sigClr }]}>{signal == null ? '—' : `${signal}%`}</Text></View>
            <Text style={[s.updatedText, { color: t.muted }]}>{ageLabel(point?.timestamp)}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenuImei(item.device.imei)} style={s.cardMenu} accessibilityLabel={`Actions for ${plate}`}>
          <TablerIcon name="more-vertical" size={18} color={t.red} />
        </Pressable>
      </View>
    );
  };

  const renderGroupVehicleRow = (item: FleetItem) => {
    const point = item.point;
    const status = getFleetStatus(point);
    const plate = plateFor(item);
    const ignition = point?.ignition;
    const accentColor = ignition === true ? '#16a34a' : statusColor[status];
    return (
      <View key={item.device.imei} style={[s.groupVehicleRow, { borderTopColor: t.border }]}>
        <View style={[s.groupVehicleAccent, { backgroundColor: accentColor }]} />
        <Pressable onPress={() => go(item, 'detail')} style={s.groupVehicleBody} accessibilityRole="button">
          <Text numberOfLines={1} style={[s.plate, { color: t.ink }]}>{plate}</Text>
          <Text numberOfLines={1} style={[s.vehicleName, { color: t.secondary }]}>{displayVehicleName(item.vehicle)}</Text>
        </Pressable>
        <Text style={[s.groupVehicleSpeed, { color: t.secondary }]}>{status === 'offline' ? 'Offline' : `${Math.round(point?.speedKmh ?? 0)} km/h`}</Text>
        <Pressable onPress={() => setMenuImei(item.device.imei)} style={s.cardMenu} accessibilityLabel={`Actions for ${plate}`}>
          <TablerIcon name="more-vertical" size={17} color={t.red} />
        </Pressable>
      </View>
    );
  };

  return <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top']}>
    <View style={[s.header, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.ink }]}>Vehicles</Text>
      <View style={s.headerRight}>
        <Text style={[s.count, { color: t.secondary }]}>{items.length} vehicles</Text>
        <Pressable onPress={() => void exportPDF()} style={s.iconBtn} accessibilityLabel="Export vehicle list as PDF">
          <TablerIcon name="download" size={18} color={t.secondary} />
        </Pressable>
        {canDo('vehicles', 'add') && <Pressable onPress={openNewGroup} style={s.addGroup} accessibilityRole="button" accessibilityLabel="Create vehicle group">
          <TablerIcon name="plus" size={17} color={t.red} />
          <Text style={[s.addGroupText, { color: t.red }]}>Group</Text>
        </Pressable>}
      </View>
    </View>

    <View style={[s.tabs, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
      <Pressable onPress={() => setViewTab('list')} style={[s.tab, viewTab === 'list' && s.tabActive]}>
        <TablerIcon name="list" size={14} color={viewTab === 'list' ? t.red : t.secondary} />
        <Text style={[s.tabText, { color: viewTab === 'list' ? t.red : t.secondary }, viewTab === 'list' && s.tabTextActive]}>All Vehicles</Text>
      </Pressable>
      <Pressable onPress={() => setViewTab('groups')} style={[s.tab, viewTab === 'groups' && s.tabActive]}>
        <TablerIcon name="layout-grid" size={14} color={viewTab === 'groups' ? t.red : t.secondary} />
        <Text style={[s.tabText, { color: viewTab === 'groups' ? t.red : t.secondary }, viewTab === 'groups' && s.tabTextActive]}>Groups</Text>
        {groups.length > 0 && <View style={[s.tabBadge, { backgroundColor: viewTab === 'groups' ? '#fff5f5' : t.chipBg }]}><Text style={[s.tabBadgeText, { color: viewTab === 'groups' ? t.red : t.secondary }]}>{groups.length}</Text></View>}
      </Pressable>
    </View>

    {viewTab === 'list' && <>
      <View style={[s.search, { backgroundColor: t.inputBg }]}>
        <TablerIcon name="search" size={16} color={t.secondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search vehicle or plate..." placeholderTextColor={t.muted} style={[s.searchInput, { color: t.ink }]} accessibilityLabel="Search vehicles" />
      </View>
      <View style={[s.filters, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
        {(['all', 'moving', 'idle', 'parked', 'offline'] as Filter[]).map(value => (
          <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && { borderBottomColor: t.red }]}>
            <Text style={[s.filterText, { color: filter === value ? t.red : t.secondary }, filter === value && s.filterTextActive]}>{value[0]!.toUpperCase() + value.slice(1)}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Pressable onPress={reload} style={s.error}><Text style={[s.errorText, { color: t.red }]}>{error}  Retry</Text></Pressable> : null}
      <FlatList
        data={sections}
        keyExtractor={row => row.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { reload(); loadGroups(); }} tintColor={t.red} />}
        contentContainerStyle={[s.listContent, !sections.length && s.empty]}
        renderItem={({ item: row }) => {
          if (row.kind === 'group') {
            const collapsed = !!collapsedListGroups[row.key];
            return (
              <Pressable onPress={() => setCollapsedListGroups(prev => ({ ...prev, [row.key]: !collapsed }))} style={[s.groupHeader, { backgroundColor: t.bg2 }]}>
                <View style={s.groupHeaderLeft}>
                  <TablerIcon name="folder" size={14} color={t.red} />
                  <Text style={[s.groupTitle, { color: t.ink }]}>{row.title}</Text>
                  <View style={[s.groupCountBadge, { backgroundColor: t.chipBg }]}><Text style={[s.groupCountText, { color: t.secondary }]}>{row.count}</Text></View>
                </View>
                <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
                  <TablerIcon name="down" size={14} color={t.secondary} />
                </View>
              </Pressable>
            );
          }
          return renderVehicleCard(row.item);
        }}
        ListEmptyComponent={<View><Text style={[s.emptyTitle, { color: t.ink }]}>{loading ? 'Loading vehicles…' : 'No vehicles found'}</Text><Text style={[s.emptySubtitle, { color: t.secondary }]}>{loading ? '' : 'Try another search or status filter.'}</Text></View>}
      />
    </>}

    {viewTab === 'groups' && (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { reload(); loadGroups(); }} tintColor={t.red} />}>
        <View style={[s.search, { backgroundColor: t.inputBg, marginBottom: 6 }]}>
          <TablerIcon name="search" size={16} color={t.secondary} />
          <TextInput value={groupSearch} onChangeText={setGroupSearch} placeholder="Search groups..." placeholderTextColor={t.muted} style={[s.searchInput, { color: t.ink }]} />
        </View>
        {groupsTabData.length === 0 ? (
          <View style={s.emptyGroups}>
            <TablerIcon name="folder-open" size={40} color={t.muted} />
            <Text style={[s.emptyTitle, { color: t.ink }]}>{groupSearch ? 'No groups match' : 'No groups yet'}</Text>
            <Text style={[s.emptySubtitle, { color: t.secondary }]}>{groupSearch ? 'Try a different search.' : 'Tap + Group to create your first vehicle group.'}</Text>
          </View>
        ) : groupsTabData.map(({ group, members, counts }) => {
          const expanded = !!expandedGroupIds[group.id];
          return (
            <View key={group.id} style={[s.groupCard, { backgroundColor: t.card, borderColor: t.cardBorder }]}>
              <Pressable onPress={() => setExpandedGroupIds(prev => ({ ...prev, [group.id]: !expanded }))} style={s.groupCardHeader}>
                <View style={s.groupCardHeaderLeft}>
                  <View style={[s.groupIconWrap, { backgroundColor: t.bg2 }]}><TablerIcon name="folder" size={18} color={t.red} /></View>
                  <View>
                    <Text style={[s.groupCardName, { color: t.ink }]}>{group.name}</Text>
                    <Text style={[s.groupCardCount, { color: t.secondary }]}>{members.length} vehicle{members.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={s.groupCardRight}>
                  {canDo('vehicles', 'edit') && <Pressable onPress={() => openEditGroup(group)} style={s.groupCardActionBtn} accessibilityLabel="Edit group"><TablerIcon name="edit" size={16} color={t.red} /></Pressable>}
                  {canDo('vehicles', 'delete') && <Pressable onPress={() => deleteGroup(group)} style={s.groupCardActionBtn} accessibilityLabel="Delete group"><TablerIcon name="trash" size={16} color={t.secondary} /></Pressable>}
                  <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}><TablerIcon name="down" size={16} color={t.secondary} /></View>
                </View>
              </Pressable>
              <View style={s.groupStatusRow}>
                {counts.moving > 0 && <View style={[s.statusChip, { backgroundColor: '#dcfce7' }]}><View style={[s.sDot, { backgroundColor: '#16a34a' }]} /><Text style={[s.statusChipText, { color: '#16a34a' }]}>{counts.moving} Moving</Text></View>}
                {counts.idle > 0 && <View style={[s.statusChip, { backgroundColor: '#fef3c7' }]}><View style={[s.sDot, { backgroundColor: '#f59e0b' }]} /><Text style={[s.statusChipText, { color: '#b45309' }]}>{counts.idle} Idle</Text></View>}
                {counts.parked > 0 && <View style={[s.statusChip, { backgroundColor: t.chipBg }]}><View style={[s.sDot, { backgroundColor: t.secondary }]} /><Text style={[s.statusChipText, { color: t.secondary }]}>{counts.parked} Parked</Text></View>}
                {counts.offline > 0 && <View style={[s.statusChip, { backgroundColor: t.bg2 }]}><View style={[s.sDot, { backgroundColor: t.muted }]} /><Text style={[s.statusChipText, { color: t.muted }]}>{counts.offline} Offline</Text></View>}
              </View>
              {expanded && members.map(item => renderGroupVehicleRow(item))}
            </View>
          );
        })}
      </ScrollView>
    )}

    <Modal visible={!!menuItem} transparent animationType="fade" onRequestClose={() => setMenuImei(null)}>
      <Pressable onPress={() => setMenuImei(null)} style={s.menuShade}>
        <Pressable onPress={event => event.stopPropagation()} style={[s.menuCard, { backgroundColor: t.card }]}>
          <Text style={[s.menuTitle, { color: t.ink, borderBottomColor: t.border }]}>{menuItem ? plateFor(menuItem) : 'Vehicle actions'}</Text>
          {menuItem && <>
            <MenuAction icon="share" label="Share Live Location" t={t} onPress={() => void shareLiveLocation(menuItem)} />
            <MenuAction icon="follow" label="Follow" t={t} onPress={() => go(menuItem, 'detail', 'follow')} />
            <MenuAction icon="replay" label="Trip Replay" t={t} onPress={() => go(menuItem, 'replay')} />
            <View style={[s.menuDivider, { backgroundColor: t.border }]} /><Text style={[s.menuSection, { color: t.secondary }]}>History</Text>
            <MenuAction icon="report" label="Last Hour" t={t} onPress={() => go(menuItem, 'history', 'lastHour')} />
            <MenuAction icon="report" label="Today" t={t} onPress={() => go(menuItem, 'history', 'today')} />
            <MenuAction icon="report" label="Yesterday" t={t} onPress={() => go(menuItem, 'history', 'yesterday')} />
            {(canDo('alerts', 'add') || canDo('alerts', 'edit')) && <><View style={[s.menuDivider, { backgroundColor: t.border }]} /><MenuAction icon="bell" label="Edit Alert" t={t} onPress={() => { const imei = menuItem.device.imei; setMenuImei(null); router.push({ pathname: '/vehicle/[imei]/alerts', params: { imei } }); }} /></>}
            {canDo('engine_cut') && <MenuAction icon="engine" label={(immobilizerOverride[menuItem.device.imei] ?? menuItem.point?.immobilizer) ? 'Restore Engine' : 'Cut Engine'} destructive t={t} onPress={() => { const selected = menuItem; setMenuImei(null); setCutItem(selected); }} />}
          </>}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={groupModalOpen} transparent animationType="slide" onRequestClose={() => setGroupModalOpen(false)}>
      <View style={s.groupShade}><View style={[s.groupModalCard, { backgroundColor: t.surface }]}>
        <View style={s.groupModalHeader}><Text style={[s.groupModalTitle, { color: t.ink }]}>{editingGroup ? 'Edit Group' : 'Create Group'}</Text><Pressable onPress={() => setGroupModalOpen(false)} accessibilityLabel="Close group editor"><TablerIcon name="close" size={19} color={t.secondary} /></Pressable></View>
        <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={t.muted} style={[s.groupNameInput, { borderColor: t.border, color: t.ink, backgroundColor: t.inputBg }]} maxLength={80} />
        <View style={s.selectionTools}><Text style={[s.selectionCount, { color: t.secondary }]}>{groupVehicleIds.length}/{items.length} selected</Text><View style={{ flex: 1 }} /><Pressable onPress={() => setGroupVehicleIds(items.flatMap(item => item.vehicle ? [item.vehicle.id] : []))}><Text style={[s.toolText, { color: t.red }]}>Select all</Text></Pressable><Pressable onPress={() => setGroupVehicleIds([])}><Text style={[s.toolText, { color: t.red }]}>Deselect all</Text></Pressable></View>
        <View style={[s.groupSearchRow, { backgroundColor: t.inputBg }]}>
          <TablerIcon name="search" size={15} color={t.secondary} />
          <TextInput value={groupVehicleSearch} onChangeText={setGroupVehicleSearch} placeholder="Search vehicles" placeholderTextColor={t.muted} style={[s.groupSearchInput, { color: t.ink }]} />
        </View>
        <ScrollView style={[s.groupVehicleList, { borderColor: t.border }]} keyboardShouldPersistTaps="handled">
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
                <View style={[s.vehicleGroupHeading, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
                  <Pressable onPress={() => toggleMany(ids)} style={s.groupCheckboxButton} accessibilityRole="checkbox" accessibilityState={{ checked: allChecked }}><View style={[s.checkBox, { borderColor: t.muted }, allChecked && { borderColor: t.red, backgroundColor: t.red }]}>{allChecked && <Text style={s.checkMark}>✓</Text>}</View></Pressable>
                  <Pressable onPress={() => setCollapsedVehicleGroups(current => ({ ...current, [section.key]: !current[section.key] }))} style={s.vehicleGroupToggle}><Text style={[s.vehicleGroupTitle, { color: t.secondary }]}>{section.name}</Text><Text style={[s.vehicleGroupCount, { color: t.secondary }]}>{section.members.length}</Text><View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}><TablerIcon name="down" size={15} color={t.secondary} /></View></Pressable>
                </View>
                {!collapsed && section.members.map(item => {
                  const vehicleId = item.vehicle!.id;
                  const selected = groupVehicleIds.includes(vehicleId);
                  return <Pressable key={item.device.imei} onPress={() => setGroupVehicleIds(current => selected ? current.filter(id => id !== vehicleId) : [...current, vehicleId])} style={[s.vehicleChoice, { borderBottomColor: t.border }]}>
                    <View style={[s.checkBox, { borderColor: t.muted }, selected && { borderColor: t.red, backgroundColor: t.red }]}>{selected && <Text style={s.checkMark}>✓</Text>}</View>
                    <View style={{ flex: 1 }}><Text style={[s.choicePlate, { color: t.ink }]}>{plateFor(item)}</Text><Text style={[s.choiceName, { color: t.secondary }]}>{displayVehicleName(item.vehicle)}</Text></View>
                  </Pressable>;
                })}
              </View>;
            }) : <Text style={[s.noGroupVehicles, { color: t.secondary }]}>{items.length ? 'No matching vehicles.' : 'No vehicles are available.'}</Text>;
          })()}
        </ScrollView>
        {groupError ? <Text style={s.groupError}>{groupError}</Text> : null}
        <View style={s.groupFooter}>
          {editingGroup && canDo('vehicles', 'delete') && <Pressable disabled={groupSaving} onPress={() => deleteGroup(editingGroup)} style={s.deleteGroupButton}><Text style={[s.deleteGroupText, { color: t.red }]}>Delete Group</Text></Pressable>}
          <View style={{ flex: 1 }} />
          <Pressable disabled={groupSaving} onPress={() => setGroupModalOpen(false)} style={s.cancelButton}><Text style={[s.cancelText, { color: t.secondary }]}>Cancel</Text></Pressable>
          <Pressable disabled={groupSaving} onPress={() => void saveGroup()} style={[s.saveGroupButton, { backgroundColor: t.red }, groupSaving && { opacity: 0.65 }]}><Text style={s.saveGroupText}>{groupSaving ? 'Saving…' : editingGroup ? 'Save' : 'Create'}</Text></Pressable>
        </View>
      </View></View>
    </Modal>
    {cutItem && <EngineCutDialog visible imei={cutItem.device.imei} plate={plateFor(cutItem)} immobilized={immobilizerOverride[cutItem.device.imei] ?? !!cutItem.point?.immobilizer} onClose={() => setCutItem(null)} onSuccess={value => setImmobilizerOverride(previous => ({ ...previous, [cutItem.device.imei]: value }))} />}
  </SafeAreaView>;
}

function MenuAction({ icon, label, onPress, destructive = false, t }: { icon: string; label: string; onPress: () => void; destructive?: boolean; t: ReturnType<typeof useTheme> }) {
  return <Pressable style={s0.menuAction} onPress={onPress}><TablerIcon name={icon} size={17} color={destructive ? t.red : t.secondary} /><Text style={[s0.menuText, { color: destructive ? t.red : t.ink }]}>{label}</Text></Pressable>;
}

// Static structural styles (no colors — colors applied inline via theme)
const s0 = StyleSheet.create({
  menuAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  menuText: { fontSize: 12 },
});

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 22, fontWeight: '700' },
    count: { fontSize: 11 },
    iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    addGroup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    addGroupText: { fontSize: 12, fontWeight: '600' },

    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: t.red },
    tabText: { fontSize: 12, fontWeight: '600' },
    tabTextActive: { fontWeight: '700' },
    tabBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
    tabBadgeText: { fontSize: 10, fontWeight: '700' },

    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 10, marginBottom: 6, paddingHorizontal: 11, height: 40, borderRadius: 8 },
    searchInput: { flex: 1, fontSize: 13, padding: 0 },

    filters: { height: 38, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch', borderBottomWidth: 1, paddingHorizontal: 8 },
    filter: { minWidth: 48, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    filterText: { fontSize: 10 },
    filterTextActive: { fontWeight: '700' },

    listContent: { paddingBottom: 20 },

    groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, marginTop: 6 },
    groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    groupTitle: { fontSize: 12, fontWeight: '700' },
    groupCountBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
    groupCountText: { fontSize: 10, fontWeight: '700' },

    card: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1 },
    cardAccent: { width: 3 },
    cardBody: { flex: 1, paddingVertical: 11, paddingLeft: 11, paddingRight: 4 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
    cardTopLeft: { flex: 1, minWidth: 0 },
    plate: { fontSize: 14, fontWeight: '700' },
    vehicleName: { fontSize: 11, marginTop: 2 },
    speedText: { fontSize: 11, fontWeight: '600', marginLeft: 8 },
    cardChips: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
    chipText: { fontSize: 10, fontWeight: '600' },
    updatedText: { fontSize: 9, marginLeft: 'auto' },
    cardMenu: { width: 36, alignItems: 'center', justifyContent: 'center' },

    groupVehicleRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingRight: 4 },
    groupVehicleAccent: { width: 3, alignSelf: 'stretch' },
    groupVehicleBody: { flex: 1, paddingVertical: 11, paddingLeft: 11, paddingRight: 4 },
    groupVehicleSpeed: { fontSize: 11, fontWeight: '600' },

    groupCard: { marginHorizontal: 12, marginTop: 10, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
    groupCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
    groupCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    groupIconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    groupCardName: { fontSize: 14, fontWeight: '700' },
    groupCardCount: { fontSize: 11, marginTop: 1 },
    groupCardRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    groupCardActionBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
    groupStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    sDot: { width: 5, height: 5, borderRadius: 3 },
    statusChipText: { fontSize: 10, fontWeight: '600' },

    emptyGroups: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },

    menuShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end', padding: 14 },
    menuCard: { borderRadius: 9, paddingBottom: 7, marginBottom: 20, overflow: 'hidden' },
    menuTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
    menuSection: { fontSize: 10, fontWeight: '700', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, textTransform: 'uppercase' },
    menuDivider: { height: 1, marginTop: 5 },

    groupShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', justifyContent: 'flex-end' },
    groupModalCard: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 17, paddingHorizontal: 16, paddingBottom: 22, maxHeight: '94%' },
    groupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    groupModalTitle: { fontSize: 17, fontWeight: '700' },
    groupNameInput: { height: 42, borderWidth: 1, borderRadius: 6, paddingHorizontal: 11, fontSize: 13 },
    selectionTools: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    selectionCount: { fontSize: 11 },
    toolText: { fontSize: 11, fontWeight: '600' },
    groupSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderRadius: 7, paddingHorizontal: 9, marginBottom: 8 },
    groupSearchInput: { flex: 1, fontSize: 11, padding: 0 },
    groupVehicleList: { flexGrow: 0, maxHeight: 310, borderTopWidth: 1, borderBottomWidth: 1 },
    vehicleGroupHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, borderBottomWidth: 1 },
    groupCheckboxButton: { minWidth: 36, height: 38, justifyContent: 'center', paddingLeft: 5 },
    vehicleGroupToggle: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
    vehicleGroupTitle: { flex: 1, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    vehicleGroupCount: { fontSize: 10 },
    vehicleChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, borderBottomWidth: 1 },
    checkBox: { width: 19, height: 19, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    checkMark: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '700' },
    choicePlate: { fontSize: 12, fontWeight: '600' },
    choiceName: { fontSize: 10, marginTop: 2 },
    noGroupVehicles: { padding: 18, textAlign: 'center', fontSize: 12 },
    groupError: { color: '#dc2626', fontSize: 11, paddingTop: 8 },
    groupFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 13 },
    deleteGroupButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 },
    deleteGroupText: { fontSize: 11, fontWeight: '600' },
    cancelButton: { height: 38, justifyContent: 'center', paddingHorizontal: 10 },
    cancelText: { fontSize: 12 },
    saveGroupButton: { height: 38, minWidth: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 6 },
    saveGroupText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
    emptySubtitle: { textAlign: 'center', fontSize: 12, marginTop: 7 },
    error: { padding: 12 },
    errorText: { fontSize: 12 },
  });
}
