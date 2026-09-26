import { useState } from 'react';
import { IconBell, IconSearch } from '@tabler/icons-react';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface AlertItem {
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

const SEV: Record<string, { bg: string; txt: string }> = {
  critical: { bg: '#fef2f2', txt: '#dc2626' },
  high:     { bg: '#fff7ed', txt: '#ea580c' },
  medium:   { bg: '#fefce8', txt: '#ca8a04' },
  low:      { bg: '#f0fdf4', txt: '#16a34a' },
  info:     { bg: '#eff6ff', txt: '#2563eb' },
};

export default function AlertsPanel({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  const { closePanel } = usePortalPanel();
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<'active' | 'all' | 'resolved'>('active');

  const filtered = alerts.filter(a => {
    const plate = a.vehicle?.licensePlate || `#${a.vehicle?.displayId ?? ''}`;
    const matchQ = !q.trim() || plate.toLowerCase().includes(q.toLowerCase()) || (a.type ?? '').toLowerCase().includes(q.toLowerCase());
    const matchS = statusF === 'all' || (statusF === 'active' ? !a.resolvedAt : !!a.resolvedAt);
    return matchQ && matchS;
  });

  const activeCount = alerts.filter(a => !a.resolvedAt).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <IconBell size={13} color="#dc2626" strokeWidth={2} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Alerts
          {activeCount > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, marginLeft: 5 }}>{activeCount}</span>}
        </span>
        <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['active', 'all', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusF(s)}
              style={{ flex: 1, padding: '3px 0', borderRadius: 5, border: `1px solid ${statusF === s ? '#dc2626' : '#e5e7eb'}`, background: statusF === s ? '#dc2626' : 'transparent', color: statusF === s ? '#fff' : '#555', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 6, padding: '4px 8px' }}>
          <IconSearch size={11} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>
            No {statusF !== 'all' ? statusF : ''} alerts
          </div>
        ) : filtered.map(a => {
          const sev = SEV[(a.severity ?? 'info').toLowerCase()] ?? SEV['info']!;
          const plate = a.vehicle?.licensePlate || (a.vehicle ? `#${a.vehicle.displayId}` : (a.deviceImei?.slice(-4) ?? '—'));
          return (
            <div key={a.id} style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', borderLeft: `3px solid ${sev.txt}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, background: sev.bg, color: sev.txt, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize', flexShrink: 0 }}>{a.severity || 'info'}</span>
                <span style={{ fontSize: 10.5, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(a.type ?? '').replace(/_/g, ' ')}</span>
                {!a.resolvedAt && <span style={{ fontSize: 8, color: '#dc2626', flexShrink: 0 }}>●</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 2 }}>{plate}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{fmt(a.createdAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
