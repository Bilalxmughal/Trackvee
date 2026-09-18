import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconUser, IconMail, IconMapPin, IconCalendar, IconEdit, IconCar, IconCpu } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Customer {
  id: string; displayId: number; email: string;
  firstName: string | null; lastName: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  organizationId: string | null;
}

interface Vehicle {
  id: string; displayId: number; licensePlate: string | null;
  make: string | null; model: string | null; year: number | null;
  isActive: boolean; organizationId: string | null;
}

interface Org { id: string; name: string; }

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cities } = useCityFilter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', cityId: '', isActive: true, organizationId: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [cu, vs, os] = await Promise.all([
        api.get<Customer>(`/users/${id}`),
        api.get<Vehicle[]>('/vehicles'),
        api.get<Org[]>('/organizations'),
      ]);
      setCustomer(cu.data);
      setVehicles(vs.data);
      setOrgs(os.data);
    } catch {
      navigate('/customers', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    if (!customer) return;
    setForm({ firstName: customer.firstName ?? '', lastName: customer.lastName ?? '', email: customer.email, password: '', cityId: customer.cityId ?? '', isActive: customer.isActive, organizationId: customer.organizationId ?? '' });
    setEditOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, organizationId: form.organizationId || null, cityId: form.cityId || null };
      if (!payload.password) delete payload.password;
      await api.patch(`/users/${id}`, payload);
      setEditOpen(false);
      setLoading(true);
      await load();
    } catch { } finally { setSaving(false); }
  };

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <Spinner style={{ height: '60vh' }} />;
  if (!customer) return null;

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—';
  const cityName = cities.find(c => c.id === customer.cityId)?.name ?? '—';
  const orgName = orgs.find(o => o.id === customer.organizationId)?.name ?? '—';
  const myVehicles = vehicles.filter(v => v.organizationId === customer.organizationId && customer.organizationId);

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Back */}
      <button onClick={() => navigate('/customers')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '4px 0', marginBottom: 20 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
        <IconArrowLeft size={15} /> Back to Customers
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconUser size={24} color="#dc2626" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fullName}</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>ID {customer.displayId} · {customer.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
            borderLeft: `3px solid ${customer.isActive ? '#22c55e' : '#e5e7eb'}`,
            color: customer.isActive ? '#16a34a' : 'var(--muted)',
            background: 'var(--bg2)' }}>
            {customer.isActive ? 'Active' : 'Inactive'}
          </span>
          <button onClick={openEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconEdit size={13} /> Edit Customer
          </button>
        </div>
      </div>

      {/* Info + Fleet grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: info cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: IconMail, label: 'Email', value: customer.email },
                { icon: IconMapPin, label: 'City', value: cityName },
                { icon: IconCar, label: 'Client', value: orgName },
                { icon: IconCalendar, label: 'Joined', value: fmtDate(customer.createdAt) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)' }}>
                  <row.icon size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{row.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { icon: IconCar, label: 'Vehicles', value: myVehicles.length },
              { icon: IconCpu, label: 'Active', value: myVehicles.filter(v => v.isActive).length },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={16} color="#dc2626" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: vehicles table */}
        <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Fleet — {myVehicles.length} vehicle{myVehicles.length !== 1 ? 's' : ''}
          </div>
          {myVehicles.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#ccc', fontSize: 13 }}>
              {customer.organizationId ? 'No vehicles in this client.' : 'Customer not linked to any client.'}
            </div>
          ) : (
            <div className="tbl-wrap" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['ID', 'License Plate', 'Make / Model', 'Year', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myVehicles.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${v.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{v.displayId}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, fontSize: 13 }}>{v.licensePlate ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)', fontSize: 12 }}>
                        {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)', fontSize: 12 }}>{v.year ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: v.isActive ? '#16a34a' : 'var(--muted)', fontSize: 12 }}>{v.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} title="Edit Customer" onClose={() => setEditOpen(false)}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="First Name">
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Ali" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="Last Name">
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Hassan" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <FormField label="Email *">
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <FormField label="New Password (leave blank to keep)">
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Client (Organization)">
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
          <FormField label="Status">
            <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={() => setEditOpen(false)} loading={saving} submitLabel="Update Customer" />
        </form>
      </Modal>
    </div>
  );
}
