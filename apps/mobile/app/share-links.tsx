import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

const SHARE_BASE = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://admin.trackvee.com';

type DeviceOption = { imei: string; label: string };
type ShareLink = {
  id: string; token: string; name: string; imei: string;
  expiresAt: string | null; viewCount: number; isActive: boolean;
  createdAt: string;
  vehicle?: { id: string; licensePlate: string | null; name: string } | null;
};
type Form = { name: string; imei: string; expiresAt: string; isActive: boolean };

const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const fmt = (value: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(value)
    ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`
    : value;

const parseDate = (value: string): string | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const linkStatus = (link: ShareLink): 'active' | 'expired' | 'inactive' => {
  if (!link.isActive) return 'inactive';
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) return 'expired';
  return 'active';
};

const createForm = (): Form => ({ name: '', imei: '', expiresAt: '', isActive: true });

export default function ShareLinksScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [links, setLinks] = useState<ShareLink[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    const [linksResult, devicesResult] = await Promise.allSettled([
      api.get<ShareLink[]>('/share-links'),
      api.get<Array<{ imei: string; displayId: number; vehicle: { licensePlate: string | null; name: string } | null }>>('/devices'),
    ]);
    if (linksResult.status === 'fulfilled') setLinks(linksResult.value.data);
    else Alert.alert('Share Links unavailable', 'Could not load share links. Please try again.');
    if (devicesResult.status === 'fulfilled') {
      setDevices(devicesResult.value.data.map(d => ({
        imei: d.imei,
        label: d.vehicle?.licensePlate ?? d.vehicle?.name ?? `#${d.displayId}`,
      })));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm(current => current ? { ...current, [key]: value } : current);

  const openEdit = (link: ShareLink) => {
    setEditing(link.id);
    setForm({ name: link.name, imei: link.imei, expiresAt: link.expiresAt?.slice(0, 10) ?? '', isActive: link.isActive });
    setDeviceSearch('');
  };

  const save = async () => {
    if (!form?.name.trim()) { Alert.alert('Check details', 'Please enter a name for this share link.'); return; }
    if (!editing && !form.imei) { Alert.alert('Check details', 'Please select a vehicle.'); return; }
    const expiresAt = form.expiresAt ? (parseDate(form.expiresAt) ?? null) : null;
    if (form.expiresAt && !expiresAt) { Alert.alert('Check details', 'Enter expiry as DD-MM-YYYY or leave blank.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/share-links/${editing}`, { name: form.name.trim(), expiresAt, isActive: form.isActive });
      } else {
        await api.post('/share-links', { name: form.name.trim(), imei: form.imei, expiresAt });
      }
      setForm(null);
      setEditing(null);
      await load(true);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      Alert.alert('Could not save', typeof message === 'string' ? message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (link: ShareLink) =>
    Alert.alert('Delete share link?', `Delete "${link.name}"? Anyone with the link will lose access.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/share-links/${link.id}`); await load(true); }
        catch { Alert.alert('Could not delete', 'Please try again.'); }
      }},
    ]);

  const shareLink = async (link: ShareLink) => {
    const url = `${SHARE_BASE}/live/${link.token}`;
    setSharedId(link.id);
    try { await Share.share({ message: `${link.name}: ${url}`, url }); }
    catch { /* dismissed */ }
    finally { setTimeout(() => setSharedId(id => id === link.id ? null : id), 2000); }
  };

  const stColor = (st: ReturnType<typeof linkStatus>) =>
    st === 'active' ? t.moving : st === 'expired' ? t.red : t.secondary;

  const filteredDevices = useMemo(() =>
    devices.filter(d => `${d.label} ${d.imei}`.toLowerCase().includes(deviceSearch.trim().toLowerCase())),
    [devices, deviceSearch]
  );

  if (loading) return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}><TablerIcon name="back" size={19} color={t.ink} /></Pressable>
        <Text style={s.title}>Share Links</Text>
      </View>
      <ActivityIndicator style={{ marginTop: 32 }} color={t.red} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Pressable
          onPress={() => form ? (setForm(null), setEditing(null)) : router.back()}
          style={s.back}
          accessibilityLabel="Back"
        >
          <TablerIcon name="back" size={19} color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{form ? (editing ? 'Edit Link' : 'New Share Link') : 'Share Links'}</Text>
          <Text style={s.subtitle}>{form ? 'Live vehicle location' : `${links.length} link${links.length !== 1 ? 's' : ''}`}</Text>
        </View>
        {!form && (
          <Pressable onPress={() => { setEditing(null); setDeviceSearch(''); setForm(createForm()); }} style={s.add} accessibilityLabel="New share link">
            <TablerIcon name="plus" size={22} color={t.red} />
          </Pressable>
        )}
      </View>

      {form ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">

            <View style={s.field}>
              <Text style={s.fieldLabel}>Link name *</Text>
              <TextInput
                value={form.name}
                onChangeText={v => update('name', v)}
                placeholder="e.g. Delivery Tracker"
                style={s.input}
                autoCapitalize="words"
              />
            </View>

            {!editing && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>Vehicle *</Text>
                <TextInput
                  value={deviceSearch}
                  onChangeText={setDeviceSearch}
                  placeholder="Search plate or device"
                  style={s.input}
                  autoCorrect={false}
                />
                <ScrollView style={s.vehicleList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredDevices.map(d => (
                    <Pressable
                      key={d.imei}
                      onPress={() => { update('imei', d.imei); setDeviceSearch(d.label); }}
                      style={[s.vehicleChoice, form.imei === d.imei && s.vehicleChoiceSelected]}
                    >
                      <Text numberOfLines={1} style={[s.vehicleChoiceText, form.imei === d.imei && { color: t.red }]}>
                        {d.label} <Text style={{ color: t.muted, fontSize: 10 }}>{d.imei}</Text>
                      </Text>
                    </Pressable>
                  ))}
                  {!filteredDevices.length && (
                    <Text style={[s.vehicleChoiceText, { padding: 10, color: t.muted }]}>No vehicles found</Text>
                  )}
                </ScrollView>
              </View>
            )}

            <View style={s.field}>
              <Text style={s.fieldLabel}>Expiry date (optional)</Text>
              <Pressable onPress={() => setDatePickerOpen(true)} style={s.input}>
                <Text style={{ color: form.expiresAt ? t.ink : t.muted, fontSize: 13 }}>
                  {form.expiresAt ? fmt(form.expiresAt) : 'No expiry (permanent)  ▾'}
                </Text>
              </Pressable>
            </View>

            {editing != null && (
              <Pressable onPress={() => update('isActive', !form.isActive)} style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.toggleLabel, { color: t.ink }]}>Active</Text>
                  <Text style={s.toggleSub}>Disable to block access without deleting</Text>
                </View>
                <View style={[s.toggle, form.isActive && s.toggleOn]}>
                  <View style={[s.toggleThumb, form.isActive && s.toggleThumbOn]} />
                </View>
              </Pressable>
            )}

            <View style={s.formActions}>
              <Pressable onPress={() => { setForm(null); setEditing(null); }} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void save()} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
                <Text style={s.saveText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create link'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={links}
          keyExtractor={l => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={t.red} />}
          contentContainerStyle={links.length ? { paddingBottom: 24 } : s.emptyWrap}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <TablerIcon name="share" size={26} color={t.muted} />
              <Text style={s.emptyTitle}>No share links yet</Text>
              <Text style={s.emptyText}>Create a link to share a vehicle's live location with anyone — no login required.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = linkStatus(item);
            const color = stColor(st);
            const vehicleLabel = item.vehicle?.licensePlate ?? item.imei;
            return (
              <View style={[s.row, { borderLeftColor: color }]}>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={s.linkName} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.badge, { backgroundColor: `${color}18` }]}>
                      <Text style={[s.badgeText, { color }]}>{st}</Text>
                    </View>
                  </View>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {vehicleLabel}
                    {item.expiresAt ? ` · Expires ${fmt(item.expiresAt.slice(0, 10))}` : ' · No expiry'}
                  </Text>
                  <Text style={s.rowViews}>{item.viewCount} {item.viewCount === 1 ? 'view' : 'views'}</Text>
                </View>
                <Pressable onPress={() => void shareLink(item)} style={s.action} accessibilityLabel="Share link">
                  <TablerIcon name={sharedId === item.id ? 'check' : 'share'} size={17} color={sharedId === item.id ? t.moving : t.secondary} />
                </Pressable>
                <Pressable onPress={() => openEdit(item)} style={s.action} accessibilityLabel="Edit link">
                  <TablerIcon name="edit" size={17} color={t.secondary} />
                </Pressable>
                <Pressable onPress={() => remove(item)} style={s.action} accessibilityLabel="Delete link">
                  <TablerIcon name="trash" size={17} color={t.secondary} />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <DatePickerModal
        visible={datePickerOpen}
        value={form?.expiresAt ?? ''}
        onClose={() => setDatePickerOpen(false)}
        onApply={v => { update('expiresAt', v); setDatePickerOpen(false); }}
        onClear={() => { update('expiresAt', ''); setDatePickerOpen(false); }}
        t={t}
        s={s}
      />
    </SafeAreaView>
  );
}

function DatePickerModal({ visible, value, onClose, onApply, onClear, t, s }: {
  visible: boolean; value: string; onClose: () => void;
  onApply: (v: string) => void; onClear: () => void;
  t: AppTheme; s: ReturnType<typeof makeStyles>;
}) {
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(`${today()}T00:00:00`);
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [selected, setSelected] = useState({ year: initial.getFullYear(), month: initial.getMonth(), day: initial.getDate() });

  useEffect(() => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(`${today()}T00:00:00`);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
    setSelected({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
  }, [value, visible]);

  const days = new Date(month.year, month.month + 1, 0).getDate();
  const offset = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
  const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(month.year, month.month, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.pickerCard}>
          <View style={s.calendarHeader}>
            <Pressable style={s.monthArrow} onPress={() => setMonth(c => { const p = new Date(c.year, c.month - 1, 1); return { year: p.getFullYear(), month: p.getMonth() }; })}>
              <Text style={s.monthArrowText}>‹</Text>
            </Pressable>
            <Text style={s.pickerTitle}>{monthName}</Text>
            <Pressable style={s.monthArrow} onPress={() => setMonth(c => { const n = new Date(c.year, c.month + 1, 1); return { year: n.getFullYear(), month: n.getMonth() }; })}>
              <Text style={s.monthArrowText}>›</Text>
            </Pressable>
          </View>
          <View style={s.calendarGrid}>
            {['M','T','W','T','F','S','S'].map((d, i) => <Text key={`${d}-${i}`} style={s.weekday}>{d}</Text>)}
            {Array.from({ length: offset }, (_, i) => <View key={`b${i}`} style={s.calendarDay} />)}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const active = selected.year === month.year && selected.month === month.month && selected.day === day;
              return (
                <Pressable key={day} onPress={() => setSelected({ year: month.year, month: month.month, day })} style={[s.calendarDay, active && s.calendarDaySelected]}>
                  <Text style={[s.calendarDayText, active && { color: '#fff', fontWeight: '700' }]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClear} style={s.clearOption}>
            <Text style={{ color: t.secondary, fontSize: 13 }}>No expiry (permanent)</Text>
          </Pressable>
          <View style={s.pickerActions}>
            <Pressable onPress={onClose} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable>
            <Pressable
              onPress={() => onApply(`${selected.year}-${String(selected.month + 1).padStart(2, '0')}-${String(selected.day).padStart(2, '0')}`)}
              style={s.saveBtn}
            >
              <Text style={s.saveText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: t.border, gap: 10 },
    back: { width: 30, height: 40, justifyContent: 'center' },
    title: { fontSize: 19, color: t.ink, fontWeight: '700' },
    subtitle: { marginTop: 2, color: t.secondary, fontSize: 11 },
    add: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 78, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, borderLeftWidth: 3 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    linkName: { color: t.ink, fontSize: 14, fontWeight: '700', flex: 1 },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
    badgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    rowMeta: { color: t.secondary, fontSize: 12 },
    rowViews: { color: t.muted, fontSize: 11, marginTop: 2 },
    action: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    emptyBox: { alignItems: 'center', paddingHorizontal: 30 },
    emptyTitle: { marginTop: 10, color: t.ink, fontSize: 14, fontWeight: '600' },
    emptyText: { marginTop: 5, textAlign: 'center', color: t.secondary, fontSize: 12 },
    formContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36, gap: 16 },
    field: { gap: 6 },
    fieldLabel: { color: t.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
    input: { minHeight: 43, borderWidth: 1, borderColor: t.border, borderRadius: 7, paddingHorizontal: 11, color: t.ink, fontSize: 13, backgroundColor: t.inputBg, justifyContent: 'center' },
    vehicleList: { maxHeight: 240, borderWidth: 1, borderColor: t.border, borderRadius: 7, marginTop: 4 },
    vehicleChoice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, borderBottomWidth: 1, borderColor: t.border },
    vehicleChoiceSelected: { backgroundColor: `${t.red}0d` },
    vehicleChoiceText: { fontSize: 12, color: t.secondary },
    toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1, borderColor: t.border, borderRadius: 7, paddingHorizontal: 12, backgroundColor: t.inputBg, gap: 12 },
    toggleLabel: { fontSize: 13, fontWeight: '600' },
    toggleSub: { fontSize: 11, color: t.secondary, marginTop: 2 },
    toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: t.border, justifyContent: 'center', padding: 3 },
    toggleOn: { backgroundColor: t.red },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    toggleThumbOn: { alignSelf: 'flex-end' },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: { minHeight: 44, minWidth: 100, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 7 },
    cancelText: { color: t.secondary, fontSize: 13, fontWeight: '500' },
    saveBtn: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: t.red, borderRadius: 7 },
    saveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    modalScrim: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
    pickerCard: { maxHeight: '80%', backgroundColor: t.bg, borderRadius: 12, padding: 14 },
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
