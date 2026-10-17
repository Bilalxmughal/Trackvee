import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../src/lib/api';
import type { FleetVehicle } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';
import type { AppTheme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

type ReportType =
  | 'travel_summary' | 'stops_move_summary' | 'stoppage_summary' | 'move_summary'
  | 'ignition_on_off' | 'overspeed' | 'overspeed_summary' | 'underspeed'
  | 'daily_travel' | 'vehicle_history' | 'alert_history' | 'driver_behavior'
  | 'geofence_activity';
type ReportOption = { id: ReportType; label: string; group: string; options?: ('speed' | 'minStop' | 'minSpeed' | 'geofence')[] };
type PickerKind = 'type' | 'vehicles' | 'period' | 'groupBy' | 'geofence' | null;
type PktParts = { year: number; month: number; day: number; hour: number; minute: number };
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
interface GeofenceOption { id: string; name: string; }
interface ReportResult {
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
  vehicleCount: number;
  rowCount: number;
  columns: string[];
  rows: (string | number | null)[][];
  summary: (string | number | null)[] | null;
}
interface SavedReport { id: string; title: string; type: string; params: Record<string, unknown>; userName: string | null; createdAt: string; }

const REPORTS: ReportOption[] = [
  { id: 'travel_summary', label: 'Travel Summary', group: 'Travel', options: ['speed'] },
  { id: 'stops_move_summary', label: 'Stops & Move Summary', group: 'Travel', options: ['speed', 'minStop'] },
  { id: 'stoppage_summary', label: 'Stoppage Summary', group: 'Travel', options: ['minStop'] },
  { id: 'move_summary', label: 'Move Summary', group: 'Travel' },
  { id: 'daily_travel', label: 'Daily Travel', group: 'Travel', options: ['speed'] },
  { id: 'ignition_on_off', label: 'Ignition ON / OFF', group: 'Activity' },
  { id: 'vehicle_history', label: 'Vehicle History', group: 'Activity' },
  { id: 'overspeed', label: 'Overspeed', group: 'Speed', options: ['speed'] },
  { id: 'overspeed_summary', label: 'Overspeed Summary', group: 'Speed', options: ['speed'] },
  { id: 'underspeed', label: 'Underspeed', group: 'Speed', options: ['minSpeed'] },
  { id: 'alert_history', label: 'Alert History', group: 'Events' },
  { id: 'driver_behavior', label: 'Driver Behavior', group: 'Events' },
  { id: 'geofence_activity', label: 'Geofence Activity', group: 'Geofence', options: ['geofence'] },
];
const REPORT_GROUPS = ['Travel', 'Activity', 'Speed', 'Events', 'Geofence'];
const PERIODS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Custom'];
const GROUP_BY_OPTIONS = [{ id: '', label: 'None' }, { id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PKT = 'Asia/Karachi';

function pktParts(date: Date): PktParts {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const read = (key: Intl.DateTimeFormatPartTypes) => Number(values.find(part => part.type === key)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute') };
}
function parsePkt(value: string): PktParts {
  const [date = '', time = '00:00'] = value.split(' ');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const current = pktParts(new Date());
  return { year: year || current.year, month: month || current.month, day: day || current.day, hour: hour || 0, minute: minute || 0 };
}
function pktValue(value: PktParts) {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')} ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}
function normalizePktValue(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const wall = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (wall) return `${wall[1]} ${wall[2]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : pktValue(pktParts(date));
}
function pktDate(value: string) {
  const p = parsePkt(value);
  return new Date(`${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:00+05:00`);
}
function toUtc(value: string) { return pktDate(value).toISOString(); }
function addCalendarDays(value: PktParts, days: number): PktParts {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day + days, value.hour, value.minute));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}
function presetRange(label: string) {
  const now = pktParts(new Date());
  const today = { ...now, hour: 0, minute: 0 };
  const endToday = { ...now };
  if (label === 'Today') return { from: pktValue(today), to: pktValue(endToday) };
  if (label === 'Yesterday') return { from: pktValue(addCalendarDays(today, -1)), to: pktValue({ ...addCalendarDays(today, -1), hour: 23, minute: 59 }) };
  if (label === 'This Week') {
    const weekday = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();
    return { from: pktValue(addCalendarDays(today, -weekday)), to: pktValue(endToday) };
  }
  if (label === 'Last Week') {
    const weekday = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();
    const end = { ...addCalendarDays(today, -weekday - 1), hour: 23, minute: 59 };
    return { from: pktValue(addCalendarDays(end, -6)), to: pktValue(end) };
  }
  if (label === 'This Month') return { from: pktValue({ ...today, day: 1 }), to: pktValue(endToday) };
  const firstThisMonth = { ...today, day: 1 };
  const lastMonthEnd = { ...addCalendarDays(firstThisMonth, -1), hour: 23, minute: 59 };
  const lastMonthStart = { ...lastMonthEnd, day: 1, hour: 0, minute: 0 };
  return { from: pktValue(lastMonthStart), to: pktValue(lastMonthEnd) };
}
function displayPkt(value: string) {
  const date = pktDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PK', { timeZone: PKT, day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}
function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function makeCsv(result: ReportResult) {
  return [result.columns, ...result.rows, ...(result.summary ? [result.summary] : [])]
    .map(row => row.map(value => csvCell(value)).join(',')).join('\r\n');
}

export default function ReportsScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [geofences, setGeofences] = useState<GeofenceOption[]>([]);
  const initialRange = useMemo(() => presetRange('Today'), []);
  const [reportId, setReportId] = useState<ReportType>('travel_summary');
  const [period, setPeriod] = useState('Today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [speedLimit, setSpeedLimit] = useState('');
  const [minStopMin, setMinStopMin] = useState('1');
  const [minSpeedKmh, setMinSpeedKmh] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [selectedGeofences, setSelectedGeofences] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [resultSearch, setResultSearch] = useState('');
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<PickerKind>(null);
  const [dateTarget, setDateTarget] = useState<'from' | 'to' | null>(null);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const vehicleIds = useMemo(() => vehicles.map(item => item.id), [vehicles]);
  const chosen = selected ?? vehicleIds;
  const report = REPORTS.find(item => item.id === reportId) ?? REPORTS[0]!;

  useEffect(() => { if (!permissionsLoading && !canDo('reports')) router.replace('/map'); }, [canDo, permissionsLoading]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setSavedLoading(true);
    Promise.allSettled([
      api.get<FleetVehicle[]>('/vehicles'),
      api.get<VehicleGroup[]>('/vehicle-groups'),
      api.get<SavedReport[]>('/reports/saved'),
    ]).then(([vehicleResponse, groupResponse, savedResponse]) => {
      if (!active) return;
      if (vehicleResponse.status === 'fulfilled') setVehicles(vehicleResponse.value.data);
      else setError('Vehicle list could not be loaded. Check your connection and try again.');
      if (groupResponse.status === 'fulfilled') setGroups(groupResponse.value.data);
      if (savedResponse.status === 'fulfilled') setSaved(savedResponse.value.data);
    }).finally(() => { if (active) setSavedLoading(false); });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    if (!report.options?.includes('geofence')) return;
    let active = true;
    api.get<GeofenceOption[]>('/geofences').then(response => { if (active) setGeofences(response.data); }).catch(() => { if (active) setGeofences([]); });
    return () => { active = false; };
  }, [reportId, report.options]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ type: reportId, vehicleIds: chosen.join(','), from: toUtc(from), to: toUtc(to) });
    if (report.options?.includes('speed') && speedLimit.trim()) params.set('speedLimit', speedLimit.trim());
    if (report.options?.includes('minStop') && minStopMin.trim()) params.set('minStopMin', minStopMin.trim());
    if (report.options?.includes('minSpeed') && minSpeedKmh.trim()) params.set('minSpeedKmh', minSpeedKmh.trim());
    if (report.options?.includes('geofence') && selectedGeofences.length) params.set('geofenceIds', selectedGeofences.join(','));
    if (groupBy) params.set('groupBy', groupBy);
    return params;
  }, [chosen, from, groupBy, minSpeedKmh, minStopMin, report.options, reportId, selectedGeofences, speedLimit, to]);

  const generate = async () => {
    if (!chosen.length) { setError('Select at least one vehicle.'); return; }
    if (pktDate(from).getTime() > pktDate(to).getTime()) { setError('The From date must be earlier than the To date.'); return; }
    const numericFilters: [boolean, string, number, number, string][] = [
      [!!report.options?.includes('speed'), speedLimit, 1, 300, 'Speed Limit'],
      [!!report.options?.includes('minStop'), minStopMin, 1, 120, 'Minimum Stop'],
      [!!report.options?.includes('minSpeed'), minSpeedKmh, 1, 200, 'Minimum Speed'],
    ];
    const invalidFilter = numericFilters.find(([enabled, value, min, max]) => enabled && value.trim() && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max));
    if (invalidFilter) { setError(`${invalidFilter[4]} must be within ${invalidFilter[2]}–${invalidFilter[3]}.`); return; }
    setBusy(true); setError(''); setResult(null); setResultSearch('');
    try {
      const response = await api.get<ReportResult>(`/reports?${buildParams().toString()}`);
      setResult(response.data);
    } catch {
      setError('Report could not be generated. Check your filters and try again.');
    } finally { setBusy(false); }
  };

  const toggleVehicle = (id: string) => {
    setResult(null);
    setSelected(current => {
      const next = current === null ? [...vehicleIds] : [...current];
      const updated = next.includes(id) ? next.filter(value => value !== id) : [...next, id];
      return updated.length === vehicleIds.length ? null : updated;
    });
  };
  const toggleGroup = (ids: string[]) => {
    setResult(null);
    setSelected(current => {
      const next = current === null ? [...vehicleIds] : [...current];
      const allSelected = ids.length > 0 && ids.every(id => next.includes(id));
      const updated = allSelected ? next.filter(id => !ids.includes(id)) : [...new Set([...next, ...ids])];
      return updated.length === vehicleIds.length ? null : updated;
    });
  };
  const setPreset = (label: string) => {
    setPeriod(label);
    if (label !== 'Custom') {
      const range = presetRange(label);
      setFrom(range.from); setTo(range.to);
    }
    setPicker(null); setResult(null); setError('');
  };
  const changeFilters = (change: () => void) => { change(); setResult(null); setError(''); };

  const refreshSaved = async () => {
    setSavedLoading(true);
    try { const response = await api.get<SavedReport[]>('/reports/saved'); setSaved(response.data); }
    catch { setError('Saved reports could not be loaded.'); }
    finally { setSavedLoading(false); }
  };
  const saveCurrent = async () => {
    const title = saveTitle.trim();
    if (!title) return;
    try {
      await api.post('/reports/saved', {
        title,
        type: reportId,
        params: {
          vehicleIds: chosen, from, to, period, speedLimit, minStopMin,
          minSpeedKmh, geofenceIds: selectedGeofences, groupBy,
        },
      });
      setSaveModalOpen(false); setSaveTitle(''); await refreshSaved();
    } catch { setError('Report filters could not be saved. Please try again.'); }
  };
  const loadSaved = (entry: SavedReport) => {
    const params = entry.params;
    setReportId(entry.type as ReportType);
    const ids = Array.isArray(params.vehicleIds) ? params.vehicleIds.filter((id): id is string => typeof id === 'string' && vehicleIds.includes(id)) : [];
    setSelected(ids.length === vehicleIds.length ? null : ids);
    setFrom(normalizePktValue(params.from, from));
    setTo(normalizePktValue(params.to, to));
    setPeriod(typeof params.period === 'string' ? params.period : 'Custom');
    setSpeedLimit(String(params.speedLimit ?? ''));
    setMinStopMin(String(params.minStopMin ?? '1'));
    setMinSpeedKmh(String(params.minSpeedKmh ?? ''));
    setGroupBy(typeof params.groupBy === 'string' ? params.groupBy : '');
    setSelectedGeofences(Array.isArray(params.geofenceIds) ? params.geofenceIds.filter((id): id is string => typeof id === 'string') : []);
    setResult(null); setError('');
  };
  const deleteSaved = async (id: string) => {
    try { await api.delete(`/reports/saved/${id}`); setSaved(current => current.filter(entry => entry.id !== id)); setDeleteId(null); }
    catch { setError('Saved report could not be deleted. Please try again.'); }
  };

  const exportCsv = async () => {
    if (!result) return;
    setExporting(true); setError('');
    try {
      const response = await api.get<string>(`/reports/export?${buildParams().toString()}`, { responseType: 'text' });
      const csv = typeof response.data === 'string' ? response.data : makeCsv(result);
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error('Temporary file storage is unavailable.');
      const now = pktParts(new Date());
      const fileDate = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
      const fileUri = `${directory}trackvee-${reportId}-${fileDate}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share report CSV', UTI: 'public.comma-separated-values-text' });
    } catch {
      setError('CSV export could not be prepared. Please try again.');
    } finally { setExporting(false); }
  };

  const selectionLabel = !vehicleIds.length ? 'No vehicles available' : selected === null || selected.length === vehicleIds.length ? `All vehicles (${vehicleIds.length})` : `${selected?.length ?? 0} selected`;
  const rows = useMemo(() => {
    if (!result || !resultSearch.trim()) return result?.rows ?? [];
    const query = resultSearch.trim().toLowerCase();
    return result.rows.filter(row => row.some(cell => String(cell ?? '').toLowerCase().includes(query)));
  }, [result, resultSearch]);
  const pickerTitle = picker === 'type' ? 'Choose Report Type' : picker === 'vehicles' ? 'Select Vehicles' : picker === 'period' ? 'Choose Period' : picker === 'groupBy' ? 'Group Report By' : 'Choose Geofence';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View><Text style={styles.title}>Reports</Text><Text style={styles.subtitle}>Fleet activity and trip summaries</Text></View>
          <TablerIcon name="report" size={23} color={t.red} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Report Type</Text>
          <Pressable onPress={() => setPicker('type')} style={styles.select}><Text numberOfLines={1} style={styles.selectText}>{report.label}</Text><Text style={styles.chevron}>⌄</Text></Pressable>

          <Text style={styles.label}>Vehicles</Text>
          <Pressable onPress={() => { setVehicleSearch(''); setPicker('vehicles'); }} style={styles.select}><Text style={styles.selectText}>{selectionLabel}</Text><Text style={styles.chevron}>⌄</Text></Pressable>

          <Text style={styles.label}>Period</Text>
          <Pressable onPress={() => setPicker('period')} style={styles.select}><Text style={styles.selectText}>{period}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
          <View style={styles.dateRow}>
            <DateField label="From · PKT" value={from} onPress={() => setDateTarget('from')} />
            <DateField label="To · PKT" value={to} onPress={() => setDateTarget('to')} />
          </View>

          {report.options?.includes('speed') ? <FilterNumber label="Speed Limit (km/h)" value={speedLimit} placeholder="Default 80" onChange={value => changeFilters(() => setSpeedLimit(value))} min={1} max={300} /> : null}
          {report.options?.includes('minStop') ? <FilterNumber label="Minimum Stop (min)" value={minStopMin} placeholder="1" onChange={value => changeFilters(() => setMinStopMin(value))} min={1} max={120} /> : null}
          {report.options?.includes('minSpeed') ? <FilterNumber label="Minimum Speed (km/h)" value={minSpeedKmh} placeholder="Default 20" onChange={value => changeFilters(() => setMinSpeedKmh(value))} min={1} max={200} /> : null}
          {report.options?.includes('geofence') ? <>
            <Text style={styles.label}>Geofence</Text>
            <Pressable onPress={() => setPicker('geofence')} style={styles.select}>
              <Text style={styles.selectText}>{selectedGeofences.length ? geofences.filter(item => selectedGeofences.includes(item.id)).map(item => item.name).join(', ') || `${selectedGeofences.length} selected` : 'All Geofences'}</Text><Text style={styles.chevron}>⌄</Text>
            </Pressable>
          </> : null}

          <Text style={styles.label}>Group By</Text>
          <Pressable onPress={() => setPicker('groupBy')} style={styles.select}><Text style={styles.selectText}>{GROUP_BY_OPTIONS.find(item => item.id === groupBy)?.label ?? 'None'}</Text><Text style={styles.chevron}>⌄</Text></Pressable>

          <Pressable disabled={busy || !vehicleIds.length} onPress={generate} style={({ pressed }) => [styles.generate, pressed && styles.pressed, (busy || !vehicleIds.length) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateText}>Generate Report</Text>}
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          {result ? <View style={styles.preview}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}><Text style={styles.previewTitle}>{REPORTS.find(item => item.id === result.type)?.label ?? 'Report Preview'}</Text><Text style={styles.previewMeta}>{result.vehicleCount} vehicle{result.vehicleCount === 1 ? '' : 's'} · {result.rowCount} rows · {displayPkt(from)} to {displayPkt(to)}</Text></View>
              <Pressable accessibilityLabel="Share CSV report" disabled={exporting} onPress={exportCsv} style={styles.exportButton}>{exporting ? <ActivityIndicator size="small" color={t.red} /> : <><TablerIcon name="report" size={16} color={t.red} /><Text style={styles.exportText}>CSV</Text></>}</Pressable>
            </View>
            <Pressable onPress={() => { setSaveTitle(`${report.label} · ${period}`); setSaveModalOpen(true); }} style={styles.saveCurrent}><TablerIcon name="bookmark" size={15} color={t.red} /><Text style={styles.saveCurrentText}>Save current filters</Text></Pressable>
            <View style={styles.resultSearch}><TablerIcon name="search" size={16} color={t.secondary} /><TextInput value={resultSearch} onChangeText={setResultSearch} placeholder="Search report results" placeholderTextColor={t.muted} style={styles.resultSearchInput} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeader}>{result.columns.map((column, index) => <Text key={`${column}-${index}`} style={styles.cellHeader}>{column}</Text>)}</View>
                {rows.map((row, rowIndex) => <View key={`${result.type}-${rowIndex}`} style={styles.tableRow}>{result.columns.map((column, columnIndex) => <Text key={`${column}-${columnIndex}`} numberOfLines={2} style={styles.cell}>{row[columnIndex] == null || row[columnIndex] === '' ? '—' : String(row[columnIndex])}</Text>)}</View>)}
                {!rows.length ? <Text style={styles.noRows}>{result.rows.length ? 'No matching rows.' : 'No report data for this period.'}</Text> : null}
                {result.summary?.length ? <View style={styles.summaryRow}>{result.summary.map((value, index) => <Text key={`summary-${index}`} style={styles.summaryCell}>{value == null ? '' : String(value)}</Text>)}</View> : null}
              </View>
            </ScrollView>
          </View> : null}

          <View style={styles.savedSection}>
            <View style={styles.savedHeader}><Text style={styles.savedTitle}>Saved Reports</Text><Pressable accessibilityLabel="Refresh saved reports" onPress={refreshSaved}><TablerIcon name="refresh" size={17} color={t.secondary} /></Pressable></View>
            {savedLoading ? <ActivityIndicator style={{ marginVertical: 16 }} color={t.red} /> : null}
            {!savedLoading && !saved.length ? <Text style={styles.noSaved}>Saved filter sets will appear here.</Text> : null}
            {!savedLoading ? saved.map(entry => <View key={entry.id} style={styles.savedRow}>
              <Pressable onPress={() => loadSaved(entry)} style={{ flex: 1 }}><Text numberOfLines={1} style={styles.savedName}>{entry.title}</Text><Text style={styles.savedMeta}>{REPORTS.find(item => item.id === entry.type)?.label ?? entry.type} · {entry.userName ?? 'Saved report'}</Text></Pressable>
              {deleteId === entry.id ? <View style={styles.deleteActions}><Pressable onPress={() => deleteSaved(entry.id)}><Text style={styles.deleteConfirm}>Delete</Text></Pressable><Pressable onPress={() => setDeleteId(null)}><Text style={styles.cancelDelete}>Cancel</Text></Pressable></View> : <Pressable accessibilityLabel={`Delete ${entry.title}`} onPress={() => setDeleteId(entry.id)} style={styles.deleteButton}><TablerIcon name="trash" size={16} color={t.secondary} /></Pressable>}
            </View>) : null}
          </View>
        </ScrollView>

        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View style={styles.modalBackdrop}><View style={styles.sheet}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{pickerTitle}</Text><Pressable onPress={() => setPicker(null)} accessibilityLabel="Close"><TablerIcon name="close" size={20} color={t.ink} /></Pressable></View>
            {picker === 'vehicles' ? <>
              <View style={styles.vehicleTools}><Pressable onPress={() => { setSelected(null); setResult(null); }}><Text style={styles.toolText}>Select all</Text></Pressable><Pressable onPress={() => { setSelected([]); setResult(null); }}><Text style={styles.toolText}>Deselect all</Text></Pressable></View>
              <View style={styles.vehicleSearch}><TablerIcon name="search" size={17} color={t.secondary} /><TextInput value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Search vehicles" placeholderTextColor={t.muted} style={styles.vehicleSearchInput} /></View>
              <VehicleSelectionList vehicles={vehicles} groups={groups} query={vehicleSearch} selected={selected} onToggleVehicle={toggleVehicle} onToggleGroup={toggleGroup} />
              <Pressable onPress={() => setPicker(null)} style={styles.done}><Text style={styles.doneText}>Done · {chosen.length} selected</Text></Pressable>
            </> : <ScrollView style={styles.choiceList}>
              {picker === 'type' ? REPORT_GROUPS.map(group => <View key={group}>
                <Text style={styles.groupHeading}>{group}</Text>
                {REPORTS.filter(item => item.group === group).map(item => <ChoiceRow key={item.id} label={item.label} selected={item.id === reportId} onPress={() => { changeFilters(() => { setReportId(item.id); setSelectedGeofences([]); }); setPicker(null); }} />)}
              </View>) : null}
              {picker === 'period' ? PERIODS.map(label => <ChoiceRow key={label} label={label} selected={period === label} onPress={() => setPreset(label)} />) : null}
              {picker === 'groupBy' ? GROUP_BY_OPTIONS.map(item => <ChoiceRow key={item.id || 'none'} label={item.label} selected={groupBy === item.id} onPress={() => { changeFilters(() => setGroupBy(item.id)); setPicker(null); }} />) : null}
              {picker === 'geofence' ? <>
                <ChoiceRow label="All Geofences" selected={!selectedGeofences.length} onPress={() => { changeFilters(() => setSelectedGeofences([])); setPicker(null); }} />
                {geofences.map(item => <ChoiceRow key={item.id} label={item.name} selected={selectedGeofences.includes(item.id)} onPress={() => { changeFilters(() => setSelectedGeofences(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])); }} />)}
                {geofences.length ? <Pressable onPress={() => setPicker(null)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable> : <Text style={styles.emptyChoices}>No geofences available. The report will include all geofences.</Text>}
              </> : null}
            </ScrollView>}
          </View></View>
        </Modal>

        <Modal visible={saveModalOpen} transparent animationType="fade" onRequestClose={() => setSaveModalOpen(false)}>
          <View style={styles.saveBackdrop}><View style={styles.saveCard}>
            <Text style={styles.sheetTitle}>Save Report Filters</Text><Text style={styles.saveHint}>Save this setup to reuse the same vehicles, dates and report options.</Text>
            <TextInput autoFocus value={saveTitle} onChangeText={setSaveTitle} placeholder="Report name" placeholderTextColor={t.muted} style={styles.saveInput} maxLength={80} />
            <View style={styles.saveActions}><Pressable onPress={() => setSaveModalOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!saveTitle.trim()} onPress={saveCurrent} style={[styles.done, !saveTitle.trim() && styles.disabled]}><Text style={styles.doneText}>Save</Text></Pressable></View>
          </View></View>
        </Modal>

        <DateTimePickerModal value={dateTarget === 'from' ? from : to} visible={dateTarget !== null} onClose={() => setDateTarget(null)} onApply={value => {
          if (dateTarget === 'from') setFrom(value); else setTo(value);
          setPeriod('Custom'); setResult(null); setError(''); setDateTarget(null);
        }} />
      </View>
    </SafeAreaView>
  );
}

function VehicleSelectionList({ vehicles, groups, query, selected, onToggleVehicle, onToggleGroup }: {
  vehicles: FleetVehicle[]; groups: VehicleGroup[]; query: string; selected: string[] | null;
  onToggleVehicle: (id: string) => void; onToggleGroup: (ids: string[]) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const normalized = query.trim().toLowerCase();
  const matches = (vehicle: FleetVehicle) => `${vehicle.licensePlate ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.name}`.toLowerCase().includes(normalized);
  const assigned = new Set(groups.flatMap(group => group.vehicleIds));
  const sections = [
    ...groups.map(group => ({ id: group.id, name: group.name, vehicles: vehicles.filter(vehicle => group.vehicleIds.includes(vehicle.id) && matches(vehicle)) })),
    { id: 'unassigned', name: 'Unassigned', vehicles: vehicles.filter(vehicle => !assigned.has(vehicle.id) && matches(vehicle)) },
  ].filter(section => section.vehicles.length > 0);
  if (!sections.length) return <Text style={styles.emptyChoices}>{vehicles.length ? 'No vehicles match your search.' : 'No vehicles available.'}</Text>;
  return <ScrollView style={styles.choiceList} keyboardShouldPersistTaps="handled">
    {sections.map(section => {
      const ids = section.vehicles.map(vehicle => vehicle.id);
      const selectedCount = ids.filter(id => selected === null || selected.includes(id)).length;
      return <View key={section.id}>
        <Pressable onPress={() => onToggleGroup(ids)} style={styles.groupRow}>
          <CheckBox checked={selectedCount === ids.length} partial={selectedCount > 0 && selectedCount < ids.length} />
          <Text style={styles.groupName}>{section.name}</Text><Text style={styles.groupCount}>{section.vehicles.length}</Text>
        </Pressable>
        {section.vehicles.map(vehicle => <Pressable key={vehicle.id} onPress={() => onToggleVehicle(vehicle.id)} style={styles.choiceRow}>
          <CheckBox checked={selected === null || selected.includes(vehicle.id)} />
          <View style={{ flex: 1 }}><Text style={styles.choiceLabel}>{vehicle.licensePlate || `#${vehicle.displayId}`}</Text><Text style={styles.choiceHint}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name}</Text></View>
        </Pressable>)}
      </View>;
    })}
  </ScrollView>;
}

function CheckBox({ checked, partial = false }: { checked: boolean; partial?: boolean }) {
  const t = useTheme(); const styles = useMemo(() => createStyles(t), [t]);
  return <View style={[styles.checkbox, (checked || partial) && styles.checkboxOn]}><Text style={styles.check}>{checked ? '✓' : partial ? '−' : ''}</Text></View>;
}
function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme(); const styles = useMemo(() => createStyles(t), [t]);
  return <Pressable onPress={onPress} style={styles.choiceRow}><Text style={[styles.choiceLabel, { flex: 1 }]}>{label}</Text>{selected ? <TablerIcon name="check" size={17} color={t.red} /> : null}</Pressable>;
}
function DateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const t = useTheme(); const styles = useMemo(() => createStyles(t), [t]);
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateBox}><Text style={styles.dateLabel}>{label}</Text><Text numberOfLines={1} style={styles.dateValue}>{displayPkt(value)}</Text></Pressable>;
}
function FilterNumber({ label, value, placeholder, onChange, min, max }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; min: number; max: number }) {
  const t = useTheme(); const styles = useMemo(() => createStyles(t), [t]);
  return <View style={styles.numberFilter}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={text => onChange(text.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder={placeholder} placeholderTextColor={t.muted} style={styles.numberInput} accessibilityLabel={`${label}, from ${min} to ${max}`} />{value && (Number(value) < min || Number(value) > max) ? <Text style={styles.validationHint}>Enter a value from {min} to {max}.</Text> : null}</View>;
}

function DateTimePickerModal({ value, visible, onClose, onApply }: { value: string; visible: boolean; onClose: () => void; onApply: (value: string) => void }) {
  const t = useTheme(); const styles = useMemo(() => createStyles(t), [t]);
  const initial = parsePkt(value);
  const [draft, setDraft] = useState<PktParts>(initial);
  const [month, setMonth] = useState({ year: initial.year, month: initial.month });
  useEffect(() => {
    if (visible) { const next = parsePkt(value); setDraft(next); setMonth({ year: next.year, month: next.month }); }
  }, [visible, value]);
  const firstWeekday = (new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const changeMonth = (delta: number) => {
    const date = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
    setMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
  };
  const changeMinutes = (delta: number) => {
    const date = new Date(Date.UTC(draft.year, draft.month - 1, draft.day, draft.hour, draft.minute + delta));
    setDraft({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() });
  };
  const changeHour = (delta: number) => {
    const pm = draft.hour >= 12;
    const current = draft.hour % 12 || 12;
    const next = ((current - 1 + delta + 12) % 12) + 1;
    setDraft(currentDraft => ({ ...currentDraft, hour: (next % 12) + (pm ? 12 : 0) }));
  };
  const toggleMeridiem = () => setDraft(current => ({ ...current, hour: current.hour >= 12 ? current.hour - 12 : current.hour + 12 }));
  const hour12 = draft.hour % 12 || 12;
  const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.pickerScrim}><View style={styles.pickerCard}>
      <View style={styles.pickerHeader}><Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.pickerArrow}><TablerIcon name="back" size={17} color={t.ink} /></Pressable><Text style={styles.pickerTitle}>{monthTitle}</Text><Pressable accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.pickerArrow}><TablerIcon name="forward" size={17} color={t.ink} /></Pressable></View>
      <View style={styles.calendarGrid}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.calendarWeekday}>{day}</Text>)}
        {Array.from({ length: firstWeekday }, (_, index) => <View key={`blank-${index}`} style={styles.calendarDay} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const active = draft.year === month.year && draft.month === month.month && draft.day === day;
          return <Pressable key={day} onPress={() => setDraft(current => ({ ...current, year: month.year, month: month.month, day }))} style={[styles.calendarDay, active && styles.calendarDayActive]}><Text style={[styles.calendarDayText, active && styles.calendarDayTextActive]}>{day}</Text></Pressable>;
        })}
      </View>
      <View style={styles.timePicker}><Text style={styles.timeLabel}>Time (PKT)</Text>
        <View style={styles.timeUnit}><Pressable onPress={() => changeHour(1)} style={styles.timeStep}><Text style={styles.timeStepText}>+</Text></Pressable><Text style={styles.timeNumber}>{String(hour12).padStart(2, '0')}</Text><Pressable onPress={() => changeHour(-1)} style={styles.timeStep}><Text style={styles.timeStepText}>−</Text></Pressable></View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeUnit}><Pressable onPress={() => changeMinutes(5)} style={styles.timeStep}><Text style={styles.timeStepText}>+</Text></Pressable><Text style={styles.timeNumber}>{String(draft.minute).padStart(2, '0')}</Text><Pressable onPress={() => changeMinutes(-5)} style={styles.timeStep}><Text style={styles.timeStepText}>−</Text></Pressable></View>
        <Pressable onPress={toggleMeridiem} style={styles.meridiem}><Text style={styles.meridiemText}>{draft.hour >= 12 ? 'PM' : 'AM'}</Text></Pressable>
      </View>
      <View style={styles.pickerActions}><Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => onApply(pktValue(draft))} style={styles.applyButton}><Text style={styles.doneText}>Apply</Text></Pressable></View>
    </View></View>
  </Modal>;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: { minHeight: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: t.border },
  title: { fontSize: 24, fontWeight: '700', color: t.ink }, subtitle: { marginTop: 3, color: t.secondary, fontSize: 12 },
  body: { padding: 18, paddingBottom: 34 }, label: { color: t.ink, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 7 },
  select: { minHeight: 46, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: 14, color: t.ink, marginRight: 10 }, chevron: { fontSize: 20, color: t.secondary, marginTop: -6 },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 14 }, dateBox: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 10 },
  dateLabel: { fontSize: 10, color: t.secondary, marginBottom: 5 }, dateValue: { fontSize: 12, color: t.ink, fontWeight: '600' },
  numberFilter: { marginTop: 2 }, numberInput: { minHeight: 44, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 12, color: t.ink, fontSize: 14 }, validationHint: { marginTop: 5, color: t.red, fontSize: 11 },
  generate: { height: 49, backgroundColor: t.red, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, pressed: { opacity: 0.84 }, disabled: { opacity: 0.55 }, generateText: { color: '#fff', fontWeight: '700', fontSize: 14 }, error: { color: t.red, fontSize: 12, marginTop: 10 },
  preview: { marginTop: 24, borderTopWidth: 1, borderColor: t.border, paddingTop: 14 }, previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, previewTitle: { color: t.ink, fontSize: 16, fontWeight: '700' }, previewMeta: { color: t.secondary, fontSize: 10, marginTop: 4 },
  exportButton: { minWidth: 58, height: 36, paddingHorizontal: 10, borderWidth: 1, borderColor: t.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, exportText: { color: t.red, fontWeight: '700', fontSize: 12 },
  saveCurrent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 }, saveCurrentText: { color: t.red, fontSize: 12, fontWeight: '600' },
  resultSearch: { height: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: t.border, borderRadius: 7, marginBottom: 10 }, resultSearchInput: { flex: 1, padding: 0, fontSize: 12, color: t.ink },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: t.border, backgroundColor: t.bg2 }, cellHeader: { width: 132, paddingHorizontal: 8, paddingVertical: 10, color: t.secondary, fontSize: 11, fontWeight: '700' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: t.border }, cell: { width: 132, paddingHorizontal: 8, paddingVertical: 11, color: t.ink, fontSize: 12 }, summaryRow: { flexDirection: 'row', borderTopWidth: 2, borderColor: t.border, backgroundColor: t.bg2 }, summaryCell: { width: 132, paddingHorizontal: 8, paddingVertical: 10, color: t.ink, fontSize: 11, fontWeight: '700' }, noRows: { padding: 18, color: t.secondary, fontSize: 12 },
  savedSection: { marginTop: 28, borderTopWidth: 1, borderColor: t.border, paddingTop: 17 }, savedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, savedTitle: { color: t.ink, fontSize: 15, fontWeight: '700' }, noSaved: { color: t.secondary, fontSize: 12, paddingVertical: 12 },
  savedRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: t.border }, savedName: { color: t.ink, fontSize: 13, fontWeight: '600' }, savedMeta: { color: t.secondary, fontSize: 10, marginTop: 4 }, deleteButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }, deleteActions: { flexDirection: 'row', gap: 12 }, deleteConfirm: { color: t.red, fontWeight: '700', fontSize: 11 }, cancelDelete: { color: t.secondary, fontSize: 11 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' }, sheet: { maxHeight: '86%', backgroundColor: t.bg, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 25 },
  sheetHeader: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: t.border }, sheetTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
  vehicleTools: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, paddingHorizontal: 18, paddingVertical: 12 }, toolText: { color: t.red, fontSize: 12, fontWeight: '600' },
  vehicleSearch: { height: 42, marginHorizontal: 18, marginBottom: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: t.border, borderRadius: 8 }, vehicleSearchInput: { flex: 1, padding: 0, fontSize: 13, color: t.ink }, choiceList: { paddingHorizontal: 18 },
  groupHeading: { color: t.secondary, fontSize: 11, fontWeight: '700', paddingTop: 14, paddingBottom: 6, textTransform: 'uppercase' }, groupRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: t.border, backgroundColor: t.bg2, paddingHorizontal: 8 }, groupName: { flex: 1, color: t.ink, fontSize: 12, fontWeight: '700' }, groupCount: { color: t.secondary, fontSize: 11 },
  choiceRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: t.border, paddingHorizontal: 4 }, choiceLabel: { color: t.ink, fontSize: 14, fontWeight: '500' }, choiceHint: { color: t.secondary, fontSize: 11, marginTop: 3 },
  checkbox: { height: 19, width: 19, borderWidth: 1, borderColor: t.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }, checkboxOn: { borderColor: t.red, backgroundColor: t.red }, check: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  done: { minHeight: 44, backgroundColor: t.red, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginHorizontal: 18, marginTop: 12, paddingHorizontal: 16 }, doneText: { color: '#fff', fontWeight: '700', fontSize: 13 }, emptyChoices: { padding: 18, color: t.secondary, fontSize: 12 },
  saveBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', padding: 22 }, saveCard: { backgroundColor: t.bg, borderRadius: 10, padding: 18, elevation: 8 }, saveHint: { color: t.secondary, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 14 }, saveInput: { height: 44, borderWidth: 1, borderColor: t.border, borderRadius: 7, paddingHorizontal: 11, color: t.ink, fontSize: 13 }, saveActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }, cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14 }, cancelText: { color: t.secondary, fontSize: 13, fontWeight: '600' },
  pickerScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', padding: 18 }, pickerCard: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: t.bg, borderRadius: 12, padding: 16, elevation: 8 }, pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, pickerArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, pickerTitle: { fontSize: 15, fontWeight: '700', color: t.ink },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, calendarWeekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 7, color: t.secondary, fontSize: 10, fontWeight: '700' }, calendarDay: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center' }, calendarDayActive: { backgroundColor: t.red, borderRadius: 20 }, calendarDayText: { fontSize: 12, color: t.ink }, calendarDayTextActive: { color: '#fff', fontWeight: '700' },
  timePicker: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, borderTopWidth: 1, borderColor: t.border, marginTop: 11, paddingTop: 27 }, timeLabel: { position: 'absolute', left: 0, top: 9, color: t.secondary, fontSize: 10 }, timeUnit: { alignItems: 'center', gap: 4 }, timeStep: { width: 38, height: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2, borderRadius: 6 }, timeStepText: { fontSize: 16, color: t.ink }, timeNumber: { fontSize: 16, color: t.ink, fontWeight: '700' }, timeColon: { fontSize: 18, fontWeight: '700', color: t.ink }, meridiem: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: t.bg2, borderRadius: 6 }, meridiemText: { fontSize: 12, fontWeight: '700', color: t.ink },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }, applyButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: t.red, borderRadius: 7 },
}); }
