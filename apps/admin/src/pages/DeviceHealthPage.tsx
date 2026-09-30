import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCpu, IconRefresh, IconSearch } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import TablePagination, { useTablePagination } from '../components/TablePagination';
import { useCityFilter } from '../contexts/CityFilterContext';

interface DeviceHealth {
  deviceId: string;
  imei: string;
  deviceName: string | null;
  vehicle: { id: string; displayId: number; licensePlate: string | null; name: string } | null;
  connection: 'online' | 'delayed' | 'offline' | 'never_seen';
  lastPacketAt: string | null;
  lastGpsAt: string | null;
  lastGpsReceivedAt: string | null;
  trackerLagSeconds: number | null;
  gps: 'good' | 'weak' | 'no_fix' | 'stale' | 'unknown';
  satellites: number | null;
  gsm: 'good' | 'fair' | 'weak' | 'unknown';
  gsmSignal: number | null;
  externalPower: 'connected' | 'disconnected' | 'unknown';
  voltageLevel: string | null;
  ignition: boolean | null;
  issues: string[];
}

const CONNECTION_LABEL: Record<DeviceHealth['connection'], string> = {
  online: 'Online', delayed: 'Delayed', offline: 'Offline', never_seen: 'Never connected',
};
const CONNECTION_COLOR: Record<DeviceHealth['connection'], string> = {
  online: '#16a34a', delayed: '#d97706', offline: '#dc2626', never_seen: '#6b7280',
};
const GPS_LABEL: Record<DeviceHealth['gps'], string> = {
  good: 'Good fix', weak: 'Weak fix', no_fix: 'No fix', stale: 'Stale', unknown: 'No data',
};

function ageLabel(value: string | null): string {
  if (!value) return 'Never';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}m ago` : `${Math.floor(hours / 24)}d ago`;
}

function HealthValue({ label, value, color }: { label: string; value: string; color?: string }) {
  return <span style={{ color: color ?? 'var(--text)', whiteSpace: 'nowrap' }}>{label}: <b>{value}</b></span>;
}

export default function DeviceHealthPage() {
  const [rows, setRows] = useState<DeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'offline'>('all');
  const { selectedCityId } = useCityFilter();
  const busy = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    try {
      const params = selectedCityId ? `?cityId=${encodeURIComponent(selectedCityId)}` : '';
      const response = await api.get<DeviceHealth[]>(`/telemetry/device-health${params}`);
      setRows(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch {
      setError('Device health could not be loaded. Check your connection and try again.');
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCityId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => ({
    online: rows.filter(row => row.connection === 'online').length,
    delayed: rows.filter(row => row.connection === 'delayed').length,
    offline: rows.filter(row => row.connection === 'offline' || row.connection === 'never_seen').length,
    issues: rows.filter(row => row.issues.length > 0).length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter(row => {
    const q = query.trim().toLowerCase();
    if (q && ![row.imei, row.deviceName ?? '', row.vehicle?.licensePlate ?? '', row.vehicle?.name ?? ''].some(value => value.toLowerCase().includes(q))) return false;
    if (filter === 'offline' && !['offline', 'never_seen'].includes(row.connection)) return false;
    if (filter === 'attention' && row.connection === 'online' && row.issues.length === 0) return false;
    return true;
  }).sort((a, b) => {
    const rank = { offline: 0, never_seen: 1, delayed: 2, online: 3 };
    return rank[a.connection] - rank[b.connection] || b.issues.length - a.issues.length;
  }), [rows, query, filter]);
  const pagination = useTablePagination(filtered, JSON.stringify([query, filter, selectedCityId]));

  const card: React.CSSProperties = { padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 };
  const muted: React.CSSProperties = { color: 'var(--muted)', fontSize: 11 };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <PageHeader title="Device Health" count={rows.length} action={
        <button onClick={() => void load(true)} disabled={refreshing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', background: 'var(--bg)', color: 'var(--text)', cursor: refreshing ? 'wait' : 'pointer', fontSize: 12 }}>
          <IconRefresh size={14} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      } />
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Online', value: counts.online, color: '#16a34a' },
            { label: 'Delayed', value: counts.delayed, color: '#d97706' },
            { label: 'Offline', value: counts.offline, color: '#dc2626' },
            { label: 'With issues', value: counts.issues, color: '#6b7280' },
          ].map(item => <div key={item.label} style={card}>
            <div style={{ fontSize: 23, fontWeight: 700, color: item.color, lineHeight: 1.1 }}>{loading ? '—' : item.value}</div>
            <div style={{ ...muted, marginTop: 5 }}>{item.label}</div>
          </div>)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <IconSearch size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#9ca3af' }} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicle or IMEI" style={{ height: 32, width: 230, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 5, background: 'var(--input-bg)', color: 'var(--input-color)', outline: 'none', fontSize: 12 }} />
          </div>
          {(['all', 'attention', 'offline'] as const).map(value => <button key={value} onClick={() => setFilter(value)} style={{ border: 'none', borderBottom: `2px solid ${filter === value ? '#dc2626' : 'transparent'}`, padding: '8px 10px', background: 'transparent', color: filter === value ? '#dc2626' : 'var(--muted)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>{value === 'all' ? `All (${rows.length})` : value === 'attention' ? `Needs attention (${counts.issues})` : `Offline (${counts.offline})`}</button>)}
          <span style={{ ...muted, marginLeft: 'auto' }}>Auto-refreshes every 30 seconds</span>
        </div>

        {error && <div role="alert" style={{ padding: 12, marginBottom: 10, borderLeft: '3px solid #dc2626', background: 'rgba(220,38,38,0.06)', color: '#b91c1c', fontSize: 12 }}>{error}</div>}
        <div className="tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Vehicle / Device', 'Connection', 'GPS', 'GSM', 'Power / Voltage', 'Last packet', 'Health issues'].map(label => <th key={label} style={{ textAlign: 'left', padding: '10px 12px', color: '#9ca3af', fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>Loading device health…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#9ca3af' }}>{rows.length ? 'No devices match these filters' : 'No devices found'}</td></tr>
                : pagination.pagedItems.map(row => <tr key={row.deviceId} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${CONNECTION_COLOR[row.connection]}` }}>
                  <td style={{ padding: '10px 12px', minWidth: 170 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 600 }}>{row.vehicle?.licensePlate || row.vehicle?.name || (row.vehicle ? `Vehicle #${row.vehicle.displayId}` : 'Unassigned')}</div>
                    <div style={{ ...muted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{row.deviceName ? `${row.deviceName} · ` : ''}{row.imei}</div>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><span style={{ color: CONNECTION_COLOR[row.connection], fontWeight: 600 }}>{CONNECTION_LABEL[row.connection]}</span><div style={{ ...muted, marginTop: 3 }}>Ignition: {row.ignition == null ? 'Unknown' : row.ignition ? 'On' : 'Off'}</div></td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><HealthValue label="GPS" value={GPS_LABEL[row.gps]} color={row.gps === 'good' ? '#16a34a' : row.gps === 'unknown' ? undefined : '#d97706'} /><div style={{ ...muted, marginTop: 3 }}>{row.satellites == null ? '—' : `${row.satellites} satellites`} · Received {ageLabel(row.lastGpsReceivedAt)}</div></td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><span style={{ color: row.gsm === 'weak' ? '#d97706' : 'var(--text)' }}>{row.gsm === 'unknown' ? 'No data' : `${row.gsm[0]!.toUpperCase()}${row.gsm.slice(1)}`}</span><div style={{ ...muted, marginTop: 3 }}>{row.gsmSignal == null ? '—' : `Level ${row.gsmSignal} / 4`}</div></td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><div style={{ color: 'var(--text)' }}>{row.externalPower === 'unknown' ? 'Unknown' : row.externalPower === 'connected' ? 'Connected' : 'Disconnected'}</div><div style={{ ...muted, marginTop: 3 }}>{row.voltageLevel ?? 'No voltage data'}</div></td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{ageLabel(row.lastPacketAt)}</td>
                  <td style={{ padding: '10px 12px', minWidth: 160, color: row.issues.length ? '#b45309' : '#16a34a' }}>{row.issues.length ? row.issues.join(', ') : 'No issues detected'}</td>
                </tr>)}
            </tbody>
          </table>
        </div>
        {!loading && <TablePagination page={pagination.page} pageSize={pagination.pageSize} total={filtered.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 12, ...muted }}><IconCpu size={14} /> Online ≤ 2 min · Delayed 2–10 min · Offline &gt; 10 min</div>
      </div>
    </div>
  );
}
