import { useEffect, useState, useRef, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconDownload, IconUpload, IconFileImport, IconArrowsExchange, IconMessage, IconCopy, IconCheck, IconX as IconXMark } from '@tabler/icons-react';
import CustomSelect from '../components/CustomSelect';
import type { DateRange } from '../components/DateRangePicker';
import { format } from 'date-fns';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { fmtDate } from '../utils/date';
import SkeletonTable from '../components/SkeletonTable';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TablePagination, { useTablePagination } from '../components/TablePagination';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Device { id: string; displayId: number; imei: string; name: string | null; simNumber: string | null; cityId: string | null; status: string; inventoryStatus: 'in_stock' | 'assigned' | 'maintenance' | 'retired'; lastSeenAt: string | null; vehicleId: string | null; vehicleDisplayId: number | null; licensePlate: string | null; make: string | null; model: string | null; organizationId: string | null; clientName: string | null; createdAt: string; }
interface Organization { id: string; name: string; }
interface SwapVehicle { id: string; displayId: number; licensePlate: string | null; name: string | null; }
interface InventorySummary { total: number; assigned: number; inStock: number; }

const sel: React.CSSProperties = { height: 34, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { imei: '', name: '', simNumber: '', cityId: '', inventoryStatus: 'in_stock' as Device['inventoryStatus'] };

function SearchableFilter({ options, value, onChange, placeholder }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const selected = options.find(option => option.id === value)?.label ?? '';
  const matches = options.filter(option => option.label.toLowerCase().includes(q.toLowerCase()));
  return <div ref={ref} style={{ position: 'relative', minWidth: 190 }}>
    <input value={open ? q : selected} placeholder={placeholder} style={{ ...sel, width: '100%', cursor: 'text' }}
      onFocus={() => { setQ(''); setOpen(true); }} onChange={event => { setQ(event.target.value); setOpen(true); }} />
    {open && <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 450, maxHeight: 230, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setOpen(false); setQ(''); }} style={{ width: '100%', padding: '8px 10px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>All</button>
      {matches.map(option => <button key={option.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(option.id); setOpen(false); setQ(''); }} style={{ width: '100%', padding: '8px 10px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border2)', background: option.id === value ? 'rgba(220,38,38,.06)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>{option.label}</button>)}
      {!matches.length && <div style={{ padding: 10, color: 'var(--muted)', fontSize: 12 }}>No results</div>}
    </div>}
  </div>;
}

function lastSeenLabel(ts: string | null) {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

const SMS_PRESETS = [
  { label: 'Connect Server',  cmd: 'Server,1,2.31.172.140,5023,0#', color: '#0891b2' },
  { label: 'Cut Engine',      cmd: 'DYD#',                          color: '#dc2626' },
  { label: 'Restore Engine',  cmd: 'HFYD#',                         color: '#16a34a' },
  { label: 'Check Status',    cmd: 'STATUS#',                       color: '#2563eb' },
  { label: 'Reset Device',    cmd: 'RESET#',                        color: '#f59e0b' },
  { label: 'View Settings',   cmd: 'PARAM#',                        color: '#7c3aed' },
  { label: 'Custom',          cmd: '',                              color: '#6b7280' },
] as const;

function SmsCommandModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const [custom, setCustom]     = useState('');
  const [password, setPassword] = useState('');
  const [copiedSms, setCopiedSms]   = useState(false);
  const [copiedSim, setCopiedSim]   = useState(false);

  const isCustom = selected === SMS_PRESETS.length - 1;
  const rawCmd   = isCustom ? custom.trim() : SMS_PRESETS[selected]!.cmd;
  const smsText  = password.trim() ? `${password.trim()} ${rawCmd}` : rawCmd;

  const copy = (text: string, which: 'sms' | 'sim') => {
    void navigator.clipboard.writeText(text).catch(() => {});
    if (which === 'sms') { setCopiedSms(true); setTimeout(() => setCopiedSms(false), 1800); }
    else                 { setCopiedSim(true); setTimeout(() => setCopiedSim(false), 1800); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>SMS Command</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, fontFamily: 'monospace' }}>{device.imei}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}><IconXMark size={16} /></button>
        </div>

        {/* preset buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {SMS_PRESETS.map((p, i) => (
            <button key={i} onClick={() => setSelected(i)}
              style={{ padding: '7px 4px', borderRadius: 7, border: `1.5px solid ${selected === i ? p.color : 'var(--border)'}`, background: selected === i ? `${p.color}14` : 'var(--bg2)', color: selected === i ? p.color : 'var(--muted)', fontSize: 11, fontWeight: selected === i ? 700 : 500, cursor: 'pointer', textAlign: 'center' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* custom input */}
        {isCustom && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Command</label>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. INTERVAL,0,60,0#"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', background: 'var(--bg2)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
          </div>
        )}

        {/* optional password */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Password (optional)</label>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank if not required"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--bg2)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        {/* SMS text to send */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Send this SMS:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <code style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--text)', wordBreak: 'break-all' }}>{smsText || '—'}</code>
            <button onClick={() => smsText && copy(smsText, 'sms')} disabled={!smsText}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', color: copiedSms ? '#16a34a' : 'var(--muted)', fontSize: 11, cursor: smsText ? 'pointer' : 'default', flexShrink: 0 }}>
              {copiedSms ? <IconCheck size={11} /> : <IconCopy size={11} />}
              {copiedSms ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* SIM number */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Send to (SIM Number):</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{device.simNumber}</span>
            <button onClick={() => copy(device.simNumber!, 'sim')}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', color: copiedSim ? '#16a34a' : 'var(--muted)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
              {copiedSim ? <IconCheck size={11} /> : <IconCopy size={11} />}
              {copiedSim ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({ total: 0, assigned: 0, inStock: 0 });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [smsDevice, setSmsDevice]   = useState<Device | null>(null);
  const [swapDevice, setSwapDevice] = useState<Device | null>(null);
  const [swapTarget, setSwapTarget] = useState('');
  const [swapVehicles, setSwapVehicles] = useState<SwapVehicle[]>([]);
  const [swapping, setSwapping] = useState(false);
  const { cities, selectedCityId } = useCityFilter();

  const load = () => {
    const query = new URLSearchParams();
    if (selectedCityId) query.set('cityId', selectedCityId);
    if (organizationFilter) query.set('organizationId', organizationFilter);
    if (statusFilter) query.set('status', statusFilter);
    if (q.trim()) query.set('search', q.trim());
    if (dateRange?.from) query.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) query.set('to', format(dateRange.to, 'yyyy-MM-dd'));
    api.get<Device[]>(`/devices/inventory?${query.toString()}`)
      .then(response => setDevices(response.data))
      .catch(() => {}).finally(() => setLoading(false));
    api.get<InventorySummary>(`/devices/inventory/summary${selectedCityId ? `?cityId=${selectedCityId}` : ''}`)
      .then(response => setSummary(response.data)).catch(() => {});
  };
  useEffect(() => {
    api.get<Organization[]>('/organizations').then(response => setOrganizations(response.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [selectedCityId, organizationFilter, statusFilter, q, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ imei: d.imei, name: d.name ?? '', simNumber: d.simNumber ?? '', cityId: d.cityId ?? '', inventoryStatus: d.inventoryStatus });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Duplicate check against already-loaded devices (exclude self when editing)
    const others = devices.filter(d => d.id !== editing?.id);
    if (others.some(d => d.imei === form.imei.trim())) { toast('A device with this IMEI already exists', 'error'); return; }
    const trimmedName = form.name.trim();
    if (trimmedName && others.some(d => d.name?.toLowerCase() === trimmedName.toLowerCase())) { toast('A device with this name already exists', 'error'); return; }
    const trimmedSim = form.simNumber.trim();
    if (trimmedSim && others.some(d => d.simNumber === trimmedSim)) { toast('A device with this SIM number already exists', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, cityId: form.cityId || null };
      if (editing) { await api.patch(`/devices/${editing.id}`, payload); toast('Device updated'); }
      else { await api.post('/devices', payload); toast('Device added'); }
      await load(); closeModal();
    } catch (err: any) { const msg = err?.response?.data?.message; toast(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Failed to save device'), 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/devices/${deleting.id}`);
      setDevices(d => d.filter(x => x.id !== deleting.id));
      setDeleting(null);
      toast('Device deleted');
    } catch (error: any) { toast(error?.response?.data?.message ?? 'Unable to delete this device', 'error'); } finally { setDeletingId(false); }
  };

  const openSwap = async (d: Device) => {
    setSwapDevice(d); setSwapTarget(''); setSwapping(false);
    try {
      const r = await api.get<SwapVehicle[]>('/vehicles?limit=500');
      const vList = Array.isArray(r.data) ? r.data : (r.data as any).items ?? [];
      setSwapVehicles(vList.filter((v: SwapVehicle) => v.id !== d.vehicleId));
    } catch { setSwapVehicles([]); }
  };

  const handleSwap = async () => {
    if (!swapDevice || !swapTarget) return;
    const targetVehicle = swapVehicles.find(v => v.id === swapTarget);
    setSwapping(true);
    try {
      await api.post(`/vehicles/${swapTarget}/device-assignment`, { deviceId: swapDevice.id, reason: 'swap' });
      toast(`Device ${swapDevice.imei} swapped to ${targetVehicle?.licensePlate || `#${targetVehicle?.displayId}`}`);
      setSwapDevice(null);
      load();
    } catch (err: any) { toast(err?.response?.data?.message ?? 'Swap failed', 'error'); } finally { setSwapping(false); }
  };

  // The API applies this filter through the selected user's effective vehicle
  // permissions. Filtering here by vehicle creator would hide valid results.
  const filtered = devices;
  const pagination = useTablePagination(filtered, JSON.stringify([q, statusFilter, organizationFilter, dateRange?.from?.getTime(), dateRange?.to?.getTime(), selectedCityId]));

  const downloadSampleCSV = () => {
    const csv = `IMEI,Name,SIM Number\n863719060123456,Tracker-01,03001234567\n863719060654321,Tracker-02,\n`;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'devices-sample.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleImport = async () => {
    if (!importText.trim()) { toast('Paste CSV content first', 'error'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const lines = importText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const isHeader = (lines[0] || '').toLowerCase().includes('imei');
      const dataLines = isHeader ? lines.slice(1) : lines;
      const items = dataLines.map(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        return { imei: cols[0] ?? '', name: cols[1] ?? '', simNumber: cols[2] ?? '' };
      }).filter(item => item.imei);
      if (!items.length) { toast('No valid rows found', 'error'); return; }
      const res = await api.post<{ imported: number; skipped: string[] }>('/devices/bulk-import', { items });
      setImportResult(res.data);
      if (res.data.imported > 0) { load(); toast(`${res.data.imported} device(s) imported`); }
    } catch (err: any) { toast(err?.response?.data?.message ?? 'Import failed', 'error'); } finally { setImporting(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText(ev.target?.result as string ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportCSV = () => {
    const headers = ['ID', 'IMEI', 'Device Name', 'SIM Number', 'Assignment', 'Vehicle', 'Client', 'Connection', 'Last Seen', 'Added'];
    const csvRows = filtered.map(d => {
      const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
      return [d.displayId, d.imei, d.name ?? '', d.simNumber ?? '', d.inventoryStatus.replace('_', ' '), d.vehicleId ? `${d.vehicleDisplayId ?? ''} ${d.licensePlate ?? ''}`.trim() : '', d.clientName ?? '', online ? 'Online' : 'Offline', lastSeenLabel(d.lastSeenAt), fmtDate(d.createdAt)];
    });
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `devices-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  const summaryCards: { label: string; value: number; color: string }[] = [
    { label: 'Total Devices', value: summary.total, color: '#111' },
    { label: 'Assigned Devices', value: summary.assigned, color: '#16a34a' },
    { label: 'In Stock', value: summary.inStock, color: '#dc2626' },
  ];

  return (
    <div>
      <PageHeader title="Devices" count={devices.length} action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { setImportModal(true); setImportResult(null); setImportText(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconFileImport size={13} /> Bulk Import
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 8, background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconDownload size={13} /> Export
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add Device
          </button>
        </div>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
        {summaryCards.map(card => <div key={card.label} style={{ padding: '14px 16px', background: 'var(--bg2)', borderLeft: `3px solid ${card.color}` }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>{card.label}</div><div style={{ marginTop: 5, fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div></div>)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search IMEI, device, or plate…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'All Assignment States' }, { value: 'assigned', label: 'Assigned' },
          { value: 'in_stock', label: 'In Stock' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' },
        ]} minWidth={160} />
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        <SearchableFilter options={organizations.map(org => ({ id: org.id, label: org.name }))} value={organizationFilter} onChange={setOrganizationFilter} placeholder="Search client…" />
        {(q || statusFilter || dateRange || organizationFilter) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); setOrganizationFilter(''); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear filters</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={8} /> : (
        <div className="tbl-wrap page-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'IMEI', 'Device', 'SIM', 'Assignment', 'Vehicle', 'Client', 'Connection', 'Last Seen', 'Added', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pagedItems.map(d => {
              const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
              const borderColor = online ? '#16a34a' : d.vehicleId ? '#dc2626' : '#9ca3af';
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${borderColor}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{d.displayId}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{d.imei}</td>
                  <td style={{ padding: '10px 14px' }}>{d.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.simNumber ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: d.inventoryStatus === 'assigned' ? '#16a34a' : d.inventoryStatus === 'retired' ? '#6b7280' : d.inventoryStatus === 'maintenance' ? '#f59e0b' : '#9ca3af' }}>{d.inventoryStatus.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.vehicleId ? `${d.vehicleDisplayId ?? ''} ${d.licensePlate ?? ''}`.trim() : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.clientName ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: online ? '#16a34a' : '#9ca3af' }}>
                    {online ? 'Online' : 'Offline'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{lastSeenLabel(d.lastSeenAt)}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(d.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      {d.inventoryStatus === 'assigned' && <button onClick={() => { void openSwap(d); }} title="Swap device to another vehicle" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconArrowsExchange size={14} /></button>}
                      {d.simNumber && <button onClick={() => setSmsDevice(d)} title="Send SMS command" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#7c3aed')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconMessage size={14} /></button>}
                      <button onClick={() => setDeleting(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={11} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No devices found</td></tr>}
          </tbody>
        </table>
        </div>
      )}
      {!loading && <TablePagination page={pagination.page} pageSize={pagination.pageSize} total={filtered.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}

      <Modal open={modal} title={editing ? 'Edit Device' : 'Add Device'} onClose={closeModal} width='min(1200px, 97vw)' height='min(800px, 96vh)'>
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
          <FormField label="City">
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
          </FormField>
          {editing && !editing.vehicleId && <FormField label="Inventory Status">
            <select value={form.inventoryStatus} onChange={event => set('inventoryStatus', event.target.value)} style={selectStyle}>
              <option value="in_stock">In Stock</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
            </select>
          </FormField>}
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Register Device'} />
        </form>
      </Modal>

      {smsDevice && <SmsCommandModal device={smsDevice} onClose={() => setSmsDevice(null)} />}

      <ConfirmDialog open={!!deleting} title="Delete Device"
        message={`Delete device "${deleting?.imei}"? Devices with telemetry or assignment history are retained and must be marked Retired.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />

      {/* ── Device Swap Modal ── */}
      <Modal open={!!swapDevice} onClose={() => setSwapDevice(null)} title="Swap Device" width={500}>
        {swapDevice && (
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Moving device:</div>
              <div style={{ fontFamily: 'monospace', color: '#dc2626' }}>{swapDevice.imei}</div>
              <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                Currently on: <strong>{swapDevice.licensePlate || `Vehicle #${swapDevice.vehicleDisplayId}`}</strong> {swapDevice.clientName ? `(${swapDevice.clientName})` : ''}
              </div>
            </div>
            <FormField label="Target Vehicle *">
              <select value={swapTarget} onChange={e => setSwapTarget(e.target.value)} style={selectStyle}>
                <option value="">— Select vehicle to receive this device —</option>
                {swapVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.licensePlate ? `${v.licensePlate}` : `#${v.displayId}`}{v.name ? ` — ${v.name}` : ''}
                  </option>
                ))}
              </select>
            </FormField>
            {swapTarget && (
              <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid #fde68a', color: '#92400e' }}>
                ⚠️ If the target vehicle already has a device, it will be automatically removed first.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setSwapDevice(null)} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { void handleSwap(); }} disabled={swapping || !swapTarget}
                style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: swapping || !swapTarget ? 'not-allowed' : 'pointer', opacity: swapping || !swapTarget ? 0.6 : 1 }}>
                {swapping ? 'Swapping…' : 'Confirm Swap'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Import Modal ── */}
      <Modal open={importModal} onClose={() => { setImportModal(false); setImportResult(null); }} title="Bulk Import Devices" width={560}>
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Paste CSV data (columns: <b>IMEI, Name, SIM Number</b>) or upload a .csv file. First row may be a header. Max 500 devices.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={downloadSampleCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #2563eb', borderRadius: 6, background: 'transparent', color: '#2563eb', fontSize: 12, cursor: 'pointer' }}>
              <IconDownload size={12}/> Download Sample
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
              <IconUpload size={12}/> Upload CSV
            </button>
            <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>or paste below</span>
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={'863719060123456,Tracker-01,03001234567\n863719060654321,Tracker-02,\n...'}
            rows={8}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', background: 'var(--bg2)', color: 'var(--text)', boxSizing: 'border-box' }}
          />
          {importResult && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 6, background: importResult.imported > 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${importResult.imported > 0 ? '#bbf7d0' : '#fecaca'}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: importResult.imported > 0 ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                {importResult.imported} device(s) imported successfully
              </div>
              {importResult.skipped.length > 0 && (
                <div style={{ fontSize: 11, color: '#dc2626' }}>
                  <b>Skipped ({importResult.skipped.length}):</b>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {importResult.skipped.slice(0, 10).map((s, i) => <li key={i}>{s}</li>)}
                    {importResult.skipped.length > 10 && <li>+{importResult.skipped.length - 10} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button onClick={() => { setImportModal(false); setImportResult(null); }} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Close</button>
            <button onClick={handleImport} disabled={importing || !importText.trim()} style={{ padding: '7px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}>
              {importing ? 'Importing…' : 'Import Devices'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
