import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  IconFileSpreadsheet, IconFileTypeCsv, IconPrinter,
  IconSearch, IconTrash, IconBookmark, IconRefresh, IconChevronDown,
} from '@tabler/icons-react';
import CustomSelect from '../components/CustomSelect';
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
  type: ReportType; from: string; to: string; generatedAt: string;
  vehicleCount: number; rowCount: number;
  columns: string[]; rows: (string|number|null)[][];
  summary: (string|number|null)[] | null;
}

interface SavedReport {
  id: string; title: string; type: string;
  params: Record<string, unknown>; userName: string | null; createdAt: string;
}

interface ScheduledReportItem {
  id: string; title: string; reportType: string; period: string; timePkt: string; active: boolean;
  reportFromTime: string | null; reportToTime: string | null; recipientEmails: string[];
  nextRunAt: string; lastSentAt: string | null; lastError: string | null;
}

interface ScheduleDraft {
  title: string; period: string; timePkt: string; reportFromTime: string | null;
  reportToTime: string | null; recipientEmails: string[]; reportType?: string;
  params?: Record<string, unknown>;
}

const SCHEDULE_PERIODS = [
  { value: 'daily_window', label: 'Daily time window' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_24_hours', label: 'Last 24 hours' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
];

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

const PERIODS = [
  { label: 'Today',      get: () => { const d=new Date(); return {f:toDate(d)+'T00:00',t:toDate(d)+'T23:59'}; } },
  { label: 'Yesterday',  get: () => { const d=new Date(); d.setDate(d.getDate()-1); return {f:toDate(d)+'T00:00',t:toDate(d)+'T23:59'}; } },
  { label: 'This Week',  get: () => { const d=new Date(),day=d.getDay(),s=new Date(d); s.setDate(d.getDate()-day); return {f:toDate(s)+'T00:00',t:toDate(d)+'T23:59'}; } },
  { label: 'Last Week',  get: () => { const d=new Date(),day=d.getDay(),e=new Date(d); e.setDate(d.getDate()-day-1); const s=new Date(e); s.setDate(e.getDate()-6); return {f:toDate(s)+'T00:00',t:toDate(e)+'T23:59'}; } },
  { label: 'This Month', get: () => { const d=new Date(); return {f:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01T00:00`,t:toDate(d)+'T23:59'}; } },
  { label: 'Last Month', get: () => { const d=new Date(); d.setDate(0); const s=new Date(d.getFullYear(),d.getMonth(),1); return {f:toDate(s)+'T00:00',t:toDate(d)+'T23:59'}; } },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { height:34, padding:'0 8px', border:'1px solid var(--input-border)', borderRadius:6, fontSize:12, color:'var(--input-color)', background:'var(--input-bg)', outline:'none', width:'100%' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer' };
const lbl: React.CSSProperties = { fontSize:11, fontWeight:600, color:'var(--text-muted)', marginBottom:4, display:'block' };
const field = (w?: number): React.CSSProperties => ({ display:'flex', flexDirection:'column', minWidth: w ?? 140 });
const btnS = (variant:'primary'|'outline'|'ghost'|'danger'): React.CSSProperties => ({
  height:34, padding:'0 14px', borderRadius: variant==='primary' ? 8 : 6, fontSize:12, fontWeight:500, cursor:'pointer',
  display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
  ...(variant==='primary' ? {background:'#dc2626',color:'#fff',border:'1px solid #dc2626'} : {}),
  ...(variant==='outline' ? {background:'transparent',color:'var(--text)',border:'1px solid var(--input-border)'} : {}),
  ...(variant==='ghost'   ? {background:'transparent',color:'var(--text-muted)',border:'1px solid var(--input-border)'} : {}),
  ...(variant==='danger'  ? {background:'transparent',color:'#dc2626',border:'1px solid #dc2626'} : {}),
});
const btnActionS: React.CSSProperties = {
  display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'3px 10px',
  borderRadius:5, border:'1px solid var(--input-border)', background:'var(--card-bg)',
  color:'var(--text)', fontSize:11, cursor:'pointer', whiteSpace:'nowrap',
};

// ── Save Modal ────────────────────────────────────────────────────────────────
function SaveModal({ onSave, onClose }: { onSave:(title:string)=>void; onClose:()=>void }) {
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:10,padding:24,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:16}}>Save Report</div>
        <label style={lbl}>Report Title</label>
        <input ref={ref} style={{...inp,marginBottom:20}} placeholder="e.g. Monthly Travel — Fleet A" value={title} onChange={e=>setTitle(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&title.trim()) onSave(title.trim()); if(e.key==='Escape') onClose();}} />
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button style={btnS('outline')} onClick={onClose}>Cancel</button>
          <button style={btnS('primary')} disabled={!title.trim()} onClick={()=>onSave(title.trim())}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ report, existing, savedReports, configured, error, saving, onClose, onSubmit }: { report?: SavedReport; existing?: ScheduledReportItem; savedReports: SavedReport[]; configured: boolean; error:string; saving:boolean; onClose:()=>void; onSubmit:(draft:ScheduleDraft)=>void }) {
  const [title, setTitle] = useState(existing?.title ?? report?.title ?? '');
  const [period, setPeriod] = useState(existing?.period ?? 'daily_window');
  const [timePkt, setTimePkt] = useState(existing?.timePkt ?? '23:00');
  const [fromTime, setFromTime] = useState(existing?.reportFromTime ?? '09:00');
  const [toTime, setToTime] = useState(existing?.reportToTime ?? '22:00');
  const [recipientText, setRecipientText] = useState(existing?.recipientEmails.join(', ') ?? '');
  const [replacementId, setReplacementId] = useState('');
  const dailyWindowValid = period !== 'daily_window' || (fromTime < toTime && toTime < timePkt);
  const chosenReport = savedReports.find(item => item.id === replacementId);
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:10,padding:24,width:420,maxWidth:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
      <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>{existing ? 'Edit Report Template' : 'Create Report Template'}</div>
      <label style={lbl}>Template name</label>
      <input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} style={{...inp,marginBottom:12}} placeholder="e.g. Daily fleet overspeed" />
      {existing ? <><label style={lbl}>Report configuration</label><select value={replacementId} onChange={e=>setReplacementId(e.target.value)} style={{...sel,marginBottom:14}}><option value="">Keep current report and filters</option>{savedReports.map(item=><option key={item.id} value={item.id}>{item.title} · {REPORT_TYPE_LABEL[item.type]??item.type}</option>)}</select></> : <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>{report?.title} · {REPORT_TYPE_LABEL[report?.type??'']??report?.type}</div>}
      <label style={lbl}>Report data period</label>
      <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...sel,marginBottom:14}}>
        {SCHEDULE_PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {period === 'daily_window' && <div style={{display:'flex',gap:10,marginBottom:12}}>
        <div style={{flex:1}}><label style={lbl}>From</label><input type="time" value={fromTime} onChange={e=>setFromTime(e.target.value)} style={inp}/></div>
        <div style={{flex:1}}><label style={lbl}>To</label><input type="time" value={toTime} onChange={e=>setToTime(e.target.value)} style={inp}/></div>
      </div>}
      <label style={lbl}>Email every day at · Pakistan time</label>
      <input type="time" value={timePkt} onChange={e=>setTimePkt(e.target.value)} style={{...inp,marginBottom:12}} />
      <label style={lbl}>Additional recipient emails (comma separated, up to 10)</label>
      <input value={recipientText} onChange={e=>setRecipientText(e.target.value)} placeholder="manager@example.com, ops@example.com" style={{...inp,marginBottom:12}} />
      {!dailyWindowValid && <div style={{fontSize:11,color:'#dc2626',marginBottom:12}}>The delivery time must be after the report window ends.</div>}
      <div style={{fontSize:11,color:configured?'var(--text-muted)':'#dc2626',marginBottom:16}}>
        {configured ? 'A copy always goes to your account email. Additional recipients will receive the same CSV.' : 'Email delivery is not configured on the server yet. The schedule can be saved, but emails will wait until delivery is configured.'}
      </div>
      {error && <div role="alert" style={{fontSize:12,color:'#dc2626',marginBottom:12}}>{error}</div>}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button style={btnS('outline')} onClick={onClose}>Cancel</button>
        <button style={btnS('primary')} disabled={saving||!dailyWindowValid||!title.trim()} onClick={()=>onSubmit({title:title.trim(),period,timePkt,reportFromTime:period==='daily_window'?fromTime:null,reportToTime:period==='daily_window'?toTime:null,recipientEmails:recipientText.split(/[;,\n]/).map(s=>s.trim()).filter(Boolean),...(chosenReport?{reportType:chosenReport.type,params:chosenReport.params}:!existing&&report?{reportType:report.type,params:report.params}:{})})}>{saving?(existing?'Saving…':'Creating…'):(existing?'Save Changes':'Save Template')}</button>
      </div>
    </div>
  </div>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [vehicles,      setVehicles]      = useState<VehicleOption[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [geofences,     setGeofences]     = useState<{id:string;name:string}[]>([]);
  const [selectedVehs,  setSelectedVehs]  = useState<string[]>([]);
  const [selectedGFs,   setSelectedGFs]   = useState<string[]>([]);

  const [reportType,  setReportType]  = useState<ReportType>('travel_summary');
  const [fromDt,      setFromDt]      = useState(() => toDate(new Date())+'T00:00');
  const [toDt,        setToDt]        = useState(() => toDate(new Date())+'T23:59');
  const [speedLimit,  setSpeedLimit]  = useState('');
  const [minSpeedKmh, setMinSpeedKmh] = useState('');
  const [minStopMin,  setMinStopMin]  = useState('1');
  const [groupBy,     setGroupBy]     = useState<''|'day'|'week'|'month'>('');
  const [activePeriod,setActivePeriod]= useState('Today');

  const [result,  setResult]  = useState<ReportResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [q,       setQ]       = useState('');

  const [saved,        setSaved]        = useState<SavedReport[]>([]);
  const [showSaveModal,setShowSaveModal]= useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [deleteId,     setDeleteId]     = useState<string|null>(null);
  const [schedules, setSchedules] = useState<ScheduledReportItem[]>([]);
  const [scheduleTarget, setScheduleTarget] = useState<{ report?: SavedReport; existing?: ScheduledReportItem }|null>(null);
  const [deliveryConfigured, setDeliveryConfigured] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const opts = REPORT_TYPES.find(r=>r.value===reportType)?.opts ?? [];

  useEffect(() => {
    api.get<{id:string;name:string;licensePlate?:string;make?:string;model?:string}[]>('/vehicles').then(r=>setVehicles(r.data.map(v=>({id:v.id,name:v.name,licensePlate:v.licensePlate??null,make:v.make??null,model:v.model??null})))).catch(()=>{});
    api.get<VehicleGroup[]>('/vehicle-groups').then(r=>setVehicleGroups(r.data)).catch(()=>{});
    api.get<{id:string;name:string}[]>('/geofences').then(r=>setGeofences(r.data)).catch(()=>{});
    loadSaved();
    loadSchedules();
  }, []);

  const loadSaved = () => {
    setSavedLoading(true);
    api.get<SavedReport[]>('/reports/saved').then(r=>setSaved(r.data)).catch(()=>{}).finally(()=>setSavedLoading(false));
  };

  const loadSchedules = () => {
    api.get<{deliveryConfigured:boolean;items:ScheduledReportItem[]}>('/reports/schedules').then(r=>{
      setSchedules(r.data.items); setDeliveryConfigured(r.data.deliveryConfigured);
    }).catch(()=>{});
  };

  const saveSchedule = async (draft: ScheduleDraft) => {
    if (!scheduleTarget) return;
    const target = scheduleTarget;
    setScheduleSaving(true); setScheduleError('');
    try {
      if (target.existing) await api.patch(`/reports/schedules/${target.existing.id}`, draft);
      else if (target.report) await api.post('/reports/schedules', { ...draft, reportType: target.report.type, params: target.report.params });
      else return;
      setScheduleTarget(null); setScheduleError(''); loadSchedules();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setScheduleError(message ?? 'Could not schedule this report');
    } finally { setScheduleSaving(false); }
  };

  const toggleSchedule = async (item: ScheduledReportItem) => {
    try { await api.patch(`/reports/schedules/${item.id}`, { active: !item.active }); loadSchedules(); }
    catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setScheduleError(message ?? 'Could not update schedule');
    }
  };

  const deleteSchedule = async (id: string) => {
    try { await api.delete(`/reports/schedules/${id}`); loadSchedules(); }
    catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setScheduleError(message ?? 'Could not delete schedule');
    }
  };

  const applyPeriod = (p: typeof PERIODS[0]) => {
    const d = p.get(); setFromDt(d.f); setToDt(d.t); setActivePeriod(p.label);
  };

  const buildParams = () => ({
    type: reportType, vehicleIds: selectedVehs.join(','),
    from: new Date(fromDt).toISOString(), to: new Date(toDt).toISOString(),
    ...(speedLimit  ? {speedLimit}  : {}),
    ...(minSpeedKmh ? {minSpeedKmh} : {}),
    ...(minStopMin  ? {minStopMin}  : {}),
    ...(selectedGFs.length ? {geofenceIds: selectedGFs.join(',')} : {}),
    ...(groupBy ? {groupBy} : {}),
  });

  const generate = async () => {
    if (!selectedVehs.length) { setError('Select at least one vehicle'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const r = await api.get<ReportResult>(`/reports?${new URLSearchParams(buildParams())}`);
      setResult(r.data);
    } catch(e:any) { setError(e?.response?.data?.message ?? 'Report generate nahi hua'); }
    finally { setLoading(false); }
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
    const p = sr.params as any;
    setReportType(sr.type as ReportType);
    if (p.vehicleIds) setSelectedVehs(Array.isArray(p.vehicleIds) ? p.vehicleIds : p.vehicleIds.split(',').filter(Boolean));
    if (p.from) setFromDt(p.from);
    if (p.to)   setToDt(p.to);
    if (p.speedLimit)  setSpeedLimit(String(p.speedLimit));
    if (p.minSpeedKmh) setMinSpeedKmh(String(p.minSpeedKmh));
    if (p.minStopMin)  setMinStopMin(String(p.minStopMin));
    if (p.geofenceIds) setSelectedGFs(Array.isArray(p.geofenceIds) ? p.geofenceIds : p.geofenceIds.split(',').filter(Boolean));
    if (p.groupBy)     setGroupBy(p.groupBy as ''|'day'|'week'|'month');
    setActivePeriod('');
    setResult(null);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const exportCsv = async () => {
    if (!result) return;
    const r = await api.get(`/reports/export?${new URLSearchParams(buildParams())}`, {responseType:'blob'});
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a'); a.href=url; a.download=`report-${reportType}-${toDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!result) return;
    const ws = XLSX.utils.aoa_to_sheet([result.columns, ...result.rows, ...(result.summary?[result.summary]:[])]);
    ws['!cols'] = result.columns.map(()=>({wch:20}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (REPORT_TYPE_LABEL[reportType]??reportType).slice(0,31));
    XLSX.writeFile(wb, `report-${reportType}-${toDate(new Date())}.xlsx`);
  };

  const displayRows = q ? result?.rows.filter(row=>row.some(c=>String(c??'').toLowerCase().includes(q.toLowerCase()))) : result?.rows;

  const fmtDate = (iso: string) => { const d=new Date(iso); return `${String(d.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}-${d.getFullYear()}`; };

  return (
    <div style={{padding:'0 0 60px'}} id="reports-page">
      <style>{`@media print{body *{visibility:hidden!important}#rpt-print,#rpt-print *{visibility:visible!important}#rpt-print{position:fixed;top:0;left:0;width:100%}.no-print{display:none!important}}`}</style>

      <PageHeader title="Reports" />

      {/* ── Config Panel ─────────────────────────────────────────────────── */}
      <div className="no-print" style={{padding:'0 20px 20px',borderBottom:'1px solid var(--border)'}}>

        {/* Single row: all fields + Generate */}
        <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end'}}>

          <div style={field(190)}>
            <span style={lbl}>Report Type</span>
            <CustomSelect value={reportType} onChange={v=>{setReportType(v as ReportType);setResult(null);}} options={(() => {
              const groups = ['Travel','Activity','Speed','Events','Geofence'];
              const out: {value:string;label:string;isGroup?:boolean}[] = [];
              groups.forEach(g => {
                const items = REPORT_TYPES.filter(r => r.group === g);
                if (items.length) {
                  out.push({ value: `__${g}`, label: g, isGroup: true });
                  items.forEach(r => out.push({ value: r.value, label: r.label }));
                }
              });
              return out;
            })()} minWidth={190} />
          </div>

          <div style={field(210)}>
            <span style={lbl}>Vehicles</span>
            <VehicleMultiSelect vehicles={vehicles} groups={vehicleGroups} selected={selectedVehs} onChange={setSelectedVehs} />
          </div>

          <div style={field(130)}>
            <span style={lbl}>Period</span>
            <CustomSelect value={activePeriod} onChange={v=>{const p=PERIODS.find(x=>x.label===v);if(p)applyPeriod(p);else setActivePeriod('');}} options={[{value:'',label:'Custom'},...PERIODS.map(p=>({value:p.label,label:p.label}))]} minWidth={130} />
          </div>

          <div style={field(160)}>
            <span style={lbl}>From</span>
            <input type="datetime-local" style={inp} value={fromDt} onChange={e=>{setFromDt(e.target.value);setActivePeriod('');}} />
          </div>

          <div style={field(160)}>
            <span style={lbl}>To</span>
            <input type="datetime-local" style={inp} value={toDt} onChange={e=>{setToDt(e.target.value);setActivePeriod('');}} />
          </div>

          {opts.includes('speed') && (
            <div style={field(85)}>
              <span style={lbl}>Speed Limit (km/h)</span>
              <input type="number" min={1} max={300} style={inp} placeholder="e.g. 80" value={speedLimit} onChange={e=>setSpeedLimit(e.target.value)} />
            </div>
          )}
          {opts.includes('minStop') && (
            <div style={field(85)}>
              <span style={lbl}>Min Stop (min)</span>
              <input type="number" min={1} max={120} style={inp} placeholder="e.g. 5" value={minStopMin} onChange={e=>setMinStopMin(e.target.value)} />
            </div>
          )}
          {opts.includes('minSpeed') && (
            <div style={field(85)}>
              <span style={lbl}>Min Speed (km/h)</span>
              <input type="number" min={1} max={200} style={inp} placeholder="e.g. 20" value={minSpeedKmh} onChange={e=>setMinSpeedKmh(e.target.value)} />
            </div>
          )}

          <div style={field(100)}>
            <span style={lbl}>Group By</span>
            <CustomSelect value={groupBy} onChange={v=>setGroupBy(v as ''|'day'|'week'|'month')} options={[{value:'',label:'None'},{value:'day',label:'Day'},{value:'week',label:'Week'},{value:'month',label:'Month'}]} minWidth={100} />
          </div>
          {opts.includes('geofence') && (
            <div style={field(170)}>
              <span style={lbl}>Geofence</span>
              <CustomSelect value={selectedGFs[0]??''} onChange={v=>setSelectedGFs(v?[v]:[])} options={[{value:'',label:'All Geofences'},...geofences.map(g=>({value:g.id,label:g.name}))]} minWidth={170} />
            </div>
          )}

          <div style={{marginTop:'auto'}}>
            <button style={btnS('primary')} onClick={generate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>


        {error && <div style={{marginTop:10,padding:'7px 12px',background:'#fee2e2',color:'#dc2626',borderRadius:4,fontSize:12}}>{error}</div>}
      </div>

      {/* ── Result ──────────────────────────────────────────────────────── */}
      {loading && <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner /></div>}

      {!loading && !result && !error && (
        <div style={{textAlign:'center',padding:'50px 20px',color:'var(--text-muted)',fontSize:13}}>
          Select vehicles and date range, then click <strong>Generate Report</strong>
        </div>
      )}

      {!loading && result && (
        <div id="rpt-print">
          {/* Result header */}
          <div style={{padding:'14px 20px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{REPORT_TYPE_LABEL[result.type]}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                {result.from} — {result.to} &nbsp;·&nbsp; {result.vehicleCount} vehicle{result.vehicleCount!==1?'s':''} &nbsp;·&nbsp; {result.rowCount} rows
              </div>
            </div>
            <div className="no-print" style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button style={btnS('ghost')} onClick={exportCsv}><IconFileTypeCsv size={14}/>CSV</button>
              <button style={btnS('ghost')} onClick={exportExcel}><IconFileSpreadsheet size={14}/>Excel</button>
              <button style={btnS('ghost')} onClick={()=>window.print()}><IconPrinter size={14}/>Print</button>
              <button style={btnS('outline')} onClick={()=>setShowSaveModal(true)}><IconBookmark size={14}/>Save Report</button>
              <button style={btnS('outline')} onClick={()=>{setScheduleError('');setScheduleTarget({report:{id:'current',title:REPORT_TYPE_LABEL[reportType],type:reportType,params:buildParams(),userName:null,createdAt:new Date().toISOString()}});}}>Create Template</button>
            </div>
          </div>

          {/* Search */}
          <div className="no-print" style={{padding:'0 20px 10px',display:'flex',alignItems:'center',gap:8}}>
            <div style={{position:'relative',width:220}}>
              <IconSearch size={13} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
              <input style={{...inp,paddingLeft:28}} placeholder="Search results..." value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
          </div>

          {/* Table */}
          <div style={{overflowX:'auto',overflowY:'auto',padding:'0 20px',maxHeight:'calc(100vh - 420px)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'var(--bg2)',borderBottom:'2px solid var(--border)'}}>
                  {result.columns.map(c=><th key={c} style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap',position:'sticky',top:0,background:'var(--bg2)',zIndex:2}}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {!(displayRows??[]).length
                  ? <tr><td colSpan={result.columns.length} style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>No data</td></tr>
                  : (displayRows??[]).map((row,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2?'var(--bg2)':'transparent'}}>
                      {row.map((cell,j)=><td key={j} style={{padding:'6px 10px',whiteSpace:'nowrap',color:'var(--text)'}}>{cell===null||cell===''?<span style={{color:'var(--text-muted)'}}>—</span>:cell}</td>)}
                    </tr>
                  ))
                }
              </tbody>
              {result.summary && (
                <tfoot>
                  <tr style={{borderTop:'2px solid var(--border)',background:'var(--bg2)'}}>
                    {result.summary.map((c,j)=><td key={j} style={{padding:'7px 10px',fontWeight:600,fontSize:11,whiteSpace:'nowrap'}}>{c===null||c===''?'':c}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Saved Reports ────────────────────────────────────────────────── */}
      <div className="no-print" style={{margin:'28px 20px 0',borderTop:'1px solid var(--border)',paddingTop:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600}}>Saved Reports</div>
          <button style={btnS('ghost')} onClick={loadSaved}><IconRefresh size={13}/>Refresh</button>
        </div>

        {savedLoading && <div style={{padding:'20px 0',textAlign:'center'}}><Spinner /></div>}

        {!savedLoading && saved.length === 0 && (
          <div style={{padding:'20px 0',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>
            No saved reports yet — generate a report and click <strong>Save Report</strong>
          </div>
        )}

        {!savedLoading && saved.length > 0 && (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'var(--bg2)',borderBottom:'2px solid var(--border)'}}>
                <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Title</th>
                <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Report Type</th>
                <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Date Range</th>
                <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Saved By</th>
                <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Saved On</th>
                <th style={{padding:'7px 10px',textAlign:'center',fontWeight:600,fontSize:11,color:'var(--text-muted)'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {saved.map((sr,i)=>{
                const p = sr.params as any;
                const fromStr = p.from ? fmtDate(p.from.includes('T') ? p.from : p.from+'T00:00') : '—';
                const toStr   = p.to   ? fmtDate(p.to.includes('T')   ? p.to   : p.to+'T23:59')   : '—';
                return (
                  <tr key={sr.id} style={{borderBottom:'1px solid var(--border)',background:i%2?'var(--bg2)':'transparent'}}>
                    <td style={{padding:'7px 10px',fontWeight:500,color:'var(--text)'}}>{sr.title}</td>
                    <td style={{padding:'7px 10px',color:'var(--text)'}}>{REPORT_TYPE_LABEL[sr.type]??sr.type}</td>
                    <td style={{padding:'7px 10px',color:'var(--text)',whiteSpace:'nowrap'}}>{fromStr} — {toStr}</td>
                    <td style={{padding:'7px 10px',color:'var(--text-muted)'}}>{sr.userName??'—'}</td>
                    <td style={{padding:'7px 10px',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{fmtDate(sr.createdAt)}</td>
                    <td style={{padding:'7px 10px',textAlign:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
                        <button title="Load & Generate" style={btnActionS} onClick={()=>loadSavedReport(sr)}>Load</button>
                        <button title="Create a reusable delivery template" style={btnActionS} onClick={()=>{setScheduleError('');setScheduleTarget({report:sr});}}>Schedule</button>
                        {deleteId===sr.id ? (
                          <>
                            <button style={{...btnActionS,border:'1px solid #dc2626',background:'#dc2626',color:'#fff'}} onClick={()=>handleDelete(sr.id)}>Confirm</button>
                            <button style={btnActionS} onClick={()=>setDeleteId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button title="Delete" aria-label={`Delete saved report ${sr.title}`} style={{...btnActionS,width:27,height:27,padding:0,color:'#dc2626'}} onClick={()=>setDeleteId(sr.id)}><IconTrash size={13}/></button>
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

      <div className="no-print" style={{margin:'22px 20px 0',borderTop:'1px solid var(--border)',paddingTop:18}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600}}>Scheduled Delivery</div>
          <button style={btnS('ghost')} onClick={loadSchedules}><IconRefresh size={13}/>Refresh</button>
        </div>
        {scheduleError && <div role="alert" style={{fontSize:12,color:'#dc2626',marginBottom:8}}>{scheduleError}</div>}
        {!schedules.length ? <div style={{padding:'10px 0',fontSize:12,color:'var(--text-muted)'}}>No scheduled reports yet. Schedule a saved report to email it daily.</div> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'var(--bg2)',borderBottom:'2px solid var(--border)'}}>
              {['Title','Period','Time (PKT)','Next Delivery','Last Sent','Status','Actions'].map(h=><th key={h} style={{padding:'7px 9px',textAlign:'left',fontSize:11,color:'var(--text-muted)'}}>{h}</th>)}
            </tr></thead>
            <tbody>{schedules.map((item,i)=><tr key={item.id} style={{borderBottom:'1px solid var(--border)',background:i%2?'var(--bg2)':'transparent'}}>
              <td style={{padding:'8px 9px'}}>{item.title}</td>
              <td style={{padding:'8px 9px'}}>{item.period==='daily_window'?`Daily ${item.reportFromTime}–${item.reportToTime}`:(SCHEDULE_PERIODS.find(p=>p.value===item.period)?.label??item.period)}</td>
              <td style={{padding:'8px 9px'}}>{item.timePkt}</td>
              <td style={{padding:'8px 9px',whiteSpace:'nowrap'}}>{new Date(item.nextRunAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})}</td>
              <td style={{padding:'8px 9px',whiteSpace:'nowrap'}} title={item.recipientEmails?.join(', ')}>{item.lastSentAt?new Date(item.lastSentAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}):'—'}{item.recipientEmails?.length?` · +${item.recipientEmails.length} recipients`:''}</td>
              <td title={item.lastError??''} style={{padding:'8px 9px',color:item.lastError?'#dc2626':item.active?'#16a34a':'var(--text-muted)',fontWeight:600}}>{item.lastError?'Delivery error':item.active?'Active':'Paused'}</td>
              <td style={{padding:'8px 9px',whiteSpace:'nowrap'}}><div style={{display:'flex',alignItems:'center',gap:6}}><button style={btnActionS} onClick={()=>{setScheduleError('');setScheduleTarget({existing:item});}}>Edit</button><button style={btnActionS} onClick={()=>toggleSchedule(item)}>{item.active?'Pause':'Activate'}</button><button title="Delete" aria-label={`Delete scheduled report ${item.title}`} style={{...btnActionS,width:27,height:27,padding:0,color:'#dc2626'}} onClick={()=>deleteSchedule(item.id)}><IconTrash size={13}/></button></div></td>
            </tr>)}</tbody>
          </table>
        )}
      </div>

      {showSaveModal && <SaveModal onSave={handleSave} onClose={()=>setShowSaveModal(false)} />}
      {scheduleTarget && <ScheduleModal report={scheduleTarget.report} existing={scheduleTarget.existing} savedReports={saved} configured={deliveryConfigured} error={scheduleError} saving={scheduleSaving} onClose={()=>setScheduleTarget(null)} onSubmit={saveSchedule} />}

      {/* Delete confirm is inline in row */}
    </div>
  );
}
