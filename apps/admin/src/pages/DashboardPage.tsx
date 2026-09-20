import { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useTheme } from '../contexts/ThemeContext';

interface Stats { users: number; organizations: number; vehicles: number; devices: number; }
interface LivePoint { imei: string; speedKmh: number; ignition?: boolean | null; timestamp: string; }
interface DeviceRow { id: string; imei: string; lastSeenAt: string | null; lastGsmSignal: number | null; lastVoltageLevel: number | null; status: string; vehicle?: { licensePlate: string | null } | null; }
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

const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#d1d5db' };
const STATUS_LABEL = { moving: 'Moving', idle: 'Idle', parked: 'Parked', offline: 'Offline' };
const ALERT_COLORS: Record<string, string> = { speed: '#dc2626', idle: '#f59e0b', tow: '#7c3aed', over_parking: '#2563eb', geofence: '#0891b2', poi: '#16a34a' };

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#aaa' }}>No data</div>;

  const r = 45; const cx = 60; const cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const slices = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const slice = { ...d, dash, gap, offset };
    offset += dash;
    return slice;
  });

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth="18"/>
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth="18"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset + circumference * 0.25}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}/>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#aaa">VEHICLES</text>
    </svg>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
function HBarChart({ data, dark }: { data: { label: string; value: number; color: string }[]; dark: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 70, fontSize: 11, color: dark ? '#aaa' : '#666', textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>{d.label.replace('_', ' ')}</div>
          <div style={{ flex: 1, height: 18, background: dark ? '#222' : '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: d.color, borderRadius: 4, transition: 'width 0.4s ease', minWidth: d.value > 0 ? 4 : 0 }}/>
          </div>
          <div style={{ width: 22, fontSize: 11, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Signal bar icon ───────────────────────────────────────────────────────────
function SignalBars({ level, color }: { level: number; color: string }) {
  const bars = [1, 2, 3, 4];
  return (
    <svg width="14" height="10" viewBox="0 0 14 10">
      {bars.map((b, i) => (
        <rect key={b} x={i * 3.5} y={10 - b * 2.2} width="2.5" height={b * 2.2} rx="0.5"
          fill={level >= b ? color : '#e5e7eb'}/>
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [livePoints, setLivePoints] = useState<LivePoint[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const { user } = useAuth();
  const { selectedCityId } = useCityFilter();
  const { dark } = useTheme();
  const { text, sub } = getGreeting();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

  useEffect(() => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([
      api.get<{ id: string }[]>(`/users${p}`),
      api.get<{ id: string }[]>(`/organizations${p}`),
      api.get<{ id: string }[]>(`/vehicles${p}`),
      api.get<{ id: string }[]>(`/devices${p}`),
      api.get<LivePoint[]>('/telemetry/live'),
      api.get<DeviceRow[]>(`/devices${p}`),
      api.get<AlertRow[]>('/alerts'),
    ]).then(([u, o, v, d, live, devFull, al]) => {
      setStats({ users: Array.isArray(u.data) ? u.data.length : 0, organizations: Array.isArray(o.data) ? o.data.length : 0, vehicles: Array.isArray(v.data) ? v.data.length : 0, devices: Array.isArray(d.data) ? d.data.length : 0 });
      setLivePoints(Array.isArray(live.data) ? live.data : []);
      setDevices(Array.isArray(devFull.data) ? devFull.data : []);
      setAlerts(Array.isArray(al.data) ? al.data : []);
    }).catch(() => {});
  }, [selectedCityId]);

  // Fleet status breakdown
  const statusCounts = useMemo(() => {
    const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
    livePoints.forEach(pt => counts[vehicleStatus(pt)]++);
    return counts;
  }, [livePoints]);

  const donutData = (Object.keys(statusCounts) as (keyof typeof statusCounts)[]).map(k => ({
    label: STATUS_LABEL[k], value: statusCounts[k], color: STATUS_COLOR[k],
  }));

  // Alert type breakdown
  const alertTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    return counts;
  }, [alerts]);

  const alertBarData = Object.entries(alertTypeCounts).map(([type, value]) => ({
    label: type, value, color: '#dc2626',
  })).sort((a, b) => b.value - a.value);

  // Device health
  const now = Date.now();
  const deviceHealth = useMemo(() => {
    const online = devices.filter(d => d.lastSeenAt && (now - new Date(d.lastSeenAt).getTime()) < 60 * 60 * 1000).length;
    const offline = devices.length - online;
    const weakSignal = devices.filter(d => d.lastGsmSignal !== null && d.lastGsmSignal <= 1).length;
    const lowBattery = devices.filter(d => d.lastVoltageLevel !== null && d.lastVoltageLevel <= 1).length;
    return { online, offline, weakSignal, lowBattery };
  }, [devices]);

  const cardStyle = { padding: '18px 20px', background: 'var(--bg2)', borderRadius: 10 };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 12 };

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{text}, {fullName}</div>
        <div style={{ fontSize: 12, color: '#bbb', marginTop: 3 }}>{sub}</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Clients', value: stats?.organizations },
          { label: 'Users', value: stats?.users },
          { label: 'Vehicles', value: stats?.vehicles },
          { label: 'Devices', value: stats?.devices },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Fleet Status Donut */}
        <div style={cardStyle}>
          <div style={labelStyle}>Fleet Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart data={donutData} size={110}/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {donutData.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{d.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginLeft: 'auto', paddingLeft: 8 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alert Rules Breakdown */}
        <div style={cardStyle}>
          <div style={labelStyle}>Alert Rules by Type</div>
          {alertBarData.length === 0
            ? <div style={{ fontSize: 12, color: '#bbb', paddingTop: 8 }}>No alerts configured</div>
            : <HBarChart data={alertBarData} dark={dark}/>
          }
          <div style={{ marginTop: 12, fontSize: 11, color: '#aaa' }}>
            {alerts.filter(a => a.active).length} active · {alerts.filter(a => !a.active).length} inactive
          </div>
        </div>

        {/* Device Health */}
        <div style={cardStyle}>
          <div style={labelStyle}>Device Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Online', value: deviceHealth.online },
              { label: 'Offline (>1hr)', value: deviceHealth.offline },
              { label: 'Weak Signal', value: deviceHealth.weakSignal },
              { label: 'Low Battery', value: deviceHealth.lowBattery },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${dark ? '#222' : '#f3f4f6'}` }}>
                <span style={{ fontSize: 12, color: dark ? '#ccc' : '#555' }}>{item.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent offline devices */}
      {devices.filter(d => d.lastSeenAt && (now - new Date(d.lastSeenAt).getTime()) > 60 * 60 * 1000).length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Offline Devices (&gt;1 hour)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['IMEI', 'Vehicle', 'Last Seen', 'Signal', 'Battery'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 8px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices
                .filter(d => d.lastSeenAt && (now - new Date(d.lastSeenAt).getTime()) > 60 * 60 * 1000)
                .slice(0, 8)
                .map(d => {
                  const age = d.lastSeenAt ? Math.round((now - new Date(d.lastSeenAt).getTime()) / 60000) : null;
                  const ageStr = age === null ? '—' : age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ${age % 60}m ago`;
                  const sig = d.lastGsmSignal ?? 0;
                  const sigColor = sig <= 1 ? '#dc2626' : sig <= 2 ? '#f59e0b' : '#16a34a';
                  return (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f9fafb'}` }}>
                      <td style={{ padding: '9px 0', fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text2)' }}>{d.imei}</td>
                      <td style={{ padding: '9px 0', fontSize: 12, color: 'var(--text)' }}>{d.vehicle?.licensePlate ?? '—'}</td>
                      <td style={{ padding: '9px 0', fontSize: 11.5, color: '#dc2626' }}>{ageStr}</td>
                      <td style={{ padding: '9px 0' }}><SignalBars level={sig} color={sigColor}/></td>
                      <td style={{ padding: '9px 0', fontSize: 11.5, color: d.lastVoltageLevel !== null && d.lastVoltageLevel <= 1 ? '#dc2626' : 'var(--text2)' }}>
                        {d.lastVoltageLevel !== null ? `L${d.lastVoltageLevel}` : '—'}
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
