import { useState, useEffect } from 'react';
import { IconChartBar, IconDownload } from '@tabler/icons-react';
import api from '../api/client';
import VehicleMultiSelect, { type VehicleOption, type VehicleGroup } from './VehicleMultiSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType =
  | 'travel_summary' | 'stops_move_summary' | 'stoppage_summary' | 'move_summary' | 'daily_travel'
  | 'ignition_on_off' | 'vehicle_history'
  | 'overspeed' | 'overspeed_summary' | 'underspeed'
  | 'alert_history' | 'driver_behavior'
  | 'geofence_activity';

interface ReportResult {
  columns: string[];
  rows: (string | number | null)[][];
  summary?: (string | number | null)[] | null;
  rowCount?: number;
}

const REPORT_TYPES: { value: ReportType; label: string; group: string; opts?: ('speed'|'minStop'|'minSpeed')[] }[] = [
  { value: 'travel_summary',     label: 'Travel Summary',       group: 'Travel',    opts: ['speed'] },
  { value: 'stops_move_summary', label: 'Stops & Move Summary', group: 'Travel',    opts: ['speed','minStop'] },
  { value: 'stoppage_summary',   label: 'Stoppage Summary',     group: 'Travel',    opts: ['minStop'] },
  { value: 'move_summary',       label: 'Move Summary',         group: 'Travel' },
  { value: 'daily_travel',       label: 'Daily Travel',         group: 'Travel',    opts: ['speed'] },
  { value: 'ignition_on_off',    label: 'Ignition ON / OFF',    group: 'Activity' },
  { value: 'vehicle_history',    label: 'Vehicle History',      group: 'Activity' },
  { value: 'overspeed',          label: 'Overspeed',            group: 'Speed',     opts: ['speed'] },
  { value: 'overspeed_summary',  label: 'Overspeed Summary',    group: 'Speed',     opts: ['speed'] },
  { value: 'underspeed',         label: 'Underspeed',           group: 'Speed',     opts: ['minSpeed'] },
  { value: 'alert_history',      label: 'Alert History',        group: 'Events' },
  { value: 'driver_behavior',    label: 'Driver Behavior',      group: 'Events' },
  { value: 'geofence_activity',  label: 'Geofence Activity',    group: 'Geofence' },
];

function toDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const PERIODS: { label: string; get: () => { f: string; t: string } }[] = [
  { label: 'Today',      get: () => { const d = new Date(); const s = new Date(d); s.setHours(0,0,0,0); return { f: toDate(d)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Yesterday',  get: () => { const s = new Date(); s.setDate(s.getDate()-1); return { f: toDate(s)+'T00:00', t: toDate(s)+'T23:59' }; } },
  { label: 'This Week',  get: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate()-d.getDay()); s.setHours(0,0,0,0); return { f: toDate(s)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Last Week',  get: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate()-d.getDay()-7); const e = new Date(s); e.setDate(e.getDate()+6); return { f: toDate(s)+'T00:00', t: toDate(e)+'T23:59' }; } },
  { label: 'This Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); return { f: toDate(s)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Last Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth()-1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return { f: toDate(s)+'T00:00', t: toDate(e)+'T23:59' }; } },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsModal({ onClose }: { onClose: () => void }) {
  const [vehicles,      setVehicles]      = useState<VehicleOption[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [selectedVehs,  setSelectedVehs]  = useState<string[]>([]);

  const [reportType,  setReportType]  = useState<ReportType>('travel_summary');
  const [fromDt,      setFromDt]      = useState(() => toDate(new Date())+'T00:00');
  const [toDt,        setToDt]        = useState(() => toDate(new Date())+'T23:59');
  const [speedLimit,  setSpeedLimit]  = useState('');
  const [minSpeedKmh, setMinSpeedKmh] = useState('');
  const [minStopMin,  setMinStopMin]  = useState('1');
  const [groupBy,     setGroupBy]     = useState<''|'day'|'week'|'vehicle'>('');
  const [activePeriod,setActivePeriod]= useState('Today');

  const [result,  setResult]  = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const opts = REPORT_TYPES.find(r => r.value === reportType)?.opts ?? [];

  useEffect(() => {
    api.get<{ id:string; name:string; licensePlate?:string|null; make?:string|null; model?:string|null }[]>('/vehicles')
      .then(r => setVehicles(r.data.map(v => ({ id: v.id, name: v.name, licensePlate: v.licensePlate ?? null, make: v.make ?? null, model: v.model ?? null }))))
      .catch(() => {});
    api.get<VehicleGroup[]>('/vehicle-groups')
      .then(r => setVehicleGroups(r.data))
      .catch(() => {});
  }, []);

  const applyPeriod = (label: string) => {
    const p = PERIODS.find(x => x.label === label); if (!p) return;
    const d = p.get(); setFromDt(d.f); setToDt(d.t); setActivePeriod(label);
  };

  const buildParams = () => ({
    type: reportType,
    vehicleIds: selectedVehs.join(','),
    from: new Date(fromDt).toISOString(),
    to: new Date(toDt).toISOString(),
    ...(speedLimit && opts.includes('speed')    ? { speedLimit }  : {}),
    ...(minSpeedKmh && opts.includes('minSpeed') ? { minSpeedKmh } : {}),
    ...(minStopMin && opts.includes('minStop')   ? { minStopMin }  : {}),
    ...(groupBy ? { groupBy } : {}),
  });

  const generate = async () => {
    if (!selectedVehs.length) { setError('Select at least one vehicle'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const { data } = await api.get<ReportResult>(`/reports?${new URLSearchParams(buildParams())}`);
      setResult(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Could not generate report');
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!result) return;
    const lines = [result.columns.join(','), ...result.rows.map(r => r.map(c => `"${c ?? ''}"`).join(','))];
    if (result.summary) lines.push(result.summary.map(c => `"${c ?? ''}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report-${reportType}-${toDate(new Date())}.csv`; a.click();
  };

  const inpStyle: React.CSSProperties = { padding: '5px 9px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'block' };

  const displayRows = result?.rows ?? [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(1200px, 97vw)', height: 'min(1000px, 96vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <IconChartBar size={16} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Reports</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-end', gap: 12, flexShrink: 0, flexWrap: 'wrap', background: '#fafafa' }}>

          {/* Report Type */}
          <div>
            <span style={lbl}>Report Type</span>
            <select value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setResult(null); setError(''); }}
              style={{ ...inpStyle, cursor: 'pointer', minWidth: 180 }}
              onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              {['Travel','Activity','Speed','Events','Geofence'].map(g => (
                <optgroup key={g} label={g}>
                  {REPORT_TYPES.filter(r => r.group === g).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Vehicles */}
          <div>
            <span style={lbl}>Vehicles</span>
            <VehicleMultiSelect vehicles={vehicles} groups={vehicleGroups} selected={selectedVehs} onChange={setSelectedVehs} />
          </div>

          {/* Period */}
          <div>
            <span style={lbl}>Period</span>
            <select value={activePeriod} onChange={e => applyPeriod(e.target.value)}
              style={{ ...inpStyle, cursor: 'pointer', minWidth: 120 }}
              onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <option value="">Custom</option>
              {PERIODS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>

          {/* From */}
          <div>
            <span style={lbl}>From</span>
            <input type="datetime-local" value={fromDt} onChange={e => { setFromDt(e.target.value); setActivePeriod(''); }} style={inpStyle}
              onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
          </div>

          {/* To */}
          <div>
            <span style={lbl}>To</span>
            <input type="datetime-local" value={toDt} onChange={e => { setToDt(e.target.value); setActivePeriod(''); }} style={inpStyle}
              onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
          </div>

          {/* Conditional: Speed Limit */}
          {opts.includes('speed') && (
            <div>
              <span style={lbl}>Speed Limit (km/h)</span>
              <input type="number" min={1} max={300} value={speedLimit} onChange={e => setSpeedLimit(e.target.value)} placeholder="e.g. 80"
                style={{ ...inpStyle, width: 90 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
            </div>
          )}

          {/* Conditional: Min Stop */}
          {opts.includes('minStop') && (
            <div>
              <span style={lbl}>Min Stop (min)</span>
              <input type="number" min={1} value={minStopMin} onChange={e => setMinStopMin(e.target.value)}
                style={{ ...inpStyle, width: 80 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
            </div>
          )}

          {/* Conditional: Min Speed */}
          {opts.includes('minSpeed') && (
            <div>
              <span style={lbl}>Min Speed (km/h)</span>
              <input type="number" min={1} value={minSpeedKmh} onChange={e => setMinSpeedKmh(e.target.value)}
                style={{ ...inpStyle, width: 90 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
            </div>
          )}

          {/* Group By */}
          <div>
            <span style={lbl}>Group By</span>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as ''|'day'|'week'|'vehicle')}
              style={{ ...inpStyle, cursor: 'pointer', width: 90 }}
              onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <option value="">None</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="vehicle">Vehicle</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            <button onClick={generate} disabled={loading || !selectedVehs.length}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: !selectedVehs.length || loading ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: !selectedVehs.length || loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Loading…' : 'Generate Report'}
            </button>
            {result && result.rows.length > 0 && (
              <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' }}>
                <IconDownload size={12} /> CSV
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626', flexShrink: 0 }}>{error}</div>
        )}

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && !result && !error && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <IconChartBar size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 12.5, color: '#bbb' }}>Select vehicles and a date range, then click Generate Report</div>
            </div>
          )}
          {!loading && result && displayRows.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 12.5, color: '#bbb' }}>No data found for this range</div>
          )}
          {result && displayRows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>#</th>
                  {result.columns.map(c => (
                    <th key={c} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f7f7f7' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td style={{ padding: '8px 14px', fontSize: 11.5, color: '#bbb' }}>{i + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '8px 14px', fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                    ))}
                  </tr>
                ))}
                {result.summary && (
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                    <td style={{ padding: '8px 14px', fontSize: 11.5, color: '#9ca3af' }}>Total</td>
                    {result.summary.map((cell, j) => (
                      <td key={j} style={{ padding: '8px 14px', fontSize: 12.5, color: '#111', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {result && displayRows.length > 0 && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{displayRows.length} records</span>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{REPORT_TYPES.find(r => r.value === reportType)?.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
