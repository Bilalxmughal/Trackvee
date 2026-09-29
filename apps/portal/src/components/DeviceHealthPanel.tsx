import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCpu, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import api from '../api/client';

interface DeviceHealth {
  deviceId: string;
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
  vehicle: { licensePlate: string | null; name: string } | null;
}

const CONNECTION: Record<DeviceHealth['connection'], { label: string; color: string }> = {
  online: { label: 'Online', color: '#16a34a' },
  delayed: { label: 'Delayed', color: '#d97706' },
  offline: { label: 'Offline', color: '#dc2626' },
  never_seen: { label: 'Never connected', color: '#6b7280' },
};
const GPS: Record<DeviceHealth['gps'], string> = {
  good: 'Good fix', weak: 'Weak fix', no_fix: 'No fix', stale: 'Stale', unknown: 'No data',
};
function age(value: string | null): string {
  if (!value) return 'Never';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export default function DeviceHealthPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<DeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const busy = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    try {
      const response = await api.get<DeviceHealth[]>('/telemetry/device-health');
      setRows(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch {
      setError('Device health could not be loaded. Check your connection and try again.');
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => ({
    online: rows.filter(row => row.connection === 'online').length,
    delayed: rows.filter(row => row.connection === 'delayed').length,
    offline: rows.filter(row => row.connection === 'offline' || row.connection === 'never_seen').length,
  }), [rows]);
  const visible = useMemo(() => rows.filter(row => {
    const q = query.trim().toLowerCase();
    if (q && ![row.vehicle?.licensePlate ?? '', row.vehicle?.name ?? ''].some(value => value.toLowerCase().includes(q))) return false;
    if (filter === 'attention' && row.connection === 'online' && row.issues.length === 0) return false;
    return true;
  }).sort((a, b) => ({ offline: 0, never_seen: 1, delayed: 2, online: 3 }[a.connection] - ({ offline: 0, never_seen: 1, delayed: 2, online: 3 }[b.connection]))), [rows, query, filter]);

  const lightText = { fontSize: 11, color: '#9ca3af' } as const;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <IconCpu size={17} color="#dc2626" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111', flex: 1 }}>Device Health</span>
        <button onClick={() => void load(true)} title="Refresh" disabled={refreshing} style={{ border: 'none', background: 'transparent', color: '#6b7280', padding: 5, cursor: 'pointer', display: 'flex' }}><IconRefresh size={16} /></button>
        <button onClick={onClose} title="Close" style={{ border: 'none', background: 'transparent', color: '#9ca3af', padding: 5, cursor: 'pointer', display: 'flex' }}><IconX size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        {[['Online', counts.online, '#16a34a'], ['Delayed', counts.delayed, '#d97706'], ['Offline', counts.offline, '#dc2626']].map(([label, count, color]) => <div key={String(label)} style={{ padding: '9px 6px', textAlign: 'center', borderRight: '1px solid #f5f5f5' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: String(color) }}>{loading ? '—' : count}</div><div style={lightText}>{label}</div>
        </div>)}
      </div>
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 9px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <IconSearch size={14} color="#9ca3af" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicles" style={{ minWidth: 0, flex: 1, border: 'none', outline: 'none', fontSize: 12, color: '#111' }} />
        </div>
        <div style={{ display: 'flex', gap: 14, borderBottom: '1px solid #f0f0f0', marginTop: 7 }}>
          {(['all', 'attention'] as const).map(value => <button key={value} onClick={() => setFilter(value)} style={{ border: 'none', borderBottom: `2px solid ${filter === value ? '#dc2626' : 'transparent'}`, background: 'transparent', padding: '8px 2px 7px', fontSize: 11.5, color: filter === value ? '#dc2626' : '#6b7280', cursor: 'pointer' }}>{value === 'all' ? `All (${rows.length})` : 'Needs attention'}</button>)}
          <span style={{ ...lightText, marginLeft: 'auto', alignSelf: 'center' }}>{refreshing ? 'Refreshing…' : '30s refresh'}</span>
        </div>
      </div>
      {error && <div role="alert" style={{ margin: '7px 12px', padding: '9px 10px', borderLeft: '3px solid #dc2626', background: '#fef2f2', color: '#b91c1c', fontSize: 11.5 }}>{error}</div>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading device health…</div>
          : visible.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{rows.length ? 'No devices match this filter' : 'No devices found'}</div>
          : visible.map(row => {
            const status = CONNECTION[row.connection];
            return <div key={row.deviceId} style={{ padding: '11px 12px', borderBottom: '1px solid #f3f4f6', borderLeft: `3px solid ${status.color}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: '#111', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.vehicle?.licensePlate || row.vehicle?.name || 'Unassigned'}</span>
                <span style={{ fontSize: 10.5, color: status.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{status.label}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 8, fontSize: 10.5, color: '#4b5563' }}>
                <span>GPS: {GPS[row.gps]}{row.satellites == null ? '' : ` · ${row.satellites} sats`} · {age(row.lastGpsReceivedAt)}</span>
                <span>GSM: {row.gsmSignal == null ? '—' : `${row.gsmSignal}/4`}</span>
                <span>Power: {row.externalPower === 'unknown' ? '—' : row.externalPower}</span>
                <span>Packet: {age(row.lastPacketAt)}</span>
              </div>
              {row.issues.length > 0 && <div style={{ marginTop: 6, color: '#b45309', fontSize: 10.5, lineHeight: 1.4 }}>{row.issues.join(' · ')}</div>}
            </div>;
          })}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', color: '#9ca3af', fontSize: 10, flexShrink: 0 }}>Online ≤ 2 min · Delayed 2–10 min · Offline &gt; 10 min</div>
    </div>
  );
}
