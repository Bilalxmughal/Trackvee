import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import type { FleetAlertRule } from '../../src/components/FleetAlertForm';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { hasCachedPushRegistration, syncPushRegistration } from '../../src/lib/pushNotifications';

type Filter = 'all' | 'active' | 'inactive';
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function AlertsScreen() {
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
        {canDo('alerts', 'add') ? <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="Create alert rule" style={s.add}><TablerIcon name="plus" size={22} color={theme.red}/></Pressable> : null}
        <Pressable onPress={() => void load()} accessibilityLabel="Refresh alerts" style={s.refresh}><TablerIcon name="refresh" size={18} color={theme.ink} /></Pressable>
      </View>
    </View>
    <View style={s.pushRow}><View style={{ flex: 1 }}><Text style={s.pushTitle}>Mobile notifications</Text><Text style={s.pushSubtitle}>{pushState === 'enabled' ? 'Enabled on this device' : 'Get alert updates on this device'}</Text></View>{pushState === 'enabled' ? <Text style={s.enabled}>Enabled</Text> : pushState === 'unknown' ? <ActivityIndicator size="small" color={theme.secondary}/> : <Pressable onPress={() => void enablePush()} disabled={pushBusy} style={s.enableButton}>{pushBusy ? <ActivityIndicator size="small" color={theme.red} /> : <Text style={s.enableText}>Enable</Text>}</Pressable>}</View>
    <View style={s.searchBox}><TablerIcon name="search" size={17} color={theme.secondary}/><TextInput value={query} onChangeText={setQuery} placeholder="Search alert rules" placeholderTextColor={theme.muted} style={s.searchInput}/></View>
    <View style={s.filters}>{(['all', 'active', 'inactive'] as Filter[]).map(value => <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterSelected]}><Text style={[s.filterText, filter === value && s.filterTextSelected]}>{label(value)} ({counts[value]})</Text></Pressable>)}</View>
    {error ? <Pressable onPress={() => void load()} style={s.error}><Text style={s.errorText}>{error}  Retry</Text></Pressable> : null}
    <FlatList data={visibleAlerts} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.red} />} contentContainerStyle={!visibleAlerts.length ? s.empty : undefined} renderItem={({ item }) => {
      const editAllowed = canManage(item, 'edit');
      const deleteAllowed = canManage(item, 'delete');
      const targetText = item.fleetWide || !item.vehicleImeis.length ? 'All vehicles' : `${item.vehicleImeis.length} ${item.vehicleImeis.length === 1 ? 'vehicle' : 'vehicles'}`;
      return <View style={s.rule}>
        <View style={[s.ruleLine, { backgroundColor: item.active ? theme.red : theme.border }]}/>
        <View style={s.ruleMain}><Text style={s.ruleName}>{item.name}</Text><Text style={s.ruleMeta}>{label(item.type)} · {targetText}</Text></View>
        <Text style={[s.state, { color: item.active ? theme.red : theme.muted }]}>{item.active ? 'Active' : 'Inactive'}</Text>
        {editAllowed || deleteAllowed ? <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${item.name}`} style={s.more} onPress={() => Alert.alert('Alert rule actions', item.name, [
          ...(editAllowed ? [{ text: 'Edit', onPress: () => openEdit(item) }] : []),
          ...(deleteAllowed ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => remove(item) }] : []),
          { text: 'Cancel', style: 'cancel' as const },
        ])}><TablerIcon name="more-vertical" size={18} color={theme.secondary}/></Pressable> : null}
      </View>;
    }} ListEmptyComponent={<View style={s.emptyCopy}><TablerIcon name="bell" size={28} color={theme.muted} /><Text style={s.emptyTitle}>{loading ? 'Loading alerts…' : 'No alert rules'}</Text><Text style={s.emptySubtitle}>{loading ? '' : query ? 'Try another search.' : 'Create an alert rule to monitor your fleet.'}</Text>{!loading && !alerts.length && canDo('alerts','add') ? <Pressable onPress={openNew} style={s.emptyAction}><TablerIcon name="plus" size={16} color={theme.red}/><Text style={s.emptyActionText}>New alert rule</Text></Pressable> : null}</View>} />
  </SafeAreaView>;
}

const s = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { minHeight: 62, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 25, fontWeight: '700', color: theme.ink }, subtitle: { fontSize: 13, color: theme.secondary, marginTop: 3 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, add: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, refresh: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }, pushRow: { minHeight: 62, marginHorizontal: 18, marginBottom: 9, paddingHorizontal: 0, borderWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, pushTitle: { color: theme.ink, fontWeight: '600', fontSize: 13 }, pushSubtitle: { color: theme.secondary, fontSize: 11, marginTop: 4 }, enableButton: { minWidth: 72, height: 34, borderRadius: 7, borderWidth: 1, borderColor: theme.red, alignItems: 'center', justifyContent: 'center' }, enableText: { color: theme.red, fontWeight: '600', fontSize: 12 }, enabled: { color: theme.red, fontWeight: '600', fontSize: 12 }, searchBox: { height: 42, marginHorizontal: 18, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, color: theme.ink, fontSize: 12, paddingVertical: 6 }, filters: { flexDirection: 'row', paddingHorizontal: 18, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderColor: theme.border }, filter: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' }, filterSelected: { borderBottomColor: theme.red }, filterText: { color: theme.secondary, fontSize: 11 }, filterTextSelected: { color: theme.red, fontWeight: '700' }, rule: { minHeight: 69, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: theme.border, gap: 10 }, ruleLine: { width: 3, height: 39 }, ruleMain: { flex: 1, minWidth: 0 }, ruleName: { color: theme.ink, fontSize: 13, fontWeight: '700' }, ruleMeta: { color: theme.secondary, fontSize: 11, marginTop: 5, textTransform: 'capitalize' }, state: { fontSize: 11, fontWeight: '600' }, more: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' }, empty: { flexGrow: 1, justifyContent: 'center' }, emptyCopy: { alignItems: 'center', padding: 30 }, emptyTitle: { marginTop: 14, fontSize: 15, fontWeight: '600', color: theme.ink }, emptySubtitle: { marginTop: 6, fontSize: 12, color: theme.secondary, textAlign: 'center' }, emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16, padding: 8 }, emptyActionText: { fontSize: 12, color: theme.red, fontWeight: '700' }, error: { paddingHorizontal: 18, paddingVertical: 10 }, errorText: { color: theme.red, fontSize: 11 } });
