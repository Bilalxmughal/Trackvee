import { useEffect, useState, useMemo } from 'react';
import { IconUsers, IconBuildingSkyscraper, IconCar, IconCpu, IconBell, IconZzz, IconParking, IconWifi, IconWifiOff, IconKey, IconKeyOff, IconAlertTriangle, IconActivity } from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useTheme } from '../contexts/ThemeContext';

interface Stats { users: number; organizations: number; vehicles: number; devices: number; }
interface LivePoint { imei: string; speedKmh: number; ignition?: boolean | null; timestamp: string; }
interface DeviceHealthRow {
  deviceId: string; imei: string;
  connection: 'online' | 'delayed' | 'offline' | 'never_seen';
  lastPacketAt: string | null; gsmSignal: number | null; voltageLevel: string | null;
  issues: string[]; vehicle?: { licensePlate: string | null } | null;
}
interface AlertRow { id: string; name: string; type: string; active: boolean; }

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

// ── Donut Chart ───────────────────────────────────────────────────────────────
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

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
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

// ── Signal Bars ───────────────────────────────────────────────────────────────
function SignalBars({ level, color }: { level: number; color: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10">
      {[1, 2, 3, 4].map((b, i) => (
        <rect key={b} x={i * 3.5} y={10 - b * 2.2} width="2.5" height={b * 2.2} rx="0.5" fill={level >= b ? color : '#e5e7eb'}/>
      ))}
    </svg>
  );
}

// ── Trend Pill ────────────────────────────────────────────────────────────────
function TrendPill({ value, total, color }: { value: number; total: number; color: string }) {
  if (!total) return null;
  const pct = Math.round((value / total) * 100);
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '18', borderRadius: 20, padding: '2px 7px' }}>{pct}%</span>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [livePoints, setLivePoints] = useState<LivePoint[]>([]);
  const [devices, setDevices] = useState<DeviceHealthRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { selectedCityId } = useCityFilter();
  const { dark } = useTheme();
  const { text, sub } = getGreeting();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

  useEffect(() => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    setLoading(true);
    Promise.all([
      api.get<{ id: string }[]>(`/users${p}`),
      api.get<{ id: string }[]>(`/organizations${p}`),
      api.get<{ id: string }[]>(`/vehicles${p}`),
      api.get<{ id: string }[]>(`/devices${p}`),
      api.get<LivePoint[]>('/telemetry/live'),
      api.get<DeviceHealthRow[]>(`/telemetry/device-health${p}`),
      api.get<AlertRow[]>('/alerts'),
    ]).then(([u, o, v, d, live, devFull, al]) => {
      setStats({ users: Array.isArray(u.data) ? u.data.length : 0, organizations: Array.isArray(o.data) ? o.data.length : 0, vehicles: Array.isArray(v.data) ? v.data.length : 0, devices: Array.isArray(d.data) ? d.data.length : 0 });
      setLivePoints(Array.isArray(live.data) ? live.data : []);
      setDevices(Array.isArray(devFull.data) ? devFull.data : []);
      setAlerts(Array.isArray(al.data) ? al.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedCityId]);

  // ── Computed stats ─────────────────────────────────────────────────────────
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
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const donutData = [
    { label: 'Moving', value: statusCounts.moving, color: '#16a34a' },
    { label: 'Idle', value: statusCounts.idle, color: '#f59e0b' },
    { label: 'Parked', value: statusCounts.parked, color: '#6b7280' },
    { label: 'Offline', value: statusCounts.offline, color: '#d1d5db' },
  ];

  const totalLive = livePoints.filter(pt => (Date.now() - new Date(pt.timestamp).getTime()) / 60000 <= 10).length;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = { padding: '18px 20px', background: dark ? 'var(--bg2)' : '#fff', borderRadius: 12, border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)' };
  const sectionLabel = { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 14 };

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: 26, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)' }}>{text}, {fullName} 👋</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{sub}</div>
        </div>
        {loading && <div style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}><IconActivity size={14}/> Loading...</div>}
      </div>

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

        {/* Fleet Status Donut */}
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

        {/* Alert Rules Breakdown */}
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

        {/* Device Health */}
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
          <div style={{ marginTop: 10, fontSize: 11, color: '#aaa' }}>
            Total: {stats?.devices ?? '—'} devices
          </div>
        </div>
      </div>

      {/* ── Row 4: Offline Devices Table ── */}
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
