import { useEffect, useState, useRef } from 'react';
import { IconRefresh, IconSearch, IconDownload, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import { useCityFilter } from '../contexts/CityFilterContext';

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

function exportCSV(data: Telemetry[], plateMap: Map<string, string>) {
  const headers = ['Time', 'Vehicle', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)', 'Altitude (m)', 'Satellites', 'Ignition'];
  const escapeCell = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = data.map(t => [
    new Date(t.timestamp).toLocaleString(),
    plateMap.get(t.deviceId) ?? t.deviceId,
    t.latitude.toFixed(6),
    t.longitude.toFixed(6),
    t.speed ?? '',
    t.heading ?? '',
    t.altitude ?? '',
    t.satellites ?? '',
    t.ignition === true ? 'On' : t.ignition === false ? 'Off' : '',
  ].map(escapeCell).join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['﻿' + csv, ], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PAGE_SIZES = [25, 50, 75, 100] as const;

export default function TelemetryPage() {
  const [rows, setRows] = useState<Telemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [q, setQ] = useState('');
  const [ignFilter, setIgnFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZES[number]>(25);
  const [page, setPage] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { selectedCityId } = useCityFilter();
  const [deviceCityMap, setDeviceCityMap] = useState<Map<string, string>>(new Map());
  const [devicePlateMap, setDevicePlateMap] = useState<Map<string, string>>(new Map());

  const load = () => {
    api.get<Telemetry[] | { data: Telemetry[] }>('/telemetry?limit=500')
      .then(r => setRows(Array.isArray(r.data) ? r.data : (r.data as { data: Telemetry[] })?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.get<{ id: string; cityId: string | null; vehicle: { licensePlate: string | null } | null }[]>('/devices')
      .then(r => {
        const cm = new Map<string, string>();
        const pm = new Map<string, string>();
        r.data.forEach(d => {
          if (d.cityId) cm.set(d.id, d.cityId);
          if (d.vehicle?.licensePlate) pm.set(d.id, d.vehicle.licensePlate);
        });
        setDeviceCityMap(cm);
        setDevicePlateMap(pm);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (auto) { timerRef.current = setInterval(load, 5000); }
    else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [q, ignFilter, dateRange, selectedCityId, pageSize]);

  const filtered = rows.filter(t => {
    if (selectedCityId && deviceCityMap.get(t.deviceId) !== selectedCityId) return false;
    if (q) {
      const ql = q.toLowerCase();
      const plate = (devicePlateMap.get(t.deviceId) ?? '').toLowerCase();
      if (!plate.includes(ql) && !t.deviceId.toLowerCase().includes(ql)) return false;
    }
    if (ignFilter === 'on' && !t.ignition) return false;
    if (ignFilter === 'off' && t.ignition) return false;
    if (dateRange?.from) {
      const d = parseISO(t.timestamp);
      if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const COLS = ['Time', 'Vehicle', 'Lat / Lng', 'Speed', 'Hdg', 'Alt', 'Sats', 'IGN'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Top bar (frozen) ── */}
      <PageHeader title="Telemetry" count={rows.length} action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} style={{ accentColor: '#dc2626' }} />
            Auto 5s
          </label>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--input-bg)', color: 'var(--text2)', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>
            <IconRefresh size={13} /> Refresh
          </button>
          <button
            onClick={() => exportCSV(filtered, devicePlateMap)}
            disabled={filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: filtered.length === 0 ? 'var(--input-bg)' : '#dc2626', color: filtered.length === 0 ? 'var(--text2)' : '#fff', border: filtered.length === 0 ? '1px solid var(--input-border)' : 'none', borderRadius: 3, fontSize: 12, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}
          >
            <IconDownload size={13} /> Export CSV
          </button>
        </div>
      } />

      {/* ── Filters (frozen) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Vehicle / Device…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--input-border)')} />
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#bbb' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value) as typeof PAGE_SIZES[number])} style={{ ...sel, width: 80 }}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {/* ── Scrollable table ── */}
      {loading ? <Spinner /> : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card-bg, #fff)', borderBottom: '1px solid var(--border)' }}>
                {COLS.map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${t.ignition ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '9px 16px', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(t.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12, fontWeight: 600 }}>{devicePlateMap.get(t.deviceId) ?? <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)' }}>{t.deviceId.slice(0, 8)}…</span>}</td>
                  <td style={{ padding: '9px 16px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12 }}>{t.speed != null ? `${t.speed} km/h` : '—'}</td>
                  <td style={{ padding: '9px 16px', color: 'var(--muted)', fontSize: 12 }}>{t.heading != null ? `${t.heading}°` : '—'}</td>
                  <td style={{ padding: '9px 16px', color: 'var(--muted)', fontSize: 12 }}>{t.altitude != null ? `${t.altitude}m` : '—'}</td>
                  <td style={{ padding: '9px 16px', color: 'var(--muted)', fontSize: 12 }}>{t.satellites ?? '—'}</td>
                  <td style={{ padding: '9px 16px', color: t.ignition ? '#16a34a' : '#ccc', fontSize: 12 }}>{t.ignition ? 'On' : 'Off'}</td>
                </tr>
              ))}
              {!paged.length && (
                <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No telemetry data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination bar (frozen at bottom) ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setPage(1)} disabled={safePage === 1}
              style={{ padding: '4px 7px', borderRadius: 3, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: safePage === 1 ? '#ccc' : 'var(--text2)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: 11 }}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: 3, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: safePage === 1 ? '#ccc' : 'var(--text2)', cursor: safePage === 1 ? 'not-allowed' : 'pointer' }}>
              <IconChevronLeft size={13}/>
            </button>

            {/* Page number pills */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} style={{ padding: '0 4px', color: '#bbb', fontSize: 12 }}>…</span>
                  : <button key={n} onClick={() => setPage(n as number)}
                      style={{ minWidth: 28, padding: '4px 6px', borderRadius: 3, border: `1px solid ${n === safePage ? '#dc2626' : 'var(--input-border)'}`, background: n === safePage ? '#dc2626' : 'var(--input-bg)', color: n === safePage ? '#fff' : 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: n === safePage ? 600 : 400 }}>{n}</button>
              )}

            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: 3, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: safePage === totalPages ? '#ccc' : 'var(--text2)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer' }}>
              <IconChevronRight size={13}/>
            </button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
              style={{ padding: '4px 7px', borderRadius: 3, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: safePage === totalPages ? '#ccc' : 'var(--text2)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: 11 }}>»</button>
          </div>

          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {safePage} / {totalPages}</span>
        </div>
      )}
    </div>
  );
}
