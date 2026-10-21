import { useEffect, useRef, useState } from 'react';
import { IconCar, IconSearch, IconChevronRight, IconHistory, IconX, IconDotsVertical, IconGauge } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate, fmtDateTime } from '../lib/date';

interface Vehicle {
  id: string; displayId: number;
  make: string | null; model: string | null;
  licensePlate: string | null; year: number | null;
  color: string | null;
  name: string;
  createdAt: string;
  lifecycleStatus: 'active' | 'expired' | 'archived';
  expiresAt: string | null;
  odometerKm?: number;
}

interface Device { id: string; displayId: number; imei: string; simNumber: string | null; vehicleId: string | null; }
interface AssignmentHistory { id: string; deviceDisplayId: number; assignedAt: string; unassignedAt: string | null; action: string; reason: string | null; odometerKm: number | null; notes: string | null; simNumber: string | null; }
type VehicleFilter = 'all' | 'active' | 'expired' | 'archived';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [menuVehicleId, setMenuVehicleId] = useState<string | null>(null);
  const [odoVehicle, setOdoVehicle] = useState<Vehicle | null>(null);
  const [odoInput, setOdoInput] = useState('');
  const [odoSaving, setOdoSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Vehicle[]>('/vehicles'),
      api.get<Device[]>('/devices'),
    ]).then(([v, d]) => {
      setVehicles(v.data);
      setDevices(d.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const devByVehicle = new Map<string, Device>();
  for (const d of devices) if (d.vehicleId) devByVehicle.set(d.vehicleId, d);

  const isExpired = (vehicle: Vehicle) => vehicle.lifecycleStatus === 'expired'
    || (vehicle.lifecycleStatus === 'active' && !!vehicle.expiresAt && Date.parse(vehicle.expiresAt) <= Date.now());
  const query = q.trim().toLowerCase();
  const filtered = vehicles.filter(v => {
    const matchesFilter = vehicleFilter === 'all'
      || (vehicleFilter === 'active' && v.lifecycleStatus === 'active' && !isExpired(v))
      || (vehicleFilter === 'expired' && isExpired(v))
      || (vehicleFilter === 'archived' && v.lifecycleStatus === 'archived');
    const matchesSearch = !query
      || (v.licensePlate ?? '').toLowerCase().includes(query)
      || [v.make, v.model, v.name].filter(Boolean).join(' ').toLowerCase().includes(query)
      || String(v.displayId).includes(query);
    return matchesFilter && matchesSearch;
  });

  useEffect(() => {
    if (!selectedVehicle) return;
    setHistoryLoading(true);
    api.get<AssignmentHistory[]>(`/devices/vehicle/${selectedVehicle.id}/assignment-history`)
      .then(response => setAssignmentHistory(response.data))
      .catch(() => setAssignmentHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (!menuVehicleId) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuVehicleId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuVehicleId]);

  const openOdoModal = (v: Vehicle) => { setMenuVehicleId(null); setOdoVehicle(v); setOdoInput(String(v.odometerKm ?? 0)); };
  const saveOdo = async () => {
    if (!odoVehicle) return;
    const km = parseFloat(odoInput);
    if (!Number.isFinite(km) || km < 0) return;
    setOdoSaving(true);
    try {
      await api.patch(`/vehicles/${odoVehicle.id}/odometer`, { odometerKm: km });
      setVehicles(rows => rows.map(v => v.id === odoVehicle.id ? { ...v, odometerKm: km } : v));
      setOdoVehicle(null);
    } catch { /* ignore */ } finally { setOdoSaving(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <IconCar size={18} color="#dc2626" strokeWidth={1.75} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Vehicles</span>
        {!loading && <span style={{ fontSize: 12, color: '#bbb', fontWeight: 400, marginLeft: 2 }}>{vehicles.length}</span>}
        <div style={{ flex: 1 }} />
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f5f5f5', borderRadius: 7, padding: '6px 11px' }}>
          <IconSearch size={12} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search vehicles…"
            style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: '#111', outline: 'none', width: 180 }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex', lineHeight: 1 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>}
        </div>
      </div>

      <div role="tablist" aria-label="Vehicle status" style={{ display: 'flex', alignItems: 'stretch', gap: 18, padding: '0 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        {(['all', 'active', 'expired', 'archived'] as VehicleFilter[]).map(filter => {
          const count = filter === 'all' ? vehicles.length : filter === 'expired'
            ? vehicles.filter(isExpired).length : filter === 'archived'
            ? vehicles.filter(vehicle => vehicle.lifecycleStatus === 'archived').length
            : vehicles.filter(vehicle => vehicle.lifecycleStatus === 'active' && !isExpired(vehicle)).length;
          const active = vehicleFilter === filter;
          const label = filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'expired' ? 'Expired' : 'Archived';
          return <button key={filter} role="tab" aria-selected={active} onClick={() => setVehicleFilter(filter)} style={{ padding: '10px 1px 9px', border: 0, borderBottom: `2px solid ${active ? '#dc2626' : 'transparent'}`, marginBottom: -1, background: 'transparent', color: active ? '#dc2626' : '#6b7280', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer' }}>{label} <span style={{ color: active ? '#dc2626' : '#9ca3af', fontWeight: 500 }}>{count}</span></button>;
        })}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#bbb' }}>Loading vehicles…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <IconCar size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: '#bbb' }}>{q ? 'No results found' : 'No vehicles in your fleet'}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                {['#', 'Plate', 'Make / Model', 'Year', 'Odometer', 'Status', 'Tracker', ''].map(h => (
                  <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const dev = devByVehicle.get(v.id);
                const name = [v.make, v.model].filter(Boolean).join(' ') || '—';
                const expired = isExpired(v);
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f7f7f7' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#aaa' }}>{i + 1}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#111' }}>
                      {v.licensePlate || <span style={{ color: '#bbb' }}>#{v.displayId}</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: '#444' }}>{name}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: '#666' }}>{v.year ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
                      {v.odometerKm != null ? `${Number(v.odometerKm).toLocaleString(undefined, { maximumFractionDigits: 0 })} km` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: expired ? '#dc2626' : v.lifecycleStatus === 'archived' ? '#9ca3af' : '#16a34a' }}>
                      {expired ? 'Expired' : v.lifecycleStatus === 'archived' ? 'Archived' : 'Active'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: dev ? '#16a34a' : '#9ca3af' }}>
                      {dev ? 'Assigned' : 'No device'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => setSelectedVehicle(v)} title="View history" style={{ border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}><IconHistory size={15} /> Details <IconChevronRight size={14} /></button>
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setMenuVehicleId(menuVehicleId === v.id ? null : v.id)} title="More actions" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}>
                            <IconDotsVertical size={15} />
                          </button>
                          {menuVehicleId === v.id && (
                            <div ref={menuRef} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', minWidth: 160, padding: 4 }}>
                              <button onClick={() => openOdoModal(v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#111', borderRadius: 5, textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <IconGauge size={14} color="#2563eb" /> Set Odometer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {selectedVehicle && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: 'min(880px, 96vw)', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <IconCar size={19} color="#dc2626" /><div style={{ marginLeft: 10, flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{selectedVehicle.licensePlate || `Vehicle ${selectedVehicle.displayId}`}</div><div style={{ marginTop: 3, fontSize: 12, color: '#6b7280' }}>{[selectedVehicle.make, selectedVehicle.model, selectedVehicle.year].filter(Boolean).join(' ') || selectedVehicle.name}</div></div>
            <button onClick={() => setSelectedVehicle(null)} aria-label="Close details" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><IconX size={18} /></button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {[['Lifecycle', isExpired(selectedVehicle) ? 'Expired' : selectedVehicle.lifecycleStatus === 'archived' ? 'Archived' : 'Active'], ['Added', fmtDate(selectedVehicle.createdAt)], ['Tracking expires', selectedVehicle.expiresAt ? fmtDate(selectedVehicle.expiresAt) : 'No expiry'], ['Tracker', devByVehicle.has(selectedVehicle.id) ? `Device ${devByVehicle.get(selectedVehicle.id)?.displayId}` : 'No device assigned'], ['SIM', (() => { const sim = devByVehicle.get(selectedVehicle.id)?.simNumber; return sim ? `••••${sim.slice(-4)}` : '—'; })()]].map(([label, value]) => <div key={label} style={{ padding: 12, borderLeft: '2px solid #dc2626', background: '#fafafa' }}><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{value}</div></div>)}
            </div>
            <div style={{ marginTop: 24, fontSize: 13, fontWeight: 700, color: '#111' }}>Device assignment history</div>
            {historyLoading ? <div style={{ padding: 22, color: '#9ca3af', fontSize: 12 }}>Loading assignment history…</div> : assignmentHistory.length ? <div style={{ marginTop: 8, borderTop: '1px solid #e5e7eb' }}>
              {assignmentHistory.map(row => <div key={row.id} style={{ padding: '12px 4px', display: 'grid', gridTemplateColumns: 'minmax(115px, .7fr) minmax(180px, 1.2fr) minmax(120px, .8fr)', gap: 12, borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                <div><strong style={{ color: '#111' }}>Device {row.deviceDisplayId}</strong><div style={{ marginTop: 4, color: '#6b7280' }}>{row.action === 'legacy' ? 'Existing assignment' : row.action}</div></div>
                <div style={{ color: '#4b5563' }}>{fmtDateTime(row.assignedAt)}<div style={{ marginTop: 4, color: '#9ca3af' }}>To {row.unassignedAt ? fmtDateTime(row.unassignedAt) : 'Current'}</div></div>
                <div style={{ color: '#6b7280' }}>{row.reason || row.notes || 'No service notes'}{row.odometerKm != null ? <div style={{ marginTop: 4 }}>Odometer {Number(row.odometerKm).toLocaleString()} km</div> : null}</div>
              </div>)}
            </div> : <div style={{ padding: 16, color: '#9ca3af', fontSize: 12 }}>No tracker assignment records available.</div>}
            <div style={{ marginTop: 14, color: '#9ca3af', fontSize: 11 }}>Tracker identifiers are kept private in the client portal.</div>
          </div>
        </div>
      </div>}

      {odoVehicle && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(360px, 96vw)', background: '#fff', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,.2)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <IconGauge size={18} color="#2563eb" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Set Odometer</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{odoVehicle.licensePlate || `#${odoVehicle.displayId}`} · {[odoVehicle.make, odoVehicle.model].filter(Boolean).join(' ') || odoVehicle.name}</div>
              </div>
              <button onClick={() => setOdoVehicle(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><IconX size={16} /></button>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Enter current odometer reading in km. The vehicle will continue accumulating distance from this value.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input autoFocus type="number" min="0" step="1" value={odoInput} onChange={e => setOdoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveOdo(); if (e.key === 'Escape') setOdoVehicle(null); }}
                style={{ flex: 1, height: 38, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, outline: 'none' }} />
              <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>km</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setOdoVehicle(null)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={() => void saveOdo()} disabled={odoSaving} style={{ padding: '8px 20px', border: 0, background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, cursor: 'pointer', opacity: odoSaving ? 0.65 : 1 }}>{odoSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
