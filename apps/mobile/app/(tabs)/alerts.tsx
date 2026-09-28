import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { syncPushRegistration } from '../../src/lib/pushNotifications';

interface AlertRule { id: string; name: string; active: boolean; type: string; vehicleImeis?: string[]; }

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState<'unknown' | 'enabled' | 'denied' | 'unconfigured' | 'unsupported'>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  useEffect(() => { if (!permissionsLoading && !canDo('alerts')) router.replace('/map'); }, [canDo, permissionsLoading]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.get<AlertRule[]>('/alerts'); setAlerts(result.data); setError(''); }
    catch { setError('Alerts could not be loaded. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useFocusEffect(useCallback(() => {
    let active = true;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void syncPushRegistration(false).then(value => { if (active) setPushState(value); }).catch(() => { if (active) setPushState('unconfigured'); });
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
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><View><Text style={styles.title}>Alerts</Text><Text style={styles.subtitle}>Rules for your fleet</Text></View><Pressable onPress={load} accessibilityLabel="Refresh alerts" style={styles.refresh}><TablerIcon name="refresh" size={18} color={theme.ink} /></Pressable></View>
      <View style={styles.pushRow}><View style={{ flex: 1 }}><Text style={styles.pushTitle}>Mobile notifications</Text><Text style={styles.pushSubtitle}>{pushState === 'enabled' ? 'Enabled on this device' : 'Get alert updates on this device'}</Text></View>{pushState === 'enabled' ? <Text style={styles.enabled}>Enabled</Text> : <Pressable onPress={() => void enablePush()} disabled={pushBusy} style={styles.enableButton}>{pushBusy ? <ActivityIndicator size="small" color={theme.red} /> : <Text style={styles.enableText}>Enable</Text>}</Pressable>}</View>
      {error ? <Pressable onPress={load} style={styles.error}><Text style={styles.errorText}>{error} Retry</Text></Pressable> : null}
      <FlatList data={alerts} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.red} />} contentContainerStyle={!alerts.length ? styles.empty : undefined} renderItem={({ item }) => <View style={styles.row}><View style={[styles.ruleLine, { backgroundColor: item.active ? theme.red : theme.border }]} /><View style={styles.rowMain}><Text style={styles.name}>{item.name}</Text><Text style={styles.description}>{item.type.replaceAll('_', ' ')} · {item.vehicleImeis?.length ?? 0} vehicles</Text></View><Text style={[styles.state, { color: item.active ? theme.red : theme.muted }]}>{item.active ? 'Active' : 'Inactive'}</Text></View>} ListEmptyComponent={<View style={styles.emptyCopy}><TablerIcon name="bell" size={28} color={theme.muted} /><Text style={styles.emptyTitle}>{loading ? 'Loading alerts…' : 'No alert rules'}</Text><Text style={styles.emptySubtitle}>{loading ? '' : 'Alert rules for your organization will appear here.'}</Text></View>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 25, fontWeight: '700', color: theme.ink }, subtitle: { fontSize: 13, color: theme.secondary, marginTop: 4 }, refresh: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }, pushRow: { minHeight: 66, marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, pushTitle: { color: theme.ink, fontWeight: '600', fontSize: 13 }, pushSubtitle: { color: theme.secondary, fontSize: 11, marginTop: 4 }, enableButton: { minWidth: 72, height: 34, borderRadius: 7, borderWidth: 1, borderColor: theme.red, alignItems: 'center', justifyContent: 'center' }, enableText: { color: theme.red, fontWeight: '600', fontSize: 12 }, enabled: { color: theme.red, fontWeight: '600', fontSize: 12 }, row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderTopWidth: 1, borderColor: theme.border, gap: 12 }, ruleLine: { width: 3, height: 40 }, rowMain: { flex: 1 }, name: { color: theme.ink, fontSize: 14, fontWeight: '600' }, description: { color: theme.secondary, fontSize: 12, marginTop: 5, textTransform: 'capitalize' }, state: { fontSize: 12, fontWeight: '600' }, empty: { flexGrow: 1, justifyContent: 'center' }, emptyCopy: { alignItems: 'center', padding: 30 }, emptyTitle: { marginTop: 14, fontSize: 15, fontWeight: '600', color: theme.ink }, emptySubtitle: { marginTop: 6, fontSize: 12, color: theme.secondary, textAlign: 'center' }, error: { paddingHorizontal: 20, paddingBottom: 14 }, errorText: { color: theme.red, fontSize: 12 } });
