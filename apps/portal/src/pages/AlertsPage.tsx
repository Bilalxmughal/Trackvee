import { useState, useEffect } from 'react';
import { IconBell, IconSearch } from '@tabler/icons-react';
import api from '../api/client';

interface Alert {
  id: string; type: string; message: string; severity: string;
  deviceImei: string; createdAt: string; resolvedAt: string | null;
  vehicle?: { licensePlate: string | null; displayId: number } | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(ts: string) {
  const d = new Date(ts);
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`;
}

const SEV_COLOR: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#fef2f2', text: '#dc2626' },
  high:     { bg: '#fff7ed', text: '#ea580c' },
  medium:   { bg: '#fefce8', text: '#ca8a04' },
  low:      { bg: '#f0fdf4', text: '#16a34a' },
  info:     { bg: '#eff6ff', text: '#2563eb' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');

  useEffect(() => {
    api.get<Alert[]>('/alerts').then(r => setAlerts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = alerts.filter(a => {
    const plate = a.vehicle?.licensePlate || `#${a.vehicle?.displayId ?? ''}`;
    const matchQ = !q.trim() || plate.toLowerCase().includes(q.toLowerCase()) || a.type.toLowerCase().includes(q.toLowerCase()) || a.message.toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !a.resolvedAt : !!a.resolvedAt);
    return matchQ && matchStatus;
  });

  const activeCount = alerts.filter(a => !a.resolvedAt).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <IconBell size={18} color="#dc2626" strokeWidth={1.75} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Alerts</span>
        {activeCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, background: '#dc2626', color: '#fff', padding: '2px 7px', borderRadius: 8 }}>{activeCount} active</span>
        )}
        <div style={{ flex: 1 }} />
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 11px', borderRadius: 5, border: `1px solid ${statusFilter === s ? '#dc2626' : '#e5e7eb'}`, background: statusFilter === s ? '#dc2626' : '#fff', color: statusFilter === s ? '#fff' : '#555', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f5f5f5', borderRadius: 7, padding: '5px 10px' }}>
          <IconSearch size={12} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search alerts…"
            style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: '#111', outline: 'none', width: 160 }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex', lineHeight: 1 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#bbb' }}>Loading alerts…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <IconBell size={40} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: '#bbb' }}>{q || statusFilter !== 'all' ? 'No matching alerts' : 'No alerts in your account'}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                {['Severity', 'Type', 'Message', 'Vehicle', 'Time', 'Status'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const sev = SEV_COLOR[a.severity?.toLowerCase()] ?? SEV_COLOR['info']!;
                const plate = a.vehicle?.licensePlate || (a.vehicle ? `#${a.vehicle.displayId}` : a.deviceImei.slice(-4));
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f7f7f7' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, background: sev.bg, color: sev.text, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{a.severity || 'info'}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: '#444', whiteSpace: 'nowrap' }}>{a.type?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#666', maxWidth: 300 }}>{a.message || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>{plate}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11.5, color: '#888', whiteSpace: 'nowrap' }}>{fmt(a.createdAt)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {a.resolvedAt
                        ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Resolved</span>
                        : <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Active</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ padding: '7px 20px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#bbb' }}>{filtered.length} alerts</span>
        </div>
      )}
    </div>
  );
}
