import { useEffect, useState } from 'react';
import { IconCar, IconSearch } from '@tabler/icons-react';
import api from '../api/client';

interface Vehicle {
  id: string; displayId: number;
  make: string | null; model: string | null;
  licensePlate: string | null; year: number | null;
  color: string | null;
}

interface Device { id: string; imei: string; vehicleId: string | null; }

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

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

  const filtered = q.trim()
    ? vehicles.filter(v =>
        (v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase()) ||
        ([v.make, v.model].filter(Boolean).join(' ')).toLowerCase().includes(q.toLowerCase()) ||
        `${v.displayId}`.includes(q))
    : vehicles;

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
                {['#', 'Plate', 'Make / Model', 'Year', 'Color', 'Device (IMEI)'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const dev = devByVehicle.get(v.id);
                const name = [v.make, v.model].filter(Boolean).join(' ') || '—';
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
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: '#666' }}>{v.color ?? '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
                      {dev ? dev.imei : <span style={{ color: '#e5e7eb' }}>No device</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
