import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import api from '../../src/lib/api';
import { useFleet, getFleetStatus, displayVehicleName } from '../../src/hooks/useFleet';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';

interface MileageRow { imei: string; plate: string | null; kmToday: number; }
interface AlertLog { id: string; alertName: string; alertType: string; vehiclePlate: string | null; timestamp: string; }
interface Vehicle { id: string; licensePlate: string | null; subscriptionExpiresAt?: string | null; }
interface MaintenanceItem {
  id: string; serviceType: string; status: string;
  vehicle: { id: string; licensePlate: string | null; name: string | null } | null;
  nextDueDate?: string | null;
}

// ── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 110 }: { data: { value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <View style={{ width: size, height: size }} />;
  const r = size / 2;
  const inner = r * 0.56;
  let angle = -Math.PI / 2;
  const segments: { d: string; color: string }[] = [];
  for (const seg of data) {
    if (seg.value === 0) continue;
    const sweep = (seg.value / total) * 2 * Math.PI;
    const clamp = Math.min(sweep, 2 * Math.PI - 0.001);
    const x1 = r + r * Math.cos(angle), y1 = r + r * Math.sin(angle);
    const x2 = r + r * Math.cos(angle + clamp), y2 = r + r * Math.sin(angle + clamp);
    const ix1 = r + inner * Math.cos(angle), iy1 = r + inner * Math.sin(angle);
    const ix2 = r + inner * Math.cos(angle + clamp), iy2 = r + inner * Math.sin(angle + clamp);
    const large = clamp > Math.PI ? 1 : 0;
    segments.push({ color: seg.color, d: `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z` });
    angle += sweep;
  }
  return (
    <Svg width={size} height={size}>
      {segments.map((seg, i) => <Path key={i} d={seg.d} fill={seg.color} />)}
    </Svg>
  );
}

// ── Mini horizontal bar ──────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={bs.track}>
      <View style={[bs.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const bs = StyleSheet.create({
  track: { flex: 1, height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

// ── Activity heatmap (24h bar chart) ─────────────────────────────────────────
function HeatmapChart({ counts, t }: { counts: number[]; t: ReturnType<typeof useTheme> }) {
  const max = Math.max(...counts, 1);
  const now = new Date().getHours();
  return (
    <View style={hs.wrap}>
      {counts.map((c, h) => {
        const pct = c / max;
        const past = h < now;
        const color = c === 0 ? (past ? '#e5e7eb' : '#f3f4f6') : `rgba(220,38,38,${0.2 + pct * 0.8})`;
        return (
          <View key={h} style={hs.col}>
            <View style={[hs.bar, { height: Math.max(4, pct * 44), backgroundColor: color }]} />
            {h % 6 === 0 && <Text style={[hs.label, { color: t.muted }]}>{h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}</Text>}
          </View>
        );
      })}
    </View>
  );
}
const hs = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 16, paddingBottom: 4 },
  col: { flex: 1, alignItems: 'center', gap: 3 },
  bar: { width: '100%', borderRadius: 2, minHeight: 4 },
  label: { fontSize: 8 },
});

// ── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, t, style }: { children: React.ReactNode; t: ReturnType<typeof useTheme>; style?: object }) {
  return (
    <View style={[s.cardShadow, style]}>
      <View style={[s.card, { backgroundColor: t.card }]}>{children}</View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const t = useTheme();
  const { items, loading: fleetLoading } = useFleet();
  const [mileage, setMileage] = useState<MileageRow[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [expiryWarnings, setExpiryWarnings] = useState<Vehicle[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const fetchExtras = useCallback(async () => {
    const id = ++seq.current;
    try {
      const [mRes, aRes, vRes, mxRes] = await Promise.all([
        api.get<MileageRow[]>('/telemetry/fleet-mileage').catch(() => ({ data: [] })),
        api.get<AlertLog[]>('/alerts/logs?limit=200').catch(() => ({ data: [] })),
        api.get<Vehicle[]>('/vehicles').catch(() => ({ data: [] })),
        api.get<MaintenanceItem[]>('/maintenance').catch(() => ({ data: [] })),
      ]);
      if (id !== seq.current) return;
      setMileage(mRes.data);
      setAlertLogs(aRes.data);
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setExpiryWarnings(vRes.data.filter(v => v.subscriptionExpiresAt && new Date(v.subscriptionExpiresAt) <= in30));
      setMaintenance(mxRes.data.filter(m => m.status === 'overdue' || m.status === 'upcoming'));
    } catch { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const run = async () => { if (active) await fetchExtras(); };
    void run();
    const timer = setInterval(() => { void run(); }, 30_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && active) void run(); });
    return () => { active = false; clearInterval(timer); sub.remove(); seq.current++; };
  }, [fetchExtras]));

  const onRefresh = async () => { setRefreshing(true); await fetchExtras(); setRefreshing(false); };

  // Fleet counts
  const moving  = items.filter(i => getFleetStatus(i.point) === 'moving').length;
  const idle    = items.filter(i => getFleetStatus(i.point) === 'idle').length;
  const parked  = items.filter(i => getFleetStatus(i.point) === 'parked').length;
  const offline = items.filter(i => getFleetStatus(i.point) === 'offline').length;
  const total   = items.length;

  // Speeding — vehicles currently >80 km/h, sorted desc
  const speeding = items
    .filter(i => i.point && getFleetStatus(i.point) === 'moving' && (i.point.speedKmh ?? 0) > 80)
    .sort((a, b) => (b.point?.speedKmh ?? 0) - (a.point?.speedKmh ?? 0));

  // Daily mileage
  const totalKm = mileage.reduce((s, r) => s + r.kmToday, 0);
  const maxKm   = mileage[0]?.kmToday ?? 1;

  // Alerts breakdown
  const geofenceAlerts = alertLogs.filter(l => l.alertType === 'geofence' || l.alertType === 'poi');
  const speedAlerts    = alertLogs.filter(l => l.alertType === 'speed');
  const otherAlerts    = alertLogs.filter(l => l.alertType !== 'geofence' && l.alertType !== 'poi' && l.alertType !== 'speed');

  // Offline vehicles (>1h)
  const offlineLong = items.filter(i => !i.point || Date.now() - new Date(i.point.timestamp).getTime() > 60 * 60_000);

  // 24h heatmap — count alert logs per hour today
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const hourlyCounts = Array.from({ length: 24 }, (_, h) =>
    alertLogs.filter(l => {
      const d = new Date(l.timestamp);
      return d >= todayStart && d.getHours() === h;
    }).length
  );

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

        {/* ── Fleet Overview ── */}
        <SectionLabel label="Fleet Overview" t={t} />
        <Card t={t} style={{ marginBottom: 14 }}>
          <View style={s.overviewRow}>
            <View style={s.donutWrap}>
              <DonutChart data={donutData} size={110} />
              <View style={s.donutCenter}>
                <Text style={[s.donutTotal, { color: t.ink }]}>{total}</Text>
                <Text style={[s.donutLabel, { color: t.secondary }]}>Total</Text>
              </View>
            </View>
            <View style={s.legend}>
              {STATUSES.map(st => (
                <View key={st.label} style={s.legendRow}>
                  <View style={[s.dot8, { backgroundColor: st.color }]} />
                  <TablerIcon name={st.icon} size={13} color={st.color} />
                  <Text style={[s.legendLabel, { color: t.ink }]}>{st.label}</Text>
                  <Text style={[s.legendVal, { color: st.color }]}>{st.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* ── Active Alerts Count ── */}
        <SectionLabel label="Active Alerts Today" t={t} />
        <View style={[s.alertGrid, { marginBottom: 14 }]}>
          {[
            { label: 'Geofence', count: geofenceAlerts.length, color: '#7c3aed', icon: 'geofence' },
            { label: 'Speed',    count: speedAlerts.length,    color: '#dc2626', icon: 'gauge' },
            { label: 'Other',    count: otherAlerts.length,    color: '#0369a1', icon: 'bell' },
            { label: 'Total',    count: alertLogs.length,      color: '#374151', icon: 'activity' },
          ].map(item => (
            <Pressable key={item.label} style={[s.alertTile, s.cardShadow, { backgroundColor: t.card }]} onPress={() => router.push('/alerts')}>
              <View style={[s.alertIconWrap, { backgroundColor: item.color + '15' }]}>
                <TablerIcon name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[s.alertCount, { color: item.color }]}>{item.count}</Text>
              <Text style={[s.alertLabel, { color: t.secondary }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Fleet Activity Heatmap ── */}
        <SectionLabel label="Activity Today (24h)" t={t} />
        <Card t={t} style={{ marginBottom: 14 }}>
          <View style={{ paddingTop: 14, paddingBottom: 10 }}>
            <View style={s.heatHeader}>
              <Text style={[s.heatTotal, { color: t.ink }]}>{alertLogs.length} <Text style={[s.heatUnit, { color: t.secondary }]}>events</Text></Text>
              <Text style={[s.heatSub, { color: t.muted }]}>Hourly alert activity</Text>
            </View>
            <HeatmapChart counts={hourlyCounts} t={t} />
          </View>
        </Card>

        {/* ── Daily Mileage ── */}
        <SectionLabel label="Daily Mileage" t={t} />
        <Card t={t} style={{ marginBottom: 14 }}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <View style={[s.iconBadge, { backgroundColor: '#dc262618' }]}>
                <TablerIcon name="gauge" size={16} color={t.red} />
              </View>
              <Text style={[s.cardTitle, { color: t.ink }]}>Total</Text>
            </View>
            <Text style={[s.bigNum, { color: t.red }]}>{totalKm.toFixed(0)} <Text style={[s.bigUnit, { color: t.secondary }]}>km</Text></Text>
          </View>
          {mileage.length === 0
            ? <Text style={[s.empty, { color: t.muted }]}>No trips recorded today</Text>
            : <>
              {mileage.slice(0, 5).map(r => (
                <View key={r.imei} style={[s.listRow, { borderTopColor: t.border }]}>
                  <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>{r.plate ?? r.imei}</Text>
                  <View style={s.barCell}><MiniBar value={r.kmToday} max={maxKm} color={t.red} /></View>
                  <Text style={[s.listKm, { color: t.red }]}>{r.kmToday.toFixed(1)}</Text>
                </View>
              ))}
              {mileage.length > 5 && <ViewAllBtn label={`View All (${mileage.length})`} color={t.red} onPress={() => router.push('/reports')} t={t} />}
            </>
          }
        </Card>

        {/* ── Top Speeding Vehicles ── */}
        {speeding.length > 0 && (
          <>
            <SectionLabel label="Speeding Now" t={t} />
            <Card t={t} style={{ marginBottom: 14 }}>
              <View style={s.cardHeader}>
                <View style={s.cardTitleRow}>
                  <View style={[s.iconBadge, { backgroundColor: '#dc262618' }]}>
                    <TablerIcon name="navigation" size={16} color="#dc2626" />
                  </View>
                  <Text style={[s.cardTitle, { color: t.ink }]}>Over 80 km/h</Text>
                </View>
                <Text style={[s.bigNum, { color: '#dc2626' }]}>{speeding.length}</Text>
              </View>
              {speeding.slice(0, 5).map(item => {
                const spd = Math.round(item.point?.speedKmh ?? 0);
                const maxSpd = Math.round(speeding[0]?.point?.speedKmh ?? 1);
                return (
                  <View key={item.device.imei} style={[s.listRow, { borderTopColor: t.border }]}>
                    <View style={[s.dot7, { backgroundColor: spd > 120 ? '#dc2626' : '#f59e0b' }]} />
                    <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>
                      {item.vehicle?.licensePlate ?? displayVehicleName(item.vehicle)}
                    </Text>
                    <View style={s.barCell}><MiniBar value={spd} max={maxSpd} color={spd > 120 ? '#dc2626' : '#f59e0b'} /></View>
                    <Text style={[s.listKm, { color: spd > 120 ? '#dc2626' : '#f59e0b' }]}>{spd} km/h</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* ── Maintenance Due ── */}
        {maintenance.length > 0 && (
          <>
            <SectionLabel label="Maintenance Due" t={t} />
            <Card t={t} style={{ marginBottom: 14 }}>
              <View style={s.cardHeader}>
                <View style={s.cardTitleRow}>
                  <View style={[s.iconBadge, { backgroundColor: '#d9770618' }]}>
                    <TablerIcon name="tool" size={16} color="#d97706" />
                  </View>
                  <Text style={[s.cardTitle, { color: t.ink }]}>Service Alerts</Text>
                </View>
                <Text style={[s.bigNum, { color: '#d97706' }]}>{maintenance.length}</Text>
              </View>
              {maintenance.slice(0, 5).map(m => (
                <View key={m.id} style={[s.listRow, { borderTopColor: t.border }]}>
                  <View style={[s.dot7, { backgroundColor: m.status === 'overdue' ? '#dc2626' : '#f59e0b' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>
                      {m.vehicle?.licensePlate ?? m.vehicle?.name ?? '—'}
                    </Text>
                    <Text style={[s.listSub, { color: t.secondary }]}>{m.serviceType}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: m.status === 'overdue' ? '#fee2e2' : '#fef3c7' }]}>
                    <Text style={[s.statusText, { color: m.status === 'overdue' ? '#dc2626' : '#d97706' }]}>
                      {m.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                    </Text>
                  </View>
                </View>
              ))}
              {maintenance.length > 5 && <ViewAllBtn label={`View All (${maintenance.length})`} color="#d97706" onPress={() => router.push('/maintenance')} t={t} />}
            </Card>
          </>
        )}

        {/* ── Geofence Events ── */}
        {geofenceAlerts.length > 0 && (
          <>
            <SectionLabel label="Geofence Events" t={t} />
            <Card t={t} style={{ marginBottom: 14 }}>
              {geofenceAlerts.slice(0, 5).map(log => (
                <View key={log.id} style={[s.listRow, { borderTopColor: t.border }]}>
                  <View style={[s.dot7, { backgroundColor: '#7c3aed' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listPrimary, { color: t.ink }]} numberOfLines={1}>{log.alertName}</Text>
                    <Text style={[s.listSub, { color: t.secondary }]}>{log.vehiclePlate ?? '—'}</Text>
                  </View>
                  <Text style={[s.listTime, { color: t.muted }]}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
              {geofenceAlerts.length > 5 && <ViewAllBtn label={`View All (${geofenceAlerts.length})`} color="#7c3aed" onPress={() => router.push('/alerts')} t={t} />}
            </Card>
          </>
        )}

        {/* ── Offline Vehicles ── */}
        {offlineLong.length > 0 && (
          <>
            <SectionLabel label="Offline Vehicles" t={t} />
            <Card t={t} style={{ marginBottom: 14 }}>
              {offlineLong.slice(0, 5).map(item => (
                <View key={item.device.imei} style={[s.listRow, { borderTopColor: t.border }]}>
                  <View style={[s.dot7, { backgroundColor: '#6b7280' }]} />
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
              {offlineLong.length > 5 && <ViewAllBtn label={`View All (${offlineLong.length})`} color="#6b7280" onPress={() => router.push('/vehicles')} t={t} />}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return <Text style={[s.sectionLabel, { color: t.secondary }]}>{label.toUpperCase()}</Text>;
}

function ViewAllBtn({ label, color, onPress, t }: { label: string; color: string; onPress: () => void; t: ReturnType<typeof useTheme> }) {
  return (
    <Pressable style={[s.viewAll, { borderTopColor: t.border }]} onPress={onPress}>
      <Text style={[s.viewAllText, { color }]}>{label}</Text>
      <TablerIcon name="chevron-right" size={14} color={color} />
    </Pressable>
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
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
  title: { fontSize: 25, fontWeight: '700', marginBottom: 12 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.6, fontWeight: '700', marginBottom: 8, marginTop: 4 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 11, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400e' },

  cardShadow: { borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4 },
  card: { borderRadius: 16, overflow: 'hidden' },

  // Overview
  overviewRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  donutWrap: { width: 110, height: 110, position: 'relative' },
  donutCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  donutTotal: { fontSize: 22, fontWeight: '800' },
  donutLabel: { fontSize: 10, fontWeight: '500' },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  legendVal: { fontSize: 16, fontWeight: '700', minWidth: 26, textAlign: 'right' },

  // Alert tiles
  alertGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  alertTile: { flex: 1, minWidth: '40%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 5 },
  alertIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertCount: { fontSize: 22, fontWeight: '800' },
  alertLabel: { fontSize: 11, fontWeight: '500' },

  // Heatmap
  heatHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  heatTotal: { fontSize: 20, fontWeight: '800' },
  heatUnit: { fontSize: 13, fontWeight: '500' },
  heatSub: { fontSize: 11 },

  // Card internals
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  iconBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bigNum: { fontSize: 20, fontWeight: '800' },
  bigUnit: { fontSize: 13, fontWeight: '500' },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listPrimary: { fontSize: 13, fontWeight: '600', minWidth: 70 },
  barCell: { flex: 1 },
  listKm: { fontSize: 12, fontWeight: '700', minWidth: 52, textAlign: 'right' },
  listSub: { fontSize: 11, marginTop: 1 },
  listTime: { fontSize: 11 },
  dot7: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  empty: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 12, textAlign: 'center' },

  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  viewAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  viewAllText: { fontSize: 13, fontWeight: '600' },
});
