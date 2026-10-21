import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconUsers, IconBuildingSkyscraper, IconCar, IconCpu, IconBell, IconZzz, IconParking, IconWifi, IconWifiOff, IconKey, IconKeyOff, IconAlertTriangle, IconActivity, IconRefresh, IconCheck, IconX, IconTrendingUp, IconCalendarAlert } from '@tabler/icons-react';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useTheme } from '../contexts/ThemeContext';
import DateRangePicker, { type DateRange } from '../components/DateRangePicker';

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Stats { users: number; organizations: number; vehicles: number; devices: number; }
interface LivePoint { imei: string; speedKmh: number; ignition?: boolean | null; timestamp: string; }
interface ExpiringDevice { id: string; imei: string; expiresAt: string; vehicleLicensePlate: string | null; vehicleName: string | null; }
interface DeviceHealthRow {
  deviceId: string; imei: string;
  connection: 'online' | 'delayed' | 'offline' | 'never_seen';
  lastPacketAt: string | null; gsmSignal: number | null; voltageLevel: string | null;
  issues: string[]; vehicle?: { licensePlate: string | null } | null;
}
interface AlertRow { id: string; name: string; type: string; active: boolean; }
interface ClientRow {
  id: string; displayId?: number; name: string; type?: string;
  companyName?: string | null; isActive: boolean; createdAt: string;
  vehicleCount: number; deviceCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(): { text: string; sub: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', sub: 'Hope your day is going well.' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', sub: 'Stay focused, you got this.' };
  if (h >= 17 && h < 21) return { text: 'Good evening', sub: 'Wrapping up for the day?' };
  return { text: 'Up late?', sub: 'Take it easy, you deserve rest.' };
}

function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'parked' | 'offline' {
  const age = (Date.now() - new Date(pt.timestamp).getTime()) / 60000;
  if (age > 10) return 'offline';
  if (pt.speedKmh >= 5) return 'moving';
  if (pt.ignition) return 'idle';
  return 'parked';
}

function clientHealthScore(c: ClientRow): { score: number; label: string; color: string } {
  if (!c.isActive) return { score: 0, label: 'Inactive', color: '#9ca3af' };
  const hasVehicles = c.vehicleCount > 0;
  const hasDevices = c.deviceCount > 0;
  if (hasVehicles && hasDevices) return { score: 100, label: 'Healthy', color: '#16a34a' };
  if (hasVehicles || hasDevices) return { score: 50, label: 'Partial', color: '#f59e0b' };
  return { score: 10, label: 'Empty', color: '#dc2626' };
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Charts ────────────────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#aaa' }}>No data</div>
  );
  const r = 45; const cx = 60; const cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const dash = (d.value / total) * circumference;
    const slice = { ...d, dash, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth="18"/>
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="18"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset + circumference * 0.25}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}/>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#aaa">VEHICLES</text>
    </svg>
  );
}

function HealthBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: '100%', height: 5, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }}/>
    </div>
  );
}

function MiniBar({ data, dark }: { data: { label: string; value: number; color: string }[]; dark: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 80, fontSize: 11, color: dark ? '#aaa' : '#777', textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>{d.label.replace(/_/g, ' ')}</div>
          <div style={{ flex: 1, height: 16, background: dark ? '#2a2a2a' : '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: d.color, borderRadius: 4, transition: 'width 0.5s ease', minWidth: d.value > 0 ? 4 : 0 }}/>
          </div>
          <div style={{ width: 24, fontSize: 11, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', flexShrink: 0, textAlign: 'right' }}>{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function SignalBars({ level, color }: { level: number; color: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10">
      {[1, 2, 3, 4].map((b, i) => (
        <rect key={b} x={i * 3.5} y={10 - b * 2.2} width="2.5" height={b * 2.2} rx="0.5" fill={level >= b ? color : '#e5e7eb'}/>
      ))}
    </svg>
  );
}

function TrendPill({ value, total, color }: { value: number; total: number; color: string }) {
  if (!total) return null;
  const pct = Math.round((value / total) * 100);
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '18', borderRadius: 20, padding: '2px 7px' }}>{pct}%</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [livePoints, setLivePoints] = useState<LivePoint[]>([]);
  const [devices, setDevices] = useState<DeviceHealthRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [agoTick, setAgoTick] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { user } = useAuth();
  const { selectedCityId } = useCityFilter();
  const { dark } = useTheme();
  const { text, sub } = getGreeting();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback((silent = false) => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    if (!silent) setLoading(true); else setRefreshing(true);
    Promise.all([
      api.get<{ id: string }[]>(`/users${p}`),
      api.get<ClientRow[]>(`/organizations${p}`),
      api.get<{ id: string }[]>(`/vehicles${p}`),
      api.get<{ id: string }[]>(`/devices${p}`),
      api.get<LivePoint[]>('/telemetry/live'),
      api.get<DeviceHealthRow[]>(`/telemetry/device-health${p}`),
      api.get<AlertRow[]>('/alerts'),
      api.get<ExpiringDevice[]>('/devices/expiring?days=30').catch(() => ({ data: [] })),
    ]).then(([u, o, v, d, live, devFull, al, exp]) => {
      const orgs = Array.isArray(o.data) ? o.data : [];
      setStats({ users: Array.isArray(u.data) ? u.data.length : 0, organizations: orgs.length, vehicles: Array.isArray(v.data) ? v.data.length : 0, devices: Array.isArray(d.data) ? d.data.length : 0 });
      setClients(orgs);
      setLivePoints(Array.isArray(live.data) ? live.data : []);
      setDevices(Array.isArray(devFull.data) ? devFull.data : []);
      setAlerts(Array.isArray(al.data) ? al.data : []);
      setExpiring(Array.isArray(exp.data) ? exp.data : []);
      setLastRefreshed(Date.now());
    }).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [selectedCityId]);

  // Initial load
  useEffect(() => { fetchAll(false); }, [fetchAll]);

  // ── Auto-refresh every 60s ───────────────────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchAll(true), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  // Tick "ago" label every 10s
  useEffect(() => {
    const t = setInterval(() => setAgoTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // ── Date-filtered clients ────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!dateRange?.from) return clients;
    return clients.filter(c => {
      try {
        return isWithinInterval(parseISO(c.createdAt), {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to ?? dateRange.from!),
        });
      } catch { return true; }
    });
  }, [clients, dateRange]);

  // ── Computed stats ───────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
    livePoints.forEach(pt => counts[vehicleStatus(pt)]++);
    return counts;
  }, [livePoints]);

  const ignitionCounts = useMemo(() => {
    let on = 0, off = 0;
    livePoints.forEach(pt => {
      const age = (Date.now() - new Date(pt.timestamp).getTime()) / 60000;
      if (age > 10) return;
      if (pt.ignition) on++; else off++;
    });
    return { on, off };
  }, [livePoints]);

  const activeVehicles = livePoints.filter(pt => (Date.now() - new Date(pt.timestamp).getTime()) / 60000 <= 10).length;
  const inactiveVehicles = Math.max(0, (stats?.vehicles ?? 0) - activeVehicles);

  const deviceHealth = useMemo(() => ({
    online: devices.filter(d => d.connection === 'online').length,
    delayed: devices.filter(d => d.connection === 'delayed').length,
    offline: devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length,
    issues: devices.filter(d => d.issues.length > 0).length,
  }), [devices]);

  const alertTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    return counts;
  }, [alerts]);

  const alertBarData = Object.entries(alertTypeCounts)
    .map(([type, value]) => ({ label: type, value, color: '#dc2626' }))
    .sort((a, b) => b.value - a.value).slice(0, 7);

  const donutData = [
    { label: 'Moving', value: statusCounts.moving, color: '#16a34a' },
    { label: 'Idle', value: statusCounts.idle, color: '#f59e0b' },
    { label: 'Parked', value: statusCounts.parked, color: '#6b7280' },
    { label: 'Offline', value: statusCounts.offline, color: '#d1d5db' },
  ];
  const totalLive = activeVehicles;

  // Client breakdown stats
  const clientStats = useMemo(() => {
    const active = filteredClients.filter(c => c.isActive).length;
    const inactive = filteredClients.length - active;
    const healthy = filteredClients.filter(c => clientHealthScore(c).label === 'Healthy').length;
    const partial = filteredClients.filter(c => clientHealthScore(c).label === 'Partial').length;
    const empty = filteredClients.filter(c => clientHealthScore(c).label === 'Empty').length;
    return { active, inactive, healthy, partial, empty };
  }, [filteredClients]);

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card = { padding: '18px 20px', background: dark ? 'var(--bg2)' : '#fff', borderRadius: 12, border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)' };
  const sectionLabel = { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 14 };

  const agoLabel = fmtAgo(Date.now() - lastRefreshed) || '';
  void agoTick;

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* ── Greeting + Controls ── */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)' }}>{text}, {fullName} 👋</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filter by date" />
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 5, background: dark ? '#1a1a1a' : '#fff', color: refreshing ? '#dc2626' : (dark ? '#aaa' : '#555'), fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <IconRefresh size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
            Refresh
          </button>
          <div style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 5 }}>
            {loading ? <><IconActivity size={12}/> Loading...</> : <><IconCheck size={12} color="#16a34a"/> Updated {agoLabel}</>}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Row 1: KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard icon={<IconBuildingSkyscraper size={20} color="#dc2626"/>} label="Total Clients" value={stats?.organizations} dark={dark}/>
        <KpiCard icon={<IconCar size={20} color="#2563eb"/>} label="Total Vehicles" value={stats?.vehicles}
          sub={<span style={{ fontSize: 11, color: '#aaa' }}><span style={{ color: '#16a34a', fontWeight: 600 }}>{activeVehicles} active</span> · <span style={{ color: '#9ca3af' }}>{inactiveVehicles} inactive</span></span>} dark={dark}/>
        <KpiCard icon={<IconCpu size={20} color="#7c3aed"/>} label="Devices" value={stats?.devices}
          sub={<TrendPill value={deviceHealth.online} total={stats?.devices ?? 0} color="#16a34a"/>} dark={dark}/>
        <KpiCard icon={<IconUsers size={20} color="#0891b2"/>} label="Total Users" value={stats?.users} dark={dark}/>
        <KpiCard icon={<IconBell size={20} color="#f59e0b"/>} label="Alert Rules" value={alerts.length}
          sub={<span style={{ fontSize: 11, color: '#aaa' }}><span style={{ color: '#16a34a', fontWeight: 600 }}>{alerts.filter(a => a.active).length} active</span></span>} dark={dark}/>
      </div>

      {/* ── Row 2: Vehicle Status Pill Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatusCard icon={<IconKey size={18} color="#16a34a"/>} label="Ignition ON" value={ignitionCounts.on} color="#16a34a" dark={dark}/>
        <StatusCard icon={<IconKeyOff size={18} color="#6b7280"/>} label="Ignition OFF" value={ignitionCounts.off} color="#6b7280" dark={dark}/>
        <StatusCard icon={<IconCar size={18} color="#16a34a"/>} label="Moving" value={statusCounts.moving} color="#16a34a" dark={dark}/>
        <StatusCard icon={<IconZzz size={18} color="#f59e0b"/>} label="Idle" value={statusCounts.idle} color="#f59e0b" dark={dark}/>
        <StatusCard icon={<IconParking size={18} color="#6b7280"/>} label="Parked" value={statusCounts.parked} color="#6b7280" dark={dark}/>
        <StatusCard icon={<IconWifiOff size={18} color="#dc2626"/>} label="Offline" value={statusCounts.offline} color="#dc2626" dark={dark}/>
      </div>

      {/* ── Row 3: Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={sectionLabel}>Fleet Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <DonutChart data={donutData} size={115}/>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {donutData.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{d.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.value}</span>
                  <TrendPill value={d.value} total={totalLive} color={d.color}/>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Alert Rules by Type</div>
          {alertBarData.length === 0
            ? <div style={{ fontSize: 12, color: '#bbb', paddingTop: 8 }}>No alerts configured</div>
            : <MiniBar data={alertBarData} dark={dark}/>}
          <div style={{ marginTop: 13, paddingTop: 10, borderTop: `1px solid ${dark ? '#2a2a2a' : '#f3f4f6'}`, display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{alerts.filter(a => a.active).length} Active</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{alerts.filter(a => !a.active).length} Inactive</span>
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Device Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { label: 'Online', value: deviceHealth.online, color: '#16a34a', icon: <IconWifi size={13} color="#16a34a"/> },
              { label: 'Delayed (2–10 min)', value: deviceHealth.delayed, color: '#f59e0b', icon: <IconActivity size={13} color="#f59e0b"/> },
              { label: 'Offline / Never seen', value: deviceHealth.offline, color: '#dc2626', icon: <IconWifiOff size={13} color="#dc2626"/> },
              { label: 'With issues', value: deviceHealth.issues, color: '#7c3aed', icon: <IconAlertTriangle size={13} color="#7c3aed"/> },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f6f6f6'}` }}>
                {item.icon}
                <span style={{ flex: 1, fontSize: 12, color: dark ? '#ccc' : '#555' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: item.value > 0 ? item.color : (dark ? '#444' : '#ccc') }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#aaa' }}>Total: {stats?.devices ?? '—'} devices</div>
        </div>
      </div>

      {/* ── Row 4: Business / Client View ── */}
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconTrendingUp size={14} color="#dc2626"/>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Business / Client View
          {dateRange?.from && <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600, textTransform: 'none', fontSize: 10 }}>· Filtered: {filteredClients.length} of {clients.length} clients</span>}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 14, marginBottom: 14 }}>

        {/* Feature 1: Subscription Status Overview */}
        <div style={card}>
          <div style={sectionLabel}>Subscription Status</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: dark ? '#1a2a1a' : '#f0fdf4', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{clientStats.active}</div>
              <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 5 }}>ACTIVE</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: dark ? '#2a1a1a' : '#fef2f2', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{clientStats.inactive}</div>
              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 5 }}>INACTIVE</div>
            </div>
          </div>
          {filteredClients.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: dark ? '#aaa' : '#777' }}>Active rate</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{Math.round((clientStats.active / filteredClients.length) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: dark ? '#333' : '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(clientStats.active / filteredClients.length) * 100}%`, background: '#16a34a', borderRadius: 4, transition: 'width 0.4s' }}/>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filteredClients.filter(c => !c.isActive).slice(0, 3).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <IconX size={11} color="#dc2626"/>
                    <span style={{ fontSize: 11, color: dark ? '#ccc' : '#555', flex: 1 }} title={c.companyName ?? c.name}>{c.companyName ?? c.name}</span>
                    <span style={{ fontSize: 10, color: '#aaa' }}>{c.vehicleCount}v / {c.deviceCount}d</span>
                  </div>
                ))}
                {clientStats.inactive > 3 && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>+{clientStats.inactive - 3} more inactive</div>}
              </div>
            </div>
          )}
        </div>

        {/* Feature 2: Client Health Score Summary */}
        <div style={card}>
          <div style={sectionLabel}>Client Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Healthy', count: clientStats.healthy, color: '#16a34a', desc: 'Has vehicles & devices' },
              { label: 'Partial', count: clientStats.partial, color: '#f59e0b', desc: 'Missing vehicles or devices' },
              { label: 'Empty', count: clientStats.empty, color: '#dc2626', desc: 'No vehicles or devices' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.label}</span>
                    <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{row.desc}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: row.color }}>{row.count}</span>
                </div>
                <HealthBar value={filteredClients.length ? (row.count / filteredClients.length) * 100 : 0} color={row.color}/>
              </div>
            ))}
          </div>
          {filteredClients.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: dark ? '#1a1a1a' : '#f9fafb', borderRadius: 8, fontSize: 11, color: dark ? '#aaa' : '#666', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)' }}>{Math.round((clientStats.healthy / filteredClients.length) * 100)}%</strong> of clients are fully provisioned.
            </div>
          )}
        </div>

        {/* Feature 3: Per-Client Breakdown Table */}
        <div style={card}>
          <div style={sectionLabel}>Per-Client Breakdown</div>
          {filteredClients.length === 0
            ? <div style={{ fontSize: 12, color: '#bbb', paddingTop: 8 }}>No clients {dateRange?.from ? 'in selected range' : 'found'}</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Client', 'Vehicles', 'Devices', 'Status', 'Health'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.4, padding: '0 10px 9px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.slice(0, 8).map(c => {
                      const { label, color } = clientHealthScore(c);
                      return (
                        <tr key={c.id}>
                          <td style={{ padding: '8px 10px 8px 0', fontSize: 12, color: 'var(--text)', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}`, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.companyName ?? c.name}>{c.companyName ?? c.name}</td>
                          <td style={{ padding: '8px 10px 8px 0', fontSize: 12, fontWeight: 600, color: c.vehicleCount > 0 ? 'var(--text)' : '#aaa', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{c.vehicleCount}</td>
                          <td style={{ padding: '8px 10px 8px 0', fontSize: 12, fontWeight: 600, color: c.deviceCount > 0 ? 'var(--text)' : '#aaa', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{c.deviceCount}</td>
                          <td style={{ padding: '8px 10px 8px 0', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: c.isActive ? '#16a34a' : '#9ca3af', background: c.isActive ? (dark ? '#1a2a1a' : '#f0fdf4') : (dark ? '#222' : '#f9fafb'), borderRadius: 4, padding: '2px 6px' }}>
                              {c.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 0', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '18', borderRadius: 4, padding: '2px 6px' }}>{label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredClients.length > 8 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#aaa' }}>+{filteredClients.length - 8} more clients</div>
                )}
              </div>
          }
        </div>
      </div>

      {/* ── Row 5: Expiring Devices Widget ── */}
      {expiring.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <IconCalendarAlert size={14} color="#f59e0b"/>
            <span style={{ ...sectionLabel, marginBottom: 0 }}>Expiring Devices ({expiring.length})</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['IMEI', 'Vehicle', 'Expires', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 10px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expiring.slice(0, 10).map(d => {
                const days = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000);
                const color = days <= 0 ? '#dc2626' : days <= 7 ? '#f59e0b' : '#6b7280';
                const bg = days <= 0 ? '#fef2f2' : days <= 7 ? '#fffbeb' : (dark ? '#222' : '#f9fafb');
                return (
                  <tr key={d.id}>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, fontFamily: 'monospace', color: dark ? '#ccc' : '#555', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{d.imei}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: 'var(--text)', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{d.vehicleLicensePlate ?? d.vehicleName ?? '—'}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, color: dark ? '#ccc' : '#555', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                      {new Date(d.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '8px 0', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '2px 6px' }}>
                        {days <= 0 ? 'Expired' : days <= 7 ? `${days}d left` : `${days}d left`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {expiring.length > 10 && <div style={{ marginTop: 8, fontSize: 11, color: '#aaa' }}>+{expiring.length - 10} more expiring devices</div>}
        </div>
      )}

      {/* ── Row 6: Offline Devices Table ── */}
      {devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sectionLabel}>Offline / Never Connected Devices ({devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['IMEI', 'Vehicle', 'Last Seen', 'Signal', 'Battery', 'Issues'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 10px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').slice(0, 10).map(d => {
                const age = d.lastPacketAt ? Math.max(0, Math.floor((Date.now() - new Date(d.lastPacketAt).getTime()) / 60000)) : null;
                const ageStr = age === null ? 'Never' : age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ${age % 60}m ago`;
                const sig = d.gsmSignal ?? 0;
                const sigColor = sig <= 1 ? '#dc2626' : sig <= 2 ? '#f59e0b' : '#16a34a';
                return (
                  <tr key={d.deviceId}>
                    <td style={{ padding: '9px 12px 9px 0', fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text2)', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{d.imei}</td>
                    <td style={{ padding: '9px 12px 9px 0', fontSize: 12, color: 'var(--text)', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{d.vehicle?.licensePlate ?? '—'}</td>
                    <td style={{ padding: '9px 12px 9px 0', fontSize: 11.5, color: '#dc2626', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{ageStr}</td>
                    <td style={{ padding: '9px 12px 9px 0', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}><SignalBars level={sig} color={sigColor}/></td>
                    <td style={{ padding: '9px 12px 9px 0', fontSize: 11.5, color: d.issues.includes('Critical tracker voltage') ? '#dc2626' : 'var(--text2)', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>{d.voltageLevel ?? '—'}</td>
                    <td style={{ padding: '9px 0', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                      {d.issues.length > 0
                        ? <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '2px 6px' }}>{d.issues[0]}</span>
                        : <span style={{ fontSize: 11, color: '#aaa' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, dark }: { icon: React.ReactNode; label: string; value: number | undefined; sub?: React.ReactNode; dark: boolean }) {
  return (
    <div style={{ padding: '16px 18px', background: dark ? 'var(--bg2)' : '#fff', borderRadius: 12, border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function StatusCard({ icon, label, value, color, dark }: { icon: React.ReactNode; label: string; value: number; color: string; dark: boolean }) {
  return (
    <div style={{ padding: '14px 16px', background: dark ? 'var(--bg2)' : '#fff', borderRadius: 12, border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
