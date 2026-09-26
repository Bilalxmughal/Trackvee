import { useState, useEffect } from 'react';
import { IconChartBar, IconSearch, IconDownload } from '@tabler/icons-react';
import api from '../api/client';

interface DeviceInfo {
  imei: string;
  vehicle: { id: string; licensePlate: string | null; displayId: number } | null;
  displayId: number;
}

type ReportType = 'trip' | 'daily' | 'idle' | 'speed';

const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: 'trip',  label: 'Trip Report',        desc: 'Start/end location, distance, duration per trip' },
  { key: 'daily', label: 'Daily Summary',      desc: 'Per-day mileage, engine hours, idle time' },
  { key: 'idle',  label: 'Idle Report',        desc: 'Engine idle events with location and duration' },
  { key: 'speed', label: 'Overspeeding Report',desc: 'Speed violations with time and location' },
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

interface TripPoint { latitude: number; longitude: number; speedKmh: number; timestamp: string; ignition?: boolean | null; }

export default function ReportsPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState('');
  const [reportType, setReportType] = useState<ReportType>('trip');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [showDeviceDrop, setShowDeviceDrop] = useState(false);

  useEffect(() => {
    const now = new Date();
    const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
    setFrom(toLocal(dayStart)); setTo(toLocal(now));
    api.get<DeviceInfo[]>('/devices').then(r => {
      setDevices(r.data);
      if (r.data.length > 0) setSelectedImei(r.data[0]!.imei);
    }).catch(() => {});
  }, []);

  const selectedDev = devices.find(d => d.imei === selectedImei);
  const selectedLabel = selectedDev
    ? (selectedDev.vehicle?.licensePlate || `#${selectedDev.vehicle?.displayId ?? selectedDev.displayId}`)
    : 'Select vehicle';

  const filteredDevices = q.trim()
    ? devices.filter(d => {
        const label = d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}`;
        return label.toLowerCase().includes(q.toLowerCase()) || d.imei.includes(q);
      })
    : devices;

  const run = async () => {
    if (!selectedImei || !from || !to) return;
    setLoading(true); setRows([]); setCols([]);
    try {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to).toISOString();
      const { data: pts } = await api.get<TripPoint[]>(`/telemetry/${selectedImei}/history?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=5000`);
      if (pts.length === 0) { setRows([]); setCols([]); setLoading(false); return; }

      if (reportType === 'trip') {
        const trips: Record<string, string | number>[] = [];
        let tripStart: TripPoint | null = null;
        let inTrip = false;
        let maxSpd = 0;
        let dist = 0;
        let prevPt: TripPoint | null = null;

        for (const p of pts) {
          const moving = p.speedKmh >= 5;
          if (!inTrip && moving) { inTrip = true; tripStart = p; maxSpd = p.speedKmh; dist = 0; prevPt = p; }
          else if (inTrip && !moving) {
            if (tripStart && prevPt) {
              const dur = Math.round((new Date(prevPt.timestamp).getTime() - new Date(tripStart.timestamp).getTime()) / 1000);
              if (dur > 60) trips.push({ 'Start': fmt(tripStart.timestamp), 'End': fmt(prevPt.timestamp), 'Distance (km)': dist.toFixed(2), 'Max Speed': Math.round(maxSpd) + ' km/h', 'Duration': dur < 3600 ? `${Math.floor(dur/60)}m` : `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m` });
            }
            inTrip = false; tripStart = null; prevPt = null;
          } else if (inTrip && prevPt) {
            dist += haversineKm(prevPt.latitude, prevPt.longitude, p.latitude, p.longitude);
            if (p.speedKmh > maxSpd) maxSpd = p.speedKmh;
            prevPt = p;
          }
        }
        setCols(['Start', 'End', 'Distance (km)', 'Max Speed', 'Duration']);
        setRows(trips);

      } else if (reportType === 'daily') {
        const byDay = new Map<string, { dist: number; maxSpd: number; idleSec: number; pts: TripPoint[] }>();
        let prevPt: TripPoint | null = null;
        for (const p of pts) {
          const day = p.timestamp.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, { dist: 0, maxSpd: 0, idleSec: 0, pts: [] });
          const d = byDay.get(day)!;
          d.pts.push(p);
          if (prevPt && prevPt.timestamp.slice(0,10) === day) d.dist += haversineKm(prevPt.latitude, prevPt.longitude, p.latitude, p.longitude);
          if (p.speedKmh > d.maxSpd) d.maxSpd = p.speedKmh;
          if (p.speedKmh < 5 && p.ignition === true) {
            const prev = d.pts[d.pts.length - 2];
            if (prev) d.idleSec += Math.max(0, Math.round((new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000));
          }
          prevPt = p;
        }
        const dailyRows = [...byDay.entries()].map(([day, d]) => ({
          'Date': day, 'Distance (km)': d.dist.toFixed(2), 'Max Speed': Math.round(d.maxSpd) + ' km/h',
          'Idle Time': d.idleSec < 60 ? `${d.idleSec}s` : `${Math.floor(d.idleSec/60)}m`,
          'Data Points': d.pts.length,
        }));
        setCols(['Date', 'Distance (km)', 'Max Speed', 'Idle Time', 'Data Points']);
        setRows(dailyRows);

      } else if (reportType === 'idle') {
        const idleEvents: Record<string, string | number>[] = [];
        let idleStart: TripPoint | null = null;
        for (const p of pts) {
          const isIdle = p.speedKmh < 5 && p.ignition === true;
          if (!idleStart && isIdle) { idleStart = p; }
          else if (idleStart && !isIdle) {
            const dur = Math.round((new Date(p.timestamp).getTime() - new Date(idleStart.timestamp).getTime()) / 1000);
            if (dur >= 120) idleEvents.push({ 'Start': fmt(idleStart.timestamp), 'End': fmt(p.timestamp), 'Duration': dur < 3600 ? `${Math.floor(dur/60)}m` : `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m`, 'Location': `${idleStart.latitude.toFixed(4)}, ${idleStart.longitude.toFixed(4)}` });
            idleStart = null;
          }
        }
        setCols(['Start', 'End', 'Duration', 'Location']);
        setRows(idleEvents);

      } else if (reportType === 'speed') {
        const LIMIT = 80;
        const events: Record<string, string | number>[] = [];
        let inEvent = false;
        let maxSpd = 0;
        let eventStart: TripPoint | null = null;
        for (const p of pts) {
          if (!inEvent && p.speedKmh > LIMIT) { inEvent = true; eventStart = p; maxSpd = p.speedKmh; }
          else if (inEvent && p.speedKmh <= LIMIT) {
            if (eventStart) events.push({ 'Time': fmt(eventStart.timestamp), 'Max Speed': Math.round(maxSpd) + ' km/h', 'Location': `${eventStart.latitude.toFixed(4)}, ${eventStart.longitude.toFixed(4)}` });
            inEvent = false; eventStart = null; maxSpd = 0;
          } else if (inEvent && p.speedKmh > maxSpd) maxSpd = p.speedKmh;
        }
        setCols(['Time', 'Max Speed', 'Location']);
        setRows(events);
      }
    } catch { setRows([]); setCols([]); } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csvRows = [cols.join(','), ...rows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${reportType}-report-${selectedImei.slice(-6)}.csv`; a.click();
  };

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <IconChartBar size={18} color="#dc2626" strokeWidth={1.75} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111', marginRight: 6 }}>Reports</span>
        <div style={{ flex: 1 }} />
      </div>

      {/* Filter bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Vehicle selector */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Vehicle</div>
          <button onClick={() => setShowDeviceDrop(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, ...inp, minWidth: 140, cursor: 'pointer' }}>
            <IconCar size={12} color="#aaa" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>
          </button>
          {showDeviceDrop && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: 200, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 3 }}>
              <div style={{ padding: '7px 9px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, background: '#fafafa' }}>
                <IconSearch size={11} color="#bbb" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#111', outline: 'none', flex: 1 }} />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredDevices.map(d => {
                  const label = d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}`;
                  const active = d.imei === selectedImei;
                  return (
                    <button key={d.imei} onClick={() => { setSelectedImei(d.imei); setShowDeviceDrop(false); setQ(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: active ? '#fff5f5' : 'transparent', color: active ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
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

        {/* Report type */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Report Type</div>
          <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} style={{ ...inp, cursor: 'pointer' }}>
            {REPORT_TYPES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {/* From */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>From</div>
          <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} style={inp}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
        </div>

        {/* To */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>To</div>
          <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} style={inp}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingTop: 18 }}>
          <button onClick={run} disabled={loading || !selectedImei}
            style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: !selectedImei || loading ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !selectedImei || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Loading…' : 'Generate'}
          </button>
          {rows.length > 0 && (
            <button onClick={exportCsv} title="Export CSV"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>
              <IconDownload size={13} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loading && rows.length === 0 && cols.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <IconChartBar size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: '#bbb' }}>Select a vehicle, date range, and report type — then click Generate</div>
          </div>
        )}
        {!loading && cols.length > 0 && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#bbb' }}>No data found for the selected range</div>
        )}
        {rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>#</th>
                {cols.map(c => (
                  <th key={c} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f7f7f7' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  <td style={{ padding: '9px 16px', fontSize: 11.5, color: '#bbb' }}>{i + 1}</td>
                  {cols.map(c => (
                    <td key={c} style={{ padding: '9px 16px', fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{row[c] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Row count footer */}
      {rows.length > 0 && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: '#bbb' }}>{rows.length} records</span>
          <span style={{ fontSize: 11.5, color: '#bbb' }}>{REPORT_TYPES.find(r => r.key === reportType)?.label}</span>
        </div>
      )}
    </div>
  );
}

// local IconCar since Vehicles page also uses it
function IconCar({ size = 16, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  );
}
