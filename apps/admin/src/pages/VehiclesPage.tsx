import { useEffect, useState } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { DateRange } from 'react-day-picker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';

interface Vehicle {
  id: string;
  displayId: number;
  licensePlate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  isActive: boolean;
  createdAt: string;
}

const sel: React.CSSProperties = {
  height: 30, padding: '0 8px', border: '1px solid #e8e8e8',
  borderRadius: 3, fontSize: 12, color: '#555', background: '#fff', outline: 'none', cursor: 'pointer',
};
const inp: React.CSSProperties = {
  height: 30, padding: '0 10px 0 30px', border: '1px solid #e8e8e8',
  borderRadius: 3, fontSize: 12, color: '#111', outline: 'none', background: '#fff', width: 180,
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    api.get<Vehicle[]>('/vehicles').then(r => setVehicles(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = vehicles.filter(v => {
    if (q && !(v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase()) &&
      !(v.make ?? '').toLowerCase().includes(q.toLowerCase()) &&
      !(v.model ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(v.isActive) !== statusFilter) return false;
    if (dateRange?.from) {
      const d = parseISO(v.createdAt);
      if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Vehicles" count={vehicles.length} action={
        <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Vehicle
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Plate, make, model…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
            onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        {(q || statusFilter || dateRange) && (
          <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }}
            style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <Spinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['ID', 'Plate', 'Make / Model', 'Year', 'Status', 'Added', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${v.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '10px 16px', color: '#aaa' }}>#{v.displayId}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{v.licensePlate ?? '—'}</td>
                <td style={{ padding: '10px 16px', color: '#555' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                <td style={{ padding: '10px 16px', color: '#555' }}>{v.year ?? '—'}</td>
                <td style={{ padding: '10px 16px', color: v.isActive ? '#16a34a' : '#aaa' }}>{v.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px 16px', color: '#aaa' }}>{new Date(v.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
                      <IconEdit size={14} />
                    </button>
                    <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No vehicles found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
