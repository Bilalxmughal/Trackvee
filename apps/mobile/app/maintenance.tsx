import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

type Vehicle = { id: string; displayId: number; name: string; licensePlate: string | null; make: string | null; model: string | null };
type VehicleGroup = { id: string; name: string; vehicleIds: string[] };
type Row = { id: string; vehicleId: string; serviceType: string; serviceDate: string; odometerKm: string | null; provider: string | null; cost: string | null; notes: string | null; nextDueDate: string | null; nextDueOdometerKm: string | null; reminderDaysBefore: number; reminderKmBefore: number; currentOdometerKm: number | null; status: 'completed'|'scheduled'|'upcoming'|'overdue'; vehicle: Vehicle };
type Form = { vehicleId: string; serviceType: string; customServiceType: string; serviceDate: string; odometerKm: string; provider: string; cost: string; notes: string; nextDueDate: string; nextDueDistanceKm: string; reminderDaysBefore: string; reminderKmBefore: string };
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const createForm = (vehicleId = ''): Form => ({ vehicleId, serviceType: 'Engine Oil', customServiceType: '', serviceDate: today(), odometerKm: '', provider: '', cost: '', notes: '', nextDueDate: '', nextDueDistanceKm: '', reminderDaysBefore: '', reminderKmBefore: '' });
const SERVICE_TYPES = ['Engine Oil','Tuning','Oil Filter','Air Filter','AC Filter','Fuel Filter','Brake Pads','Brake Fluid','Coolant','Transmission Oil','Battery','Tyre Rotation','General Inspection','Other'];
const formatDate = (value: string) => /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(0,4)}` : value;
const parseDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === `${year}-${month}-${day}` ? `${year}-${month}-${day}` : null;
};
const label = (vehicle: Vehicle) => vehicle.licensePlate || `#${vehicle.displayId}`;

export default function MaintenanceScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const colors = useMemo(() => ({ completed: t.secondary, scheduled: t.secondary, upcoming: '#b45309', overdue: t.red }), [t]);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [groups, setGroups] = useState<VehicleGroup[]>([]); const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all'|'upcoming'|'overdue'>('all'); const [form, setForm] = useState<Form | null>(null); const [editing, setEditing] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [serviceTypeOpen, setServiceTypeOpen] = useState(false); const [odometerPickerOpen, setOdometerPickerOpen] = useState(false); const [dateTarget, setDateTarget] = useState<'serviceDate'|'nextDueDate'|null>(null); const [vehicleSearch, setVehicleSearch] = useState(''); const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  useEffect(() => { if (!permissionsLoading && !canDo('maintenance')) router.replace('/map'); }, [canDo, permissionsLoading]);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    const [vehicleResult, groupResult, recordResult] = await Promise.allSettled([api.get<Vehicle[]>('/maintenance/vehicles'), api.get<VehicleGroup[]>('/vehicle-groups'), api.get<Row[]>('/maintenance')]);
    if (vehicleResult.status === 'fulfilled') setVehicles(vehicleResult.value.data); else setVehicles([]);
    setGroups(groupResult.status === 'fulfilled' ? groupResult.value.data : []);
    if (recordResult.status === 'fulfilled') setRows(recordResult.value.data);
    else Alert.alert('Maintenance unavailable', 'Service records could not be loaded. Please try again.');
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { if (!permissionsLoading && canDo('maintenance')) void load(); }, [canDo, permissionsLoading, load]);
  const closeForm = useCallback(() => { setForm(null); setEditing(null); }, []);
  const visible = useMemo(() => rows.filter(row => filter === 'all' || row.status === filter), [rows, filter]);
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => current ? { ...current, [key]: value } : current);
  const openEdit = (row: Row) => { setEditing(row.id); const known = SERVICE_TYPES.includes(row.serviceType); const serviceOdometer = row.odometerKm == null ? null : Number(row.odometerKm); const dueOdometer = row.nextDueOdometerKm == null ? null : Number(row.nextDueOdometerKm); setForm({ vehicleId: row.vehicleId, serviceType: known ? row.serviceType : 'Other', customServiceType: known ? '' : row.serviceType, serviceDate: row.serviceDate.slice(0,10), odometerKm: row.odometerKm ?? '', provider: row.provider ?? '', cost: row.cost ?? '', notes: row.notes ?? '', nextDueDate: row.nextDueDate?.slice(0,10) ?? '', nextDueDistanceKm: serviceOdometer != null && dueOdometer != null && dueOdometer > serviceOdometer ? String(dueOdometer - serviceOdometer) : '', reminderDaysBefore: row.reminderDaysBefore ? String(row.reminderDaysBefore) : '', reminderKmBefore: row.reminderKmBefore ? String(row.reminderKmBefore) : '' }); setVehicleSearch(''); };
  const save = async () => {
    const serviceType = form?.serviceType === 'Other' ? form.customServiceType.trim() : form?.serviceType.trim();
    const serviceDate = form ? parseDate(form.serviceDate) : null; const nextDueDate = form?.nextDueDate ? parseDate(form.nextDueDate) : null;
    if (!form?.vehicleId || !serviceType || !serviceDate || !nextDueDate || !form.nextDueDistanceKm || !form.reminderDaysBefore.trim() || !form.reminderKmBefore.trim()) { Alert.alert('Check service details', 'Complete all required fields and select valid service and due dates.'); return; }
    const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
    const payload = { vehicleId: form.vehicleId, serviceType, serviceDate, odometerKm: numberOrNull(form.odometerKm), provider: form.provider.trim() || null, cost: numberOrNull(form.cost), notes: form.notes.trim() || null, nextDueDate, nextDueOdometerKm: numberOrNull(form.nextDueDistanceKm) == null || numberOrNull(form.odometerKm) == null ? null : Number(form.odometerKm) + Number(form.nextDueDistanceKm), reminderDaysBefore: numberOrNull(form.reminderDaysBefore) ?? 0, reminderKmBefore: numberOrNull(form.reminderKmBefore) ?? 0 };
    if (form.nextDueDistanceKm && payload.odometerKm == null) { Alert.alert('Check service details', 'Enter the service odometer before setting a distance-based due point.'); return; }
    if (![payload.reminderDaysBefore, payload.reminderKmBefore].every(value => Number.isFinite(value) && value >= 0)) { Alert.alert('Check service details', 'Reminder values must be zero or higher.'); return; }
    if ([payload.odometerKm, payload.cost, payload.nextDueOdometerKm].some(value => value != null && (!Number.isFinite(value) || value < 0))) { Alert.alert('Check service details', 'Odometer and cost values must be zero or higher.'); return; }
    setSaving(true);
    try { if (editing) await api.put(`/maintenance/${editing}`, payload); else await api.post('/maintenance', payload); setForm(null); setEditing(null); await load(true); }
    catch (error) { const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message; Alert.alert('Could not save service record', typeof message === 'string' ? message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  const remove = (row: Row) => Alert.alert('Delete service record?', `Remove ${row.serviceType} for ${label(row.vehicle)}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/maintenance/${row.id}`); await load(true); } catch { Alert.alert('Could not delete record', 'Please try again.'); } } }]);
  const textField = (title: string, key: keyof Form, opts: { numeric?: boolean; date?: boolean; multiline?: boolean } = {}) => <View style={s.field} key={key}><Text style={s.label}>{title}</Text><TextInput value={opts.date ? formatDate((form?.[key] as string | undefined) ?? '') : (form?.[key] as string | undefined) ?? ''} onChangeText={value => update(key, value)} keyboardType={opts.numeric ? 'decimal-pad' : opts.date ? 'numbers-and-punctuation' : 'default'} placeholder={opts.date ? 'DD-MM-YYYY' : ''} autoCapitalize="sentences" multiline={opts.multiline} style={[s.input, opts.multiline && s.multiline]}/></View>;
  if (permissionsLoading || !canDo('maintenance')) return <SafeAreaView style={s.screen} edges={['top']}><ActivityIndicator style={{ marginTop: 25 }} color={t.red}/></SafeAreaView>;
  return <SafeAreaView style={s.screen} edges={['top']}>
    <Stack.Screen options={{ headerBackButtonMenuEnabled: false }} />
    <View style={s.header}><Pressable onPress={() => form ? (setForm(null), setEditing(null)) : router.back()} style={s.back} accessibilityLabel="Back"><TablerIcon name="arrow-left" size={19} color={t.ink}/></Pressable><View style={{ flex: 1 }}><Text style={s.title}>{form ? (editing ? 'Edit Service' : 'Log Service') : 'Maintenance'}</Text><Text style={s.subtitle}>{form ? 'History and next due reminders' : `${rows.length} service records`}</Text></View>{!form && canDo('maintenance','add') ? <Pressable onPress={() => { setEditing(null); setVehicleSearch(''); setForm(createForm(vehicles[0]?.id ?? '')); }} style={s.add} accessibilityLabel="Log service"><TablerIcon name="plus" size={19} color="#fff"/></Pressable> : null}</View>
    {form ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <View style={s.field}><Text style={s.label}>Vehicle *</Text><TextInput value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Search vehicle or plate" style={s.input} autoCorrect={false}/>{!vehicles.length ? <Text style={s.empty}>{loading ? 'Loading vehicles…' : 'No vehicles are available for your account.'}</Text> : null}<ScrollView style={s.vehicleOptions} nestedScrollEnabled keyboardShouldPersistTaps="handled">{groups.map(group => { const members = vehicles.filter(vehicle => group.vehicleIds.includes(vehicle.id) && `${label(vehicle)} ${vehicle.name} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase().includes(vehicleSearch.trim().toLowerCase())); if (!members.length) return null; const collapsed = collapsedGroups.has(group.id); return <View key={group.id}><Pressable onPress={() => setCollapsedGroups(current => { const next = new Set(current); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next; })} style={s.groupHeader}><Text style={s.groupName}>{group.name}</Text><Text style={s.groupName}>{collapsed ? '+' : '−'} · {members.length}</Text></Pressable>{!collapsed && members.map(vehicle => <Pressable key={vehicle.id} onPress={() => update('vehicleId', vehicle.id)} style={[s.vehicleChoice, form.vehicleId === vehicle.id && s.vehicleChoiceSelected]}><Text numberOfLines={1} style={[s.vehicleChoiceText, form.vehicleId === vehicle.id && { color: t.red }]}>{label(vehicle)} · {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name}</Text></Pressable>)}</View>; })}{(() => { const ungrouped = vehicles.filter(vehicle => !groups.some(g => g.vehicleIds.includes(vehicle.id)) && `${label(vehicle)} ${vehicle.name} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase().includes(vehicleSearch.trim().toLowerCase())); if (!ungrouped.length) return null; const collapsed = collapsedGroups.has('__ungrouped__'); return <View key="__ungrouped__"><Pressable onPress={() => setCollapsedGroups(cur => { const n = new Set(cur); n.has('__ungrouped__') ? n.delete('__ungrouped__') : n.add('__ungrouped__'); return n; })} style={s.groupHeader}><Text style={s.groupName}>Ungrouped</Text><Text style={s.groupName}>{collapsed ? '+' : '−'} · {ungrouped.length}</Text></Pressable>{!collapsed && ungrouped.map(vehicle => <Pressable key={vehicle.id} onPress={() => update('vehicleId', vehicle.id)} style={[s.vehicleChoice, form.vehicleId === vehicle.id && s.vehicleChoiceSelected]}><Text numberOfLines={1} style={[s.vehicleChoiceText, form.vehicleId === vehicle.id && { color: t.red }]}>{label(vehicle)} · {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name}</Text></Pressable>)}</View>; })()}</ScrollView></View>
      <View style={s.field}><Text style={s.label}>Service type *</Text><Pressable onPress={() => setServiceTypeOpen(true)} style={s.input}><Text style={{ color: t.ink, fontSize: 13 }}>{form.serviceType || 'Select service type'}  ▾</Text></Pressable>{form.serviceType === 'Other' ? textField('Custom service type *','customServiceType') : null}</View>
      <Text style={s.sectionTitle}>Service Details</Text>
      <View style={s.grid}>{dateField('Service date *','serviceDate')}{textField(form.nextDueDistanceKm ? 'Service odometer (km) *' : 'Service odometer (km)','odometerKm',{numeric:true})}{textField('Cost (PKR)','cost',{numeric:true})}</View>
      <Text style={s.sectionTitle}>Next Due</Text>
      <View style={s.grid}>{dateField('Next due date *','nextDueDate')}<View style={s.field}><Text style={s.label}>Due after (km) *</Text><Pressable onPress={() => setOdometerPickerOpen(true)} style={s.input}><Text style={{ color: form.nextDueDistanceKm ? t.ink : t.muted, fontSize: 13 }}>{form.nextDueDistanceKm ? `${Number(form.nextDueDistanceKm).toLocaleString('en-US')} km after service${form.odometerKm ? ` · ${(Number(form.odometerKm) + Number(form.nextDueDistanceKm)).toLocaleString('en-US')} km total` : ''}` : 'Select distance'}  ▾</Text></Pressable></View></View>
      <Text style={s.sectionTitle}>Reminders</Text>
      <View style={s.grid}>{textField('Reminder lead (days) *','reminderDaysBefore',{numeric:true})}{textField('Reminder lead (km) *','reminderKmBefore',{numeric:true})}</View>
      {textField('Notes','notes',{multiline:true})}
      <View style={s.formActions}><Pressable onPress={() => { setForm(null); setEditing(null); }} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={[s.saveBtn, saving && { opacity: .6 }]}><Text style={s.saveText}>{saving ? 'Saving…' : 'Save record'}</Text></Pressable></View>
    </ScrollView></KeyboardAvoidingView> : <>
      <View style={s.filters}>{(['all','upcoming','overdue'] as const).map(value => <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && s.filterTextActive]}>{value[0]!.toUpperCase()+value.slice(1)}{value === 'all' ? ` · ${rows.length}` : ` · ${rows.filter(row => row.status === value).length}`}</Text></Pressable>)}</View>
      <FlatList data={visible} keyExtractor={row => row.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={t.red}/>} contentContainerStyle={visible.length ? { paddingTop: 4, paddingBottom: 24 } : s.emptyContent} ListEmptyComponent={<View style={s.empty}><TablerIcon name="tool" size={26} color={t.muted}/><Text style={s.emptyTitle}>{loading ? 'Loading service history…' : 'No service records yet'}</Text><Text style={s.emptyText}>{loading ? '' : 'Log a service to keep maintenance history and reminders.'}</Text></View>} renderItem={({ item }) => <View style={s.row}><View style={{ flex: 1 }}><View style={s.rowTitle}><Text style={s.plate}>{label(item.vehicle)}</Text><View style={[s.statusBadge, { backgroundColor: `${colors[item.status]}18` }]}><Text style={[s.statusBadgeText, { color: colors[item.status] }]}>{item.status}</Text></View></View><Text style={s.service}>{item.serviceType} · {formatDate(item.serviceDate)}</Text><Text style={s.meta}>{item.odometerKm != null ? `${Number(item.odometerKm).toLocaleString('en-US')} km at service` : 'Odometer not recorded'}{item.nextDueDate ? ` · Due ${formatDate(item.nextDueDate)}` : ''}{item.nextDueOdometerKm != null ? ` · ${Number(item.nextDueOdometerKm).toLocaleString('en-US')} km` : ''}</Text>{item.currentOdometerKm != null && item.nextDueOdometerKm != null ? <Text style={s.meta}>Est. current: {Math.round(item.currentOdometerKm).toLocaleString('en-US')} km</Text> : null}</View>{canDo('maintenance','edit') ? <Pressable onPress={() => openEdit(item)} accessibilityLabel="Edit service" style={s.rowAction}><TablerIcon name="edit" size={17} color={t.secondary}/></Pressable> : null}{canDo('maintenance','delete') ? <Pressable onPress={() => remove(item)} accessibilityLabel="Delete service" style={s.rowAction}><TablerIcon name="trash" size={17} color={t.secondary}/></Pressable> : null}</View>} />
    </>}
    <Modal visible={serviceTypeOpen} transparent animationType="fade" onRequestClose={() => setServiceTypeOpen(false)}><View style={s.modalScrim}><Pressable style={StyleSheet.absoluteFill} onPress={() => setServiceTypeOpen(false)}/><View style={s.pickerCard}><Text style={s.pickerTitle}>Select service type</Text><ScrollView>{SERVICE_TYPES.map(value => <Pressable key={value} onPress={() => { update('serviceType', value); setServiceTypeOpen(false); }} style={s.serviceOption}><Text style={{ color: form?.serviceType === value ? t.red : t.ink, fontSize: 14 }}>{value}</Text></Pressable>)}</ScrollView></View></View></Modal>
    <Modal visible={odometerPickerOpen} transparent animationType="fade" onRequestClose={() => setOdometerPickerOpen(false)}><View style={s.modalScrim}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOdometerPickerOpen(false)}/><View style={s.pickerCard}><Text style={s.pickerTitle}>Distance after service</Text><ScrollView style={{ maxHeight: 360 }}>{Array.from({ length: 20 }, (_, index) => (index + 1) * 500).map(value => <Pressable key={value} onPress={() => { update('nextDueDistanceKm', String(value)); setOdometerPickerOpen(false); }} style={s.serviceOption}><Text style={{ color: Number(form?.nextDueDistanceKm) === value ? t.red : t.ink, fontSize: 14 }}>{value.toLocaleString('en-US')} km later{form?.odometerKm ? ` · ${(Number(form.odometerKm) + value).toLocaleString('en-US')} km total` : ''}</Text></Pressable>)}</ScrollView><Pressable onPress={() => { update('nextDueDistanceKm', ''); setOdometerPickerOpen(false); }} style={s.clearOption}><Text style={{ color: t.secondary, fontSize: 13 }}>Clear selection</Text></Pressable></View></View></Modal>
    {dateTarget && <MaintenanceDatePicker value={form?.[dateTarget] ?? ''} visible onClose={() => setDateTarget(null)} onApply={value => { update(dateTarget, value); setDateTarget(null); }}/ >}
  </SafeAreaView>;

  function dateField(title: string, key: 'serviceDate'|'nextDueDate') { return <View style={s.field} key={key}><Text style={s.label}>{title}</Text><Pressable onPress={() => setDateTarget(key)} style={s.input}><Text style={{ color: form?.[key] ? t.ink : t.muted, fontSize: 12 }}>{form?.[key] ? formatDate(form[key]) : 'Select date'}  ▾</Text></Pressable></View>; }
}

function MaintenanceDatePicker({ value, visible, onClose, onApply }: { value: string; visible: boolean; onClose: () => void; onApply: (value: string) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(`${today()}T00:00:00`);
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [selected, setSelected] = useState({ year: initial.getFullYear(), month: initial.getMonth(), day: initial.getDate() });
  useEffect(() => { const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(`${today()}T00:00:00`); setMonth({ year: parsed.getFullYear(), month: parsed.getMonth() }); setSelected({ year: parsed.getFullYear(), month: parsed.getMonth(), day: parsed.getDate() }); }, [value, visible]);
  const days = new Date(month.year, month.month + 1, 0).getDate();
  const offset = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
  const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(month.year, month.month, 1));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.modalScrim}><Pressable style={StyleSheet.absoluteFill} onPress={onClose}/><View style={s.pickerCard}><View style={s.calendarHeader}><Pressable style={s.monthArrow} onPress={() => setMonth(current => { const previous = new Date(current.year, current.month - 1, 1); return { year: previous.getFullYear(), month: previous.getMonth() }; })}><Text style={s.monthArrowText}>‹</Text></Pressable><Text style={s.pickerTitle}>{monthName}</Text><Pressable style={s.monthArrow} onPress={() => setMonth(current => { const next = new Date(current.year, current.month + 1, 1); return { year: next.getFullYear(), month: next.getMonth() }; })}><Text style={s.monthArrowText}>›</Text></Pressable></View><View style={s.calendarGrid}>{['M','T','W','T','F','S','S'].map((day, index) => <Text key={`${day}-${index}`} style={s.weekday}>{day}</Text>)}{Array.from({ length: offset }, (_, index) => <View key={`blank-${index}`} style={s.calendarDay}/>)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const active = selected.year === month.year && selected.month === month.month && selected.day === day; return <Pressable key={day} onPress={() => setSelected({ year: month.year, month: month.month, day })} style={[s.calendarDay, active && s.calendarDaySelected]}><Text style={[s.calendarDayText, active && { color: '#fff', fontWeight: '700' }]}>{day}</Text></Pressable>; })}</View><View style={s.pickerActions}><Pressable onPress={onClose} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => onApply(`${selected.year}-${String(selected.month + 1).padStart(2,'0')}-${String(selected.day).padStart(2,'0')}`)} style={s.saveBtn}><Text style={s.saveText}>Apply</Text></Pressable></View></View></View></Modal>;
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    back: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2 },
    title: { fontSize: 22, color: t.ink, fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { marginTop: 2, color: t.secondary, fontSize: 12 },
    add: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red },
    filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: t.bg2 },
    filterActive: { backgroundColor: `${t.red}14` },
    filterText: { color: t.secondary, fontSize: 12 },
    filterTextActive: { color: t.red, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 100, paddingHorizontal: 14, paddingVertical: 14, marginHorizontal: 16, marginVertical: 4, borderRadius: 14, backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    plate: { color: t.ink, fontSize: 14, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
    statusBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    service: { color: t.ink, fontSize: 12, fontWeight: '500' },
    meta: { marginTop: 3, color: t.secondary, fontSize: 11 },
    rowAction: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
    emptyContent: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingHorizontal: 30 },
    emptyTitle: { marginTop: 10, color: t.ink, fontSize: 14, fontWeight: '600' },
    emptyText: { marginTop: 5, textAlign: 'center', color: t.secondary, fontSize: 12 },
    form: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36, gap: 14 },
    sectionTitle: { color: t.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
    field: { gap: 6, width: '100%' },
    label: { color: t.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
    input: { minHeight: 43, borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 11, color: t.ink, fontSize: 13, backgroundColor: t.inputBg, justifyContent: 'center' },
    multiline: { minHeight: 84, paddingTop: 10, textAlignVertical: 'top' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 12 },
    vehicleOptions: { maxHeight: 250, borderWidth: 1, borderColor: t.border, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
    groupHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, backgroundColor: t.bg2, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
    groupName: { color: t.ink, fontSize: 11, fontWeight: '700' },
    vehicleChoice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
    vehicleChoiceSelected: { backgroundColor: `${t.red}0d` },
    vehicleChoiceText: { fontSize: 12, color: t.secondary },
    serviceOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderColor: t.border },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    cancelBtn: { minHeight: 46, minWidth: 100, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.bg2 },
    cancelText: { color: t.secondary, fontSize: 13, fontWeight: '500' },
    saveBtn: { flex: 1, minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: t.red, borderRadius: 12 },
    saveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    modalScrim: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
    pickerCard: { maxHeight: '80%', backgroundColor: t.card, borderRadius: 16, padding: 14 },
    pickerTitle: { color: t.ink, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
    clearOption: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    monthArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    monthArrowText: { color: t.red, fontSize: 25 },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8, color: t.secondary, fontSize: 11, fontWeight: '700' },
    calendarDay: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
    calendarDaySelected: { backgroundColor: t.red },
    calendarDayText: { color: t.ink, fontSize: 13 },
    pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  });
}
