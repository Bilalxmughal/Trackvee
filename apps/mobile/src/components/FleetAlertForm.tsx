import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/api';
import { TablerIcon } from './TablerIcon';
import { theme } from '../theme';

export type FleetAlertType = 'over_speed' | 'idle' | 'ignition_on' | 'ignition_off' | 'power_cut' | 'low_battery' | 'no_gps' | 'offline' | 'tow' | 'over_parking' | 'geofence' | 'low_score' | 'speed_zone';
export interface FleetAlertRule {
  id: string;
  name: string;
  active: boolean;
  type: FleetAlertType;
  config: Record<string, string | number>;
  vehicleImeis: string[];
  excludedVehicleImeis?: string[];
  fleetWide?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  schedule?: { from?: string; to?: string; days?: string[]; timeFrom?: string; timeTo?: string } | null;
  notifications?: { appPush?: boolean; webPush?: boolean; webSound?: boolean; email?: boolean };
}
export interface AlertVehicle { id: string; imei: string; plate: string; name: string; }
export interface AlertVehicleGroup { id: string; name: string; vehicleIds: string[]; }
export interface AlertZone { id: string; name: string; }

const TYPES: { id: FleetAlertType; label: string; icon: string; description: string }[] = [
  { id: 'over_speed', label: 'Over Speed', icon: 'gauge', description: 'Vehicle exceeds the configured speed.' },
  { id: 'idle', label: 'Idle', icon: 'engine', description: 'Engine stays on while the vehicle is stationary.' },
  { id: 'ignition_on', label: 'Ignition On', icon: 'power', description: 'Ignition changes to on.' },
  { id: 'ignition_off', label: 'Ignition Off', icon: 'power', description: 'Ignition changes to off.' },
  { id: 'power_cut', label: 'Power Cut', icon: 'engine', description: 'External power disconnects.' },
  { id: 'low_battery', label: 'Low Battery', icon: 'battery', description: 'Internal battery reaches the limit.' },
  { id: 'no_gps', label: 'No GPS', icon: 'signal', description: 'A GPS fix is invalid.' },
  { id: 'offline', label: 'Offline', icon: 'signal', description: 'Vehicle communication is interrupted.' },
  { id: 'tow', label: 'Tow Alert', icon: 'truck', description: 'Vehicle moves while ignition is off.' },
  { id: 'over_parking', label: 'Over Parking', icon: 'map-pin', description: 'Vehicle remains parked.' },
  { id: 'geofence', label: 'Geofence', icon: 'geofence', description: 'Vehicle enters or exits a geofence.' },
  { id: 'low_score', label: 'Low Score', icon: 'activity', description: 'Daily driver score reaches the limit.' },
  { id: 'speed_zone', label: 'Speed Zone', icon: 'gauge', description: 'Vehicle exceeds the limit inside a geofence.' },
];
const DAYS = [{ id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' }, { id: 'thu', label: 'T' }, { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' }];
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export function FleetAlertForm({ visible, initial, vehicles, groups, geofences, allowFleetWide, onClose, onSaved }: {
  visible: boolean;
  initial: FleetAlertRule | null;
  vehicles: AlertVehicle[];
  groups: AlertVehicleGroup[];
  geofences: AlertZone[];
  allowFleetWide: boolean;
  onClose: () => void;
  onSaved: (rule: FleetAlertRule) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<FleetAlertType>(initial?.type ?? 'over_speed');
  const [selectedImeis, setSelectedImeis] = useState<string[]>(initial?.fleetWide ? [] : initial?.vehicleImeis ?? []);
  const [allVehicles, setAllVehicles] = useState(!!initial?.fleetWide);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(initial?.active ?? true);
  const [config, setConfig] = useState<Record<string, string | number>>(initial?.config ?? { speedLimit: 80 });
  const [scheduled, setScheduled] = useState(!!initial?.schedule);
  const [schedule, setSchedule] = useState<FleetAlertRule['schedule']>(initial?.schedule ?? { days: [] });
  const [notifications, setNotifications] = useState<FleetAlertRule['notifications']>(initial ? initial.notifications ?? {} : { appPush: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedType = TYPES.find(option => option.id === type)!;
  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? vehicles.filter(vehicle => `${vehicle.plate} ${vehicle.name}`.toLowerCase().includes(query)) : vehicles;
  }, [vehicles, search]);
  const filteredIds = new Set(filteredVehicles.map(vehicle => vehicle.id));
  const assignedIds = new Set(groups.flatMap(group => group.vehicleIds));
  const ungrouped = filteredVehicles.filter(vehicle => !assignedIds.has(vehicle.id));
  const selectedCount = allVehicles ? vehicles.length : selectedImeis.length;
  const numberField = type === 'over_speed' || type === 'speed_zone' ? 'speedLimit'
    : ['idle', 'no_gps', 'offline', 'over_parking'].includes(type) ? 'minutes'
      : type === 'low_battery' ? 'level' : type === 'low_score' ? 'scoreThreshold' : null;
  const zoneNeeded = type === 'geofence' || type === 'speed_zone';

  const selectIds = (ids: string[]) => {
    if (allVehicles) setAllVehicles(false);
    const everySelected = ids.length > 0 && ids.every(id => selectedImeis.includes(vehicles.find(vehicle => vehicle.id === id)?.imei ?? ''));
    setSelectedImeis(current => everySelected
      ? current.filter(imei => !ids.some(id => vehicles.find(vehicle => vehicle.id === id)?.imei === imei))
      : [...new Set([...current, ...ids.map(id => vehicles.find(vehicle => vehicle.id === id)?.imei).filter((imei): imei is string => !!imei)])]);
  };
  const toggleDay = (day: string) => setSchedule(current => {
    const days = current?.days ?? [];
    return { ...current, days: days.includes(day) ? days.filter(item => item !== day) : [...days, day] };
  });
  const validateStep = () => {
    if (step === 1) {
      if (!name.trim()) return 'Enter an alert name.';
      if (!allVehicles && selectedImeis.length === 0) return 'Select at least one vehicle.';
      if (allVehicles && !allowFleetWide) return 'You do not have access to create a fleet-wide alert.';
    }
    if (step === 2) {
      if (numberField && !(Number(config[numberField]) > 0)) return `Enter a valid ${titleCase(numberField).toLowerCase()}.`;
      if (type === 'low_battery' && Number(config.level) > 5) return 'Battery level must be between 1 and 5.';
      if (type === 'low_score' && Number(config.scoreThreshold) > 100) return 'Score must be between 1 and 100.';
      if (zoneNeeded && !config.geofenceId) return 'Select a geofence.';
    }
    return '';
  };
  const next = () => {
    const message = validateStep();
    if (message) { setError(message); return; }
    setError(''); setStep(value => Math.min(3, value + 1));
  };
  const save = async () => {
    const message = validateStep();
    if (message) { setError(message); return; }
    setSaving(true); setError('');
    const payload = {
      name: name.trim(), type, active, config,
      vehicleImeis: allVehicles ? [] : selectedImeis,
      schedule: scheduled ? schedule : null,
      notifications,
    };
    try {
      const result = initial?.id
        ? await api.put<FleetAlertRule>(`/alerts/${initial.id}`, payload)
        : await api.post<FleetAlertRule>('/alerts', payload);
      onSaved(result.data);
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      setError(status === 403 ? 'You do not have permission to save this alert for the selected vehicles.' : 'The alert could not be saved. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  const vehicleRow = (vehicle: AlertVehicle) => {
    const checked = allVehicles || selectedImeis.includes(vehicle.imei);
    return <Pressable key={vehicle.id} onPress={() => selectIds([vehicle.id])} style={s.vehicleRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[s.checkbox, checked && s.checkboxSelected]}>{checked ? <TablerIcon name="check" size={13} color="#fff" /> : null}</View>
      <View style={{ flex: 1 }}><Text style={s.vehiclePlate}>{vehicle.plate}</Text><Text style={s.vehicleName}>{vehicle.name}</Text></View>
    </Pressable>;
  };
  const groupRow = (group: AlertVehicleGroup) => {
    const members = group.vehicleIds.filter(id => filteredIds.has(id) && vehicles.some(vehicle => vehicle.id === id));
    if (!members.length) return null;
    const memberImeis = members.map(id => vehicles.find(vehicle => vehicle.id === id)!.imei);
    const count = memberImeis.filter(imei => allVehicles || selectedImeis.includes(imei)).length;
    const checked = count === memberImeis.length;
    return <View key={group.id}>
      <Pressable onPress={() => selectIds(members)} style={s.groupRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <View style={[s.checkbox, count > 0 && s.checkboxSelected]}>{count > 0 ? <TablerIcon name={checked ? 'check' : 'minus'} size={13} color="#fff" /> : null}</View>
        <Text style={s.groupName}>{group.name}</Text><Text style={s.count}>{members.length}</Text>
      </Pressable>
      {members.map(id => vehicleRow(vehicles.find(vehicle => vehicle.id === id)!))}
    </View>;
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={step > 1 ? () => { setError(''); setStep(value => value - 1); } : onClose} accessibilityLabel={step > 1 ? 'Previous step' : 'Close alert form'}><TablerIcon name="back" size={21} color={theme.ink}/></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.headerTitle}>{initial ? 'Edit Alert Rule' : 'New Alert Rule'}</Text><Text style={s.headerSubtitle}>Step {step} of 3 · {['Vehicles', 'Alert type', 'Settings'][step - 1]}</Text></View>
        <Pressable onPress={onClose} accessibilityLabel="Close"><TablerIcon name="close" size={20} color={theme.secondary}/></Pressable>
      </View>
      <View style={s.progress}>{[1, 2, 3].map(number => <View key={number} style={[s.progressSegment, number <= step && s.progressActive]}/>)}</View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        {step === 1 && <>
          <Text style={s.sectionTitle}>Rule name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="For example, Main Fleet Speed" placeholderTextColor={theme.muted} style={s.input} accessibilityLabel="Alert rule name" />
          <View style={s.sectionHeading}><Text style={s.sectionTitle}>Vehicles</Text><Text style={s.count}>{allVehicles ? 'All vehicles' : `${selectedImeis.length} selected`}</Text></View>
          {allowFleetWide && <Pressable onPress={() => { setAllVehicles(value => !value); setSelectedImeis([]); }} style={s.allRow} accessibilityRole="checkbox" accessibilityState={{ checked: allVehicles }}><View style={[s.checkbox, allVehicles && s.checkboxSelected]}>{allVehicles ? <TablerIcon name="check" size={13} color="#fff"/> : null}</View><View style={{ flex: 1 }}><Text style={s.vehiclePlate}>All current and future vehicles</Text><Text style={s.vehicleName}>This rule will apply across your organization fleet.</Text></View></Pressable>}
          <View style={s.searchBox}><TablerIcon name="search" size={16} color={theme.secondary}/><TextInput value={search} onChangeText={setSearch} placeholder="Search vehicle or plate" placeholderTextColor={theme.muted} style={s.searchInput}/><Pressable onPress={() => selectIds(vehicles.map(vehicle => vehicle.id))}><Text style={s.selectAll}>{selectedImeis.length === vehicles.length && vehicles.length > 0 ? 'Deselect all' : 'Select all'}</Text></Pressable></View>
          {groups.map(groupRow)}
          {ungrouped.length ? <View><Text style={s.groupHeading}>Other vehicles</Text>{ungrouped.map(vehicleRow)}</View> : null}
          {!vehicles.length ? <Text style={s.empty}>No vehicles are available for your account.</Text> : null}
        </>}
        {step === 2 && <>
          <Text style={s.sectionTitle}>Choose an alert type</Text>
          <View style={s.typeGrid}>{TYPES.map(option => <Pressable key={option.id} onPress={() => { setType(option.id); setConfig(option.id === 'over_speed' ? { speedLimit: 80 } : {}); }} style={[s.typeCard, type === option.id && s.typeCardSelected]} accessibilityRole="radio" accessibilityState={{ selected: type === option.id }}>
            <TablerIcon name={option.icon} size={19} color={type === option.id ? theme.red : theme.secondary}/><Text style={[s.typeLabel, type === option.id && s.typeLabelSelected]}>{option.label}</Text><Text style={s.typeDescription}>{option.description}</Text>
          </Pressable>)}</View>
          {numberField ? <View style={s.configBlock}><Text style={s.sectionTitle}>{type === 'over_speed' || type === 'speed_zone' ? 'Speed limit (km/h)' : type === 'low_battery' ? 'Battery level (1–5)' : type === 'low_score' ? 'Score threshold (1–100)' : 'Duration (minutes)'}</Text><TextInput keyboardType="numeric" value={String(config[numberField] ?? (type === 'over_speed' ? 80 : type === 'speed_zone' ? 60 : type === 'idle' ? 10 : type === 'low_battery' ? 2 : type === 'low_score' ? 70 : 5))} onChangeText={value => setConfig(current => ({ ...current, [numberField]: Number(value) || 0 }))} style={s.input} accessibilityLabel="Alert threshold"/></View> : null}
          {zoneNeeded ? <View style={s.configBlock}><Text style={s.sectionTitle}>Geofence</Text>{geofences.map(zone => <Pressable key={zone.id} onPress={() => setConfig(current => ({ ...current, geofenceId: zone.id }))} style={s.choiceRow}><View style={[s.radio, config.geofenceId === zone.id && s.radioSelected]}>{config.geofenceId === zone.id ? <View style={s.radioDot}/> : null}</View><Text style={s.vehiclePlate}>{zone.name}</Text></Pressable>)}{!geofences.length ? <Text style={s.empty}>Create a geofence before using this alert type.</Text> : null}</View> : null}
          {type === 'geofence' ? <View style={s.configBlock}><Text style={s.sectionTitle}>Trigger when vehicle</Text><View style={s.choiceOptions}>{(['enter', 'exit', 'both'] as const).map(event => <Pressable key={event} onPress={() => setConfig(current => ({ ...current, geofenceEvent: event }))} style={[s.choiceButton, (config.geofenceEvent ?? 'both') === event && s.choiceSelected]}><Text style={[s.choiceText, (config.geofenceEvent ?? 'both') === event && s.choiceTextSelected]}>{titleCase(event)}</Text></Pressable>)}</View></View> : null}
          {type === 'tow' || type === 'ignition_on' || type === 'ignition_off' || type === 'power_cut' || type === 'no_gps' || type === 'offline' ? <Text style={s.hint}>{selectedType.description}</Text> : null}
        </>}
        {step === 3 && <>
          <View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.rowTitle}>Rule active</Text><Text style={s.hint}>Inactive rules do not trigger alerts.</Text></View><Switch value={active} onValueChange={setActive} trackColor={{ true: theme.red }}/></View>
          <View style={s.card}>
            <View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.rowTitle}>Schedule</Text><Text style={s.hint}>Limit when this rule can trigger.</Text></View><Switch value={scheduled} onValueChange={setScheduled} trackColor={{ true: theme.red }}/></View>
            {scheduled ? <>
              <Text style={s.fieldLabel}>Days</Text><View style={s.dayRow}>{DAYS.map(day => { const selected = schedule?.days?.includes(day.id) ?? false; return <Pressable key={day.id} onPress={() => toggleDay(day.id)} style={[s.dayButton, selected && s.daySelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={[s.dayText, selected && s.dayTextSelected]}>{day.label}</Text></Pressable>; })}</View>
              <Text style={s.fieldLabel}>Date range (optional)</Text><View style={s.inlineFields}><TextInput value={schedule?.from ?? ''} onChangeText={value => setSchedule(current => ({ ...current, from: value }))} placeholder="From · YYYY-MM-DD" placeholderTextColor={theme.muted} style={[s.input, s.halfInput]}/><TextInput value={schedule?.to ?? ''} onChangeText={value => setSchedule(current => ({ ...current, to: value }))} placeholder="To · YYYY-MM-DD" placeholderTextColor={theme.muted} style={[s.input, s.halfInput]}/></View>
              <Text style={s.fieldLabel}>Time window (optional)</Text><View style={s.inlineFields}><TextInput value={schedule?.timeFrom ?? ''} onChangeText={value => setSchedule(current => ({ ...current, timeFrom: value }))} placeholder="Start · HH:MM" placeholderTextColor={theme.muted} style={[s.input, s.halfInput]}/><TextInput value={schedule?.timeTo ?? ''} onChangeText={value => setSchedule(current => ({ ...current, timeTo: value }))} placeholder="End · HH:MM" placeholderTextColor={theme.muted} style={[s.input, s.halfInput]}/></View>
            </> : null}
          </View>
          <View style={s.card}><View style={s.settingRow}><View style={{ flex: 1 }}><Text style={s.rowTitle}>Mobile push</Text><Text style={s.hint}>Send this alert to devices that enabled notifications.</Text></View><Switch value={notifications?.appPush === true} onValueChange={value => setNotifications(current => ({ ...current, appPush: value }))} trackColor={{ true: theme.red }}/></View></View>
        </>}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
      <View style={s.footer}>
        {step < 3 ? <Pressable onPress={next} style={s.primary}><Text style={s.primaryText}>Continue</Text><TablerIcon name="forward" size={17} color="#fff"/></Pressable>
          : <Pressable disabled={saving} onPress={() => void save()} style={[s.primary, saving && s.disabled]}>{saving ? <ActivityIndicator size="small" color="#fff"/> : null}<Text style={s.primaryText}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Create alert rule'}</Text></Pressable>}
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, header: { minHeight: 62, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerTitle: { color: theme.ink, fontWeight: '700', fontSize: 16 }, headerSubtitle: { color: theme.secondary, fontSize: 11, marginTop: 3 }, progress: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingVertical: 10 }, progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.border }, progressActive: { backgroundColor: theme.red }, body: { padding: 18, paddingBottom: 28 }, sectionTitle: { color: theme.ink, fontSize: 13, fontWeight: '700', marginBottom: 9 }, sectionHeading: { marginTop: 22, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, input: { minHeight: 44, borderWidth: 1, borderColor: theme.border, borderRadius: 7, paddingHorizontal: 12, color: theme.ink, fontSize: 13 }, allRow: { minHeight: 62, paddingHorizontal: 11, marginBottom: 9, borderWidth: 1, borderColor: theme.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchBox: { minHeight: 42, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }, searchInput: { flex: 1, color: theme.ink, fontSize: 13, paddingVertical: 8 }, selectAll: { color: theme.red, fontSize: 11, fontWeight: '600' }, groupRow: { minHeight: 40, backgroundColor: theme.canvas, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderTopWidth: 1, borderColor: theme.border }, groupName: { flex: 1, color: theme.ink, fontSize: 12, fontWeight: '700' }, groupHeading: { paddingVertical: 9, color: theme.secondary, fontSize: 11, fontWeight: '700' }, vehicleRow: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: theme.border }, checkbox: { width: 19, height: 19, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { borderColor: theme.red, backgroundColor: theme.red }, vehiclePlate: { color: theme.ink, fontSize: 12, fontWeight: '600' }, vehicleName: { color: theme.secondary, fontSize: 11, marginTop: 3 }, count: { color: theme.secondary, fontSize: 11 }, empty: { color: theme.secondary, fontSize: 12, marginVertical: 14, textAlign: 'center' }, typeGrid: { gap: 8 }, typeCard: { minHeight: 69, padding: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, typeCardSelected: { borderColor: theme.red, backgroundColor: '#fffafa' }, typeLabel: { color: theme.ink, fontSize: 12, fontWeight: '700' }, typeLabelSelected: { color: theme.red }, typeDescription: { width: '100%', color: theme.secondary, fontSize: 10, marginLeft: 27, marginTop: -5 }, configBlock: { marginTop: 18 }, choiceRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: theme.border }, radio: { width: 18, height: 18, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: theme.red }, radioDot: { width: 9, height: 9, backgroundColor: theme.red, borderRadius: 5 }, choiceOptions: { flexDirection: 'row', gap: 7 }, choiceButton: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: theme.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, choiceSelected: { borderColor: theme.red, backgroundColor: '#fffafa' }, choiceText: { color: theme.secondary, fontSize: 12 }, choiceTextSelected: { color: theme.red, fontWeight: '700' }, hint: { color: theme.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 }, settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, rowTitle: { color: theme.ink, fontSize: 13, fontWeight: '700' }, card: { padding: 13, marginTop: 13, borderWidth: 1, borderColor: theme.border, borderRadius: 8 }, fieldLabel: { marginTop: 15, marginBottom: 7, color: theme.secondary, fontSize: 11, fontWeight: '600' }, dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 }, dayButton: { width: 36, height: 36, borderWidth: 1, borderColor: theme.border, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, daySelected: { borderColor: theme.red, backgroundColor: '#fff5f5' }, dayText: { color: theme.secondary, fontWeight: '600', fontSize: 11 }, dayTextSelected: { color: theme.red }, inlineFields: { flexDirection: 'row', gap: 8 }, halfInput: { flex: 1, fontSize: 11, paddingHorizontal: 8 }, error: { color: theme.red, fontSize: 12, marginTop: 15 }, footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderColor: theme.border }, primary: { minHeight: 47, paddingHorizontal: 16, backgroundColor: theme.red, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.7 },
});
