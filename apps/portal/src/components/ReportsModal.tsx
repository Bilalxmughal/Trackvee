import { useState, useEffect, useMemo } from 'react';
import { IconChartBar, IconSearch, IconDownload } from '@tabler/icons-react';
import api from '../api/client';

interface DeviceInfo { imei: string; displayId: number; vehicle: { id: string; licensePlate: string | null; displayId: number } | null; }
interface TripPoint { latitude: number; longitude: number; speedKmh: number; timestamp: string; ignition?: boolean | null; }

type ReportType = 'trip' | 'daily' | 'idle' | 'speed';
const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: 'trip',  label: 'Trip Report' },
  { key: 'daily', label: 'Daily Summary' },
  { key: 'idle',  label: 'Idle Report' },
  { key: 'speed', label: 'Overspeeding' },
];

function toLocal(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

const PERIODS: { label: string; get: () => { f: string; t: string } }[] = [
  { label: 'Today',      get: () => { const d = new Date(); const s = new Date(d); s.setHours(0,0,0,0); return { f: toLocal(s), t: toLocal(d) }; } },
  { label: 'Yesterday',  get: () => { const s = new Date(); s.setHours(0,0,0,0); const e = new Date(s); s.setDate(s.getDate()-1); e.setMilliseconds(-1); return { f: toLocal(s), t: toLocal(e) }; } },
  { label: 'This Week',  get: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate()-d.getDay()); s.setHours(0,0,0,0); return { f: toLocal(s), t: toLocal(d) }; } },
  { label: 'Last Week',  get: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate()-d.getDay()-7); s.setHours(0,0,0,0); const e = new Date(s); e.setDate(e.getDate()+7); e.setMilliseconds(-1); return { f: toLocal(s), t: toLocal(e) }; } },
  { label: 'This Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); return { f: toLocal(s), t: toLocal(d) }; } },
  { label: 'Last Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth()-1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59); return { f: toLocal(s), t: toLocal(e) }; } },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(ts: string) {
  const d = new Date(ts);
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`;
}
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function ReportsModal({ onClose }: { onClose: () => void }) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState('');
  const [reportType, setReportType] = useState<ReportType>('trip');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [activePeriod, setActivePeriod] = useState<string | null>('Today');

  useEffect(() => {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
    setFrom(toLocal(dayStart)); setTo(toLocal(now));
    api.get<DeviceInfo[]>('/devices').then(r => { setDevices(r.data); if (r.data.length > 0) setSelectedImei(r.data[0]!.imei); }).catch(() => {});
  }, []);

  const selectedDev = devices.find(d => d.imei === selectedImei);
  const selectedLabel = selectedDev ? (selectedDev.vehicle?.licensePlate || `#${selectedDev.vehicle?.displayId ?? selectedDev.displayId}`) : 'Select vehicle';
  const filteredDevices = q.trim() ? devices.filter(d => { const l = d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}`; return l.toLowerCase().includes(q.toLowerCase()); }) : devices;

  const run = async () => {
    if (!selectedImei || !from || !to) return;
    setLoading(true); setRows([]); setCols([]);
    try {
      const fromIso = new Date(from).toISOString(), toIso = new Date(to).toISOString();
      const { data: pts } = await api.get<TripPoint[]>(`/telemetry/${selectedImei}/history?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=5000`);
      if (pts.length === 0) { setLoading(false); return; }

      if (reportType === 'trip') {
        const trips: Record<string, string | number>[] = [];
        let tripStart: TripPoint | null = null, inTrip = false, maxSpd = 0, dist = 0, prevPt: TripPoint | null = null;
        for (const p of pts) {
          if (!inTrip && p.speedKmh >= 5) { inTrip = true; tripStart = p; maxSpd = p.speedKmh; dist = 0; prevPt = p; }
          else if (inTrip && p.speedKmh < 5) {
            if (tripStart && prevPt) {
              const dur = Math.round((new Date(prevPt.timestamp).getTime() - new Date(tripStart.timestamp).getTime()) / 1000);
              if (dur > 60) trips.push({ Start: fmt(tripStart.timestamp), End: fmt(prevPt.timestamp), 'Distance (km)': dist.toFixed(2), 'Max Speed': Math.round(maxSpd) + ' km/h', Duration: dur < 3600 ? `${Math.floor(dur/60)}m` : `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m` });
            }
            inTrip = false; tripStart = null; prevPt = null;
          } else if (inTrip && prevPt) {
            dist += haversineKm(prevPt.latitude, prevPt.longitude, p.latitude, p.longitude);
            if (p.speedKmh > maxSpd) maxSpd = p.speedKmh;
            prevPt = p;
          }
        }
        setCols(['Start', 'End', 'Distance (km)', 'Max Speed', 'Duration']); setRows(trips);

      } else if (reportType === 'daily') {
        const byDay = new Map<string, { dist: number; maxSpd: number; idleSec: number; count: number }>();
        let prevPt: TripPoint | null = null;
        for (const p of pts) {
          const day = p.timestamp.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, { dist: 0, maxSpd: 0, idleSec: 0, count: 0 });
          const d = byDay.get(day)!; d.count++;
          if (prevPt && prevPt.timestamp.slice(0,10) === day) d.dist += haversineKm(prevPt.latitude, prevPt.longitude, p.latitude, p.longitude);
          if (p.speedKmh > d.maxSpd) d.maxSpd = p.speedKmh;
          if (p.speedKmh < 5 && p.ignition === true && prevPt) d.idleSec += Math.max(0, Math.round((new Date(p.timestamp).getTime() - new Date(prevPt.timestamp).getTime()) / 1000));
          prevPt = p;
        }
        setCols(['Date', 'Distance (km)', 'Max Speed', 'Idle Time', 'Data Points']);
        setRows([...byDay.entries()].map(([day, d]) => ({ Date: day, 'Distance (km)': d.dist.toFixed(2), 'Max Speed': Math.round(d.maxSpd) + ' km/h', 'Idle Time': d.idleSec < 60 ? `${d.idleSec}s` : `${Math.floor(d.idleSec/60)}m`, 'Data Points': d.count })));

      } else if (reportType === 'idle') {
        const events: Record<string, string | number>[] = [];
        let idleStart: TripPoint | null = null, prevPt: TripPoint | null = null;
        for (const p of pts) {
          const isIdle = p.speedKmh < 5 && p.ignition === true;
          if (!idleStart && isIdle) { idleStart = p; }
          else if (idleStart && !isIdle) {
            if (prevPt) { const dur = Math.round((new Date(prevPt.timestamp).getTime() - new Date(idleStart.timestamp).getTime()) / 1000); if (dur >= 120) events.push({ Start: fmt(idleStart.timestamp), End: fmt(prevPt.timestamp), Duration: dur < 3600 ? `${Math.floor(dur/60)}m` : `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m`, Location: `${idleStart.latitude.toFixed(4)}, ${idleStart.longitude.toFixed(4)}` }); }
            idleStart = null;
          }
          prevPt = p;
        }
        setCols(['Start', 'End', 'Duration', 'Location']); setRows(events);

      } else {
        const LIMIT = 80;
        const events: Record<string, string | number>[] = [];
        let inEv = false, maxSpd = 0, evStart: TripPoint | null = null;
        for (const p of pts) {
          if (!inEv && p.speedKmh > LIMIT) { inEv = true; evStart = p; maxSpd = p.speedKmh; }
          else if (inEv && p.speedKmh <= LIMIT) { if (evStart) events.push({ Time: fmt(evStart.timestamp), 'Max Speed': Math.round(maxSpd) + ' km/h', Location: `${evStart.latitude.toFixed(4)}, ${evStart.longitude.toFixed(4)}` }); inEv = false; evStart = null; maxSpd = 0; }
          else if (inEv && p.speedKmh > maxSpd) maxSpd = p.speedKmh;
        }
        setCols(['Time', 'Max Speed', 'Location']); setRows(events);
      }
    } catch { setRows([]); setCols([]); } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const blob = new Blob([[cols.join(','), ...rows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportType}-${selectedImei.slice(-6)}.csv`; a.click();
  };

  const inpStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(1100px, 97vw)', height: 'min(780px, 95vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <IconChartBar size={16} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Reports</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Period presets */}
        <div style={{ padding: '6px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 4, flexShrink: 0, background: '#fafafa', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => { const r = p.get(); setFrom(r.f); setTo(r.t); setActivePeriod(p.label); }}
              style={{ padding: '3px 10px', borderRadius: 5, border: `1px solid ${activePeriod === p.label ? '#dc2626' : '#e5e7eb'}`, background: activePeriod === p.label ? '#fff5f5' : '#fff', color: activePeriod === p.label ? '#dc2626' : '#777', fontSize: 11.5, fontWeight: activePeriod === p.label ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap', background: '#fafafa' }}>
          {/* Vehicle selector */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Vehicle</div>
            <button onClick={() => setShowDrop(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, ...inpStyle, minWidth: 130, cursor: 'pointer' }}>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{selectedLabel}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>
            </button>
            {showDrop && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: 180, maxHeight: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 3 }}>
                <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, background: '#fafafa' }}>
                  <IconSearch size={11} color="#bbb" />
                  <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none', flex: 1 }} />
                </div>
                <div style={{ overflowY: 'auto' }}>
                  {filteredDevices.map(d => {
                    const label = d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}`;
                    const active = d.imei === selectedImei;
                    return (
                      <button key={d.imei} onClick={() => { setSelectedImei(d.imei); setShowDrop(false); setQ(''); }}
                        style={{ display: 'block', width: '100%', padding: '7px 11px', border: 'none', background: active ? '#fff5f5' : 'transparent', color: active ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f5f5'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Report Type</div>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} style={{ ...inpStyle, cursor: 'pointer' }}>
              {REPORT_TYPES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>From</div>
            <input type="datetime-local" value={from} onChange={e => { setFrom(e.target.value); setActivePeriod(null); }} style={inpStyle} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>To</div>
            <input type="datetime-local" value={to} onChange={e => { setTo(e.target.value); setActivePeriod(null); }} style={inpStyle} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingTop: 16 }}>
            <button onClick={run} disabled={loading || !selectedImei}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: !selectedImei || loading ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: !selectedImei || loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Loading…' : 'Generate'}
            </button>
            {rows.length > 0 && (
              <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' }}>
                <IconDownload size={12} /> CSV
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && rows.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <IconChartBar size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 12.5, color: '#bbb' }}>Select a vehicle, date range, and report type — then click Generate</div>
            </div>
          )}
          {!loading && cols.length > 0 && rows.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 12.5, color: '#bbb' }}>No data found for this range</div>
          )}
          {rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>#</th>
                  {cols.map(c => <th key={c} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f7f7f7' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td style={{ padding: '9px 16px', fontSize: 11.5, color: '#bbb' }}>{i + 1}</td>
                    {cols.map(c => <td key={c} style={{ padding: '9px 16px', fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{row[c] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {rows.length > 0 && (
          <div style={{ padding: '7px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{rows.length} records</span>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{REPORT_TYPES.find(r => r.key === reportType)?.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
