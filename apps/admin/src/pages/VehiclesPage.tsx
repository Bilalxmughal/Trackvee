import { useEffect, useState, FormEvent, useRef } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconHistory, IconDownload, IconFileImport, IconUpload } from '@tabler/icons-react';
import CustomSelect from '../components/CustomSelect';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
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
import TablePagination, { useTablePagination } from '../components/TablePagination';

interface Vehicle { id: string; displayId: number; licensePlate: string | null; make: string | null; model: string | null; year: number | null; cityId: string | null; organizationId: string | null; isActive: boolean; lifecycleStatus: 'active' | 'expired' | 'archived'; expiresAt: string | null; createdAt: string; odometerKm: number; }
interface Org { id: string; name: string; }
interface AirlineOpt { id: string; name: string; iataCode: string | null; }
interface DeviceAssignment { id: string; vehicleId: string; assignedAt: string; unassignedAt: string | null; action: string; reason: string | null; odometerKm: number | null; notes: string | null; deviceDisplayId: number; imei: string; simNumber: string | null; assignedByFirstName: string | null; assignedByLastName: string | null; }
interface InventoryDevice { id: string; displayId: number; imei: string; name: string | null; simNumber: string | null; inventoryStatus: 'in_stock' | 'assigned' | 'maintenance' | 'retired'; vehicleId: string | null; licensePlate: string | null; }
function ClientSearchSelect({ orgs, value, onChange }: { orgs: Org[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const current = orgs.find(org => org.id === value); const filtered = orgs.filter(org => org.name.toLowerCase().includes(query.toLowerCase()));
  return <div ref={root} style={{ position: 'relative' }}><button type="button" onClick={() => setOpen(v => !v)} style={{ ...sel, minWidth: 150, textAlign: 'left', fontWeight: 400 }}>{current?.name ?? 'All Clients'}</button>{open && <div style={{ position: 'absolute', zIndex: 600, top: 'calc(100% + 3px)', left: 0, minWidth: 230, background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,.16)' }}><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search clients…" style={{ ...inp, width: '100%', paddingLeft: 10, borderRadius: 0 }} /><div style={{ maxHeight: 220, overflowY: 'auto' }}><button type="button" onClick={() => { onChange(''); setQuery(''); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>All Clients</button>{filtered.map(org => <button key={org.id} type="button" onClick={() => { onChange(org.id); setQuery(''); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, borderTop: '1px solid var(--border2)', background: org.id === value ? 'var(--bg2)' : 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>{org.name}</button>)}</div></div>}</div>;
}

function DeviceSearchSelect({ devices, value, onChange }: { devices: InventoryDevice[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const selected = devices.find(device => device.id === value);
  const filtered = devices.filter(device => `${device.displayId} ${device.imei} ${device.name ?? ''} ${device.licensePlate ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div ref={root} style={{ position: 'relative', minWidth: 250 }}><button type="button" onClick={() => setOpen(v => !v)} style={{ ...sel, width: '100%', height: 34, textAlign: 'left' }}>{selected ? `Device ${selected.displayId} · ${selected.imei}` : 'Select a device from inventory'}</button>
    {open && <div style={{ position: 'absolute', zIndex: 600, top: 'calc(100% + 3px)', left: 0, right: 0, minWidth: 310, background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,.16)' }}><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search device, IMEI, or vehicle…" style={{ ...inp, width: '100%', paddingLeft: 10, borderRadius: 0 }} /><div style={{ maxHeight: 220, overflowY: 'auto' }}>{filtered.map(device => <button key={device.id} type="button" onClick={() => { onChange(device.id); setQuery(''); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, borderBottom: '1px solid var(--border2)', background: device.id === value ? 'var(--bg2)' : 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}><strong>Device {device.displayId}</strong> · {device.imei}{device.licensePlate ? <span style={{ color: '#dc2626' }}> · Assigned to {device.licensePlate}</span> : <span style={{ color: '#16a34a' }}> · In stock</span>}</button>)}{!filtered.length && <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>No devices found</div>}</div></div>}</div>;
}

const sel: React.CSSProperties = { height: 34, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { licensePlate: '', make: '', model: '', year: '', cityId: '', lifecycleStatus: 'active' as Vehicle['lifecycleStatus'], expiresAt: '', organizationId: '', odometerKm: '0' };

export default function VehiclesPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [airlines, setAirlines] = useState<AirlineOpt[]>([]);
  const [clientTab, setClientTab] = useState<'client' | 'airline'>('client');
  const [vehicleAirlineId, setVehicleAirlineId] = useState(''); // current airline assignment (from airline_vehicles table)
  const [selectedAirlineId, setSelectedAirlineId] = useState(''); // airline selected in form
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expiryRange, setExpiryRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [assignmentRows, setAssignmentRows] = useState<DeviceAssignment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [inventoryDevices, setInventoryDevices] = useState<InventoryDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [deviceConflict, setDeviceConflict] = useState('');
  const [odoEditId, setOdoEditId] = useState<string | null>(null);
  const [odoInput, setOdoInput] = useState('');
  const [odoSaving, setOdoSaving] = useState(false);
  const [importModal, setImportModal]   = useState(false);
  const [importText, setImportText]     = useState('');
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
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
    Promise.all([api.get<Vehicle[]>(`/vehicles${p}`), api.get<Org[]>('/organizations'), api.get<AirlineOpt[]>('/airlines')])
      .then(([v, o, a]) => { setVehicles(v.data); setOrgs(o.data); setAirlines(a.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openDetails = async (vehicle: Vehicle) => {
    setDetailVehicle(vehicle); setAssignmentRows([]); setInventoryDevices([]); setAssignmentLoading(true); setDeviceConflict('');
    try {
      const [history, devices] = await Promise.all([
        api.get<DeviceAssignment[]>(`/devices/vehicle/${vehicle.id}/assignment-history`),
        api.get<InventoryDevice[]>('/devices/inventory'),
      ]);
      setAssignmentRows(history.data);
      setInventoryDevices(devices.data.filter(device => device.inventoryStatus !== 'retired' && device.inventoryStatus !== 'maintenance'));
      const current = devices.data.find(device => device.vehicleId === vehicle.id);
      setSelectedDeviceId(current?.id ?? '');
    } catch { setAssignmentRows([]); setInventoryDevices([]); } finally { setAssignmentLoading(false); }
  };

  const currentDevice = inventoryDevices.find(device => device.vehicleId === detailVehicle?.id);
  const selectedDevice = inventoryDevices.find(device => device.id === selectedDeviceId);
  const conflictingDevice = selectedDevice?.vehicleId && selectedDevice.vehicleId !== detailVehicle?.id ? selectedDevice : null;

  const saveVehicleDevice = async () => {
    if (!detailVehicle || !selectedDeviceId) return;
    if (conflictingDevice) {
      setDeviceConflict(`Device ${conflictingDevice.displayId} is already assigned to ${conflictingDevice.licensePlate || 'another vehicle'}. Remove it from that vehicle first.`);
      return;
    }
    setDeviceSaving(true); setDeviceConflict('');
    try {
      await api.post(`/vehicles/${detailVehicle.id}/device-assignment`, { deviceId: selectedDeviceId, reason: currentDevice ? 'Device replaced' : 'Device assigned' });
      setVehicles(rows => rows.map(row => row.id === detailVehicle.id ? { ...row, lifecycleStatus: 'active', isActive: true } : row));
      await load();
      await openDetails({ ...detailVehicle, lifecycleStatus: 'active', isActive: true });
      toast(currentDevice ? 'Device replaced' : 'Device assigned');
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setDeviceConflict(Array.isArray(message) ? message.join('. ') : message ?? 'Unable to assign this device.');
    } finally { setDeviceSaving(false); }
  };

  const removeVehicleDevice = async () => {
    if (!detailVehicle || !currentDevice || !window.confirm(`Remove device ${currentDevice.displayId} from ${detailVehicle.licensePlate || 'this vehicle'}? The vehicle will become Expired and disappear from live tracking.`)) return;
    setDeviceSaving(true); setDeviceConflict('');
    try {
      await api.post(`/vehicles/${detailVehicle.id}/device-assignment`, { deviceId: null, reason: 'Device removed from vehicle' });
      setVehicles(rows => rows.map(row => row.id === detailVehicle.id ? { ...row, lifecycleStatus: 'expired', isActive: false } : row));
      await openDetails({ ...detailVehicle, lifecycleStatus: 'expired', isActive: false });
      toast('Device removed from vehicle');
    } catch (error: any) { setDeviceConflict(error?.response?.data?.message ?? 'Unable to remove this device.'); }
    finally { setDeviceSaving(false); }
  };

  const saveOdometer = async () => {
    if (!odoEditId) return;
    const km = parseFloat(odoInput);
    if (!Number.isFinite(km) || km < 0) { toast('Enter a valid odometer value', 'error'); return; }
    setOdoSaving(true);
    try {
      await api.patch(`/vehicles/${odoEditId}/odometer`, { odometerKm: km });
      setVehicles(rows => rows.map(v => v.id === odoEditId ? { ...v, odometerKm: km } : v));
      if (detailVehicle?.id === odoEditId) setDetailVehicle(prev => prev ? { ...prev, odometerKm: km } : prev);
      setOdoEditId(null); toast('Odometer updated');
    } catch { toast('Failed to update odometer', 'error'); } finally { setOdoSaving(false); }
  };

  const openAdd = () => { setEditing(null); setForm(empty); setClientTab('client'); setVehicleAirlineId(''); setSelectedAirlineId(''); setModal(true); };
  const openEdit = async (v: Vehicle) => {
    setEditing(v);
    setForm({ licensePlate: v.licensePlate ?? '', make: v.make ?? '', model: v.model ?? '', year: v.year ? String(v.year) : '', cityId: v.cityId ?? '', lifecycleStatus: v.lifecycleStatus ?? (v.isActive ? 'active' : 'archived'), expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : '', organizationId: v.organizationId ?? '', odometerKm: String(v.odometerKm ?? 0) });
    setClientTab('client'); setVehicleAirlineId(''); setSelectedAirlineId('');
    try {
      const res = await api.get<{ id: string; name: string; iataCode: string | null } | null>(`/airlines/by-vehicle/${v.id}`);
      const al = res.data;
      if (al) { setVehicleAirlineId(al.id); setSelectedAirlineId(al.id); setClientTab('airline'); }
    } catch {}
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { lifecycleStatus, expiresAt, odometerKm, ...profile } = form;
      // When airline tab is active, don't set organizationId (airlines use their own junction table)
      const orgId = clientTab === 'airline' ? null : (form.organizationId || null);
      const payload = { ...profile, year: form.year ? Number(form.year) : null, organizationId: orgId, cityId: form.cityId || null };
      const odoKm = parseFloat(odometerKm);
      let vehicleId: string;
      if (editing) {
        vehicleId = editing.id;
        await api.patch(`/vehicles/${editing.id}`, payload);
        if (canManageLifecycle) await api.patch(`/vehicles/${editing.id}/lifecycle`, { lifecycleStatus, expiresAt: expiresAt || null });
        if (Number.isFinite(odoKm) && odoKm >= 0 && odoKm !== (editing.odometerKm ?? 0)) await api.patch(`/vehicles/${editing.id}/odometer`, { odometerKm: odoKm });
      } else {
        const created = await api.post<Vehicle>('/vehicles', payload);
        vehicleId = created.data.id;
        if (canManageLifecycle && (lifecycleStatus !== 'active' || expiresAt)) await api.patch(`/vehicles/${vehicleId}/lifecycle`, { lifecycleStatus, expiresAt: expiresAt || null });
        if (Number.isFinite(odoKm) && odoKm > 0) await api.patch(`/vehicles/${vehicleId}/odometer`, { odometerKm: odoKm });
      }
      // Handle airline assignment separately
      if (clientTab === 'airline') {
        if (vehicleAirlineId && vehicleAirlineId !== selectedAirlineId) {
          await api.delete(`/airlines/${vehicleAirlineId}/vehicles/${vehicleId}`);
        }
        if (selectedAirlineId) {
          await api.post(`/airlines/${selectedAirlineId}/vehicles`, { vehicleId });
        }
      } else if (vehicleAirlineId) {
        // switched to client tab — unassign from airline
        await api.delete(`/airlines/${vehicleAirlineId}/vehicles/${vehicleId}`);
      }
      await load(); closeModal();
      toast(editing ? 'Vehicle updated' : 'Vehicle added');
    } catch (err: any) { const msg = err?.response?.data?.message; toast(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Failed to save vehicle'), 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      const result = await api.delete<{ archived: boolean }>(`/vehicles/${deleting.id}`);
      if (result.data.archived) { setVehicles(rows => rows.map(row => row.id === deleting.id ? { ...row, lifecycleStatus: 'archived', isActive: false } : row)); toast('Vehicle archived'); }
      else { setVehicles(v => v.filter(x => x.id !== deleting.id)); toast('Vehicle deleted'); }
      setDeleting(null);
    } catch { toast('Failed to delete vehicle', 'error'); } finally { setDeletingId(false); }
  };

  const filtered = vehicles.filter(v => {
    if (q && !(v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase()) && !(v.make ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    const effectiveStatus = v.lifecycleStatus === 'active' && v.expiresAt && Date.parse(v.expiresAt) <= Date.now() ? 'expired' : v.lifecycleStatus;
    if (statusFilter && effectiveStatus !== statusFilter) return false;
    if (organizationFilter && v.organizationId !== organizationFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(v.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    if (expiryRange?.from && (!v.expiresAt || !isWithinInterval(parseISO(v.expiresAt), { start: startOfDay(expiryRange.from), end: endOfDay(expiryRange.to ?? expiryRange.from) }))) return false;
    return true;
  });
  const pagination = useTablePagination(filtered, JSON.stringify([q, statusFilter, organizationFilter, dateRange?.from?.getTime(), dateRange?.to?.getTime(), expiryRange?.from?.getTime(), expiryRange?.to?.getTime()]));
  const getLifecycle = (vehicle: Vehicle): Vehicle['lifecycleStatus'] => vehicle.lifecycleStatus === 'active' && vehicle.expiresAt && Date.parse(vehicle.expiresAt) <= Date.now() ? 'expired' : vehicle.lifecycleStatus;
  const countLifecycle = (key: Vehicle['lifecycleStatus'] | 'all') => key === 'all' ? vehicles.length : vehicles.filter(vehicle => getLifecycle(vehicle) === key).length;

  const downloadSampleCSV = () => {
    const csv = `License Plate,Make,Model,Year\nABC-123,Toyota,Corolla,2022\nXYZ-456,Honda,Civic,2021\n`;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'vehicles-sample.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleImport = async () => {
    if (!importText.trim()) { toast('Paste CSV content first', 'error'); return; }
    setImporting(true); setImportResult(null);
    try {
      const lines = importText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const isHeader = lines[0]?.toLowerCase().includes('plate') || lines[0]?.toLowerCase().includes('license');
      const dataLines = isHeader ? lines.slice(1) : lines;
      const items = dataLines.map(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        return { licensePlate: cols[0] ?? '', make: cols[1] ?? '', model: cols[2] ?? '', year: cols[3] ?? '' };
      }).filter(item => item.licensePlate);
      if (!items.length) { toast('No valid rows found', 'error'); return; }
      const res = await api.post<{ imported: number; skipped: string[] }>('/vehicles/bulk-import', { items });
      setImportResult(res.data);
      if (res.data.imported > 0) { load(); toast(`${res.data.imported} vehicle(s) imported`); }
    } catch (err: any) { toast(err?.response?.data?.message ?? 'Import failed', 'error'); } finally { setImporting(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportCSV = () => {
    const headers = ['ID', 'License Plate', 'Make', 'Model', 'Year', 'Client', 'Lifecycle', 'Added Date', 'Expiry Date'];
    const csvRows = filtered.map(v => [v.displayId, v.licensePlate ?? '', v.make ?? '', v.model ?? '', v.year ?? '', orgs.find(o => o.id === v.organizationId)?.name ?? '', getLifecycle(v), fmtDate(v.createdAt), v.expiresAt ? fmtDate(v.expiresAt) : '']);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `vehicles-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader title="Vehicles" count={vehicles.length} action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 8, background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconDownload size={13} /> Export
          </button>
          {canAdd && <button onClick={() => { setImportModal(true); setImportText(''); setImportResult(null); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #2563eb', borderRadius: 8, background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconFileImport size={13} /> Bulk Import
          </button>}
          {canAdd && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add Vehicle
          </button>}
        </div>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
        {([['All Vehicles', 'all', '#374151'], ['Active', 'active', '#16a34a'], ['Expired', 'expired', '#dc2626'], ['Archived', 'archived', '#6b7280']] as const).map(([label, key, color]) => <div key={key} style={{ borderLeft: `3px solid ${color}`, padding: '8px 12px', background: 'var(--bg2)' }}><div style={{ color: 'var(--muted)', fontSize: 11 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 700, marginTop: 3 }}>{countLifecycle(key)}</div></div>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Plate, make, model…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'All Lifecycle States' }, { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired' }, { value: 'archived', label: 'Archived' },
        ]} />
        <ClientSearchSelect orgs={orgs} value={organizationFilter} onChange={setOrganizationFilter} />
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        <DateRangePicker value={expiryRange} onChange={setExpiryRange} placeholder="Tracking expiry" />
        {(q || statusFilter || organizationFilter || dateRange || expiryRange) && <button onClick={() => { setQ(''); setStatusFilter(''); setOrganizationFilter(''); setDateRange(undefined); setExpiryRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={7} /> : (
        <div className="tbl-wrap page-table">
        <table>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Plate', 'Make / Model', 'Year', 'Odometer', 'Client', 'Status', 'Added', 'Tracking Expiry', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pagedItems.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${getLifecycle(v) === 'active' ? '#16a34a' : getLifecycle(v) === 'expired' ? '#dc2626' : '#9ca3af'}` }}>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{v.displayId}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{v.licensePlate ?? '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{v.year ?? '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{Number(v.odometerKm ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{orgs.find(org => org.id === v.organizationId)?.name ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {canManageLifecycle ? <select value={getLifecycle(v)} onChange={async e => {
                    const lifecycleStatus = e.target.value as Vehicle['lifecycleStatus'];
                    try { await api.patch(`/vehicles/${v.id}/lifecycle`, { lifecycleStatus, expiresAt: v.expiresAt }); setVehicles(rows => rows.map(row => row.id === v.id ? { ...row, lifecycleStatus, isActive: lifecycleStatus === 'active' } : row)); }
                    catch { /* Keep the saved lifecycle state on screen. */ }
                  }} style={{ ...sel, color: getLifecycle(v) === 'expired' ? '#dc2626' : getLifecycle(v) === 'active' ? '#16a34a' : '#6b7280' }}>
                    <option value="active">Active</option><option value="expired">Expired</option><option value="archived">Archived</option>
                  </select> : <span style={{ color: getLifecycle(v) === 'expired' ? '#dc2626' : getLifecycle(v) === 'active' ? '#16a34a' : '#6b7280' }}>{getLifecycle(v) === 'expired' ? 'Expired' : getLifecycle(v) === 'archived' ? 'Archived' : 'Active'}</span>}
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(v.createdAt)}</td>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{v.expiresAt ? fmtDate(v.expiresAt) : '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => void openDetails(v)} title="View" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: 4, display: 'flex' }}><IconEye size={15}/></button>
                    {canEdit && <button onClick={() => openEdit(v)} title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: 4, display: 'flex' }}><IconEdit size={15}/></button>}
                    {canDelete && <button onClick={() => setDeleting(v)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, borderRadius: 4, display: 'flex' }}><IconTrash size={15}/></button>}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No vehicles found</td></tr>}
          </tbody>
        </table>
        </div>
      )}
      {!loading && <TablePagination page={pagination.page} pageSize={pagination.pageSize} total={filtered.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}

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
          <FormField label="Odometer (km)">
            <input type="number" min="0" step="1" value={form.odometerKm} onChange={e => set('odometerKm', e.target.value)} placeholder="0" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Client">
              {/* Tab toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 6, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--input-border)' }}>
                {(['client', 'airline'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setClientTab(t)}
                    style={{ flex: 1, padding: '5px 0', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: clientTab === t ? 700 : 400, background: clientTab === t ? '#dc2626' : 'var(--input-bg)', color: clientTab === t ? '#fff' : 'var(--muted)' }}>
                    {t === 'client' ? 'Client' : 'Airline'}
                  </button>
                ))}
              </div>
              {clientTab === 'client' ? (
                <select value={form.organizationId} onChange={e => set('organizationId', e.target.value)} style={selectStyle}>
                  <option value="">— None —</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <select value={selectedAirlineId} onChange={e => setSelectedAirlineId(e.target.value)} style={selectStyle}>
                  <option value="">— None —</option>
                  {airlines.map(a => <option key={a.id} value={a.id}>{a.name}{a.iataCode ? ` (${a.iataCode})` : ''}</option>)}
                </select>
              )}
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
            <div style={{ padding: 12, borderLeft: '2px solid #2563eb', background: 'var(--bg2)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Odometer</div>
              {odoEditId === detailVehicle.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input autoFocus type="number" min="0" step="0.1" value={odoInput} onChange={e => setOdoInput(e.target.value)} style={{ ...sel, width: 100, height: 28, padding: '0 6px', fontSize: 12 }} onKeyDown={e => { if (e.key === 'Enter') void saveOdometer(); if (e.key === 'Escape') setOdoEditId(null); }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>km</span>
                  <button onClick={() => void saveOdometer()} disabled={odoSaving} style={{ height: 28, padding: '0 10px', border: 0, background: '#dc2626', color: '#fff', fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>Save</button>
                  <button onClick={() => setOdoEditId(null)} style={{ height: 28, padding: '0 8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{Number(detailVehicle.odometerKm ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} km</span>
                  {canEdit && <button onClick={() => { setOdoEditId(detailVehicle.id); setOdoInput(String(detailVehicle.odometerKm ?? 0)); }} style={{ height: 22, padding: '0 8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 10, cursor: 'pointer', borderRadius: 4 }}>Set</button>}
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Vehicle Device</div>
            {assignmentLoading ? <Spinner /> : <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', fontSize: 12, color: 'var(--text2)' }}>
                  {currentDevice ? <><strong>Device {currentDevice.displayId}</strong> · {currentDevice.imei}<div style={{ marginTop: 4, color: 'var(--muted)' }}>SIM {currentDevice.simNumber || '—'}</div></> : 'No device assigned'}
                </div>
                {canManageLifecycle && <>
                  <DeviceSearchSelect devices={inventoryDevices} value={selectedDeviceId} onChange={id => { setSelectedDeviceId(id); setDeviceConflict(''); }} />
                  <button disabled={!selectedDeviceId || selectedDeviceId === currentDevice?.id || deviceSaving} onClick={() => void saveVehicleDevice()} style={{ height: 34, padding: '0 14px', border: 0, background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', opacity: !selectedDeviceId || selectedDeviceId === currentDevice?.id || deviceSaving ? .5 : 1 }}>{currentDevice ? 'Replace Device' : 'Assign Device'}</button>
                  {currentDevice && <button disabled={deviceSaving} onClick={() => void removeVehicleDevice()} style={{ height: 34, padding: '0 14px', border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Remove Device</button>}
                </>}
              </div>
            </>}
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

      <Modal open={!!deviceConflict} title={deviceConflict.toLowerCase().includes('already assigned') ? 'Device Already Assigned' : 'Device Assignment'} onClose={() => setDeviceConflict('')}>
        <div style={{ borderLeft: '3px solid #dc2626', padding: '12px 14px', background: 'rgba(220,38,38,.06)', color: 'var(--text2)', fontSize: 13 }}>{deviceConflict}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><button onClick={() => setDeviceConflict('')} style={{ height: 34, padding: '0 16px', border: 0, background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Understood</button></div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Vehicle"
        message={`Remove vehicle "${deleting?.licensePlate ?? deleting?.id}"? Vehicles with history are archived so reports and tracking records remain available.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />

      <Modal open={importModal} title="Bulk Import Vehicles" onClose={() => setImportModal(false)} width="min(600px, 96vw)">
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg2)', borderLeft: '3px solid #2563eb', fontSize: 12, color: 'var(--text2)' }}>
          <strong>CSV format:</strong> License Plate, Make, Model, Year<br />
          Header row is optional. First column (License Plate) is required.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={downloadSampleCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', border: '1px solid #2563eb', borderRadius: 6, background: 'transparent', color: '#2563eb', fontSize: 12, cursor: 'pointer' }}>
            <IconDownload size={13} /> Download Sample
          </button>
          <button onClick={() => importFileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
            <IconUpload size={13} /> Upload CSV File
          </button>
          <input ref={importFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
        <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={"ABC-123,Toyota,Corolla,2022\nXYZ-456,Honda,Civic,2021"} rows={8}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', background: 'var(--input-bg)', color: 'var(--input-color)', resize: 'vertical', outline: 'none' }} />
        {importResult && (
          <div style={{ margin: '10px 0', padding: '10px 14px', background: importResult.imported > 0 ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.06)', borderLeft: `3px solid ${importResult.imported > 0 ? '#16a34a' : '#dc2626'}`, fontSize: 12 }}>
            <strong>{importResult.imported} vehicle(s) imported.</strong>
            {importResult.skipped.length > 0 && <div style={{ marginTop: 6, color: 'var(--muted)' }}>Skipped ({importResult.skipped.length}): {importResult.skipped.slice(0, 5).join(', ')}{importResult.skipped.length > 5 ? ` and ${importResult.skipped.length - 5} more` : ''}</div>}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={() => setImportModal(false)} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>Close</button>
          <button onClick={() => void handleImport()} disabled={importing || !importText.trim()} style={{ height: 34, padding: '0 16px', border: 0, background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer', borderRadius: 6, opacity: importing || !importText.trim() ? .5 : 1 }}>
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
