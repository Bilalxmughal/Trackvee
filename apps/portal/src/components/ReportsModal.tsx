import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { IconChartBar, IconDownload, IconFileSpreadsheet, IconPrinter, IconSearch, IconBookmark, IconTrash, IconRefresh } from '@tabler/icons-react';
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
  vehicleCount?: number;
  type?: ReportType;
  from?: string;
  to?: string;
}

interface SavedReport {
  id: string;
  title: string;
  type: string;
  params: Record<string, unknown>;
  userName: string | null;
  createdAt: string;
}

const REPORT_TYPES: { value: ReportType; label: string; group: string; opts?: ('speed'|'minStop'|'minSpeed'|'geofence')[] }[] = [
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
  { value: 'geofence_activity',  label: 'Geofence Activity',    group: 'Geofence',  opts: ['geofence'] },
];

const REPORT_TYPE_LABEL: Record<string, string> = Object.fromEntries(REPORT_TYPES.map(r => [r.value, r.label]));

function toDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const PERIODS: { label: string; get: () => { f: string; t: string } }[] = [
  { label: 'Today',      get: () => { const d = new Date(); return { f: toDate(d)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Yesterday',  get: () => { const d = new Date(); d.setDate(d.getDate()-1); return { f: toDate(d)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'This Week',  get: () => { const d = new Date(), day = d.getDay(), s = new Date(d); s.setDate(d.getDate()-day); return { f: toDate(s)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Last Week',  get: () => { const d = new Date(), day = d.getDay(), e = new Date(d); e.setDate(d.getDate()-day-1); const s = new Date(e); s.setDate(e.getDate()-6); return { f: toDate(s)+'T00:00', t: toDate(e)+'T23:59' }; } },
  { label: 'This Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); return { f: toDate(s)+'T00:00', t: toDate(d)+'T23:59' }; } },
  { label: 'Last Month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth()-1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return { f: toDate(s)+'T00:00', t: toDate(e)+'T23:59' }; } },
];

// ── Save Modal ────────────────────────────────────────────────────────────────
function SaveModal({ onSave, onClose }: { onSave: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>Save Report</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Report Title</label>
        <input ref={ref} style={{ ...inp, marginBottom: 20 }} placeholder="e.g. Monthly Travel — Fleet A" value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onSave(title.trim()); if (e.key === 'Escape') onClose(); }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => title.trim() && onSave(title.trim())} disabled={!title.trim()}
            style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: !title.trim() ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: !title.trim() ? 'not-allowed' : 'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsModal({ onClose }: { onClose: () => void }) {
  const [vehicles,      setVehicles]      = useState<VehicleOption[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [geofences,     setGeofences]     = useState<{ id: string; name: string }[]>([]);
  const [selectedVehs,  setSelectedVehs]  = useState<string[]>([]);
  const [selectedGFs,   setSelectedGFs]   = useState<string[]>([]);

  const [reportType,  setReportType]  = useState<ReportType>('travel_summary');
  const [fromDt,      setFromDt]      = useState(() => toDate(new Date())+'T00:00');
  const [toDt,        setToDt]        = useState(() => toDate(new Date())+'T23:59');
  const [speedLimit,  setSpeedLimit]  = useState('');
  const [minSpeedKmh, setMinSpeedKmh] = useState('');
  const [minStopMin,  setMinStopMin]  = useState('1');
  const [groupBy,     setGroupBy]     = useState<''|'day'|'week'|'month'|'vehicle'>('');
  const [activePeriod,setActivePeriod]= useState('Today');
  const [q,           setQ]           = useState('');

  const [result,       setResult]       = useState<ReportResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const [saved,         setSaved]         = useState<SavedReport[]>([]);
  const [savedLoading,  setSavedLoading]  = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [showSaved,     setShowSaved]     = useState(false);

  const opts = REPORT_TYPES.find(r => r.value === reportType)?.opts ?? [];

  useEffect(() => {
    api.get<{ id:string; name:string; licensePlate?:string|null; make?:string|null; model?:string|null }[]>('/vehicles')
      .then(r => setVehicles(r.data.map(v => ({ id: v.id, name: v.name, licensePlate: v.licensePlate ?? null, make: v.make ?? null, model: v.model ?? null }))))
      .catch(() => {});
    api.get<VehicleGroup[]>('/vehicle-groups').then(r => setVehicleGroups(r.data)).catch(() => {});
    api.get<{ id: string; name: string }[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {});
    loadSaved();
  }, []);

  const loadSaved = () => {
    setSavedLoading(true);
    api.get<SavedReport[]>('/reports/saved').then(r => setSaved(r.data)).catch(() => {}).finally(() => setSavedLoading(false));
  };

  const applyPeriod = (label: string) => {
    const p = PERIODS.find(x => x.label === label); if (!p) return;
    const d = p.get(); setFromDt(d.f); setToDt(d.t); setActivePeriod(label);
  };

  const buildParams = () => ({
    type: reportType,
    vehicleIds: selectedVehs.join(','),
    from: new Date(fromDt).toISOString(),
    to: new Date(toDt).toISOString(),
    ...(speedLimit && opts.includes('speed')     ? { speedLimit }  : {}),
    ...(minSpeedKmh && opts.includes('minSpeed') ? { minSpeedKmh } : {}),
    ...(minStopMin && opts.includes('minStop')   ? { minStopMin }  : {}),
    ...(selectedGFs.length                       ? { geofenceIds: selectedGFs.join(',') } : {}),
    ...(groupBy                                  ? { groupBy }     : {}),
  });

  const generate = async () => {
    if (!selectedVehs.length) { setError('Select at least one vehicle'); return; }
    setError(''); setLoading(true); setResult(null); setQ('');
    try {
      const { data } = await api.get<ReportResult>(`/reports?${new URLSearchParams(buildParams())}`);
      setResult(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Could not generate report');
    } finally { setLoading(false); }
  };

  const handleSave = async (title: string) => {
    setShowSaveModal(false);
    try {
      await api.post('/reports/saved', {
        title, type: reportType,
        params: { vehicleIds: selectedVehs, from: fromDt, to: toDt, speedLimit, minSpeedKmh, minStopMin, geofenceIds: selectedGFs, groupBy },
      });
      loadSaved();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setDeleteId(null);
    try { await api.delete(`/reports/saved/${id}`); loadSaved(); } catch {}
  };

  const loadSavedReport = (sr: SavedReport) => {
    const p = sr.params as Record<string, unknown>;
    setReportType(sr.type as ReportType);
    if (p.vehicleIds) setSelectedVehs(Array.isArray(p.vehicleIds) ? p.vehicleIds as string[] : String(p.vehicleIds).split(',').filter(Boolean));
    if (p.from) setFromDt(String(p.from));
    if (p.to)   setToDt(String(p.to));
    if (p.speedLimit)  setSpeedLimit(String(p.speedLimit));
    if (p.minSpeedKmh) setMinSpeedKmh(String(p.minSpeedKmh));
    if (p.minStopMin)  setMinStopMin(String(p.minStopMin));
    if (p.geofenceIds) setSelectedGFs(Array.isArray(p.geofenceIds) ? p.geofenceIds as string[] : String(p.geofenceIds).split(',').filter(Boolean));
    if (p.groupBy) setGroupBy(p.groupBy as ''|'day'|'week'|'month'|'vehicle');
    setActivePeriod('');
    setResult(null);
    setShowSaved(false);
  };

  const exportCsv = () => {
    if (!result) return;
    const lines = [result.columns.join(','), ...result.rows.map(r => r.map(c => `"${c ?? ''}"`).join(','))];
    if (result.summary) lines.push(result.summary.map(c => `"${c ?? ''}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report-${reportType}-${toDate(new Date())}.csv`; a.click();
  };

  const exportExcel = () => {
    if (!result) return;
    const ws = XLSX.utils.aoa_to_sheet([result.columns, ...result.rows, ...(result.summary ? [result.summary] : [])]);
    ws['!cols'] = result.columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (REPORT_TYPE_LABEL[reportType] ?? reportType).slice(0, 31));
    XLSX.writeFile(wb, `report-${reportType}-${toDate(new Date())}.xlsx`);
  };

  const displayRows = q
    ? result?.rows.filter(row => row.some(c => String(c ?? '').toLowerCase().includes(q.toLowerCase())))
    : result?.rows ?? [];

  const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}-${d.getFullYear()}`; };

  const inpStyle: React.CSSProperties = { padding: '5px 9px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'block' };
  const btnOutline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' };

  return (
    <>
      <style>{`@media print{body *{visibility:hidden!important}#rpt-print-portal,#rpt-print-portal *{visibility:visible!important}#rpt-print-portal{position:fixed;top:0;left:0;width:100%}}`}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, width: 'min(1200px, 97vw)', height: 'min(800px, 96vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
            <IconChartBar size={16} color="#dc2626" strokeWidth={1.75} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Reports</span>
            <button onClick={() => { setShowSaved(s => !s); }} style={{ ...btnOutline, fontSize: 11.5 }}>
              <IconBookmark size={12} /> Saved
            </button>
            <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex', marginLeft: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Saved Reports Panel */}
          {showSaved && (
            <div style={{ borderBottom: '1px solid #f0f0f0', flexShrink: 0, maxHeight: 220, overflowY: 'auto', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#333', flex: 1 }}>Saved Reports</span>
                <button onClick={loadSaved} style={{ ...btnOutline, padding: '3px 8px', fontSize: 11 }}><IconRefresh size={11} /> Refresh</button>
              </div>
              {savedLoading && <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#bbb' }}>Loading…</div>}
              {!savedLoading && saved.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#bbb' }}>No saved reports yet</div>
              )}
              {!savedLoading && saved.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {['Title', 'Type', 'Date Range', 'Saved By', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {saved.map(sr => {
                      const p = sr.params as Record<string, unknown>;
                      const fromStr = p.from ? fmtDate(String(p.from)) : '—';
                      const toStr   = p.to   ? fmtDate(String(p.to))   : '—';
                      return (
                        <tr key={sr.id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 500, color: '#111' }}>{sr.title}</td>
                          <td style={{ padding: '6px 12px', color: '#555' }}>{REPORT_TYPE_LABEL[sr.type] ?? sr.type}</td>
                          <td style={{ padding: '6px 12px', color: '#777', whiteSpace: 'nowrap' }}>{fromStr} — {toStr}</td>
                          <td style={{ padding: '6px 12px', color: '#999' }}>{sr.userName ?? '—'}</td>
                          <td style={{ padding: '6px 12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => loadSavedReport(sr)} style={{ ...btnOutline, padding: '3px 10px', fontSize: 11 }}>Load</button>
                              {deleteId === sr.id ? (
                                <>
                                  <button onClick={() => handleDelete(sr.id)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Confirm</button>
                                  <button onClick={() => setDeleteId(null)} style={{ ...btnOutline, padding: '3px 8px', fontSize: 11 }}>Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => setDeleteId(sr.id)} style={{ ...btnOutline, padding: '3px 7px' }}><IconTrash size={12} color="#dc2626" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Filter bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0, flexWrap: 'wrap', background: '#fafafa' }}>

            <div>
              <span style={lbl}>Report Type</span>
              <select value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setResult(null); setError(''); }}
                style={{ ...inpStyle, cursor: 'pointer', minWidth: 175 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                {['Travel','Activity','Speed','Events','Geofence'].map(g => (
                  <optgroup key={g} label={g}>
                    {REPORT_TYPES.filter(r => r.group === g).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <span style={lbl}>Vehicles</span>
              <VehicleMultiSelect vehicles={vehicles} groups={vehicleGroups} selected={selectedVehs} onChange={setSelectedVehs} />
            </div>

            <div>
              <span style={lbl}>Period</span>
              <select value={activePeriod} onChange={e => applyPeriod(e.target.value)}
                style={{ ...inpStyle, cursor: 'pointer', minWidth: 110 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <option value="">Custom</option>
                {PERIODS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <span style={lbl}>From</span>
              <input type="datetime-local" value={fromDt} onChange={e => { setFromDt(e.target.value); setActivePeriod(''); }} style={inpStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
            </div>

            <div>
              <span style={lbl}>To</span>
              <input type="datetime-local" value={toDt} onChange={e => { setToDt(e.target.value); setActivePeriod(''); }} style={inpStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
            </div>

            {opts.includes('speed') && (
              <div>
                <span style={lbl}>Speed Limit (km/h)</span>
                <input type="number" min={1} max={300} value={speedLimit} onChange={e => setSpeedLimit(e.target.value)} placeholder="e.g. 80"
                  style={{ ...inpStyle, width: 90 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
              </div>
            )}

            {opts.includes('minStop') && (
              <div>
                <span style={lbl}>Min Stop (min)</span>
                <input type="number" min={1} value={minStopMin} onChange={e => setMinStopMin(e.target.value)}
                  style={{ ...inpStyle, width: 80 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
              </div>
            )}

            {opts.includes('minSpeed') && (
              <div>
                <span style={lbl}>Min Speed (km/h)</span>
                <input type="number" min={1} value={minSpeedKmh} onChange={e => setMinSpeedKmh(e.target.value)}
                  style={{ ...inpStyle, width: 90 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
              </div>
            )}

            {opts.includes('geofence') && (
              <div>
                <span style={lbl}>Geofence</span>
                <select value={selectedGFs[0] ?? ''} onChange={e => setSelectedGFs(e.target.value ? [e.target.value] : [])}
                  style={{ ...inpStyle, cursor: 'pointer', minWidth: 140 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                  <option value="">All Geofences</option>
                  {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <span style={lbl}>Group By</span>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as ''|'day'|'week'|'month'|'vehicle')}
                style={{ ...inpStyle, cursor: 'pointer', width: 90 }}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <option value="">None</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="vehicle">Vehicle</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
              <button onClick={generate} disabled={loading || !selectedVehs.length}
                style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: !selectedVehs.length || loading ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: !selectedVehs.length || loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Loading…' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626', flexShrink: 0 }}>{error}</div>
          )}

          {/* Results */}
          <div id="rpt-print-portal" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Result toolbar */}
            {result && (displayRows ?? []).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111' }}>{REPORT_TYPE_LABEL[reportType]}</span>
                  <span style={{ fontSize: 11, color: '#bbb', marginLeft: 8 }}>{(displayRows ?? []).length} records</span>
                </div>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <IconSearch size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc', pointerEvents: 'none' }} />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search results…"
                    style={{ ...inpStyle, paddingLeft: 26, width: 160 }}
                    onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                </div>
                <button onClick={exportCsv} style={btnOutline}><IconDownload size={12} /> CSV</button>
                <button onClick={exportExcel} style={btnOutline}><IconFileSpreadsheet size={12} /> Excel</button>
                <button onClick={() => window.print()} style={btnOutline}><IconPrinter size={12} /> Print</button>
                <button onClick={() => setShowSaveModal(true)} style={btnOutline}><IconBookmark size={12} /> Save</button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && !error && (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <IconChartBar size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 12.5, color: '#bbb' }}>Select vehicles and a date range, then click Generate</div>
              </div>
            )}
            {loading && (
              <div style={{ padding: 60, textAlign: 'center', fontSize: 12.5, color: '#bbb' }}>Generating report…</div>
            )}
            {!loading && result && (displayRows ?? []).length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 12.5, color: '#bbb' }}>No data found for this range</div>
            )}

            {/* Table */}
            {result && (displayRows ?? []).length > 0 && (
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#bbb', textAlign: 'left' }}>#</th>
                      {result.columns.map(c => (
                        <th key={c} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(displayRows ?? []).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f7f7f7', background: i % 2 ? '#fafafa' : '#fff' }}>
                        <td style={{ padding: '7px 12px', fontSize: 11.5, color: '#bbb' }}>{i + 1}</td>
                        {row.map((cell, j) => (
                          <td key={j} style={{ padding: '7px 12px', fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {result.summary && (
                    <tfoot>
                      <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                        <td style={{ padding: '7px 12px', fontSize: 11.5, color: '#9ca3af' }}>Total</td>
                        {result.summary.map((cell, j) => (
                          <td key={j} style={{ padding: '7px 12px', fontSize: 12.5, color: '#111', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && <SaveModal onSave={handleSave} onClose={() => setShowSaveModal(false)} />}
    </>
  );
}
