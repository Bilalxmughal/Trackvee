import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/api';
import { TablerIcon } from './TablerIcon';
import { useTheme } from '../hooks/useTheme';
import type { AppTheme } from '../theme';
import { usePortalPermissions } from '../auth/PortalPermissionsProvider';
import { AlertSoundSettings, MobileAlertSoundId } from './AlertSoundSettings';

type Rule = { id: string; name: string; type: string; active: boolean; config: Record<string, string | number>; schedule?: Record<string, unknown> | null; notifications?: { appPush?: boolean; appSound?: boolean; appSoundId?: MobileAlertSoundId; webPush?: boolean; webSound?: boolean; email?: boolean }; vehicleImeis: string[]; excludedVehicleImeis?: string[] };
type Zone = { id: string; name: string };
type Filter = 'all' | 'active' | 'inactive';
const TYPES = ['over_speed', 'idle', 'ignition_on', 'ignition_off', 'power_cut', 'low_battery', 'no_gps', 'offline', 'tow', 'over_parking', 'geofence', 'poi', 'low_score', 'speed_zone', 'maintenance'] as const;
const SERVICE_TYPES = ['Engine Oil', 'Tuning', 'Oil Filter', 'Air Filter', 'AC Filter', 'Fuel Filter', 'Brake Pads', 'Brake Fluid', 'Coolant', 'Transmission Oil', 'Battery', 'Tyre Rotation', 'General Inspection', 'Other'];
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export function VehicleAlertsPanel({ visible, imei, onClose, fullScreen = false }: { visible: boolean; imei: string; onClose: () => void; fullScreen?: boolean }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
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
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [menuRuleId, setMenuRuleId] = useState<string | null>(null);
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
    setSchedule(rule?.schedule ?? null);
    setNotifications(rule ? { ...rule.notifications, appPush: rule.notifications?.appPush ?? true, appSound: rule.notifications?.appSound ?? true, appSoundId: rule.notifications?.appSoundId ?? 'trackvee' } : { appPush: true, appSound: true, appSoundId: 'trackvee' });
    setFormOpen(true); setError('');
  };

  const save = async () => {
    if (!name.trim()) { setError('Enter an alert name.'); return; }
    if (!canDo('alerts', editing ? 'edit' : 'add')) return;
    const requiredNumber = type === 'over_speed' || type === 'speed_zone' ? 'speedLimit' : ['idle', 'no_gps', 'offline', 'over_parking'].includes(type) ? 'minutes' : type === 'low_battery' ? 'level' : type === 'low_score' ? 'scoreThreshold' : null;
    if (requiredNumber && !(Number(config[requiredNumber]) > 0)) { setError(`Enter a valid ${label(requiredNumber).toLowerCase()}.`); return; }
    const requiredZone = type === 'geofence' || type === 'speed_zone' ? 'geofenceId' : type === 'poi' ? 'poiId' : null;
    if (requiredZone && !config[requiredZone]) { setError('Select a zone.'); return; }
    if (type === 'maintenance' && (!config.serviceType || (config.serviceType === 'Other' && !String(config.customServiceType ?? '').trim()))) { setError('Select a service type and enter its name when choosing Other.'); return; }
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

  const visibleRules = useMemo(() => {
    return rules.filter(rule =>
      filter === 'all' || (filter === 'active' ? rule.active : !rule.active)
    );
  }, [rules, filter]);

  const counts = useMemo(() => ({
    all: rules.length,
    active: rules.filter(r => r.active).length,
    inactive: rules.filter(r => !r.active).length,
  }), [rules]);

  const menuRule = rules.find(r => r.id === menuRuleId) ?? null;

  const listView = <>
    <View style={s.pillRow}>
      {(['all', 'active', 'inactive'] as Filter[]).map(value => (
        <Pressable key={value} onPress={() => setFilter(value)} style={[s.pill, { backgroundColor: filter === value ? t.red : t.bg2 }]}>
          <Text style={[s.pillText, { color: filter === value ? '#fff' : t.secondary, fontWeight: filter === value ? '600' : '500' }]}>{label(value)} {counts[value]}</Text>
        </Pressable>
      ))}
    </View>

    {error ? <Pressable onPress={() => void load()} style={s.errorRow}><Text style={[s.errorText, { color: t.red }]}>{error}  Retry</Text></Pressable> : null}

    {loading
      ? <ActivityIndicator style={{ marginTop: 32 }} color={t.red} />
      : <FlatList
          data={visibleRules}
          keyExtractor={rule => rule.id}
          contentContainerStyle={!visibleRules.length ? s.empty : s.listContent}
          renderItem={({ item }) => {
            const activeBg = item.active ? `${t.red}14` : t.bg2;
            const activeColor = item.active ? t.red : t.muted;
            return (
              <View style={[s.rule, { borderBottomColor: t.border }]}>
                <View style={[s.ruleAccent, { backgroundColor: item.active ? t.red : t.border }]} />
                <View style={s.ruleMain}>
                  <Text style={[s.ruleName, { color: t.ink }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.ruleMeta, { color: t.secondary }]} numberOfLines={1}>{label(item.type)} · {item.active ? 'Active' : 'Inactive'}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: activeBg }]}>
                  <Text style={[s.statusText, { color: activeColor }]}>{item.active ? 'Active' : 'Inactive'}</Text>
                </View>
                {(canDo('alerts', 'edit') || canDo('alerts', 'delete'))
                  ? <Pressable style={s.moreBtn} onPress={() => setMenuRuleId(item.id)}>
                      <TablerIcon name="more-vertical" size={18} color={t.secondary} />
                    </Pressable>
                  : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyCopy}>
              <TablerIcon name="bell" size={36} color={t.muted} />
              <Text style={[s.emptyTitle, { color: t.ink }]}>{loading ? 'Loading…' : 'No alert rules'}</Text>
              <Text style={[s.emptySubtitle, { color: t.secondary }]}>No alerts configured for this vehicle.</Text>
              {!loading && !rules.length && canDo('alerts', 'add')
                ? <Pressable onPress={() => openForm(null)} style={s.emptyAction}>
                    <TablerIcon name="plus" size={15} color={t.red} />
                    <Text style={[s.emptyActionText, { color: t.red }]}>New alert rule</Text>
                  </Pressable>
                : null}
            </View>
          }
        />
    }

    <Modal visible={!!menuRule} transparent animationType="fade" onRequestClose={() => setMenuRuleId(null)}>
      <Pressable onPress={() => setMenuRuleId(null)} style={s.menuShade}>
        <Pressable onPress={e => e.stopPropagation()} style={[s.menuCard, { backgroundColor: t.card }]}>
          <Text style={[s.menuTitle, { color: t.ink, borderBottomColor: t.border }]} numberOfLines={1}>{menuRule?.name ?? ''}</Text>
          {canDo('alerts', 'edit') && <Pressable style={s.menuAction} onPress={() => { setMenuRuleId(null); openForm(menuRule!); }}>
            <TablerIcon name="edit" size={17} color={t.secondary} />
            <Text style={[s.menuActionText, { color: t.ink }]}>Edit</Text>
          </Pressable>}
          {canDo('alerts', 'delete') && <Pressable style={s.menuAction} onPress={() => { setMenuRuleId(null); void remove(menuRule!); }}>
            <TablerIcon name="trash" size={17} color={t.red} />
            <Text style={[s.menuActionText, { color: t.red }]}>Delete</Text>
          </Pressable>}
        </Pressable>
      </Pressable>
    </Modal>
  </>;

  const formView = <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
    {error ? <Text style={[s.errorText, { color: t.red, marginBottom: 8 }]}>{error}</Text> : null}
    <Text style={s.fieldLabel}>Rule name</Text>
    <TextInput value={name} onChangeText={setName} style={s.input} placeholder="Alert name" accessibilityLabel="Alert name" placeholderTextColor={t.muted} />
    <Text style={s.fieldLabel}>Alert type</Text>
    <Pressable style={s.input} onPress={() => setTypeOpen(v => !v)}><Text style={{ color: t.ink, fontSize: 14 }}>{label(type)} ▾</Text></Pressable>
    {typeOpen && <View style={s.options}>{TYPES.map(option => <Pressable key={option} style={s.option} onPress={() => { setType(option); setTypeOpen(false); setConfig(option === 'over_speed' ? { speedLimit: 80 } : {}); }}><Text style={{ color: option === type ? t.red : t.ink, fontSize: 13 }}>{label(option)}</Text></Pressable>)}</View>}
    {numericField && <>
      <Text style={s.fieldLabel}>{label(numericField)}{numericField === 'speedLimit' ? ' (km/h)' : numericField === 'minutes' ? ' (minutes)' : ''}</Text>
      <TextInput value={String(config[numericField] ?? '')} onChangeText={text => setConfig(prev => ({ ...prev, [numericField]: Number(text) || 0 }))} keyboardType="numeric" style={s.input} accessibilityLabel={label(numericField)} placeholderTextColor={t.muted} />
    </>}
    {zoneField && <>
      <Text style={s.fieldLabel}>{zoneField === 'poiId' ? 'POI' : 'Geofence'}</Text>
      <Pressable style={s.input} onPress={() => setZoneOpen(v => !v)}><Text style={{ color: t.ink, fontSize: 14 }}>{zoneItems.find(z => z.id === config[zoneField])?.name ?? 'Select zone'} ▾</Text></Pressable>
      {zoneOpen && <View style={s.options}>{zoneItems.map(z => <Pressable key={z.id} style={s.option} onPress={() => { setConfig(prev => ({ ...prev, [zoneField]: z.id })); setZoneOpen(false); }}><Text style={{ color: t.ink, fontSize: 13 }}>{z.name}</Text></Pressable>)}</View>}
    </>}
    {type === 'maintenance' && <>
      <Text style={s.fieldLabel}>Service type</Text>
      <Pressable style={s.input} onPress={() => setServiceTypeOpen(v => !v)}><Text style={{ color: t.ink, fontSize: 14 }}>{String(config.serviceType ?? 'Select service type')} ▾</Text></Pressable>
      {serviceTypeOpen && <View style={s.options}>{SERVICE_TYPES.map(st => <Pressable key={st} style={s.option} onPress={() => { setConfig(prev => ({ ...prev, serviceType: st, customServiceType: st === 'Other' ? prev.customServiceType ?? '' : '' })); setServiceTypeOpen(false); }}><Text style={[{ fontSize: 13 }, config.serviceType === st ? { color: t.red } : { color: t.ink }]}>{st}</Text></Pressable>)}</View>}
      {config.serviceType === 'Other' && <TextInput value={String(config.customServiceType ?? '')} onChangeText={v => setConfig(prev => ({ ...prev, customServiceType: v }))} placeholder="Enter custom service type" maxLength={80} style={s.input} placeholderTextColor={t.muted} />}
    </>}
    {(type === 'geofence' || type === 'poi') && <>
      <Text style={s.fieldLabel}>Event</Text>
      <View style={s.eventRow}>
        {(['enter', 'exit', 'both'] as const).map(event => <Pressable key={event} onPress={() => setConfig(prev => ({ ...prev, [type === 'poi' ? 'poiEvent' : 'geofenceEvent']: event }))} style={[s.eventButton, config[type === 'poi' ? 'poiEvent' : 'geofenceEvent'] === event && s.eventSelected]}><Text style={{ color: t.ink, fontSize: 13 }}>{label(event)}</Text></Pressable>)}
      </View>
    </>}
    <View style={s.switchRow}><Text style={s.fieldLabel}>Active</Text><Switch value={active} onValueChange={setActive} trackColor={{ true: t.red }} /></View>
    <View style={s.switchRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.fieldLabel}>Mobile push</Text>
        <Text style={s.hint}>Send this alert to devices with notifications enabled.</Text>
      </View>
      <Switch value={notifications?.appPush === true} onValueChange={v => setNotifications(prev => ({ ...prev, appPush: v, ...(v ? { appSound: prev?.appSound ?? true, appSoundId: prev?.appSoundId ?? 'trackvee' } : {}) }))} trackColor={{ true: t.red }} />
    </View>
    <AlertSoundSettings enabled={notifications?.appPush === true} soundEnabled={notifications?.appSound ?? true} soundId={notifications?.appSoundId ?? 'trackvee'} onSoundEnabledChange={v => setNotifications(prev => ({ ...prev, appSound: v }))} onSoundIdChange={v => setNotifications(prev => ({ ...prev, appSoundId: v }))} />
    <Pressable disabled={saving} style={s.saveBtn} onPress={() => void save()}>
      <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save for this vehicle'}</Text>
    </Pressable>
  </ScrollView>;

  const content = <View style={s.container}>
    <View style={s.header}>
      <Pressable onPress={formOpen ? () => setFormOpen(false) : onClose} style={s.backBtn} accessibilityLabel="Back">
        <TablerIcon name="arrow-left" size={18} color={t.ink} />
      </Pressable>
      <View style={s.headerTitle}>
        <Text style={s.title}>{formOpen ? (editing ? 'Edit Alert' : 'New Alert') : 'Vehicle Alerts'}</Text>
      </View>
      <View style={s.headerActions}>
        {!formOpen && canDo('alerts', 'add') && (
          <Pressable onPress={() => openForm(null)} style={s.addBtn} accessibilityLabel="New alert">
            <TablerIcon name="plus" size={20} color="#fff" />
          </Pressable>
        )}
        {!formOpen && (
          <Pressable onPress={() => void load()} style={s.iconBtn} accessibilityLabel="Refresh">
            <TablerIcon name="refresh" size={18} color={t.ink} />
          </Pressable>
        )}
      </View>
    </View>

    {formOpen ? formView : listView}
  </View>;

  if (fullScreen) return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>{content}</SafeAreaView>
    </KeyboardAvoidingView>
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{content}</KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    backBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, minWidth: 0 },
    title: { fontSize: 18, fontWeight: '700', color: t.ink, letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: t.secondary, marginTop: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    pillRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    pillText: { fontSize: 12 },
    errorRow: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 12 },
    listContent: { paddingBottom: 20 },
    rule: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
    ruleAccent: { width: 3, height: 36, borderRadius: 2 },
    ruleMain: { flex: 1, minWidth: 0 },
    ruleName: { fontSize: 14, fontWeight: '600' },
    ruleMeta: { fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, overflow: 'hidden' },
    statusText: { fontSize: 11, fontWeight: '600' },
    moreBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
    empty: { flexGrow: 1, justifyContent: 'center' },
    emptyCopy: { alignItems: 'center', padding: 36 },
    emptyTitle: { marginTop: 14, fontSize: 16, fontWeight: '600' },
    emptySubtitle: { marginTop: 6, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: `${t.red}14` },
    emptyActionText: { fontSize: 13, fontWeight: '600' },
    form: { padding: 18, paddingBottom: 36 },
    fieldLabel: { color: t.ink, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 7 },
    hint: { color: t.secondary, fontSize: 11, lineHeight: 16 },
    input: { minHeight: 44, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', fontSize: 14, color: t.ink },
    options: { borderWidth: 1, borderColor: t.border, borderRadius: 8, maxHeight: 260, overflow: 'hidden' },
    option: { padding: 10, borderBottomWidth: 1, borderBottomColor: t.border },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    eventRow: { flexDirection: 'row', gap: 7 },
    eventButton: { flex: 1, alignItems: 'center', padding: 10, borderWidth: 1, borderColor: t.border, borderRadius: 8 },
    eventSelected: { borderColor: t.red, backgroundColor: t.surface },
    saveBtn: { backgroundColor: t.red, minHeight: 46, marginTop: 26, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    menuShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end', padding: 14 },
    menuCard: { borderRadius: 9, paddingBottom: 7, marginBottom: 20, overflow: 'hidden' },
    menuTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
    menuAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
    menuActionText: { fontSize: 14 },
  });
}
