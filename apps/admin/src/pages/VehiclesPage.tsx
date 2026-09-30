import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconHistory } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import SkeletonTable from '../components/SkeletonTable';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import { ORG_ROLES } from '../config/roles';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Vehicle { id: string; displayId: number; licensePlate: string | null; make: string | null; model: string | null; year: number | null; cityId: string | null; organizationId: string | null; isActive: boolean; lifecycleStatus: 'active' | 'expired' | 'archived'; expiresAt: string | null; createdAt: string; }
interface Org { id: string; name: string; }
interface DeviceAssignment { id: string; vehicleId: string; assignedAt: string; unassignedAt: string | null; action: string; reason: string | null; odometerKm: number | null; notes: string | null; deviceDisplayId: number; imei: string; simNumber: string | null; assignedByFirstName: string | null; assignedByLastName: string | null; }

const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { licensePlate: '', make: '', model: '', year: '', cityId: '', lifecycleStatus: 'active' as Vehicle['lifecycleStatus'], expiresAt: '', organizationId: '' };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [assignmentRows, setAssignmentRows] = useState<DeviceAssignment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const { cities, selectedCityId } = useCityFilter();
  const { user } = useAuth();
  const { canOrgDo } = useOrgRolePerms();
  const role = user?.role ?? '';
  const isOrgRole = ORG_ROLES.includes(role as (typeof ORG_ROLES)[number]);
  const canManageLifecycle = ['super_admin', 'admin', 'ops'].includes(role);
  const canAdd    = isOrgRole ? canOrgDo(role, 'vehicles', 'add')    : true;
  const canEdit   = isOrgRole ? canOrgDo(role, 'vehicles', 'edit')   : true;
  const canDelete = isOrgRole ? canOrgDo(role, 'vehicles', 'delete') : true;

  const load = () => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([api.get<Vehicle[]>(`/vehicles${p}`), api.get<Org[]>('/organizations')])
      .then(([v, o]) => { setVehicles(v.data); setOrgs(o.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openDetails = async (vehicle: Vehicle) => {
    setDetailVehicle(vehicle); setAssignmentRows([]); setAssignmentLoading(true);
    try {
      const response = await api.get<DeviceAssignment[]>(`/devices/vehicle/${vehicle.id}/assignment-history`);
      setAssignmentRows(response.data);
    } catch { setAssignmentRows([]); } finally { setAssignmentLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ licensePlate: v.licensePlate ?? '', make: v.make ?? '', model: v.model ?? '', year: v.year ? String(v.year) : '', cityId: v.cityId ?? '', lifecycleStatus: v.lifecycleStatus ?? (v.isActive ? 'active' : 'archived'), expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : '', organizationId: v.organizationId ?? '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { lifecycleStatus, expiresAt, ...profile } = form;
      const payload = { ...profile, year: form.year ? Number(form.year) : null, organizationId: form.organizationId || null, cityId: form.cityId || null };
      if (editing) {
        await api.patch(`/vehicles/${editing.id}`, payload);
        if (canManageLifecycle) await api.patch(`/vehicles/${editing.id}/lifecycle`, { lifecycleStatus, expiresAt: expiresAt || null });
      } else {
        const created = await api.post<Vehicle>('/vehicles', payload);
        if (canManageLifecycle && (lifecycleStatus !== 'active' || expiresAt)) await api.patch(`/vehicles/${created.data.id}/lifecycle`, { lifecycleStatus, expiresAt: expiresAt || null });
      }
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      const result = await api.delete<{ archived: boolean }>(`/vehicles/${deleting.id}`);
      if (result.data.archived) setVehicles(rows => rows.map(row => row.id === deleting.id ? { ...row, lifecycleStatus: 'archived', isActive: false } : row));
      else setVehicles(v => v.filter(x => x.id !== deleting.id));
      setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = vehicles.filter(v => {
    if (q && !(v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase()) && !(v.make ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && v.lifecycleStatus !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(v.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Vehicles" count={vehicles.length} action={
        canAdd ? (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add Vehicle
          </button>
        ) : undefined
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Plate, make, model…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Lifecycle States</option><option value="active">Active</option><option value="expired">Expired</option><option value="archived">Archived</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        {(q || statusFilter || dateRange) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={7} /> : (
        <div className="tbl-wrap">
        <table>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Plate', 'Make / Model', 'Year', 'Status', 'Added', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${v.lifecycleStatus === 'active' ? '#16a34a' : v.lifecycleStatus === 'expired' ? '#dc2626' : '#9ca3af'}` }}>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{v.displayId}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{v.licensePlate ?? '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{v.year ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {canManageLifecycle ? <select value={v.lifecycleStatus ?? (v.isActive ? 'active' : 'archived')} onChange={async e => {
                    const lifecycleStatus = e.target.value as Vehicle['lifecycleStatus'];
                    try { await api.patch(`/vehicles/${v.id}/lifecycle`, { lifecycleStatus, expiresAt: v.expiresAt }); setVehicles(rows => rows.map(row => row.id === v.id ? { ...row, lifecycleStatus, isActive: lifecycleStatus === 'active' } : row)); }
                    catch { /* Keep the saved lifecycle state on screen. */ }
                  }} style={{ ...sel, color: v.lifecycleStatus === 'expired' ? '#dc2626' : v.lifecycleStatus === 'active' ? '#16a34a' : '#6b7280' }}>
                    <option value="active">Active</option><option value="expired">Expired</option><option value="archived">Archived</option>
                  </select> : <span style={{ color: v.lifecycleStatus === 'expired' ? '#dc2626' : v.lifecycleStatus === 'active' ? '#16a34a' : '#6b7280' }}>{v.lifecycleStatus}</span>}
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(v.createdAt)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => void openDetails(v)} title="Vehicle details and tracker history" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 4, borderRadius: 3 }}><IconEye size={14} /></button>
                    {canEdit && <button onClick={() => openEdit(v)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>}
                    {canDelete && <button onClick={() => setDeleting(v)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No vehicles found</td></tr>}
          </tbody>
        </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} onClose={closeModal} width='min(1200px, 97vw)' height='min(800px, 96vh)'>
        <form onSubmit={handleSubmit}>
          <FormField label="License Plate">
            <input value={form.licensePlate} onChange={e => set('licensePlate', e.target.value)} placeholder="LEA-1234" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Make">
              <input value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="Model">
              <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Year">
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2022" min="1990" max="2030" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            {canManageLifecycle && <FormField label="Status">
              <select value={form.lifecycleStatus} onChange={e => set('lifecycleStatus', e.target.value)} style={selectStyle}>
                <option value="active">Active</option><option value="expired">Expired</option><option value="archived">Archived</option>
              </select>
            </FormField>}
          </div>
          {canManageLifecycle && <FormField label="Tracking Expiry Date">
            <input type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} style={inputStyle} />
          </FormField>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Organization">
              <select value={form.organizationId} onChange={e => set('organizationId', e.target.value)} style={selectStyle}>
                <option value="">None</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FormField>
            <FormField label="City">
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <Modal open={!!detailVehicle} title="Vehicle Details" onClose={() => setDetailVehicle(null)} width="min(900px, 96vw)">
        {detailVehicle && <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              ['Vehicle', detailVehicle.licensePlate || `Vehicle ${detailVehicle.displayId}`],
              ['Make / Model', [detailVehicle.make, detailVehicle.model, detailVehicle.year].filter(Boolean).join(' ') || '—'],
              ['Lifecycle', detailVehicle.lifecycleStatus === 'expired' ? 'Expired' : detailVehicle.lifecycleStatus === 'archived' ? 'Archived' : 'Active'],
              ['Added', new Date(detailVehicle.createdAt).toLocaleDateString()],
              ['Expiry', detailVehicle.expiresAt ? new Date(detailVehicle.expiresAt).toLocaleDateString() : 'No expiry'],
            ].map(([label, value]) => <div key={label} style={{ padding: 12, borderLeft: '2px solid #dc2626', background: 'var(--bg2)' }}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div></div>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '22px 0 8px', fontSize: 13, fontWeight: 700 }}><IconHistory size={16} color="#dc2626" /> Device and assignment history</div>
          {assignmentLoading ? <Spinner /> : assignmentRows.length ? <div style={{ borderTop: '1px solid var(--border)' }}>
            {assignmentRows.map(row => <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(190px, 1.2fr) minmax(150px, 1fr)', gap: 12, padding: '13px 4px', borderBottom: '1px solid var(--border2)', fontSize: 12 }}>
              <div><strong>Device {row.deviceDisplayId}</strong><div style={{ marginTop: 5, fontFamily: 'monospace', color: 'var(--muted)' }}>{row.imei}</div><div style={{ marginTop: 3, color: 'var(--muted)' }}>SIM {row.simNumber || '—'}</div></div>
              <div style={{ color: 'var(--text2)' }}>{new Date(row.assignedAt).toLocaleString()}<div style={{ marginTop: 4, color: 'var(--muted)' }}>To {row.unassignedAt ? new Date(row.unassignedAt).toLocaleString() : 'Current'}</div><div style={{ marginTop: 4, color: row.unassignedAt ? 'var(--muted)' : '#16a34a' }}>{row.action === 'legacy' ? 'Existing assignment' : row.action}</div></div>
              <div style={{ color: 'var(--text2)' }}>{row.reason || row.notes || 'No work notes'}{row.odometerKm != null ? <div style={{ marginTop: 5 }}>Odometer {Number(row.odometerKm).toLocaleString()} km</div> : null}</div>
            </div>)}
          </div> : <div style={{ padding: 18, color: 'var(--muted)', fontSize: 12 }}>No device assignment records found.</div>}
        </div>}
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Vehicle"
        message={`Remove vehicle "${deleting?.licensePlate ?? deleting?.id}"? Vehicles with history are archived so reports and tracking records remain available.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}
