import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';

interface Org { id: string; name: string; }
interface Vehicle { id: string; displayId: number; name: string; licensePlate: string | null; make: string | null; model: string | null; organizationId: string | null; }
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
interface Row { id: string; vehicleId: string; serviceType: string; serviceDate: string; odometerKm: string | null; provider: string | null; cost: string | null; notes: string | null; nextDueDate: string | null; nextDueOdometerKm: string | null; reminderDaysBefore: number; reminderKmBefore: number; currentOdometerKm: number | null; status: 'completed'|'scheduled'|'upcoming'|'overdue'; vehicle: Vehicle; }
type Form = { vehicleId: string; serviceType: string; customServiceType: string; serviceDate: string; odometerKm: number | null; provider: string | null; cost: number | null; notes: string | null; nextDueDate: string | null; nextDueOdometerKm: number | null; reminderDaysBefore: number; reminderKmBefore: number; };
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const blank = (vehicleId = ''): Form => ({ vehicleId, serviceType: 'Engine Oil', customServiceType: '', serviceDate: today(), odometerKm: null, provider: null, cost: null, notes: null, nextDueDate: null, nextDueOdometerKm: null, reminderDaysBefore: 30, reminderKmBefore: 500 });
const SERVICE_TYPES = ['Engine Oil','Tuning','Oil Filter','Air Filter','AC Filter','Fuel Filter','Brake Pads','Brake Fluid','Coolant','Transmission Oil','Battery','Tyre Rotation','General Inspection','Other'];
const formatDate = (value: string | null | undefined) => value ? `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(0,4)}` : '—';
const dateInput = (value: string | null, onChange: (value: string | null) => void) => <div style={{ position: 'relative' }}><input readOnly value={value ? formatDate(value) : ''} placeholder="DD-MM-YYYY" style={input}/><input aria-label="Choose date" type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}/></div>;
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const input: React.CSSProperties = { height: 34, border: '1px solid var(--input-border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--input-color)', padding: '0 9px', fontSize: 12, outline: 'none' };
const statusColor = { completed: '#6b7280', scheduled: '#6b7280', upcoming: '#b45309', overdue: '#dc2626' };

export default function MaintenancePage() {
  const { user } = useAuth();
  const role = (user?.role ?? 'viewer') as UserRole;
  const can = (action: 'view'|'add'|'edit'|'delete') => canPerformAction(role, 'maintenance', action);
  const [orgs, setOrgs] = useState<Org[]>([]); const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [groups, setGroups] = useState<VehicleGroup[]>([]); const [rows, setRows] = useState<Row[]>([]);
  const [orgId, setOrgId] = useState(''); const [filter, setFilter] = useState('all'); const [form, setForm] = useState<Form | null>(null); const [editing, setEditing] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { api.get<Org[]>('/organizations').then(r => { setOrgs(r.data); if (r.data[0]) setOrgId(r.data[0].id); }).catch(() => setError('Organizations could not be loaded.')); }, []);
  const load = useCallback(async () => {
    if (!orgId) { setRows([]); setVehicles([]); setGroups([]); setLoading(false); return; }
    setLoading(true);
    const [vehicleRes, groupRes, recordRes] = await Promise.allSettled([
      api.get<Vehicle[]>(`/maintenance/vehicles?organizationId=${encodeURIComponent(orgId)}`),
      api.get<VehicleGroup[]>(`/vehicle-groups?orgId=${encodeURIComponent(orgId)}`),
      api.get<Row[]>(`/maintenance?organizationId=${encodeURIComponent(orgId)}`),
    ]);
    if (vehicleRes.status === 'fulfilled') setVehicles(vehicleRes.value.data);
    if (vehicleRes.status === 'rejected') setError('Vehicles could not be loaded.');
    if (groupRes.status === 'fulfilled') setGroups(groupRes.value.data); else setGroups([]);
    if (recordRes.status === 'fulfilled') setRows(recordRes.value.data); else setError('Maintenance records could not be loaded.');
    setLoading(false);
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => rows.filter(row => filter === 'all' || row.status === filter), [rows, filter]);
  const vlabel = (v: Vehicle) => `${v.licensePlate || `#${v.displayId}`} · ${[v.make, v.model].filter(Boolean).join(' ') || v.name}`;
  const edit = (row: Row) => { setEditing(row.id); setError(''); const known = SERVICE_TYPES.includes(row.serviceType); setForm({ vehicleId: row.vehicleId, serviceType: known ? row.serviceType : 'Other', customServiceType: known ? '' : row.serviceType, serviceDate: row.serviceDate.slice(0,10), odometerKm: row.odometerKm == null ? null : Number(row.odometerKm), provider: row.provider, cost: row.cost == null ? null : Number(row.cost), notes: row.notes, nextDueDate: row.nextDueDate?.slice(0,10) ?? null, nextDueOdometerKm: row.nextDueOdometerKm == null ? null : Number(row.nextDueOdometerKm), reminderDaysBefore: row.reminderDaysBefore, reminderKmBefore: row.reminderKmBefore }); };
  const save = async () => {
    const serviceType = form?.serviceType === 'Other' ? form.customServiceType.trim() : form?.serviceType.trim();
    if (!form?.vehicleId || !serviceType || !form.serviceDate) { setError('Select a vehicle and enter the service type and date.'); return; }
    if (form.nextDueOdometerKm != null && form.odometerKm == null) { setError('Enter the service odometer to use an odometer reminder.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, serviceType };
      if (editing) await api.put(`/maintenance/${editing}`, payload);
      else await api.post(`/maintenance?organizationId=${encodeURIComponent(orgId)}`, payload);
      setForm(null); setEditing(null); await load();
    } catch (e) { const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message; setError(typeof message === 'string' ? message : 'The service record could not be saved.'); }
    finally { setSaving(false); }
  };
  const remove = async (row: Row) => { if (!window.confirm(`Delete the ${row.serviceType} service record?`)) return; try { await api.delete(`/maintenance/${row.id}`); await load(); } catch { setError('The service record could not be deleted.'); } };
  const setValue = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => current ? { ...current, [key]: value } : current);

  return <div>
    <PageHeader title="Maintenance" action={can('add') && !form ? <button onClick={() => { setError(''); setEditing(null); setForm(blank(vehicles[0]?.id ?? '')); }} style={{ height: 30, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', border: 0, borderRadius: 4, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><IconPlus size={14}/> Log Service</button> : undefined}/>
    <div style={{ padding: '0 24px 24px' }}>
      {error && <div role="alert" style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'end', gap: 14, margin: '8px 0 16px' }}>
        <label style={{ ...field, width: 280 }}><span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Client organization</span><select value={orgId} onChange={e => setOrgId(e.target.value)} style={input}><option value="">Select organization</option>{orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}><span>{rows.length} service records</span><span style={{ color: '#b45309' }}>{rows.filter(r => r.status === 'upcoming').length} upcoming</span><span style={{ color: '#dc2626' }}>{rows.filter(r => r.status === 'overdue').length} overdue</span></div>
      </div>
      {form && <div style={{ marginBottom: 18, borderBottom: '1px solid var(--border)', padding: '8px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', fontWeight: 650, marginBottom: 12 }}><button onClick={() => { setForm(null); setEditing(null); }} aria-label="Back to maintenance" style={{ display: 'flex', padding: 2, border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}><IconArrowLeft size={16}/></button>{editing ? 'Edit Service Record' : 'Log Service'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(150px,1fr))', gap: 10 }}>
          {[['Vehicle', <select disabled={loading || vehicles.length === 0} value={form.vehicleId} onChange={e => setValue('vehicleId', e.target.value)} style={input}><option value="">{loading ? 'Loading vehicles…' : 'Select vehicle'}</option>{groups.map(group => { const members = vehicles.filter(v => group.vehicleIds.includes(v.id)); return members.length ? <optgroup key={group.id} label={group.name}>{members.map(v => <option key={v.id} value={v.id}>{vlabel(v)}</option>)}</optgroup> : null; })}<optgroup label="Other vehicles">{vehicles.filter(v => !groups.some(g => g.vehicleIds.includes(v.id))).map(v => <option key={v.id} value={v.id}>{vlabel(v)}</option>)}</optgroup></select>], ['Service type', <select value={form.serviceType} onChange={e => setValue('serviceType',e.target.value)} style={input}>{SERVICE_TYPES.map(type => <option key={type}>{type}</option>)}</select>], ['Service date', dateInput(form.serviceDate, value => value && setValue('serviceDate',value))], ['Odometer (km)', <input type="number" min="0" step="0.1" value={form.odometerKm ?? ''} onChange={e => setValue('odometerKm',e.target.value === '' ? null : Number(e.target.value))} style={input}/>], ['Provider', <input value={form.provider ?? ''} onChange={e => setValue('provider',e.target.value || null)} style={input}/>], ['Cost', <input type="number" min="0" step="0.01" value={form.cost ?? ''} onChange={e => setValue('cost',e.target.value === '' ? null : Number(e.target.value))} style={input}/>], ['Next due date', dateInput(form.nextDueDate, value => setValue('nextDueDate',value))], ['Next due odometer (km)', <input type="number" min="0" step="0.1" value={form.nextDueOdometerKm ?? ''} onChange={e => setValue('nextDueOdometerKm',e.target.value === '' ? null : Number(e.target.value))} style={input}/>], ['Reminder lead (days / km)', <div style={{ display: 'flex', gap: 6 }}><input title="Days" type="number" min="0" max="365" value={form.reminderDaysBefore} onChange={e => setValue('reminderDaysBefore',Number(e.target.value))} style={{ ...input, width: '50%' }}/><input title="Kilometres" type="number" min="0" max="100000" value={form.reminderKmBefore} onChange={e => setValue('reminderKmBefore',Number(e.target.value))} style={{ ...input, width: '50%' }}/></div>]].map(([label, control]) => <label key={String(label)} style={field}><span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>{control}</label>)}
          {form.serviceType === 'Other' && <label style={field}><span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Custom service type</span><input value={form.customServiceType} onChange={e => setValue('customServiceType',e.target.value)} maxLength={80} style={input} placeholder="Enter service type"/></label>}
        </div>
        <label style={{ ...field, marginTop: 10 }}><span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Notes</span><textarea value={form.notes ?? ''} onChange={e => setValue('notes',e.target.value || null)} rows={2} maxLength={4000} style={{ ...input, height: 'auto', padding: 8 }}/></label>
        <div style={{ display: 'flex', justifyContent: 'end', gap: 8, marginTop: 12 }}><button onClick={() => { setForm(null); setEditing(null); }} style={{ ...input, width: 'auto', padding: '0 12px', cursor: 'pointer' }}>Cancel</button><button disabled={saving} onClick={() => void save()} style={{ height: 34, padding: '0 14px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save record'}</button></div>
      </div>}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 10 }}>{(['all','upcoming','overdue'] as const).map(value => <button key={value} onClick={() => setFilter(value)} style={{ padding: '9px 12px', background: 'transparent', border: 0, borderBottom: `2px solid ${filter === value ? '#dc2626' : 'transparent'}`, color: filter === value ? '#dc2626' : 'var(--muted)', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>{value}</button>)}</div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Vehicle','Service','Date / Odometer','Next due','Status',''].map((label,i)=><th key={i} style={{ padding: '9px 10px', textAlign: i > 3 ? 'center' : 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={6} style={{ padding: 20, color: 'var(--muted)' }}>Loading maintenance records…</td></tr> : shown.map(row => <tr key={row.id} style={{ borderBottom: '1px solid var(--border2)' }}><td style={{ padding: '10px', color: 'var(--text)' }}>{row.vehicle.licensePlate || row.vehicle.name}<div style={{ color: 'var(--muted)', fontSize: 10 }}>{[row.vehicle.make,row.vehicle.model].filter(Boolean).join(' ')}</div></td><td style={{ padding: 10 }}>{row.serviceType}{row.provider && <div style={{ color: 'var(--muted)', fontSize: 10 }}>{row.provider}</div>}</td><td style={{ padding: 10 }}>{formatDate(row.serviceDate)}<div style={{ color: 'var(--muted)', fontSize: 10 }}>{row.odometerKm == null ? 'Odometer —' : `${Number(row.odometerKm).toLocaleString('en-US')} km`}</div></td><td style={{ padding: 10 }}>{formatDate(row.nextDueDate)}{row.nextDueOdometerKm != null && <div style={{ color: 'var(--muted)', fontSize: 10 }}>{Number(row.nextDueOdometerKm).toLocaleString('en-US')} km</div>}{row.currentOdometerKm != null && row.nextDueOdometerKm != null && <div style={{ color: 'var(--muted)', fontSize: 10 }}>Est. current: {Math.round(row.currentOdometerKm).toLocaleString('en-US')} km</div>}</td><td style={{ padding: 10, color: statusColor[row.status], textTransform: 'capitalize', fontWeight: 600 }}>{row.status}</td><td style={{ padding: 6, textAlign: 'right', whiteSpace: 'nowrap' }}>{can('edit') && <button title="Edit" onClick={() => edit(row)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}><IconPencil size={14}/></button>}{can('delete') && <button title="Delete" onClick={() => void remove(row)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}><IconTrash size={14}/></button>}</td></tr>)}{!loading && !shown.length && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No maintenance records match this filter.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}
