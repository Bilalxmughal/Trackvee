import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconBuilding, IconUsers, IconCar, IconCpu, IconMapPin, IconPhone, IconMail, IconLock, IconCalendar, IconEdit } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Client {
  id: string; displayId: number; name: string;
  pocName: string | null; contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  customerCount: number; vehicleCount: number; deviceCount: number;
}
interface Vehicle {
  id: string; displayId: number; licensePlate: string | null;
  make: string | null; model: string | null; year: number | null;
  isActive: boolean; organizationId: string | null;
}
interface Device {
  id: string; imei: string; status: string;
  vehicle?: { id: string; licensePlate: string | null } | null;
}

const card: React.CSSProperties = { padding: 20, borderRadius: 12, background: 'var(--bg2)' };
const emptyForm = { name: '', pocName: '', contactNo: '', email: '', password: '', cityId: '', isActive: true };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cities } = useCityFilter();
  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [cl, vs, ds] = await Promise.all([
        api.get<Client>(`/organizations/${id}`),
        api.get<Vehicle[]>('/vehicles'),
        api.get<Device[]>('/devices'),
      ]);
      setClient(cl.data);
      setVehicles(vs.data);
      setDevices(ds.data);
    } catch {
      navigate('/clients', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    if (!client) return;
    setForm({ name: client.name, pocName: client.pocName ?? '', contactNo: client.contactNo ?? '', email: client.email ?? '', password: '', cityId: client.cityId ?? '', isActive: client.isActive });
    setEditOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name, pocName: form.pocName || null, contactNo: form.contactNo || null,
        email: form.email || null, cityId: form.cityId || null, isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;
      await api.patch(`/organizations/${id}`, payload);
      setEditOpen(false);
      setLoading(true);
      await load();
    } catch { } finally { setSaving(false); }
  };

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <Spinner style={{ height: '60vh' }} />;
  if (!client) return null;

  const cityName = cities.find(c => c.id === client.cityId)?.name ?? '—';
  const myVehicles = vehicles.filter(v => v.organizationId === client.id);
  const deviceMap = new Map(devices.filter(d => d.vehicle?.id).map(d => [d.vehicle!.id, d]));

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Back */}
      <button onClick={() => navigate('/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '4px 0', marginBottom: 20 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
        <IconArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconBuilding size={24} color="#dc2626" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{client.name}</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>ID {client.displayId}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, borderLeft: `3px solid ${client.isActive ? '#22c55e' : '#e5e7eb'}`, color: client.isActive ? '#16a34a' : 'var(--muted)', background: 'var(--bg2)' }}>
            {client.isActive ? 'Active' : 'Inactive'}
          </span>
          <button onClick={openEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconEdit size={13} /> Edit Client
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: IconUsers, label: 'Customers', value: client.customerCount },
          { icon: IconCar, label: 'Vehicles', value: client.vehicleCount },
          { icon: IconCpu, label: 'Devices', value: client.deviceCount },
        ].map(s => (
          <div key={s.label} style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={18} color="#dc2626" />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid: left info | right fleet */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contact Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: IconUsers, label: 'POC Name', value: client.pocName ?? '—' },
                { icon: IconPhone, label: 'Contact No', value: client.contactNo ?? '—' },
                { icon: IconMail, label: 'Email', value: client.email ?? '—' },
                { icon: IconMapPin, label: 'City', value: cityName },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 8, background: 'var(--bg)' }}>
                  <row.icon size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{row.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Portal Access</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconLock size={15} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {client.email ? 'Portal Login Enabled' : 'No Portal Access'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {client.email ? client.email : 'No email or password configured.'}
                </div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Dates</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 8, background: 'var(--bg)' }}>
              <IconCalendar size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>Added on</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{fmtDate(client.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: fleet */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Fleet — {myVehicles.length} vehicle{myVehicles.length !== 1 ? 's' : ''}
            </span>
          </div>
          {myVehicles.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>No vehicles registered for this client.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'License Plate', 'Make / Model', 'Year', 'Device IMEI', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myVehicles.map(v => {
                  const dev = deviceMap.get(v.id);
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${v.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                      <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{v.displayId}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{v.licensePlate ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{v.year ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: dev ? 'var(--text)' : '#ccc' }}>
                        {dev ? dev.imei : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: v.isActive ? '#16a34a' : 'var(--muted)', fontSize: 12 }}>{v.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} title="Edit Client" onClose={() => setEditOpen(false)}>
        <form onSubmit={handleSave}>
          <FormField label="Company Name *">
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Acme Logistics" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="POC Name">
              <input value={form.pocName} onChange={e => set('pocName', e.target.value)} placeholder="e.g. Ali Khan" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label="Contact No">
              <input value={form.contactNo} onChange={e => set('contactNo', e.target.value)} placeholder="03001234567" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Email (Portal Login)">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="client@example.com" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label="New Password (leave blank to keep)">
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          </div>
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
          <FormActions onClose={() => setEditOpen(false)} loading={saving} submitLabel="Update Client" />
        </form>
      </Modal>
    </div>
  );
}
