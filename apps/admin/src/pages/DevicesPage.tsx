import { useEffect, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';

interface Device {
  id: string;
  displayId: number;
  imei: string;
  name: string | null;
  simNumber: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  vehicle?: { licensePlate: string | null; displayId: number } | null;
  createdAt: string;
}

const inp: React.CSSProperties = {
  height: 30,
  padding: '0 10px 0 30px',
  border: '1px solid #e8e8e8',
  borderRadius: 3,
  fontSize: 12,
  color: '#111',
  outline: 'none',
  background: '#fff',
  width: 200,
};

function lastSeenLabel(ts: string | null) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get<Device[]>('/devices')
      .then(r => setDevices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = devices.filter(d =>
    !q ||
    d.imei.includes(q) ||
    (d.name ?? '').toLowerCase().includes(q.toLowerCase()) ||
    (d.simNumber ?? '').includes(q)
  );

  return (
    <div>
      <PageHeader
        title="Devices"
        count={devices.length}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="IMEI or name…"
                style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
              />
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              <IconPlus size={13} />
              Add Device
            </button>
          </div>
        }
      />

      {loading ? <Spinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['ID', 'IMEI', 'Name', 'SIM', 'Vehicle', 'Last Seen', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
              const borderColor = !d.isActive ? '#aaa' : online ? '#22c55e' : '#dc2626';
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${borderColor}` }}>
                  <td style={{ padding: '10px 16px', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>#{d.displayId}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11 }}>{d.imei}</td>
                  <td style={{ padding: '10px 16px' }}>{d.name ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#555' }}>{d.simNumber ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#555' }}>
                    {d.vehicle ? `#${d.vehicle.displayId} ${d.vehicle.licensePlate ?? ''}`.trim() : <span style={{ color: '#ddd' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#aaa' }}>{lastSeenLabel(d.lastSeenAt)}</td>
                  <td style={{ padding: '10px 16px', color: !d.isActive ? '#aaa' : online ? '#16a34a' : '#dc2626' }}>
                    {!d.isActive ? 'Inactive' : online ? 'Online' : 'Offline'}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#ccc', fontSize: 12 }}>
                  No devices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
