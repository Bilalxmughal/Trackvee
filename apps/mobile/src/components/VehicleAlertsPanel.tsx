import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/api';
import { TablerIcon } from './TablerIcon';
import { theme } from '../theme';
import { usePortalPermissions } from '../auth/PortalPermissionsProvider';

type Rule = { id: string; name: string; type: string; active: boolean; config: Record<string, string | number>; schedule?: Record<string, unknown> | null; notifications?: Record<string, boolean>; vehicleImeis: string[]; excludedVehicleImeis?: string[] };
type Zone = { id: string; name: string };
const TYPES = ['over_speed', 'idle', 'ignition_on', 'ignition_off', 'power_cut', 'low_battery', 'no_gps', 'offline', 'tow', 'over_parking', 'geofence', 'poi', 'low_score', 'speed_zone'] as const;
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export function VehicleAlertsPanel({ visible, imei, onClose, fullScreen = false }: { visible: boolean; imei: string; onClose: () => void; fullScreen?: boolean }) {
  const { canDo } = usePortalPermissions();
  const [rules, setRules] = useState<Rule[]>([]);
  const [geofences, setGeofences] = useState<Zone[]>([]);
  const [pois, setPois] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Rule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('over_speed');
  const [active, setActive] = useState(true);
  const [config, setConfig] = useState<Record<string, string | number>>({ speedLimit: 80 });
  const [schedule, setSchedule] = useState<Rule['schedule']>(null);
  const [notifications, setNotifications] = useState<Rule['notifications']>({});
  const [typeOpen, setTypeOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!imei || !visible) return;
    const id = ++requestId.current;
    setLoading(true); setError(''); setRules([]);
    try {
      const alerts = await api.get<Rule[]>(`/alerts/vehicle/${imei}`);
      if (id !== requestId.current) return;
      setRules(alerts.data ?? []);
      const [gf, poi] = await Promise.allSettled([api.get<Zone[]>('/geofences'), api.get<Zone[]>('/pois')]);
      if (id !== requestId.current) return;
      setGeofences(gf.status === 'fulfilled' ? gf.value.data ?? [] : []);
      setPois(poi.status === 'fulfilled' ? poi.value.data ?? [] : []);
    } catch { if (id === requestId.current) setError('Vehicle alerts could not be loaded. Try again.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [imei, visible]);
  useEffect(() => { void load(); return () => { requestId.current++; setRules([]); setFormOpen(false); }; }, [load]);
  const openForm = (rule: Rule | null) => {
    setEditing(rule); setName(rule?.name ?? ''); setType(rule?.type ?? 'over_speed');
    setActive(rule?.active ?? true); setConfig(rule?.config ?? { speedLimit: 80 });
    setSchedule(rule?.schedule ?? null); setNotifications(rule ? rule.notifications ?? {} : { appPush: true });
    setFormOpen(true); setError('');
  };
  const save = async () => {
    if (!name.trim()) { setError('Enter an alert name.'); return; }
    if (!canDo('alerts', editing ? 'edit' : 'add')) return;
    const requiredNumber = type === 'over_speed' || type === 'speed_zone' ? 'speedLimit' : ['idle', 'no_gps', 'offline', 'over_parking'].includes(type) ? 'minutes' : type === 'low_battery' ? 'level' : type === 'low_score' ? 'scoreThreshold' : null;
    if (requiredNumber && !(Number(config[requiredNumber]) > 0)) { setError(`Enter a valid ${label(requiredNumber).toLowerCase()}.`); return; }
    const requiredZone = type === 'geofence' || type === 'speed_zone' ? 'geofenceId' : type === 'poi' ? 'poiId' : null;
    if (requiredZone && !config[requiredZone]) { setError('Select a zone.'); return; }
    setSaving(true); setError('');
    try {
      const body = { name: name.trim(), type, active, config, schedule, notifications, vehicleImeis: [imei] };
      if (editing) await api.put(`/alerts/${editing.id}/vehicle/${imei}`, body);
      else await api.post(`/alerts/vehicle/${imei}`, body);
      setFormOpen(false); await load();
    } catch { setError('Alert could not be saved. Check your access and try again.'); }
    finally { setSaving(false); }
  };
  const remove = async (rule: Rule) => {
    if (!canDo('alerts', 'delete')) return;
    setSaving(true); setError('');
    try { await api.delete(`/alerts/${rule.id}/vehicle/${imei}`); await load(); }
    catch { setError('Alert could not be removed. Try again.'); }
    finally { setSaving(false); }
  };
  const numericField = type === 'over_speed' || type === 'speed_zone' ? 'speedLimit' : ['idle', 'no_gps', 'offline', 'over_parking'].includes(type) ? 'minutes' : type === 'low_battery' ? 'level' : type === 'low_score' ? 'scoreThreshold' : null;
  const zoneField = type === 'geofence' || type === 'speed_zone' ? 'geofenceId' : type === 'poi' ? 'poiId' : null;
  const zoneItems = zoneField === 'poiId' ? pois : geofences;
  const content = <View style={s.container}>
      <View style={s.header}><Pressable onPress={formOpen ? () => setFormOpen(false) : onClose} accessibilityLabel="Back"><TablerIcon name="back" size={21} /></Pressable><Text style={s.title}>{formOpen ? (editing ? 'Edit Vehicle Alert' : 'New Vehicle Alert') : 'Vehicle Alerts'}</Text>{!formOpen && canDo('alerts', 'add') ? <Pressable onPress={() => openForm(null)} accessibilityLabel="New alert"><TablerIcon name="plus" size={23} color={theme.red} /></Pressable> : <View style={{ width: 23 }} />}</View>
      {error ? <Pressable onPress={() => void load()}><Text style={s.error}>{error}</Text></Pressable> : null}
      {formOpen ? <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Rule name</Text><TextInput value={name} onChangeText={setName} style={s.input} placeholder="Alert name" accessibilityLabel="Alert name" />
        <Text style={s.label}>Alert type</Text><Pressable style={s.input} onPress={() => setTypeOpen(v => !v)}><Text style={s.value}>{label(type)} ▾</Text></Pressable>
        {typeOpen && <View style={s.options}>{TYPES.map(option => <Pressable key={option} style={s.option} onPress={() => { setType(option); setTypeOpen(false); setConfig(option === 'over_speed' ? { speedLimit: 80 } : {}); }}><Text style={s.value}>{label(option)}</Text></Pressable>)}</View>}
        {numericField && <><Text style={s.label}>{label(numericField)}{numericField === 'speedLimit' ? ' (km/h)' : numericField === 'minutes' ? ' (minutes)' : ''}</Text><TextInput value={String(config[numericField] ?? '')} onChangeText={text => setConfig(previous => ({ ...previous, [numericField]: Number(text) || 0 }))} keyboardType="numeric" style={s.input} accessibilityLabel={label(numericField)} /></>}
        {zoneField && <><Text style={s.label}>{zoneField === 'poiId' ? 'POI' : 'Geofence'}</Text><Pressable style={s.input} onPress={() => setZoneOpen(v => !v)}><Text style={s.value}>{zoneItems.find(zone => zone.id === config[zoneField])?.name ?? 'Select zone'} ▾</Text></Pressable>{zoneOpen && <View style={s.options}>{zoneItems.map(zone => <Pressable key={zone.id} style={s.option} onPress={() => { setConfig(previous => ({ ...previous, [zoneField]: zone.id })); setZoneOpen(false); }}><Text style={s.value}>{zone.name}</Text></Pressable>)}</View>}</>}
        {(type === 'geofence' || type === 'poi') && <><Text style={s.label}>Event</Text><View style={s.eventRow}>{(['enter', 'exit', 'both'] as const).map(event => <Pressable key={event} onPress={() => setConfig(previous => ({ ...previous, [type === 'poi' ? 'poiEvent' : 'geofenceEvent']: event }))} style={[s.eventButton, config[type === 'poi' ? 'poiEvent' : 'geofenceEvent'] === event && s.eventSelected]}><Text style={s.value}>{label(event)}</Text></Pressable>)}</View></>}
        <View style={s.activeRow}><Text style={s.label}>Active</Text><Switch value={active} onValueChange={setActive} trackColor={{ true: theme.red }} /></View>
        <View style={s.activeRow}><View style={{ flex: 1, paddingRight: 12 }}><Text style={s.label}>Mobile push</Text><Text style={s.hint}>Send this alert to devices with notifications enabled.</Text></View><Switch value={notifications?.appPush === true} onValueChange={value => setNotifications(previous => ({ ...previous, appPush: value }))} trackColor={{ true: theme.red }} /></View>
        <Pressable disabled={saving} style={s.primary} onPress={() => void save()}><Text style={s.primaryText}>{saving ? 'Saving…' : 'Save for this vehicle'}</Text></Pressable>
      </ScrollView> : loading ? <ActivityIndicator style={{ marginTop: 32 }} color={theme.red} /> : <FlatList data={rules} keyExtractor={rule => rule.id} ListEmptyComponent={<Text style={s.empty}>No alerts for this vehicle.</Text>} renderItem={({ item }) => <View style={s.rule}><View style={{ flex: 1 }}><Text style={s.ruleName}>{item.name}</Text><Text style={s.ruleMeta}>{label(item.type)} · {item.active ? 'Active' : 'Inactive'}</Text></View>{canDo('alerts', 'edit') && <Pressable onPress={() => openForm(item)} style={s.link}><Text style={s.linkText}>Edit</Text></Pressable>}{canDo('alerts', 'delete') && <Pressable onPress={() => Alert.alert('Remove vehicle alert?', `Remove ${item.name} for this vehicle only?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void remove(item); } }])} style={s.link} disabled={saving}><Text style={s.linkText}>Delete</Text></Pressable>}</View>} />}
    </View>;
  if (fullScreen) return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>{content}</SafeAreaView></KeyboardAvoidingView>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{content}</KeyboardAvoidingView></Modal>;
}
const s = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.border }, title: { color: theme.ink, fontSize: 17, fontWeight: '700' }, error: { color: theme.red, padding: 16, fontSize: 12 }, form: { padding: 18, paddingBottom: 36 }, label: { color: theme.ink, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 7 }, hint: { color: theme.secondary, fontSize: 11, lineHeight: 16 }, input: { minHeight: 44, borderWidth: 1, borderColor: theme.border, borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center', fontSize: 14, color: theme.ink }, value: { color: theme.ink, fontSize: 13 }, options: { borderWidth: 1, borderColor: theme.border, borderRadius: 7, maxHeight: 260, overflow: 'hidden' }, option: { padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border }, activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, primary: { backgroundColor: theme.red, minHeight: 44, marginTop: 25, borderRadius: 7, justifyContent: 'center', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, eventRow: { flexDirection: 'row', gap: 7 }, eventButton: { flex: 1, alignItems: 'center', padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 7 }, eventSelected: { borderColor: theme.red, backgroundColor: '#fff5f5' }, empty: { color: theme.secondary, textAlign: 'center', marginTop: 36 }, rule: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 9, borderBottomWidth: 1, borderColor: theme.border }, ruleName: { color: theme.ink, fontWeight: '700', fontSize: 14 }, ruleMeta: { color: theme.secondary, marginTop: 4, fontSize: 11 }, link: { padding: 5 }, linkText: { color: theme.red, fontSize: 11, fontWeight: '600' } });
