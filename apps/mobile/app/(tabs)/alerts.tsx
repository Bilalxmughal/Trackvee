import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import type { FleetAlertRule } from '../../src/components/FleetAlertForm';
import { useTheme } from '../../src/hooks/useTheme';
import type { AppTheme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { hasCachedPushRegistration, syncPushRegistration } from '../../src/lib/pushNotifications';

type Filter = 'all' | 'active' | 'inactive';
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function AlertsScreen() {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const [alerts, setAlerts] = useState<FleetAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [pushState, setPushState] = useState<'unknown' | 'enabled' | 'disabled' | 'denied' | 'unconfigured' | 'unsupported'>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();

  useEffect(() => { if (!permissionsLoading && !canDo('alerts')) router.replace('/map'); }, [canDo, permissionsLoading]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const alertResult = await api.get<FleetAlertRule[]>('/alerts');
      setAlerts(alertResult.data ?? []);
    } catch { setError('Alerts could not be loaded. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useFocusEffect(useCallback(() => {
    let active = true;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void (async () => {
        const cachedRegistration = await hasCachedPushRegistration().catch(() => false);
        if (!active) return;
        if (active && cachedRegistration) setPushState('enabled');
        try {
          const value = await syncPushRegistration(false);
          if (active && (value === 'enabled' || value === 'disabled' || value === 'denied' || !cachedRegistration)) setPushState(value);
        } catch {
          if (active) setPushState(current => current === 'enabled' ? current : 'unconfigured');
        }
      })();
    } else setPushState('unsupported');
    return () => { active = false; };
  }, []));

  const enablePush = async () => {
    setPushBusy(true);
    try {
      const state = await syncPushRegistration(true);
      setPushState(state);
      if (state === 'denied') setError('Notification permission is off. Enable notifications in your device settings.');
      else if (state === 'unconfigured') setError('Push notifications are not configured for this app build yet.');
      else if (state === 'unsupported') setError('Push notifications are available in the iOS and Android app.');
      else setError('');
    } catch { setError('Push notifications could not be enabled. Please try again.'); }
    finally { setPushBusy(false); }
  };

  const openNew = () => router.push('/alert-rule');
  const openEdit = (rule: FleetAlertRule) => router.push({ pathname: '/alert-rule', params: { ruleId: rule.id } });
  const remove = (rule: FleetAlertRule) => Alert.alert('Delete alert rule?', `Delete “${rule.name}” for its selected vehicles?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      try { await api.delete(`/alerts/${rule.id}`); setAlerts(current => current.filter(item => item.id !== rule.id)); }
      catch { setError('The alert rule could not be deleted. Check your access and try again.'); }
    })(); } },
  ]);

  const visibleAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter(rule => (filter === 'all' || (filter === 'active' ? rule.active : !rule.active))
      && (!q || rule.name.toLowerCase().includes(q) || rule.type.toLowerCase().includes(q)));
  }, [alerts, filter, query]);
  const counts = useMemo(() => ({ all: alerts.length, active: alerts.filter(item => item.active).length, inactive: alerts.filter(item => !item.active).length }), [alerts]);
  const canManage = (rule: FleetAlertRule, action: 'edit' | 'delete') => {
    const field = action === 'edit' ? rule.canEdit : rule.canDelete;
    if (typeof field === 'boolean') return field && canDo('alerts', action);
    return false;
  };

  return <SafeAreaView style={s.container} edges={['top']}>
    <View style={s.header}>
      <View><Text style={s.title}>Alerts</Text><Text style={s.subtitle}>Rules for your fleet</Text></View>
      <View style={s.headerActions}>
        {canDo('alerts', 'add') ? <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="Create alert rule" style={s.addBtn}><TablerIcon name="plus" size={20} color="#fff"/></Pressable> : null}
        <Pressable onPress={() => void load()} accessibilityLabel="Refresh alerts" style={s.iconBtn}><TablerIcon name="refresh" size={18} color={t.ink} /></Pressable>
      </View>
    </View>


    <View style={[s.search, { borderBottomColor: t.border }]}>
      <TablerIcon name="search" size={16} color={t.secondary}/>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search alert rules" placeholderTextColor={t.muted} style={[s.searchInput, { color: t.ink }]}/>
    </View>

    <View style={s.pillRow}>
      {(['all', 'active', 'inactive'] as Filter[]).map(value => (
        <Pressable key={value} onPress={() => setFilter(value)} style={[s.pill, { backgroundColor: filter === value ? t.red : t.bg2 }]}>
          <Text style={[s.pillText, { color: filter === value ? '#fff' : t.secondary, fontWeight: filter === value ? '600' : '500' }]}>{label(value)} {counts[value]}</Text>
        </Pressable>
      ))}
    </View>

    {error ? <Pressable onPress={() => void load()} style={s.errorRow}><Text style={[s.errorText, { color: t.red }]}>{error}  Retry</Text></Pressable> : null}

    <FlatList
      data={visibleAlerts}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.red} />}
      contentContainerStyle={!visibleAlerts.length ? s.empty : s.listContent}
      renderItem={({ item }) => {
        const editAllowed = canManage(item, 'edit');
        const deleteAllowed = canManage(item, 'delete');
        const targetText = item.fleetWide || !item.vehicleImeis.length ? 'All vehicles' : `${item.vehicleImeis.length} ${item.vehicleImeis.length === 1 ? 'vehicle' : 'vehicles'}`;
        const activeBg = item.active ? `${t.red}14` : t.bg2;
        const activeColor = item.active ? t.red : t.muted;
        return (
          <View style={[s.rule, { borderBottomColor: t.border }]}>
            <View style={[s.ruleAccent, { backgroundColor: item.active ? t.red : t.border }]}/>
            <View style={s.ruleMain}>
              <Text style={[s.ruleName, { color: t.ink }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[s.ruleMeta, { color: t.secondary }]} numberOfLines={1}>{label(item.type)} · {targetText}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: activeBg, borderRadius: 5, overflow: 'hidden' }]}>
              <Text style={[s.statusText, { color: activeColor }]}>{item.active ? 'Active' : 'Inactive'}</Text>
            </View>
            {editAllowed || deleteAllowed
              ? <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${item.name}`} style={s.moreBtn} onPress={() => Alert.alert('Alert rule actions', item.name, [
                  ...(editAllowed ? [{ text: 'Edit', onPress: () => openEdit(item) }] : []),
                  ...(deleteAllowed ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => remove(item) }] : []),
                  { text: 'Cancel', style: 'cancel' as const },
                ])}><TablerIcon name="more-vertical" size={18} color={t.secondary}/></Pressable>
              : null}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={s.emptyCopy}>
          <TablerIcon name="bell" size={36} color={t.muted} />
          <Text style={[s.emptyTitle, { color: t.ink }]}>{loading ? 'Loading alerts…' : 'No alert rules'}</Text>
          <Text style={[s.emptySubtitle, { color: t.secondary }]}>{loading ? '' : query ? 'Try another search.' : 'Create an alert rule to monitor your fleet.'}</Text>
          {!loading && !alerts.length && canDo('alerts', 'add')
            ? <Pressable onPress={openNew} style={s.emptyAction}>
                <TablerIcon name="plus" size={15} color={t.red}/>
                <Text style={[s.emptyActionText, { color: t.red }]}>New alert rule</Text>
              </Pressable>
            : null}
        </View>
      }
    />
  </SafeAreaView>;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: t.secondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  pushCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, padding: 13, borderWidth: 1, borderRadius: 10 },
  pushIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pushTitle: { fontSize: 13, fontWeight: '600' },
  pushSubtitle: { fontSize: 11, marginTop: 2 },
  enabledBadge: { backgroundColor: '#dcfce7', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  enabledText: { fontSize: 11, fontWeight: '600' },
  enableBtn: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  enableBtnText: { fontSize: 12, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  pillRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { fontSize: 12 },
  listContent: { paddingBottom: 20 },
  rule: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  ruleAccent: { width: 3, height: 36, borderRadius: 2 },
  ruleMain: { flex: 1, minWidth: 0 },
  ruleName: { fontSize: 14, fontWeight: '600' },
  ruleMeta: { fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  moreBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  errorRow: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  emptyCopy: { alignItems: 'center', padding: 36 },
  emptyTitle: { marginTop: 14, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { marginTop: 6, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: `${t.red}14` },
  emptyActionText: { fontSize: 13, fontWeight: '600' },
}); }
