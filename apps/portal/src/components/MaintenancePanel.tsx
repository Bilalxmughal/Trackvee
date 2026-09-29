import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconCalendarDue, IconPencil, IconPlus, IconTrash, IconTool } from '@tabler/icons-react';
import api from '../api/client';
import { usePortalPerms } from '../contexts/PortalPermsContext';

interface Vehicle { id: string; name: string; licensePlate: string | null; make: string | null; model: string | null; displayId: number; }
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }
interface RecordRow {
  id: string; vehicleId: string; serviceType: string; serviceDate: string; odometerKm: string | null;
  provider: string | null; cost: string | null; notes: string | null; nextDueDate: string | null;
  nextDueOdometerKm: string | null; reminderDaysBefore: number; reminderKmBefore: number;
  currentOdometerKm: number | null; status: 'completed' | 'scheduled' | 'upcoming' | 'overdue';
  vehicle: Vehicle;
}
type FormState = {
  vehicleId: string; serviceType: string; customServiceType: string; serviceDate: string; odometerKm: number | null;
  provider: string | null; cost: number | null; notes: string | null; nextDueDate: string | null;
  nextDueOdometerKm: number | null; reminderDaysBefore: number; reminderKmBefore: number;
};
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const emptyForm = (vehicleId = ''): FormState => ({ vehicleId, serviceType: 'Engine Oil', customServiceType: '', serviceDate: today(), odometerKm: null, provider: null, cost: null, notes: null, nextDueDate: null, nextDueOdometerKm: null, reminderDaysBefore: 30, reminderKmBefore: 500 });
const SERVICE_TYPES = ['Engine Oil','Tuning','Oil Filter','Air Filter','AC Filter','Fuel Filter','Brake Pads','Brake Fluid','Coolant','Transmission Oil','Battery','Tyre Rotation','General Inspection','Other'];
const formatDate = (value: string | null | undefined) => value ? `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(0,4)}` : '—';
const dateInput = (value: string | null, onChange: (value: string | null) => void) => <div style={{ position: 'relative' }}><input readOnly value={value ? formatDate(value) : ''} placeholder="DD-MM-YYYY" style={input}/><input aria-label="Choose date" type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}/></div>;
const labelVehicle = (v: Vehicle) => `${v.licensePlate || `#${v.displayId}`} · ${[v.make, v.model].filter(Boolean).join(' ') || v.name}`;
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, padding: '0 9px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', color: '#111', fontSize: 12, outline: 'none' };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 };
const caption: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 };
const statusColor: Record<RecordRow['status'], string> = { completed: '#6b7280', scheduled: '#6b7280', upcoming: '#b45309', overdue: '#dc2626' };

export default function MaintenancePanel({ onClose }: { onClose: () => void }) {
  const { canDo } = usePortalPerms();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [vehicleError, setVehicleError] = useState('');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue'>('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [vehicleResult, groupResult, recordResult] = await Promise.allSettled([
      api.get<Vehicle[]>('/maintenance/vehicles'), api.get<VehicleGroup[]>('/vehicle-groups'), api.get<RecordRow[]>('/maintenance'),
    ]);
    if (vehicleResult.status === 'fulfilled') { setVehicles(vehicleResult.value.data); setVehicleError(''); }
    else { setVehicles([]); setVehicleError('Vehicles could not be loaded. Please refresh and try again.'); }
    setGroups(groupResult.status === 'fulfilled' ? groupResult.value.data : []);
    if (recordResult.status === 'fulfilled') setRecords(recordResult.value.data);
    else setError('Maintenance records could not be loaded. Please try again.');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => records.filter(row => filter === 'all' || row.status === filter), [records, filter]);
  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => current ? { ...current, [key]: value } : current);
  const openNew = () => { setError(''); setEditingId(null); setForm(emptyForm(vehicles[0]?.id ?? '')); };
  const openEdit = (row: RecordRow) => {
    setError(''); setEditingId(row.id);
    const known = SERVICE_TYPES.includes(row.serviceType);
    setForm({ vehicleId: row.vehicleId, serviceType: known ? row.serviceType : 'Other', customServiceType: known ? '' : row.serviceType, serviceDate: row.serviceDate.slice(0, 10), odometerKm: row.odometerKm == null ? null : Number(row.odometerKm), provider: row.provider, cost: row.cost == null ? null : Number(row.cost), notes: row.notes, nextDueDate: row.nextDueDate?.slice(0, 10) ?? null, nextDueOdometerKm: row.nextDueOdometerKm == null ? null : Number(row.nextDueOdometerKm), reminderDaysBefore: row.reminderDaysBefore, reminderKmBefore: row.reminderKmBefore });
  };
  const save = async () => {
    const serviceType = form?.serviceType === 'Other' ? form.customServiceType.trim() : form?.serviceType.trim();
    if (!form || !form.vehicleId || !serviceType || !form.serviceDate) { setError('Select a vehicle and enter the service type and date.'); return; }
    if (form.nextDueOdometerKm != null && form.odometerKm == null) { setError('Enter the service odometer to use an odometer reminder.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, serviceType };
    try {
      if (editingId) await api.put(`/maintenance/${editingId}`, payload);
      else await api.post('/maintenance', payload);
      setForm(null); setEditingId(null); await load();
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(typeof message === 'string' ? message : 'The service record could not be saved.');
    } finally { setSaving(false); }
  };
  const remove = async (row: RecordRow) => {
    if (!window.confirm(`Delete the ${row.serviceType} record for ${row.vehicle.licensePlate || row.vehicle.name}?`)) return;
    try { await api.delete(`/maintenance/${row.id}`); await load(); }
    catch { setError('The service record could not be deleted.'); }
  };

  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff' }}>
    <div style={{ minHeight: 54, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
      {form ? <button onClick={() => { setForm(null); setEditingId(null); }} aria-label="Back to maintenance" style={{ display: 'flex', border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer', padding: 3 }}><IconArrowLeft size={17}/></button> : <IconTool size={17} color="#dc2626"/>}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: '#111', fontSize: 13, fontWeight: 700 }}>{form ? (editingId ? 'Edit Service Record' : 'Log Service') : 'Maintenance'}</div><div style={{ color: '#9ca3af', fontSize: 10.5, marginTop: 2 }}>{form ? 'Service history and next due reminders' : `${records.length} service records`}</div></div>
      {!form && canDo('maintenance', 'add') && <button onClick={openNew} title="Log service" style={{ border: 0, background: 'transparent', color: '#dc2626', display: 'flex', cursor: 'pointer', padding: 4 }}><IconPlus size={20}/></button>}
      {!form && <button onClick={onClose} aria-label="Close maintenance" style={{ border: 0, background: 'transparent', color: '#9ca3af', fontSize: 20, cursor: 'pointer', padding: '0 2px' }}>×</button>}
    </div>
    {error && <div role="alert" style={{ margin: '9px 12px 0', color: '#dc2626', fontSize: 11 }}>{error}</div>}
    {form ? <div style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {vehicleError && <div role="alert" style={{ color: '#dc2626', fontSize: 11 }}>{vehicleError}</div>}
      <label style={field}><span style={caption}>Vehicle</span><select disabled={loading || vehicles.length === 0} value={form.vehicleId} onChange={e => setValue('vehicleId', e.target.value)} style={input}><option value="">{loading ? 'Loading vehicles…' : vehicles.length ? 'Select vehicle' : 'No vehicles available'}</option>{groups.map(group => { const members = vehicles.filter(v => group.vehicleIds.includes(v.id)); return members.length ? <optgroup key={group.id} label={group.name}>{members.map(v => <option key={v.id} value={v.id}>{labelVehicle(v)}</option>)}</optgroup> : null; })}<optgroup label="Other vehicles">{vehicles.filter(v => !groups.some(g => g.vehicleIds.includes(v.id))).map(v => <option key={v.id} value={v.id}>{labelVehicle(v)}</option>)}</optgroup></select></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <label style={field}><span style={caption}>Service type</span><select value={form.serviceType} onChange={e => setValue('serviceType', e.target.value)} style={input}>{SERVICE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        {form.serviceType === 'Other' && <label style={field}><span style={caption}>Custom service type</span><input value={form.customServiceType} maxLength={80} placeholder="Enter service type" onChange={e => setValue('customServiceType', e.target.value)} style={input}/></label>}
        <label style={field}><span style={caption}>Service date</span>{dateInput(form.serviceDate, value => value && setValue('serviceDate', value))}</label>
        <label style={field}><span style={caption}>Odometer (km)</span><input type="number" min="0" step="0.1" value={form.odometerKm ?? ''} onChange={e => setValue('odometerKm', e.target.value === '' ? null : Number(e.target.value))} style={input}/></label>
        <label style={field}><span style={caption}>Provider</span><input value={form.provider ?? ''} maxLength={120} onChange={e => setValue('provider', e.target.value || null)} style={input}/></label>
        <label style={field}><span style={caption}>Cost</span><input type="number" min="0" step="0.01" value={form.cost ?? ''} onChange={e => setValue('cost', e.target.value === '' ? null : Number(e.target.value))} style={input}/></label>
        <label style={field}><span style={caption}>Next due date</span>{dateInput(form.nextDueDate, value => setValue('nextDueDate', value))}</label>
        <label style={field}><span style={caption}>Next due odometer (km)</span><input type="number" min="0" step="0.1" value={form.nextDueOdometerKm ?? ''} onChange={e => setValue('nextDueOdometerKm', e.target.value === '' ? null : Number(e.target.value))} style={input}/></label>
        <label style={field}><span style={caption}>Remind before (days)</span><input type="number" min="0" max="365" value={form.reminderDaysBefore} onChange={e => setValue('reminderDaysBefore', Number(e.target.value))} style={input}/></label>
        <label style={field}><span style={caption}>Remind before (km)</span><input type="number" min="0" max="100000" value={form.reminderKmBefore} onChange={e => setValue('reminderKmBefore', Number(e.target.value))} style={input}/></label>
      </div>
      <label style={field}><span style={caption}>Notes</span><textarea value={form.notes ?? ''} maxLength={4000} rows={3} onChange={e => setValue('notes', e.target.value || null)} style={{ ...input, height: 'auto', padding: 9, resize: 'vertical' }}/></label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f0f0f0', paddingTop: 11 }}><button onClick={() => setForm(null)} style={{ height: 32, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 5, padding: '0 12px', color: '#555', cursor: 'pointer' }}>Cancel</button><button disabled={saving} onClick={() => void save()} style={{ height: 32, border: 0, background: '#dc2626', borderRadius: 5, padding: '0 14px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save record'}</button></div>
    </div> : <>
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '0 12px' }}>{(['all', 'upcoming', 'overdue'] as const).map(value => <button key={value} onClick={() => setFilter(value)} style={{ padding: '10px 9px', color: filter === value ? '#dc2626' : '#6b7280', border: 0, borderBottom: `2px solid ${filter === value ? '#dc2626' : 'transparent'}`, background: 'transparent', fontSize: 11.5, cursor: 'pointer', textTransform: 'capitalize' }}>{value === 'all' ? `All (${records.length})` : `${value} (${records.filter(row => row.status === value).length})`}</button>)}</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>{loading ? <div style={{ padding: 20, color: '#888', fontSize: 12 }}>Loading maintenance records…</div> : visible.length === 0 ? <div style={{ padding: '38px 20px', textAlign: 'center', color: '#777' }}><IconCalendarDue size={24} color="#9ca3af"/><div style={{ fontSize: 12, marginTop: 8 }}>{filter === 'all' ? 'No service records yet.' : `No ${filter} maintenance reminders.`}</div></div> : visible.map(row => <div key={row.id} style={{ display: 'flex', gap: 9, padding: '11px 13px', borderBottom: '1px solid #f0f0f0' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}><span style={{ fontSize: 12.5, color: '#111', fontWeight: 650 }}>{row.vehicle.licensePlate || row.vehicle.name}</span><span style={{ color: statusColor[row.status], fontSize: 10.5, fontWeight: 600, textTransform: 'capitalize' }}>{row.status.replace('_', ' ')}</span></div><div style={{ color: '#555', fontSize: 11.5, marginTop: 3 }}>{row.serviceType} · {formatDate(row.serviceDate)}</div><div style={{ color: '#888', fontSize: 10.5, marginTop: 3 }}>{row.odometerKm != null ? `${Number(row.odometerKm).toLocaleString('en-US')} km at service` : 'Odometer not recorded'}{row.nextDueDate ? ` · Next: ${formatDate(row.nextDueDate)}` : ''}{row.nextDueOdometerKm != null ? ` · ${Number(row.nextDueOdometerKm).toLocaleString('en-US')} km` : ''}</div>{row.provider && <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{row.provider}{row.cost != null ? ` · Rs ${Number(row.cost).toLocaleString('en-PK')}` : ''}</div>}</div>{canDo('maintenance', 'edit') && <button onClick={() => openEdit(row)} aria-label={`Edit ${row.serviceType}`} style={{ border: 0, background: 'transparent', color: '#777', cursor: 'pointer', height: 24, padding: 2 }}><IconPencil size={14}/></button>}{canDo('maintenance', 'delete') && <button onClick={() => void remove(row)} aria-label={`Delete ${row.serviceType}`} style={{ border: 0, background: 'transparent', color: '#777', cursor: 'pointer', height: 24, padding: 2 }}><IconTrash size={14}/></button>}</div>)}</div>
    </>}
  </div>;
}
