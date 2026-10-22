import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCar, IconCpu, IconBell, IconZzz, IconParking, IconWifi, IconWifiOff,
  IconKey, IconKeyOff, IconTool, IconRefresh, IconCheck, IconActivity,
  IconAlertTriangle, IconCircleCheck, IconGauge, IconMapPin, IconAlertCircle,
  IconClock,
} from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { usePortalPerms } from '../contexts/PortalPermsContext';

interface LivePoint {
  imei: string; speedKmh: number; ignition?: boolean | null; timestamp: string;
}
interface DeviceHealth {
  deviceId: string; connection: 'online' | 'delayed' | 'offline' | 'never_seen';
  lastPacketAt: string | null; gsmSignal: number | null; voltageLevel: string | null;
  issues: string[]; vehicle?: { licensePlate: string | null; name: string } | null;
}
interface AlertLog {
  id: string; alertName: string; alertType: string; vehiclePlate: string | null;
  triggeredAt: string;
}
interface MileageRow { imei: string; plate: string | null; kmToday: number; }
interface MaintenanceItem {
  id: string; vehicleLicensePlate: string | null; serviceType: string;
  isDue: boolean; dueDate: string | null; estimatedDueDateFromDistance: string | null;
}
interface ExpiringDevice {
  id: string; imei: string; expiresAt: string;
  vehicle: { licensePlate: string | null; name: string } | null;
}

function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'parked' | 'offline' {
  const age = (Date.now() - new Date(pt.timestamp).getTime()) / 60000;
  if (age > 10) return 'offline';
  if (pt.speedKmh >= 5) return 'moving';
  if (pt.ignition) return 'idle';
  return 'parked';
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

const CARD: React.CSSProperties = {
  padding: '18px 20px', background: '#fff', borderRadius: 12,
  border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase',
  letterSpacing: 0.8, marginBottom: 14,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { canDo } = usePortalPerms();
  const [livePoints, setLivePoints] = useState<LivePoint[]>([]);
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDevice[]>([]);
  const [mileage, setMileage] = useState<MileageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [agoTick, setAgoTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    const requests: Promise<unknown>[] = [
      api.get<LivePoint[]>('/telemetry/live').catch(() => ({ data: [] })),
      api.get<DeviceHealth[]>('/telemetry/device-health').catch(() => ({ data: [] })),
      api.get<ExpiringDevice[]>('/devices/expiring').catch(() => ({ data: [] })),
      api.get<MileageRow[]>('/telemetry/fleet-mileage').catch(() => ({ data: [] })),
    ];
    if (canDo('alerts', 'view'))
      requests.push(api.get<AlertLog[]>('/alerts/logs?limit=30').catch(() => ({ data: [] })));
    if (canDo('maintenance', 'view'))
      requests.push(api.get<MaintenanceItem[]>('/maintenance?isDue=true').catch(() => ({ data: [] })));

    Promise.all(requests).then(([live, dev, exp, mil, al, maint]) => {
      setLivePoints(Array.isArray((live as { data: LivePoint[] }).data) ? (live as { data: LivePoint[] }).data : []);
      setDevices(Array.isArray((dev as { data: DeviceHealth[] }).data) ? (dev as { data: DeviceHealth[] }).data : []);
      setExpiring(Array.isArray((exp as { data: ExpiringDevice[] }).data) ? (exp as { data: ExpiringDevice[] }).data : []);
      setMileage(Array.isArray((mil as { data: MileageRow[] }).data) ? (mil as { data: MileageRow[] }).data : []);
      if (al) setAlertLogs(Array.isArray((al as { data: AlertLog[] }).data) ? (al as { data: AlertLog[] }).data : []);
      if (maint) setMaintenance(Array.isArray((maint as { data: MaintenanceItem[] }).data) ? (maint as { data: MaintenanceItem[] }).data : []);
      setLastRefreshed(Date.now());
    }).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [canDo]);

  useEffect(() => { fetchAll(false); }, [fetchAll]);
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchAll(true), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);
  useEffect(() => {
    const t = setInterval(() => setAgoTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);
  void agoTick;

  const statusCounts = useMemo(() => {
    const c = { moving: 0, idle: 0, parked: 0, offline: 0 };
    livePoints.forEach(pt => c[vehicleStatus(pt)]++);
    return c;
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

  const deviceHealth = useMemo(() => ({
    online: devices.filter(d => d.connection === 'online').length,
    delayed: devices.filter(d => d.connection === 'delayed').length,
    offline: devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length,
    issues: devices.filter(d => d.issues.length > 0).length,
  }), [devices]);

  const totalVehicles = livePoints.length;
  const orgName = user?.organizationName || '';
  const agoLabel = fmtAgo(Date.now() - lastRefreshed);

  const dueMaintenance = maintenance.filter(m => m.isDue);

  const expiryWarnings = useMemo(() => expiring.filter(d => {
    const days = daysUntil(d.expiresAt);
    return days <= 30;
  }), [expiring]);

  const geofenceAlerts = useMemo(() =>
    alertLogs.filter(l => l.alertType === 'geofence' || l.alertType === 'poi').slice(0, 8),
  [alertLogs]);

  const offlineLong = useMemo(() => devices.filter(d => {
    if (d.connection !== 'offline' && d.connection !== 'never_seen') return false;
    if (!d.lastPacketAt) return true;
    const age = (Date.now() - new Date(d.lastPacketAt).getTime()) / 3600000;
    return age >= 1;
  }), [devices]);

  const totalMileageToday = useMemo(() => mileage.reduce((s, r) => s + r.kmToday, 0), [mileage]);

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>
            {orgName ? `${orgName} — Fleet Overview` : 'Fleet Overview'}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>Live snapshot of your fleet and devices</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', border: '1px solid #e8e8e8', borderRadius: 5, background: '#fff', color: refreshing ? '#dc2626' : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <IconRefresh size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
            Refresh
          </button>
          <span style={{ fontSize: 11, color: '#aaa' }}>
            {loading ? <><IconActivity size={12}/> Loading...</> : <><IconCheck size={12} color="#16a34a"/> {agoLabel}</>}
          </span>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Fleet Status KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { icon: <IconKey size={17} color="#16a34a"/>, label: 'Ignition ON', value: ignitionCounts.on, color: '#16a34a' },
          { icon: <IconKeyOff size={17} color="#6b7280"/>, label: 'Ignition OFF', value: ignitionCounts.off, color: '#6b7280' },
          { icon: <IconCar size={17} color="#16a34a"/>, label: 'Moving', value: statusCounts.moving, color: '#16a34a' },
          { icon: <IconZzz size={17} color="#f59e0b"/>, label: 'Idle', value: statusCounts.idle, color: '#f59e0b' },
          { icon: <IconParking size={17} color="#6b7280"/>, label: 'Parked', value: statusCounts.parked, color: '#6b7280' },
          { icon: <IconWifiOff size={17} color="#dc2626"/>, label: 'Offline', value: statusCounts.offline, color: '#dc2626' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {kpi.icon}
              <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
              {loading ? '—' : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Device Health + Recent Alerts + Maintenance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Device Health */}
        <div style={CARD}>
          <div style={LABEL}>Device Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { label: 'Online', value: deviceHealth.online, color: '#16a34a', icon: <IconWifi size={13} color="#16a34a"/> },
              { label: 'Delayed (2–10 min)', value: deviceHealth.delayed, color: '#f59e0b', icon: <IconActivity size={13} color="#f59e0b"/> },
              { label: 'Offline / Never seen', value: deviceHealth.offline, color: '#dc2626', icon: <IconWifiOff size={13} color="#dc2626"/> },
              { label: 'With issues', value: deviceHealth.issues, color: '#7c3aed', icon: <IconAlertTriangle size={13} color="#7c3aed"/> },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: '1px solid #f6f6f6' }}>
                {item.icon}
                <span style={{ flex: 1, fontSize: 12, color: '#555' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: item.value > 0 ? item.color : '#ccc' }}>{loading ? '—' : item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#aaa' }}>Total: {loading ? '—' : devices.length} devices</div>
        </div>

        {/* Recent Alerts */}
        {canDo('alerts', 'view') && (
          <div style={CARD}>
            <div style={LABEL}>Recent Alert Events</div>
            {loading ? (
              <div style={{ fontSize: 12, color: '#bbb' }}>Loading…</div>
            ) : alertLogs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#16a34a' }}>
                <IconCircleCheck size={16}/>
                <span style={{ fontSize: 13, fontWeight: 600 }}>No recent alerts</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {alertLogs.slice(0, 7).map(log => {
                  const age = Math.round((Date.now() - new Date(log.triggeredAt).getTime()) / 60000);
                  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: log.acknowledged ? '#d1d5db' : '#dc2626', flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.alertName}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>{log.vehiclePlate ?? '—'} · {ageStr}</div>
                      </div>
                    </div>
                  );
                })}
                {alertLogs.length > 7 && <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>+{alertLogs.length - 7} more</div>}
              </div>
            )}
          </div>
        )}

        {/* Maintenance / Expiring Devices */}
        <div style={CARD}>
          {canDo('maintenance', 'view') && dueMaintenance.length > 0 ? (
            <>
              <div style={LABEL}>Maintenance Due</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dueMaintenance.slice(0, 5).map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                    <IconTool size={13} color="#f59e0b"/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.vehicleLicensePlate ?? '—'}
                      </div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>{m.serviceType}</div>
                    </div>
                    <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Due</span>
                  </div>
                ))}
                {dueMaintenance.length > 5 && <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>+{dueMaintenance.length - 5} more</div>}
              </div>
            </>
          ) : expiring.length > 0 ? (
            <>
              <div style={LABEL}>Expiring Devices</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {expiring.slice(0, 5).map(d => {
                  const days = daysUntil(d.expiresAt);
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                      <IconCpu size={13} color={days <= 0 ? '#dc2626' : days <= 7 ? '#f59e0b' : '#6b7280'}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.vehicle?.licensePlate ?? d.imei}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: days <= 0 ? '#dc2626' : '#f59e0b', background: days <= 0 ? '#fef2f2' : '#fffbeb', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
                        {days <= 0 ? 'Expired' : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div style={LABEL}>Fleet Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Total vehicles tracked</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{loading ? '—' : totalVehicles}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Online devices</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{loading ? '—' : deviceHealth.online}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Active alerts</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: alertLogs.filter(l => !l.acknowledged).length > 0 ? '#dc2626' : '#111' }}>
                    {loading ? '—' : alertLogs.filter(l => !l.acknowledged).length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Offline Devices Table */}
      {!loading && devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length > 0 && (
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={LABEL}>
            Offline / Never Connected Devices ({devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Vehicle', 'Last Seen', 'Signal', 'Issues'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 10px 0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.filter(d => d.connection === 'offline' || d.connection === 'never_seen').slice(0, 8).map(d => {
                const age = d.lastPacketAt ? Math.max(0, Math.floor((Date.now() - new Date(d.lastPacketAt).getTime()) / 60000)) : null;
                const ageStr = age === null ? 'Never' : age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
                return (
                  <tr key={d.deviceId}>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: '#111', borderBottom: '1px solid #f9fafb' }}>{d.vehicle?.licensePlate ?? d.vehicle?.name ?? '—'}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, color: '#dc2626', borderBottom: '1px solid #f9fafb' }}>{ageStr}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, color: '#555', borderBottom: '1px solid #f9fafb' }}>{d.gsmSignal != null ? `${d.gsmSignal}/4` : '—'}</td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                      {d.issues.length > 0
                        ? <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '2px 6px' }}>{d.issues[0]}</span>
                        : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Subscription / Expiry Warning Banner ── */}
      {!loading && expiryWarnings.length > 0 && (
        <div style={{ ...CARD, marginBottom: 14, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconAlertCircle size={15} color="#f59e0b" />
            <span style={{ ...LABEL, marginBottom: 0, color: '#92400e' }}>
              Subscription Expiry Warning — {expiryWarnings.length} vehicle{expiryWarnings.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {expiryWarnings.map(d => {
              const days = daysUntil(d.expiresAt);
              const color = days <= 0 ? '#dc2626' : days <= 7 ? '#ea580c' : '#92400e';
              const bg = days <= 0 ? '#fef2f2' : days <= 7 ? '#fff7ed' : '#fefce8';
              return (
                <div key={d.id} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 7, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>{d.vehicle?.licensePlate ?? d.imei}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, background: 'transparent' }}>
                    {days <= 0 ? 'Expired' : `${days}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row: Daily Mileage + Geofence Notifications + Last Seen Summary ── */}
      {!loading && (mileage.length > 0 || geofenceAlerts.length > 0 || offlineLong.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Daily Mileage */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <IconGauge size={14} color="#2563eb" />
              <span style={{ ...LABEL, marginBottom: 0 }}>Today's Mileage</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                {totalMileageToday.toLocaleString(undefined, { maximumFractionDigits: 0 })} km total
              </span>
            </div>
            {mileage.length === 0 ? (
              <div style={{ fontSize: 12, color: '#bbb' }}>No movement recorded today.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {mileage.slice(0, 7).map(r => (
                  <div key={r.imei} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.plate ?? r.imei}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', minWidth: 50, textAlign: 'right' }}>{r.kmToday.toLocaleString()} km</span>
                  </div>
                ))}
                {mileage.length > 7 && <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>+{mileage.length - 7} more vehicles</div>}
              </div>
            )}
          </div>

          {/* Geofence Notifications */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <IconMapPin size={14} color="#7c3aed" />
              <span style={{ ...LABEL, marginBottom: 0 }}>Geofence Events</span>
            </div>
            {geofenceAlerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', padding: '4px 0' }}>
                <IconCircleCheck size={15} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>No geofence events today</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {geofenceAlerts.map(log => {
                  const age = Math.round((Date.now() - new Date(log.triggeredAt).getTime()) / 60000);
                  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
                  const event = (log as any).payload?.event as string | undefined;
                  const gfName = (log as any).payload?.geofenceName as string | undefined;
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: event === 'enter' ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.vehiclePlate ?? '—'} {event ? `• ${event}` : ''}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>{gfName ?? log.alertName} · {ageStr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Last Seen Summary */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <IconClock size={14} color="#dc2626" />
              <span style={{ ...LABEL, marginBottom: 0 }}>Long Offline Vehicles</span>
            </div>
            {offlineLong.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', padding: '4px 0' }}>
                <IconCircleCheck size={15} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>All vehicles seen recently</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {offlineLong.slice(0, 7).map(d => {
                  const age = d.lastPacketAt ? (Date.now() - new Date(d.lastPacketAt).getTime()) / 3600000 : null;
                  const ageStr = age === null ? 'Never seen' : age < 24 ? `${Math.floor(age)}h offline` : `${Math.floor(age / 24)}d offline`;
                  const color = age === null || age >= 24 ? '#dc2626' : '#f59e0b';
                  return (
                    <div key={d.deviceId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f9fafb' }}>
                      <IconWifiOff size={12} color={color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.vehicle?.licensePlate ?? d.vehicle?.name ?? '—'}
                        </div>
                        <div style={{ fontSize: 10, color }}>Last seen: {ageStr}</div>
                      </div>
                    </div>
                  );
                })}
                {offlineLong.length > 7 && <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>+{offlineLong.length - 7} more</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expiring Devices full table if maintenance not shown */}
      {!loading && expiring.length > 0 && !canDo('maintenance', 'view') && (
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={LABEL}>Expiring Devices ({expiring.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Vehicle', 'IMEI', 'Expires', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 10px 0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expiring.map(d => {
                const days = daysUntil(d.expiresAt);
                return (
                  <tr key={d.id}>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: '#111', borderBottom: '1px solid #f9fafb' }}>{d.vehicle?.licensePlate ?? '—'}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, fontFamily: 'monospace', color: '#555', borderBottom: '1px solid #f9fafb' }}>{d.imei}</td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 11.5, color: '#555', borderBottom: '1px solid #f9fafb' }}>
                      {new Date(d.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: days <= 0 ? '#dc2626' : days <= 7 ? '#f59e0b' : '#6b7280', background: days <= 0 ? '#fef2f2' : days <= 7 ? '#fffbeb' : '#f9fafb', borderRadius: 4, padding: '2px 6px' }}>
                        {days <= 0 ? 'Expired' : days <= 7 ? `${days}d left` : `${days}d left`}
                      </span>
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
