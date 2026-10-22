import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Path } from 'react-native-svg';
import api from '../../src/lib/api';
import { useFleet, getFleetStatus, displayVehicleName } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';

interface MileageRow { imei: string; plate: string | null; kmToday: number; }
interface AlertLog { id: string; alertName: string; alertType: string; vehiclePlate: string | null; timestamp: string; }
interface Vehicle { id: string; licensePlate: string | null; subscriptionExpiresAt?: string | null; }

// ── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }: { data: { value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <View style={{ width: size, height: size }} />;
  const r = size / 2;
  const inner = r * 0.55;
  let angle = -Math.PI / 2;
  const segments: { d: string; color: string }[] = [];
  for (const seg of data) {
    if (seg.value === 0) continue;
    const sweep = (seg.value / total) * 2 * Math.PI;
    const x1 = r + r * Math.cos(angle);
    const y1 = r + r * Math.sin(angle);
    const x2 = r + r * Math.cos(angle + sweep);
    const y2 = r + r * Math.sin(angle + sweep);
    const ix1 = r + inner * Math.cos(angle);
    const iy1 = r + inner * Math.sin(angle);
    const ix2 = r + inner * Math.cos(angle + sweep);
    const iy2 = r + inner * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    segments.push({
      color: seg.color,
      d: `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`,
    });
    angle += sweep;
  }
  return (
    <Svg width={size} height={size}>
      {segments.map((s, i) => <Path key={i} d={s.d} fill={s.color} />)}
      <Circle cx={r} cy={r} r={inner * 0.8} fill="transparent" />
    </Svg>
  );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { flex: 1, height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

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
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setExpiryWarnings(vehicleRes.data.filter(v => v.subscriptionExpiresAt && new Date(v.subscriptionExpiresAt) <= in30));
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = async () => { if (active) await fetchExtras(); };
    void run();
    timer = setInterval(() => { void run(); }, 30_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && active) void run(); });
    return () => { active = false; if (timer) clearInterval(timer); sub.remove(); requestSeq.current++; };
  }, [fetchExtras]));

  const onRefresh = async () => { setRefreshing(true); await fetchExtras(); setRefreshing(false); };

  const moving  = items.filter(i => getFleetStatus(i.point) === 'moving').length;
  const idle    = items.filter(i => getFleetStatus(i.point) === 'idle').length;
  const parked  = items.filter(i => getFleetStatus(i.point) === 'parked').length;
  const offline = items.filter(i => getFleetStatus(i.point) === 'offline').length;
  const total   = items.length;

  const totalKm = mileage.reduce((s, r) => s + r.kmToday, 0);
  const maxKm   = mileage[0]?.kmToday ?? 1;
  const geofenceAlerts = alertLogs.filter(l => l.alertType === 'geofence' || l.alertType === 'poi');

  const offlineLong = items.filter(i => {
    const pt = i.point;
    return !pt || Date.now() - new Date(pt.timestamp).getTime() > 60 * 60_000;
  });

  const donutData = [
    { value: moving,  color: '#16a34a' },
    { value: idle,    color: '#f59e0b' },
    { value: parked,  color: '#6b7280' },
    { value: offline, color: '#dc2626' },
  ];

  const STATUSES = [
    { label: 'Moving',  value: moving,  color: '#16a34a', icon: 'navigation' },
    { label: 'Idle',    value: idle,    color: '#f59e0b', icon: 'clock' },
    { label: 'Parked',  value: parked,  color: '#6b7280', icon: 'parking' },
    { label: 'Offline', value: offline, color: '#dc2626', icon: 'wifi-off' },
  ];

  if (fleetLoading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={t.red} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.red} />}
      >
        <Text style={[s.title, { color: t.ink }]}>Dashboard</Text>

        {/* Expiry banner */}
        {expiryWarnings.length > 0 && (
          <View style={[s.banner, { backgroundColor: '#fef3c7' }]}>
            <TablerIcon name="alert-triangle" size={15} color="#d97706" />
            <Text style={s.bannerText}>{expiryWarnings.length} vehicle{expiryWarnings.length > 1 ? 's' : ''} subscription expiring soon</Text>
          </View>
        )}

        {/* ── Fleet Overview card ── */}
        <Card t={t} style={{ marginBottom: 14 }}>
          <Text style={[s.cardTitle, { color: t.ink }]}>Fleet Overview</Text>
          <View style={s.overviewRow}>
            {/* Donut */}
            <View style={s.donutWrap}>
              <DonutChart data={donutData} size={110} />
              <View style={s.donutCenter}>
                <Text style={[s.donutTotal, { color: t.ink }]}>{total}</Text>
                <Text style={[s.donutLabel, { color: t.secondary }]}>Total</Text>
              </View>
            </View>
            {/* Legend */}
            <View style={s.legend}>
              {STATUSES.map(st => (
                <View key={st.label} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: st.color }]} />
                  <TablerIcon name={st.icon} size={14} color={st.color} />
                  <Text style={[s.legendLabel, { color: t.ink }]}>{st.label}</Text>
                  <Text style={[s.legendVal, { color: st.color }]}>{st.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* ── Daily Mileage card ── */}
        <Card t={t} style={{ marginBottom: 14 }}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <View style={[s.iconBadge, { backgroundColor: '#dc262618' }]}>
                <TablerIcon name="gauge" size={16} color={t.red} />
              </View>
              <Text style={[s.cardTitle, { color: t.ink }]}>Daily Mileage</Text>
            </View>
            <Text style={[s.cardBig, { color: t.red }]}>{totalKm.toFixed(0)} <Text style={[s.cardBigUnit, { color: t.secondary }]}>km</Text></Text>
          </View>

          {mileage.length === 0
            ? <Text style={[s.empty, { color: t.muted }]}>No trips recorded today</Text>
            : <>
              {mileage.slice(0, 5).map(r => (
                <View key={r.imei} style={[s.listRow, { borderTopColor: t.border }]}>
                  <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>{r.plate ?? r.imei}</Text>
                  <View style={s.barCell}>
                    <MiniBar value={r.kmToday} max={maxKm} color={t.red} />
                  </View>
                  <Text style={[s.listKm, { color: t.red }]}>{r.kmToday.toFixed(1)}</Text>
                </View>
              ))}
              {mileage.length > 5 && (
                <Pressable style={s.viewAll} onPress={() => router.push('/reports')}>
                  <Text style={[s.viewAllText, { color: t.red }]}>View All ({mileage.length})</Text>
                  <TablerIcon name="chevron-right" size={14} color={t.red} />
                </Pressable>
              )}
            </>
          }
        </Card>

        {/* ── Geofence Events card ── */}
        {geofenceAlerts.length > 0 && (
          <Card t={t} style={{ marginBottom: 14 }}>
            <View style={s.cardHeader}>
              <View style={s.cardTitleRow}>
                <View style={[s.iconBadge, { backgroundColor: '#7c3aed18' }]}>
                  <TablerIcon name="geofence" size={16} color="#7c3aed" />
                </View>
                <Text style={[s.cardTitle, { color: t.ink }]}>Geofence Events</Text>
              </View>
              <Text style={[s.cardCount, { color: '#7c3aed' }]}>{geofenceAlerts.length}</Text>
            </View>
            {geofenceAlerts.slice(0, 5).map(log => (
              <View key={log.id} style={[s.listRow, { borderTopColor: t.border }]}>
                <View style={[s.alertDot, { backgroundColor: '#7c3aed' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>{log.alertName}</Text>
                  <Text style={[s.listSub, { color: t.secondary }]}>{log.vehiclePlate ?? '—'}</Text>
                </View>
                <Text style={[s.listTime, { color: t.muted }]}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
            {geofenceAlerts.length > 5 && (
              <Pressable style={s.viewAll} onPress={() => router.push('/alerts')}>
                <Text style={[s.viewAllText, { color: '#7c3aed' }]}>View All ({geofenceAlerts.length})</Text>
                <TablerIcon name="chevron-right" size={14} color="#7c3aed" />
              </Pressable>
            )}
          </Card>
        )}

        {/* ── Offline Vehicles card ── */}
        {offlineLong.length > 0 && (
          <Card t={t} style={{ marginBottom: 14 }}>
            <View style={s.cardHeader}>
              <View style={s.cardTitleRow}>
                <View style={[s.iconBadge, { backgroundColor: '#dc262618' }]}>
                  <TablerIcon name="wifi-off" size={16} color="#dc2626" />
                </View>
                <Text style={[s.cardTitle, { color: t.ink }]}>Offline Vehicles</Text>
              </View>
              <Text style={[s.cardCount, { color: '#dc2626' }]}>{offlineLong.length}</Text>
            </View>
            {offlineLong.slice(0, 5).map(item => (
              <View key={item.device.imei} style={[s.listRow, { borderTopColor: t.border }]}>
                <View style={[s.alertDot, { backgroundColor: '#6b7280' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>
                    {item.vehicle?.licensePlate ?? displayVehicleName(item.vehicle)}
                  </Text>
                  <Text style={[s.listSub, { color: t.secondary }]}>
                    {item.point ? 'Last seen ' + formatAgo(item.point.timestamp) : 'No data received'}
                  </Text>
                </View>
              </View>
            ))}
            {offlineLong.length > 5 && (
              <Pressable style={s.viewAll} onPress={() => router.push('/map')}>
                <Text style={[s.viewAllText, { color: '#dc2626' }]}>View All ({offlineLong.length})</Text>
                <TablerIcon name="chevron-right" size={14} color="#dc2626" />
              </Pressable>
            )}
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children, t, style }: { children: React.ReactNode; t: ReturnType<typeof useTheme>; style?: object }) {
  return (
    <View style={[s.card, { backgroundColor: t.card, shadowColor: '#000' }, style]}>
      {children}
    </View>
  );
}

function formatAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  title: { fontSize: 25, fontWeight: '700', marginBottom: 14 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 11, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400e' },

  card: {
    borderRadius: 16, overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardBig: { fontSize: 22, fontWeight: '800' },
  cardBigUnit: { fontSize: 14, fontWeight: '500' },
  cardCount: { fontSize: 20, fontWeight: '800' },

  iconBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Fleet overview
  overviewRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
  donutWrap: { width: 110, height: 110, position: 'relative' },
  donutCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  donutTotal: { fontSize: 22, fontWeight: '800' },
  donutLabel: { fontSize: 10, fontWeight: '500', marginTop: -1 },
  legend: { flex: 1, gap: 9 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  legendVal: { fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'right' },

  // List rows
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listPrimary: { fontSize: 13, fontWeight: '600', minWidth: 80 },
  barCell: { flex: 1 },
  listKm: { fontSize: 13, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  listSub: { fontSize: 11, marginTop: 1 },
  listTime: { fontSize: 11 },
  alertDot: { width: 7, height: 7, borderRadius: 4 },
  empty: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 12, textAlign: 'center' },

  viewAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
});
