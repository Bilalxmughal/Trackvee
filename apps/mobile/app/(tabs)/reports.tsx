import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import type { FleetVehicle } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

const REPORTS = [
  { id: 'travel_summary', label: 'Travel Summary', group: 'Travel' },
  { id: 'stops_move_summary', label: 'Stops & Move Summary', group: 'Travel' },
  { id: 'stoppage_summary', label: 'Stoppage Summary', group: 'Travel' },
  { id: 'move_summary', label: 'Move Summary', group: 'Travel' },
  { id: 'daily_travel', label: 'Daily Travel', group: 'Travel' },
  { id: 'ignition_on_off', label: 'Ignition ON / OFF', group: 'Activity' },
  { id: 'vehicle_history', label: 'Vehicle History', group: 'Activity' },
  { id: 'overspeed', label: 'Overspeed', group: 'Speed' },
  { id: 'overspeed_summary', label: 'Overspeed Summary', group: 'Speed' },
  { id: 'underspeed', label: 'Underspeed', group: 'Speed' },
  { id: 'alert_history', label: 'Alert History', group: 'Events' },
  { id: 'driver_behavior', label: 'Driver Behavior', group: 'Events' },
  { id: 'geofence_activity', label: 'Geofence Activity', group: 'Geofence' },
];
const PRESETS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month'];
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
type Result = { columns: string[]; rows: (string | number | null)[][]; summary?: (string | number | null)[] | null };

function toLocal(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function periodRange(label: string) {
  const now = new Date();
  if (label === 'Today') { const from = new Date(now); from.setHours(0,0,0,0); return { from: toLocal(from), to: toLocal(now) }; }
  if (label === 'Yesterday') { const from = new Date(now); from.setDate(from.getDate()-1); from.setHours(0,0,0,0); const to = new Date(from); to.setHours(23,59,0,0); return { from: toLocal(from), to: toLocal(to) }; }
  if (label === 'This Week') { const from = new Date(now); from.setDate(from.getDate()-from.getDay()); from.setHours(0,0,0,0); return { from: toLocal(from), to: toLocal(now) }; }
  if (label === 'Last Week') { const to = new Date(now); to.setDate(to.getDate()-to.getDay()-1); to.setHours(23,59,0,0); const from = new Date(to); from.setDate(from.getDate()-6); from.setHours(0,0,0,0); return { from: toLocal(from), to: toLocal(to) }; }
  if (label === 'This Month') { const from = new Date(now.getFullYear(), now.getMonth(), 1); return { from: toLocal(from), to: toLocal(now) }; }
  const from = new Date(now.getFullYear(), now.getMonth()-1, 1); const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 0); return { from: toLocal(from), to: toLocal(to) };
}

export default function ReportsScreen() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [reportId, setReportId] = useState('travel_summary');
  const [period, setPeriod] = useState('Today');
  const [selected, setSelected] = useState<string[] | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'type' | 'vehicles' | 'period' | null>(null);
  const { canDo } = usePortalPermissions();
  useEffect(() => { if (!canDo('reports')) router.replace('/map'); }, [canDo]);
  const vehicleIds = useMemo(() => vehicles.map(item => item.id), [vehicles]);
  const chosen = selected ?? vehicleIds;
  const reportName = REPORTS.find(item => item.id === reportId)?.label ?? 'Travel Summary';

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([api.get<FleetVehicle[]>('/vehicles'), api.get<VehicleGroup[]>('/vehicle-groups')])
      .then(([vehicleResponse, groupResponse]) => { if (active) { setVehicles(vehicleResponse.data); setGroups(groupResponse.data); } })
      .catch(() => { if (active) setError('Vehicle list could not be loaded. Check your connection and try again.'); });
    return () => { active = false; };
  }, []));

  const generate = async () => {
    if (!chosen.length) { setError('Select at least one vehicle.'); return; }
    setBusy(true); setError('');
    try {
      const range = periodRange(period);
      const params = new URLSearchParams({ type: reportId, vehicleIds: chosen.join(','), from: range.from, to: range.to });
      const response = await api.get<Result>(`/reports?${params.toString()}`);
      setResult(response.data);
    } catch {
      setError('Report could not be generated. Check your filters and try again.');
    } finally { setBusy(false); }
  };

  const toggleVehicle = (id: string) => setSelected(current => {
    const next = current === null ? [...vehicleIds] : [...current];
    return next.includes(id) ? next.filter(value => value !== id) : [...next, id];
  });
  const selectionLabel = selected === null || selected.length === vehicleIds.length ? 'All vehicles' : `${selected.length} selected`;
  const choices = picker === 'type' ? REPORTS : picker === 'period' ? PRESETS.map(label => ({ id: label, label })) : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <View style={{ flex: 1 }}>
      <View style={styles.header}><View><Text style={styles.title}>Reports</Text><Text style={styles.subtitle}>Fleet activity and trip summaries</Text></View><TablerIcon name="report" size={23} color={theme.red} /></View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Report Type</Text>
        <Pressable onPress={() => setPicker('type')} style={styles.select}><Text style={styles.selectText}>{reportName}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
        <Text style={styles.label}>Vehicles</Text>
        <Pressable onPress={() => setPicker('vehicles')} style={styles.select}><Text style={styles.selectText}>{selectionLabel}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
        <Text style={styles.label}>Period</Text>
        <Pressable onPress={() => setPicker('period')} style={styles.select}><Text style={styles.selectText}>{period}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
        <View style={styles.dateRow}><View style={styles.dateBox}><Text style={styles.dateLabel}>From</Text><Text style={styles.dateValue}>{periodRange(period).from.slice(0, 10)}</Text></View><View style={styles.dateBox}><Text style={styles.dateLabel}>To</Text><Text style={styles.dateValue}>{periodRange(period).to.slice(0, 10)}</Text></View></View>
        <Pressable disabled={busy || !vehicleIds.length} onPress={generate} style={({ pressed }) => [styles.generate, pressed && styles.pressed, (busy || !vehicleIds.length) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateText}>Generate Report</Text>}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {result ? <View style={styles.preview}>
          <Text style={styles.previewTitle}>Report Preview</Text>
          {result.summary?.length ? <View style={styles.summary}><Text style={styles.summaryText}>{result.summary.map(String).join('  ·  ')}</Text></View> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.tableHeader}>{result.columns.map((column, index) => <Text key={`${column}-${index}`} style={styles.cellHeader}>{column}</Text>)}</View>
              {result.rows.map((row, rowIndex) => <View key={rowIndex} style={styles.tableRow}>{result.columns.map((column, columnIndex) => <Text key={`${column}-${columnIndex}`} numberOfLines={2} style={styles.cell}>{row[columnIndex] == null ? '—' : String(row[columnIndex])}</Text>)}</View>)}
              {!result.rows.length ? <Text style={styles.noRows}>No report data for this period.</Text> : null}
            </View>
          </ScrollView>
        </View> : null}
      </ScrollView>

      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}>
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{picker === 'type' ? 'Choose Report Type' : picker === 'period' ? 'Choose Period' : 'Select Vehicles'}</Text><Pressable onPress={() => setPicker(null)} accessibilityLabel="Close"><TablerIcon name="close" size={20} color={theme.ink} /></Pressable></View>
          {picker === 'vehicles' ? <>
            <View style={styles.vehicleTools}><Pressable onPress={() => setSelected([...vehicleIds])}><Text style={styles.toolText}>Select all</Text></Pressable><Pressable onPress={() => setSelected([])}><Text style={styles.toolText}>Deselect all</Text></Pressable></View>
            <View style={styles.vehicleSearch}><TablerIcon name="search" size={17} color={theme.secondary} /><TextInput value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Search vehicles" placeholderTextColor={theme.muted} style={styles.vehicleSearchInput} /></View>
            <ScrollView style={styles.choiceList}>
              {groups.map(group => {
                const groupVehicles = vehicles.filter(vehicle => group.vehicleIds.includes(vehicle.id) && `${vehicle.licensePlate ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.name}`.toLowerCase().includes(vehicleSearch.toLowerCase()));
                if (!groupVehicles.length) return null;
                const groupIds = groupVehicles.map(vehicle => vehicle.id);
                const checkedCount = groupIds.filter(id => selected === null || selected.includes(id)).length;
                return <View key={group.id}>
                  <Pressable onPress={() => setSelected(current => { const next = current === null ? [...vehicleIds] : [...current]; const allSelected = groupIds.every(id => next.includes(id)); return allSelected ? next.filter(id => !groupIds.includes(id)) : [...new Set([...next, ...groupIds])]; })} style={styles.groupRow}>
                    <View style={[styles.checkbox, checkedCount > 0 && styles.checkboxOn]}><Text style={styles.check}>{checkedCount === groupIds.length ? '✓' : checkedCount ? '−' : ''}</Text></View><Text style={styles.groupName}>{group.name}</Text><Text style={styles.groupCount}>{groupVehicles.length}</Text>
                  </Pressable>
                  {groupVehicles.map(vehicle => <VehicleChoice key={vehicle.id} vehicle={vehicle} checked={selected === null || selected.includes(vehicle.id)} onPress={() => toggleVehicle(vehicle.id)} />)}
                </View>;
              })}
              {vehicles.filter(vehicle => !groups.some(group => group.vehicleIds.includes(vehicle.id)) && `${vehicle.licensePlate ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.name}`.toLowerCase().includes(vehicleSearch.toLowerCase())).map(vehicle => <VehicleChoice key={vehicle.id} vehicle={vehicle} checked={selected === null || selected.includes(vehicle.id)} onPress={() => toggleVehicle(vehicle.id)} />)}
            </ScrollView>
          </> : <ScrollView style={styles.choiceList}>{choices.map(choice => <Pressable key={choice.id} onPress={() => { if (picker === 'type') setReportId(choice.id); else setPeriod(choice.label); setPicker(null); setResult(null); }} style={styles.choiceRow}><Text style={styles.choiceLabel}>{choice.label}</Text></Pressable>)}</ScrollView>}
          {picker === 'vehicles' ? <Pressable onPress={() => setPicker(null)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable> : null}
        </View></View>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

function VehicleChoice({ vehicle, checked, onPress }: { vehicle: FleetVehicle; checked: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.choiceRow}><View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <Text style={styles.check}>✓</Text> : null}</View><View><Text style={styles.choiceLabel}>{vehicle.licensePlate || `#${vehicle.displayId}`}</Text><Text style={styles.choiceHint}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name}</Text></View></Pressable>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { minHeight: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.border }, title: { fontSize: 24, fontWeight: '700', color: theme.ink }, subtitle: { marginTop: 3, color: theme.secondary, fontSize: 12 }, body: { padding: 18, paddingBottom: 30 }, label: { color: theme.ink, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 7 }, select: { minHeight: 46, borderWidth: 1, borderColor: theme.border, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectText: { fontSize: 14, color: theme.ink }, chevron: { fontSize: 20, color: theme.secondary, marginTop: -6 }, dateRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, dateBox: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 9, padding: 11 }, dateLabel: { fontSize: 11, color: theme.secondary, marginBottom: 5 }, dateValue: { fontSize: 13, color: theme.ink, fontWeight: '500' }, generate: { height: 50, backgroundColor: theme.red, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, pressed: { opacity: 0.84 }, disabled: { opacity: 0.55 }, generateText: { color: '#fff', fontWeight: '700', fontSize: 14 }, error: { color: theme.red, fontSize: 12, marginTop: 10 }, preview: { marginTop: 25, borderTopWidth: 1, borderColor: theme.border, paddingTop: 14 }, previewTitle: { color: theme.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 }, summary: { backgroundColor: theme.canvas, padding: 10, marginBottom: 9 }, summaryText: { color: theme.secondary, fontSize: 12 }, tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.border, backgroundColor: theme.canvas }, cellHeader: { width: 132, paddingHorizontal: 8, paddingVertical: 10, color: theme.secondary, fontSize: 11, fontWeight: '700' }, tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.border }, cell: { width: 132, paddingHorizontal: 8, paddingVertical: 11, color: theme.ink, fontSize: 12 }, noRows: { padding: 18, color: theme.secondary, fontSize: 12 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' }, sheet: { maxHeight: '82%', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 26 }, sheetHeader: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.border }, sheetTitle: { fontSize: 16, fontWeight: '700', color: theme.ink }, vehicleTools: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, paddingHorizontal: 18, paddingVertical: 12 }, toolText: { color: theme.red, fontSize: 12, fontWeight: '600' }, vehicleSearch: { height: 42, marginHorizontal: 18, marginBottom: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 9 }, vehicleSearchInput: { flex: 1, padding: 0, fontSize: 13, color: theme.ink }, choiceList: { paddingHorizontal: 18 }, groupRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: theme.border, backgroundColor: theme.canvas }, groupName: { flex: 1, color: theme.ink, fontSize: 12, fontWeight: '700' }, groupCount: { color: theme.secondary, fontSize: 11 }, choiceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: theme.border }, choiceLabel: { color: theme.ink, fontSize: 14, fontWeight: '500' }, choiceHint: { color: theme.secondary, fontSize: 11, marginTop: 3 }, checkbox: { height: 18, width: 18, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }, checkboxOn: { borderColor: theme.red, backgroundColor: theme.red }, check: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 }, done: { height: 46, backgroundColor: theme.red, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 18, marginTop: 12 }, doneText: { color: '#fff', fontWeight: '700' } });
