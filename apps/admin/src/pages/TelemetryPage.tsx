import { useEffect, useState, useRef } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';

interface Telemetry {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  satellites: number | null;
  ignition: boolean | null;
  timestamp: string;
}

const sel: React.CSSProperties = {
  height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
  borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer',
};
const inp: React.CSSProperties = {
  height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)',
  borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180,
};

export default function TelemetryPage() {
  const [rows, setRows] = useState<Telemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [q, setQ] = useState('');
  const [ignFilter, setIgnFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    api.get<Telemetry[] | { data: Telemetry[] }>('/telemetry?limit=100')
      .then(r => setRows(Array.isArray(r.data) ? r.data : (r.data as { data: Telemetry[] })?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (auto) { timerRef.current = setInterval(load, 5000); }
    else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto]);

  const filtered = rows.filter(t => {
    if (q && !t.deviceId.toLowerCase().includes(q.toLowerCase())) return false;
    if (ignFilter === 'on' && !t.ignition) return false;
    if (ignFilter === 'off' && t.ignition) return false;
    if (dateRange?.from) {
      const d = parseISO(t.timestamp);
      if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Telemetry" count={rows.length} action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} style={{ accentColor: '#dc2626' }} />
            Auto 5s
          </label>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#fff', color: '#555', border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>
            <IconRefresh size={13} /> Refresh
          </button>
        </div>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Device ID…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
            onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={ignFilter} onChange={e => setIgnFilter(e.target.value)} style={sel}>
          <option value="">All Ignition</option>
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Timestamp range" />
        {(q || ignFilter || dateRange) && (
          <button onClick={() => { setQ(''); setIgnFilter(''); setDateRange(undefined); }}
            style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="tbl-wrap">
        <table>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['Time', 'Device', 'Lat / Lng', 'Speed', 'Hdg', 'Alt', 'Sats', 'IGN'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${t.ignition ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '9px 16px', color: '#aaa', whiteSpace: 'nowrap' }}>{new Date(t.timestamp).toLocaleTimeString()}</td>
                <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 10, color: '#999' }}>{t.deviceId.slice(0, 8)}…</td>
                <td style={{ padding: '9px 16px', fontVariantNumeric: 'tabular-nums' }}>{t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}</td>
                <td style={{ padding: '9px 16px' }}>{t.speed != null ? `${t.speed} km/h` : '—'}</td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.heading != null ? `${t.heading}°` : '—'}</td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.altitude != null ? `${t.altitude}m` : '—'}</td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.satellites ?? '—'}</td>
                <td style={{ padding: '9px 16px', color: t.ignition ? '#16a34a' : '#ccc' }}>{t.ignition ? 'On' : 'Off'}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No telemetry data</td></tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
