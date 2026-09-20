import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconBuilding, IconUser, IconCar, IconCpu, IconMapPin, IconPhone, IconMail, IconLock, IconCalendar, IconEdit, IconEye, IconEyeOff, IconPlus, IconLink, IconPlugConnected, IconPlugConnectedX, IconBell } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useTheme } from '../contexts/ThemeContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import AlertsModal from '../components/AlertsModal';

interface Client {
  id: string; displayId: number; name: string; type: string;
  companyName: string | null; pocName: string | null;
  contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  vehicleCount: number; deviceCount: number;
}
interface Vehicle {
  id: string; displayId: number; licensePlate: string | null;
  make: string | null; model: string | null; year: number | null;
  isActive: boolean; organizationId: string | null;
}
interface Device {
  id: string; imei: string; status: string;
  lastImmobilizer: boolean | null;
  vehicle?: { id: string } | null;
}

const card: React.CSSProperties = { padding: 20, borderRadius: 12, background: 'var(--bg2)' };
const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; };
const blur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; };

const TypeBadge = ({ type }: { type: string }) => (
  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{type === 'b2b' ? 'B2B' : 'B2C'}</span>
);

const emptyVehicle = { licensePlate: '', make: '', model: '', year: '', isActive: true };
const emptyDevice = { imei: '', name: '', simNumber: '', isActive: true };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cities } = useCityFilter();
  const { dark } = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit client modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', companyName: '', contactNo: '', email: '', password: '', cityId: '', isActive: true, type: 'b2b' });
  const [showPw, setShowPw] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Alert modal
  const [alertImei, setAlertImei] = useState<string | null>(null);

  // Immobilize state per vehicleId
  const [immoBusy, setImmoBusy] = useState<string | null>(null);

  const handleImmobilize = async (vehicleId: string, action: 'immobilize' | 'activate') => {
    setImmoBusy(vehicleId);
    try {
      await api.post(`/vehicles/${vehicleId}/command`, { action });
      await load();
    } catch { } finally { setImmoBusy(null); }
  };

  // Add vehicle modal
  const [vModal, setVModal] = useState(false);
  const [vForm, setVForm] = useState(emptyVehicle);
  const [vSaving, setVSaving] = useState(false);

  // Assign device modal
  const [dModal, setDModal] = useState(false);
  const [dTargetVehicle, setDTargetVehicle] = useState<Vehicle | null>(null);
  const [dForm, setDForm] = useState(emptyDevice);
  const [dSaving, setDSaving] = useState(false);

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

  // Edit client
  const openEdit = () => {
    if (!client) return;
    setEditForm({ name: client.name, companyName: client.companyName ?? '', contactNo: client.contactNo ?? '', email: client.email ?? '', password: '', cityId: client.cityId ?? '', isActive: client.isActive, type: client.type });
    setShowPw(false); setEditOpen(true);
  };
  const handleEditSave = async (e: FormEvent) => {
    e.preventDefault(); setEditSaving(true);
    try {
      const payload: Record<string, unknown> = { name: editForm.name, companyName: editForm.type === 'b2b' ? (editForm.companyName || null) : null, contactNo: editForm.contactNo || null, email: editForm.email || null, cityId: editForm.cityId || null, isActive: editForm.isActive };
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`/organizations/${id}`, payload);
      setEditOpen(false); setLoading(true); await load();
    } catch { } finally { setEditSaving(false); }
  };
  const setE = (k: string, v: unknown) => setEditForm(f => ({ ...f, [k]: v }));

  // Add vehicle
  const openAddVehicle = () => { setVForm(emptyVehicle); setVModal(true); };
  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault(); setVSaving(true);
    try {
      await api.post('/vehicles', {
        licensePlate: vForm.licensePlate || null,
        make: vForm.make || null,
        model: vForm.model || null,
        year: vForm.year ? Number(vForm.year) : null,
        isActive: vForm.isActive,
        organizationId: client!.id,
        cityId: client!.cityId,
      });
      setVModal(false); setLoading(true); await load();
    } catch { } finally { setVSaving(false); }
  };
  const setV = (k: string, v: unknown) => setVForm(f => ({ ...f, [k]: v }));

  // Assign device
  const openAssignDevice = (vehicle: Vehicle) => { setDTargetVehicle(vehicle); setDForm(emptyDevice); setDModal(true); };
  const handleAssignDevice = async (e: FormEvent) => {
    e.preventDefault(); setDSaving(true);
    try {
      await api.post('/devices', {
        imei: dForm.imei,
        name: dForm.name || null,
        simNumber: dForm.simNumber || null,
        isActive: dForm.isActive,
        vehicleId: dTargetVehicle!.id,
        cityId: client!.cityId,
      });
      setDModal(false); setLoading(true); await load();
    } catch { } finally { setDSaving(false); }
  };
  const setD = (k: string, v: unknown) => setDForm(f => ({ ...f, [k]: v }));

  if (loading) return <Spinner style={{ height: '60vh' }} />;
  if (!client) return null;

  const cityName = cities.find(c => c.id === client.cityId)?.name ?? '—';
  const myVehicles = vehicles.filter(v => v.organizationId === client.id);
  const deviceMap = new Map(devices.filter(d => d.vehicle?.id).map(d => [d.vehicle!.id, d]));
  const isB2B = client.type === 'b2b';

  const detailRows = [
    ...(isB2B ? [{ icon: IconBuilding, label: 'Company', value: client.companyName ?? '—' }] : []),
    { icon: IconPhone, label: 'Contact', value: client.contactNo ?? '—' },
    { icon: IconMail, label: 'Email', value: client.email ?? '—' },
    { icon: IconMapPin, label: 'City', value: cityName },
    { icon: IconCalendar, label: 'Added', value: fmtDate(client.createdAt) },
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
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
            {isB2B ? <IconBuilding size={24} color="#dc2626" /> : <IconUser size={24} color="#dc2626" />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{client.name}</h1>
              <TypeBadge type={client.type} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              ID {client.displayId}{isB2B && client.companyName ? ` · ${client.companyName}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, borderLeft: `3px solid ${client.isActive ? '#22c55e' : '#e5e7eb'}`, color: client.isActive ? '#16a34a' : 'var(--muted)', background: 'var(--bg2)' }}>
            {client.isActive ? 'Active' : 'Inactive'}
          </span>
          <button onClick={openEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconEdit size={13} /> Edit Client
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: IconCar, label: 'Vehicles', value: myVehicles.length },
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

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detailRows.map(row => (
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{client.email ? 'Portal Login Enabled' : 'No Portal Access'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{client.email ?? 'No email configured.'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Fleet table */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Fleet — {myVehicles.length} vehicle{myVehicles.length !== 1 ? 's' : ''}
            </span>
            <button onClick={openAddVehicle}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}>
              <IconPlus size={12} /> Add Vehicle
            </button>
          </div>

          {myVehicles.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>
              No vehicles yet.{' '}
              <button onClick={openAddVehicle} style={{ color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Add one now</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'License Plate', 'Make / Model', 'Year', 'Device IMEI', 'Status', 'Engine', 'Alert', ''].map(h => (
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
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: dev ? 'var(--text)' : '#ccc' }}>{dev ? dev.imei : '—'}</td>
                      <td style={{ padding: '10px 14px', color: v.isActive ? '#16a34a' : 'var(--muted)', fontSize: 12 }}>{v.isActive ? 'Active' : 'Inactive'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {dev && (
                          <button
                            onClick={() => handleImmobilize(v.id, dev.lastImmobilizer ? 'activate' : 'immobilize')}
                            disabled={immoBusy === v.id}
                            title={dev.lastImmobilizer ? 'Engine cut — click to restore' : 'Click to cut engine'}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                              border: `1px solid ${dev.lastImmobilizer ? '#dc2626' : '#e5e7eb'}`,
                              background: dev.lastImmobilizer ? 'rgba(220,38,38,0.08)' : 'var(--bg)',
                              color: dev.lastImmobilizer ? '#dc2626' : '#16a34a',
                              opacity: immoBusy === v.id ? 0.5 : 1,
                              whiteSpace: 'nowrap',
                            }}>
                            {dev.lastImmobilizer
                              ? <><IconPlugConnectedX size={11} /> Cut</>
                              : <><IconPlugConnected size={11} /> Active</>}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {dev && (
                          <button onClick={() => setAlertImei(dev.imei)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}>
                            <IconBell size={11} /> Set Alert
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {!dev && (
                          <button onClick={() => openAssignDevice(v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}>
                            <IconLink size={11} /> Assign Device
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      <Modal open={editOpen} title="Edit Client" onClose={() => setEditOpen(false)}>
        <form onSubmit={handleEditSave}>
          <FormField label="Full Name *">
            <input required value={editForm.name} onChange={e => setE('name', e.target.value)} placeholder="Contact person name" style={inputStyle} onFocus={focus} onBlur={blur} />
          </FormField>
          {editForm.type === 'b2b' && (
            <FormField label="Company Name">
              <input value={editForm.companyName} onChange={e => setE('companyName', e.target.value)} placeholder="e.g. Acme Logistics" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Email">
              <input type="email" value={editForm.email} onChange={e => setE('email', e.target.value)} placeholder="client@example.com" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
            <FormField label="Contact No">
              <input value={editForm.contactNo} onChange={e => setE('contactNo', e.target.value)} placeholder="923001234567" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
          </div>
          <FormField label="New Password (leave blank to keep)">
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={editForm.password} onChange={e => setE('password', e.target.value)} placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 36, width: '100%', boxSizing: 'border-box' }} onFocus={focus} onBlur={blur} />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showPw ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="City">
              <select value={editForm.cityId} onChange={e => setE('cityId', e.target.value)} style={selectStyle} onFocus={focus} onBlur={blur}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={String(editForm.isActive)} onChange={e => setE('isActive', e.target.value === 'true')} style={selectStyle}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions onClose={() => setEditOpen(false)} loading={editSaving} submitLabel="Update Client" />
        </form>
      </Modal>

      {/* Add Vehicle Modal */}
      <Modal open={vModal} title="Add Vehicle" onClose={() => setVModal(false)}>
        <form onSubmit={handleAddVehicle}>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
            Client: <strong style={{ color: 'var(--text)' }}>{client.name}</strong>{isB2B && client.companyName ? ` · ${client.companyName}` : ''}
          </div>
          <FormField label="License Plate">
            <input value={vForm.licensePlate} onChange={e => setV('licensePlate', e.target.value)} placeholder="LEA-1234" style={inputStyle} onFocus={focus} onBlur={blur} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Make">
              <input value={vForm.make} onChange={e => setV('make', e.target.value)} placeholder="Toyota" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
            <FormField label="Model">
              <input value={vForm.model} onChange={e => setV('model', e.target.value)} placeholder="Corolla" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Year">
              <input type="number" value={vForm.year} onChange={e => setV('year', e.target.value)} placeholder="2022" min="1990" max="2030" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
            <FormField label="Status">
              <select value={String(vForm.isActive)} onChange={e => setV('isActive', e.target.value === 'true')} style={selectStyle}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions onClose={() => setVModal(false)} loading={vSaving} submitLabel="Add Vehicle" />
        </form>
      </Modal>

      {/* Assign Device Modal */}
      <Modal open={dModal} title="Assign Device" onClose={() => setDModal(false)}>
        <form onSubmit={handleAssignDevice}>
          {dTargetVehicle && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
              Vehicle: <strong style={{ color: 'var(--text)' }}>{dTargetVehicle.licensePlate ?? `#${dTargetVehicle.displayId}`}</strong>
              {[dTargetVehicle.make, dTargetVehicle.model].filter(Boolean).length > 0 && ` · ${[dTargetVehicle.make, dTargetVehicle.model].filter(Boolean).join(' ')}`}
            </div>
          )}
          <FormField label="IMEI *">
            <input required value={dForm.imei} onChange={e => setD('imei', e.target.value)} placeholder="15-digit IMEI" maxLength={20} style={inputStyle} onFocus={focus} onBlur={blur} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Device Name">
              <input value={dForm.name} onChange={e => setD('name', e.target.value)} placeholder="e.g. Tracker-01" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
            <FormField label="SIM Number">
              <input value={dForm.simNumber} onChange={e => setD('simNumber', e.target.value)} placeholder="923001234567" style={inputStyle} onFocus={focus} onBlur={blur} />
            </FormField>
          </div>
          <FormField label="Status">
            <select value={String(dForm.isActive)} onChange={e => setD('isActive', e.target.value === 'true')} style={selectStyle}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={() => setDModal(false)} loading={dSaving} submitLabel="Assign Device" />
        </form>
      </Modal>

      {/* Alert Modal */}
      {alertImei && (
        <AlertsModal
          open={true}
          onClose={() => setAlertImei(null)}
          dark={dark}
          vehicles={vehicles
            .filter(v => v.organizationId === client?.id)
            .map(v => {
              const d = devices.find(d => d.vehicle?.id === v.id);
              return d ? { imei: d.imei, plate: v.licensePlate ?? `Vehicle ${v.displayId}` } : null;
            })
            .filter(Boolean) as { imei: string; plate: string }[]}
          preSelectedImei={alertImei}
        />
      )}
    </div>
  );
}
