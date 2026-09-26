import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { IconFileSpreadsheet, IconFileTypeCsv, IconPrinter, IconChevronDown, IconSearch } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import VehicleMultiSelect, { VehicleOption, VehicleGroup } from '../components/VehicleMultiSelect';

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportType =
  | 'travel_summary' | 'stops_move_summary' | 'stoppage_summary' | 'move_summary'
  | 'ignition_on_off' | 'overspeed' | 'overspeed_summary' | 'underspeed'
  | 'daily_travel' | 'vehicle_history' | 'alert_history' | 'driver_behavior'
  | 'geofence_activity';

interface ReportResult {
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
  vehicleCount: number;
  rowCount: number;
  columns: string[];
  rows: (string | number | null)[][];
  summary: (string | number | null)[] | null;
}

const REPORT_TYPES: { value: ReportType; label: string; group: string; opts?: ('speed' | 'minStop' | 'minSpeed' | 'geofence')[] }[] = [
  { value: 'travel_summary',     label: 'Travel Summary',         group: 'Travel',   opts: ['speed'] },
  { value: 'stops_move_summary', label: 'Stops & Move Summary',   group: 'Travel',   opts: ['speed', 'minStop'] },
  { value: 'stoppage_summary',   label: 'Stoppage Summary',       group: 'Travel',   opts: ['minStop'] },
  { value: 'move_summary',       label: 'Move Summary',           group: 'Travel' },
  { value: 'daily_travel',       label: 'Daily Travel Report',    group: 'Travel',   opts: ['speed'] },
  { value: 'ignition_on_off',    label: 'Ignition ON / OFF',      group: 'Activity' },
  { value: 'vehicle_history',    label: 'Vehicle History',        group: 'Activity' },
  { value: 'overspeed',          label: 'Overspeed',              group: 'Speed',    opts: ['speed'] },
  { value: 'overspeed_summary',  label: 'Overspeed Summary',      group: 'Speed',    opts: ['speed'] },
  { value: 'underspeed',         label: 'Underspeed',             group: 'Speed',    opts: ['minSpeed'] },
  { value: 'alert_history',      label: 'Alert History',          group: 'Events' },
  { value: 'driver_behavior',    label: 'Driver Behavior',        group: 'Events' },
  { value: 'geofence_activity',  label: 'Geofence Activity',      group: 'Geofence', opts: ['geofence'] },
];

const PERIODS: { label: string; getDates: () => { from: string; to: string } }[] = [
  { label: 'Today',         getDates: () => { const d = new Date(); return { from: toDate(d) + 'T00:00', to: toDate(d) + 'T23:59' }; } },
  { label: 'Yesterday',     getDates: () => { const d = new Date(); d.setDate(d.getDate()-1); return { from: toDate(d) + 'T00:00', to: toDate(d) + 'T23:59' }; } },
  { label: 'This Week',     getDates: () => { const d = new Date(), day = d.getDay(); const s = new Date(d); s.setDate(d.getDate()-day); return { from: toDate(s)+'T00:00', to: toDate(d)+'T23:59' }; } },
  { label: 'Last Week',     getDates: () => { const d = new Date(), day = d.getDay(); const e = new Date(d); e.setDate(d.getDate()-day-1); const s = new Date(e); s.setDate(e.getDate()-6); return { from: toDate(s)+'T00:00', to: toDate(e)+'T23:59' }; } },
  { label: 'This Month',    getDates: () => { const d = new Date(); return { from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01T00:00`, to: toDate(d)+'T23:59' }; } },
  { label: 'Last Month',    getDates: () => { const d = new Date(); d.setDate(0); const s = new Date(d.getFullYear(), d.getMonth(), 1); return { from: toDate(s)+'T00:00', to: toDate(d)+'T23:59' }; } },
  { label: 'Custom', getDates: () => { const d = new Date(); return { from: toDate(d)+'T00:00', to: toDate(d)+'T23:59' }; } },
];

function toDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// ── Styles ────────────────────────────────────────────────────────────────────
const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none' };
const btn = (variant: 'primary' | 'outline' | 'ghost'): React.CSSProperties => ({
  height: 30, padding: '0 14px', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
  ...(variant === 'primary'  ? { background: '#dc2626', color: '#fff', border: '1px solid #dc2626' } : {}),
  ...(variant === 'outline'  ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--input-border)' } : {}),
  ...(variant === 'ghost'    ? { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--input-border)' } : {}),
});

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [vehicles, setVehicles]     = useState<VehicleOption[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [geofences, setGeofences]   = useState<{ id: string; name: string }[]>([]);
  const [selectedVehs, setSelectedVehs] = useState<string[]>([]);
  const [selectedGFs, setSelectedGFs]   = useState<string[]>([]);
  const [reportType, setReportType] = useState<ReportType>('travel_summary');
  const [period, setPeriod]         = useState('Today');
  const [fromDt, setFromDt]         = useState(() => { const d = new Date(); return `${toDate(d)}T00:00`; });
  const [toDt, setToDt]             = useState(() => { const d = new Date(); return `${toDate(d)}T23:59`; });
  const [speedLimit, setSpeedLimit] = useState(80);
  const [minSpeedKmh, setMinSpeedKmh] = useState(20);
  const [minStopMin, setMinStopMin] = useState(1);

  const [result, setResult]   = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [q, setQ]             = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const currentTypeDef = REPORT_TYPES.find(r => r.value === reportType)!;
  const opts = currentTypeDef.opts ?? [];

  useEffect(() => {
    api.get<{ id: string; name: string; licensePlate?: string }[]>('/vehicles').then(r => setVehicles(r.data.map(v => ({ id: v.id, name: v.name, licensePlate: v.licensePlate ?? null })))).catch(() => {});
    api.get<VehicleGroup[]>('/vehicle-groups').then(r => setVehicleGroups(r.data)).catch(() => {});
    api.get<{ id: string; name: string }[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {});
  }, []);

  const applyPeriod = (lbl: string) => {
    setPeriod(lbl);
    const p = PERIODS.find(p => p.label === lbl);
    if (p && lbl !== 'Custom') { const d = p.getDates(); setFromDt(d.from); setToDt(d.to); }
  };

  const generate = async () => {
    if (!selectedVehs.length) { setError('Kam az kam ek vehicle select karo'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const params = new URLSearchParams({
        type: reportType,
        vehicleIds: selectedVehs.join(','),
        from: new Date(fromDt).toISOString(),
        to: new Date(toDt).toISOString(),
        speedLimit: String(speedLimit),
        minSpeedKmh: String(minSpeedKmh),
        minStopMin: String(minStopMin),
        ...(selectedGFs.length ? { geofenceIds: selectedGFs.join(',') } : {}),
      });
      const r = await api.get<ReportResult>(`/reports?${params}`);
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Report generate nahi hua');
    } finally { setLoading(false); }
  };

  const exportCsv = async () => {
    if (!result) return;
    const params = new URLSearchParams({
      type: reportType, vehicleIds: selectedVehs.join(','),
      from: new Date(fromDt).toISOString(), to: new Date(toDt).toISOString(),
      speedLimit: String(speedLimit), minSpeedKmh: String(minSpeedKmh), minStopMin: String(minStopMin),
      ...(selectedGFs.length ? { geofenceIds: selectedGFs.join(',') } : {}),
    });
    const r = await api.get(`/reports/export?${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `report-${reportType}-${toDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!result) return;
    const ws = XLSX.utils.aoa_to_sheet([result.columns, ...result.rows, ...(result.summary ? [result.summary] : [])]);
    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    ws['!cols'] = result.columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentTypeDef.label.slice(0, 31));
    XLSX.writeFile(wb, `report-${reportType}-${toDate(new Date())}.xlsx`);
  };

  const printReport = () => { window.print(); };

  // Filter rows by search
  const displayRows = q
    ? result?.rows.filter(row => row.some(cell => String(cell ?? '').toLowerCase().includes(q.toLowerCase())))
    : result?.rows;

  return (
    <div style={{ padding: '0 0 60px' }} id="reports-page">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #reports-print-area, #reports-print-area * { visibility: visible !important; }
          #reports-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <PageHeader
        title="Reports"
        action={
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {result && <>
              <button style={btn('ghost')} onClick={exportCsv}><IconFileTypeCsv size={14} /> CSV</button>
              <button style={btn('ghost')} onClick={exportExcel}><IconFileSpreadsheet size={14} /> Excel</button>
              <button style={btn('ghost')} onClick={printReport}><IconPrinter size={14} /> Print / PDF</button>
            </>}
            <button style={btn('primary')} onClick={generate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        }
      />

      {/* Config Row */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 20px 16px', alignItems: 'flex-end' }}>
        {/* Report Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Report Type</span>
          <select style={{ ...sel, minWidth: 200 }} value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setResult(null); }}>
            {['Travel', 'Activity', 'Speed', 'Events', 'Geofence'].map(group => (
              <optgroup key={group} label={group}>
                {REPORT_TYPES.filter(r => r.group === group).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Vehicles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Vehicles</span>
          <VehicleMultiSelect vehicles={vehicles} groups={vehicleGroups} selected={selectedVehs} onChange={setSelectedVehs} />
        </div>

        {/* Period */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Period</span>
          <select style={sel} value={period} onChange={e => applyPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.label}>{p.label}</option>)}
          </select>
        </div>

        {/* Date From */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Date From</span>
          <input type="datetime-local" style={inp} value={fromDt} onChange={e => { setFromDt(e.target.value); setPeriod('Custom'); }} />
        </div>

        {/* Date To */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Date To</span>
          <input type="datetime-local" style={inp} value={toDt} onChange={e => { setToDt(e.target.value); setPeriod('Custom'); }} />
        </div>

        {/* Conditional Options */}
        {opts.includes('speed') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Speed Limit (km/h)</span>
            <input type="number" min={1} max={300} style={{ ...inp, width: 80 }} value={speedLimit} onChange={e => setSpeedLimit(+e.target.value)} />
          </div>
        )}
        {opts.includes('minStop') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Min Stop (min)</span>
            <input type="number" min={1} max={120} style={{ ...inp, width: 72 }} value={minStopMin} onChange={e => setMinStopMin(+e.target.value)} />
          </div>
        )}
        {opts.includes('minSpeed') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Min Speed (km/h)</span>
            <input type="number" min={1} max={200} style={{ ...inp, width: 90 }} value={minSpeedKmh} onChange={e => setMinSpeedKmh(+e.target.value)} />
          </div>
        )}
        {opts.includes('geofence') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Geofences</span>
            <select style={{ ...sel, minWidth: 160 }} value={selectedGFs[0] ?? ''} onChange={e => setSelectedGFs(e.target.value ? [e.target.value] : [])}>
              <option value="">All Geofences</option>
              {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="no-print" style={{ margin: '0 20px 12px', padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontSize: 12 }}>{error}</div>}

      {/* Loading */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

      {/* Empty State */}
      {!loading && !result && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13 }}>Select vehicles and date range, then click <strong>Generate Report</strong></div>
        </div>
      )}

      {/* Result */}
      {!loading && result && (
        <div id="reports-print-area" ref={printRef}>
          {/* Print Header */}
          <div style={{ padding: '0 20px 10px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {currentTypeDef.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {result.from} — {result.to} &nbsp;·&nbsp; {result.vehicleCount} vehicle{result.vehicleCount !== 1 ? 's' : ''} &nbsp;·&nbsp; {result.rowCount} rows &nbsp;·&nbsp; Generated: {result.generatedAt}
            </div>
          </div>

          {/* Search */}
          <div className="no-print" style={{ padding: '0 20px 10px' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input style={{ ...inp, paddingLeft: 28, width: 220 }} placeholder="Search results..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', padding: '0 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--table-head-bg, var(--bg2))', borderBottom: '2px solid var(--table-border)' }}>
                  {result.columns.map(col => (
                    <th key={col} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(displayRows ?? []).length === 0 ? (
                  <tr><td colSpan={result.columns.length} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No data in selected range</td></tr>
                ) : (displayRows ?? []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--table-border)', background: i % 2 === 0 ? 'transparent' : 'var(--table-alt-bg, transparent)' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '6px 10px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {cell === null || cell === '' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {result.summary && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--table-border)', background: 'var(--bg2)' }}>
                    {result.summary.map((cell, j) => (
                      <td key={j} style={{ padding: '7px 10px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {cell === null || cell === '' ? '' : cell}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {result.rowCount > 1000 && (
            <div style={{ padding: '10px 20px', fontSize: 11, color: 'var(--text-muted)' }}>
              {result.rowCount.toLocaleString()} rows total — export to Excel/CSV for full data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
