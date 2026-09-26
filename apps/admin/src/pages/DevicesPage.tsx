import { useEffect, useState, useRef, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import SkeletonTable from '../components/SkeletonTable';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Device { id: string; displayId: number; imei: string; name: string | null; simNumber: string | null; cityId: string | null; isActive: boolean; lastSeenAt: string | null; vehicle?: { licensePlate: string | null; displayId: number; id: string } | null; createdAt: string; }
interface Vehicle { id: string; displayId: number; licensePlate: string | null; make: string | null; model: string | null; }

const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { imei: '', name: '', simNumber: '', cityId: '', isActive: true, vehicleId: '' };

function lastSeenLabel(ts: string | null) {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

function VehicleSearch({ vehicles, value, onChange }: { vehicles: Vehicle[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = vehicles.find(v => v.id === value);
  const displayText = selected
    ? `${selected.displayId} — ${[selected.licensePlate, selected.make, selected.model].filter(Boolean).join(' ')}`
    : '';

  const filteredVehicles = q
    ? vehicles.filter(v => `${v.licensePlate ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    : vehicles;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={open ? q : displayText}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        placeholder="Search vehicle by plate or make…"
        style={inputStyle}
        onFocus={e => { setQ(''); setOpen(true); e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 200, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', marginTop: 2 }}>
          <div onMouseDown={() => { onChange(''); setOpen(false); setQ(''); }}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#aaa', borderBottom: '1px solid var(--border2)' }}>
            Unassigned
          </div>
          {filteredVehicles.map(v => (
            <div key={v.id} onMouseDown={() => { onChange(v.id); setOpen(false); setQ(''); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border2)', background: v.id === value ? 'rgba(220,38,38,0.04)' : 'transparent', color: v.id === value ? '#dc2626' : 'var(--text)' }}>
              {v.displayId} — {[v.licensePlate, v.make, v.model].filter(Boolean).join(' ')}
            </div>
          ))}
          {!filteredVehicles.length && <div style={{ padding: '8px 12px', fontSize: 12, color: '#bbb' }}>No vehicles found</div>}
        </div>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const { cities, selectedCityId } = useCityFilter();

  const load = () => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([api.get<Device[]>(`/devices${p}`), api.get<Vehicle[]>('/vehicles')])
      .then(([d, v]) => { setDevices(d.data); setVehicles(v.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ imei: d.imei, name: d.name ?? '', simNumber: d.simNumber ?? '', cityId: d.cityId ?? '', isActive: d.isActive, vehicleId: d.vehicle?.id ?? '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, vehicleId: form.vehicleId || null, cityId: form.cityId || null };
      if (editing) await api.patch(`/devices/${editing.id}`, payload);
      else await api.post('/devices', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/devices/${deleting.id}`);
      setDevices(d => d.filter(x => x.id !== deleting.id));
      setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = devices.filter(d => {
    if (q && !d.imei.includes(q) && !(d.name ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(d.isActive) !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(d.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Devices" count={devices.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Device
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="IMEI or name…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        {(q || statusFilter || dateRange) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={8} /> : (
        <div className="tbl-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'IMEI', 'Name', 'SIM', 'Vehicle', 'Last Seen', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
              const borderColor = online ? '#22c55e' : !d.isActive ? '#e5e7eb' : '#dc2626';
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${borderColor}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{d.displayId}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{d.imei}</td>
                  <td style={{ padding: '10px 14px' }}>{d.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.simNumber ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>
                    {d.vehicle ? `${d.vehicle.displayId} ${d.vehicle.licensePlate ?? ''}`.trim() : <span style={{ color: 'var(--muted2)' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{lastSeenLabel(d.lastSeenAt)}</td>
                  <td style={{ padding: '10px 14px', color: online ? '#16a34a' : !d.isActive ? '#aaa' : '#dc2626' }}>
                    {online ? 'Online' : !d.isActive ? 'Inactive' : 'Offline'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No devices found</td></tr>}
          </tbody>
        </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Device' : 'Add Device'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="IMEI *">
            <input required value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="15-digit IMEI number" maxLength={20}
              style={inputStyle} readOnly={!!editing}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Device Name">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tracker-01" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="SIM Number">
              <input value={form.simNumber} onChange={e => set('simNumber', e.target.value)} placeholder="03001234567" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <FormField label="Link to Vehicle">
            <VehicleSearch vehicles={vehicles} value={form.vehicleId} onChange={id => set('vehicleId', id)} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="City">
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Register Device'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Device"
        message={`Delete device "${deleting?.imei}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}
