import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import api from '../../src/lib/api';
import { useFleet, getFleetStatus, displayVehicleName } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';

interface MileageRow { imei: string; plate: string | null; kmToday: number; }
interface AlertLog {
  id: string;
  alertName: string;
  alertType: string;
  vehiclePlate: string | null;
  timestamp: string;
}
interface Vehicle {
  id: string;
  licensePlate: string | null;
  subscriptionExpiresAt?: string | null;
}

function StatCard({ icon, value, label, color, t }: { icon: string; value: number; label: string; color: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.statCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <TablerIcon name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: t.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.secondary }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const t = useTheme();
  const { items, loading: fleetLoading } = useFleet();
  const [mileage, setMileage] = useState<MileageRow[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [expiryWarnings, setExpiryWarnings] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  const fetchExtras = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const [mileageRes, alertRes, vehicleRes] = await Promise.all([
        api.get<MileageRow[]>('/telemetry/fleet-mileage').catch(() => ({ data: [] })),
        api.get<AlertLog[]>('/alerts/logs?limit=50').catch(() => ({ data: [] })),
        api.get<Vehicle[]>('/vehicles').catch(() => ({ data: [] })),
      ]);
      if (seq !== requestSeq.current) return;
      setMileage(mileageRes.data);
      setAlertLogs(alertRes.data);
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      setExpiryWarnings(
        vehicleRes.data.filter(v => v.subscriptionExpiresAt && new Date(v.subscriptionExpiresAt) <= in30)
      );
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = async () => { if (active) await fetchExtras(); };
    void run();
    timer = setInterval(() => { void run(); }, 30_000);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && active) void run();
    });
    return () => { active = false; if (timer) clearInterval(timer); sub.remove(); requestSeq.current++; };
  }, [fetchExtras]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchExtras();
    setRefreshing(false);
  };

  // Fleet status counts
  const moving = items.filter(i => getFleetStatus(i.point) === 'moving').length;
  const idle = items.filter(i => getFleetStatus(i.point) === 'idle').length;
  const parked = items.filter(i => getFleetStatus(i.point) === 'parked').length;
  const offline = items.filter(i => getFleetStatus(i.point) === 'offline').length;
  const totalKm = mileage.reduce((s, r) => s + r.kmToday, 0);
  const geofenceAlerts = alertLogs.filter(l => l.alertType === 'geofence' || l.alertType === 'poi').slice(0, 5);
  const offlineLong = items.filter(i => {
    const pt = i.point;
    if (!pt) return true;
    return Date.now() - new Date(pt.timestamp).getTime() > 60 * 60_000;
  });

  if (fleetLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.loadingWrap}><ActivityIndicator color={t.red} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.red} />}
      >
        <Text style={[styles.title, { color: t.ink }]}>Dashboard</Text>

        {/* Expiry warning banner */}
        {expiryWarnings.length > 0 && (
          <View style={[styles.warningBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <TablerIcon name="alert-triangle" size={16} color="#d97706" />
            <Text style={styles.warningText}>
              {expiryWarnings.length} vehicle{expiryWarnings.length > 1 ? 's' : ''} subscription expiring soon
            </Text>
          </View>
        )}

        {/* Fleet status grid */}
        <Text style={[styles.sectionLabel, { color: t.secondary }]}>FLEET STATUS</Text>
        <View style={styles.statGrid}>
          <StatCard icon="navigation" value={moving} label="Moving" color="#16a34a" t={t} />
          <StatCard icon="clock" value={idle} label="Idle" color="#d97706" t={t} />
          <StatCard icon="parking" value={parked} label="Parked" color="#6b7280" t={t} />
          <StatCard icon="wifi-off" value={offline} label="Offline" color="#dc2626" t={t} />
        </View>

        {/* Daily mileage */}
        <Text style={[styles.sectionLabel, { color: t.secondary }]}>DAILY MILEAGE</Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.cardRow}>
            <TablerIcon name="gauge" size={18} color={t.red} />
            <Text style={[styles.cardBig, { color: t.ink }]}>{totalKm.toFixed(1)} km</Text>
            <Text style={[styles.cardSub, { color: t.secondary }]}>total today</Text>
          </View>
          {mileage.slice(0, 5).map(r => (
            <View key={r.imei} style={[styles.listRow, { borderTopColor: t.border }]}>
              <Text style={[styles.listPlate, { color: t.ink }]}>{r.plate ?? r.imei}</Text>
              <Text style={[styles.listKm, { color: t.red }]}>{r.kmToday.toFixed(1)} km</Text>
            </View>
          ))}
          {mileage.length === 0 && (
            <Text style={[styles.emptyText, { color: t.muted }]}>No trips recorded today</Text>
          )}
        </View>

        {/* Geofence events */}
        <Text style={[styles.sectionLabel, { color: t.secondary }]}>GEOFENCE EVENTS</Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {geofenceAlerts.length === 0 ? (
            <Text style={[styles.emptyText, { color: t.muted }]}>No geofence events today</Text>
          ) : geofenceAlerts.map(log => (
            <View key={log.id} style={[styles.listRow, { borderTopColor: t.border }]}>
              <View style={[styles.alertDot, { backgroundColor: '#dc2626' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.listPlate, { color: t.ink }]} numberOfLines={1}>{log.alertName}</Text>
                <Text style={[styles.listSub, { color: t.secondary }]}>{log.vehiclePlate ?? '—'}</Text>
              </View>
              <Text style={[styles.listTime, { color: t.muted }]}>
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </View>

        {/* Long offline vehicles */}
        {offlineLong.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: t.secondary }]}>OFFLINE VEHICLES</Text>
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              {offlineLong.slice(0, 5).map(item => (
                <View key={item.device.imei} style={[styles.listRow, { borderTopColor: t.border }]}>
                  <View style={[styles.alertDot, { backgroundColor: '#6b7280' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listPlate, { color: t.ink }]} numberOfLines={1}>
                      {item.vehicle?.licensePlate ?? displayVehicleName(item.vehicle)}
                    </Text>
                    <Text style={[styles.listSub, { color: t.secondary }]}>
                      {item.point
                        ? 'Last seen ' + formatAgo(item.point.timestamp)
                        : 'No data'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  title: { fontSize: 25, fontWeight: '700', marginBottom: 14 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.5, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  statGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '40%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 4 },
  warningText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400e' },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardBig: { fontSize: 20, fontWeight: '700' },
  cardSub: { fontSize: 12, marginLeft: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listPlate: { fontSize: 13, fontWeight: '600' },
  listKm: { marginLeft: 'auto', fontSize: 13, fontWeight: '700' },
  listSub: { fontSize: 11, marginTop: 1 },
  listTime: { fontSize: 11 },
  alertDot: { width: 7, height: 7, borderRadius: 4 },
  emptyText: { padding: 14, fontSize: 12, textAlign: 'center' },
});
