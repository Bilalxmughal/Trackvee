import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';

interface AlertRule { id: string; name: string; active: boolean; type: string; vehicleImeis?: string[]; }

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { canDo } = usePortalPermissions();
  useEffect(() => { if (!canDo('alerts')) router.replace('/map'); }, [canDo]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.get<AlertRule[]>('/alerts'); setAlerts(result.data); setError(''); }
    catch { setError('Alerts could not be loaded. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return (
    <View style={styles.container}>
      <View style={styles.header}><View><Text style={styles.title}>Alerts</Text><Text style={styles.subtitle}>Rules for your fleet</Text></View><Pressable onPress={load} accessibilityLabel="Refresh alerts" style={styles.refresh}><TablerIcon name="refresh" size={18} color={theme.ink} /></Pressable></View>
      {error ? <Pressable onPress={load} style={styles.error}><Text style={styles.errorText}>{error} Retry</Text></Pressable> : null}
      <FlatList data={alerts} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.red} />} contentContainerStyle={!alerts.length ? styles.empty : undefined} renderItem={({ item }) => <View style={styles.row}><View style={[styles.ruleLine, { backgroundColor: item.active ? theme.red : theme.border }]} /><View style={styles.rowMain}><Text style={styles.name}>{item.name}</Text><Text style={styles.description}>{item.type.replaceAll('_', ' ')} · {item.vehicleImeis?.length ?? 0} vehicles</Text></View><Text style={[styles.state, { color: item.active ? theme.red : theme.muted }]}>{item.active ? 'Active' : 'Inactive'}</Text></View>} ListEmptyComponent={<View style={styles.emptyCopy}><TablerIcon name="bell" size={28} color={theme.muted} /><Text style={styles.emptyTitle}>{loading ? 'Loading alerts…' : 'No alert rules'}</Text><Text style={styles.emptySubtitle}>{loading ? '' : 'Alert rules for your organization will appear here.'}</Text></View>} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 }, header: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 25, fontWeight: '700', color: theme.ink }, subtitle: { fontSize: 13, color: theme.secondary, marginTop: 4 }, refresh: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }, row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderTopWidth: 1, borderColor: theme.border, gap: 12 }, ruleLine: { width: 3, height: 40 }, rowMain: { flex: 1 }, name: { color: theme.ink, fontSize: 14, fontWeight: '600' }, description: { color: theme.secondary, fontSize: 12, marginTop: 5, textTransform: 'capitalize' }, state: { fontSize: 12, fontWeight: '600' }, empty: { flexGrow: 1, justifyContent: 'center' }, emptyCopy: { alignItems: 'center', padding: 30 }, emptyTitle: { marginTop: 14, fontSize: 15, fontWeight: '600', color: theme.ink }, emptySubtitle: { marginTop: 6, fontSize: 12, color: theme.secondary, textAlign: 'center' }, error: { paddingHorizontal: 20, paddingBottom: 14 }, errorText: { color: theme.red, fontSize: 12 } });
