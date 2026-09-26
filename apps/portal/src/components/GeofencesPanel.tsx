import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface Geofence {
  id: string; name: string; type: 'circle' | 'polygon';
  latitude: number | null; longitude: number | null; radius: number | null;
  coordinates: [number, number][] | null;
  triggerOnEnter: boolean; triggerOnExit: boolean;
  color: string | null;
}

function GeoIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}

export default function GeofencesPanel({
  geofences, loading, selectedId, onSelect,
}: {
  geofences: Geofence[]; loading: boolean;
  selectedId: string | null; onSelect: (gf: Geofence) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [q, setQ] = useState('');

  const filtered = q.trim()
    ? geofences.filter(g => g.name.toLowerCase().includes(q.toLowerCase()))
    : geofences;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <GeoIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Geofences <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{geofences.length}</span>
        </span>
        <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 6, padding: '4px 8px' }}>
          <IconSearch size={11} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search geofences…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : 'No geofences'}</div>
        ) : filtered.map(gf => {
          const active = selectedId === gf.id;
          const borderC = active ? '#dc2626' : (gf.color ?? '#6b7280');
          return (
            <div key={gf.id} onClick={() => onSelect(gf)}
              style={{ padding: '10px 12px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer', background: active ? '#fff5f5' : 'transparent', borderLeft: `3px solid ${borderC}`, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#dc2626' : '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gf.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#888', background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>{gf.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {gf.triggerOnEnter && <span style={{ fontSize: 9.5, color: '#16a34a', background: '#f0fdf4', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>Enter</span>}
                {gf.triggerOnExit && <span style={{ fontSize: 9.5, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>Exit</span>}
                {gf.type === 'circle' && gf.radius != null && (
                  <span style={{ fontSize: 9.5, color: '#888' }}>{gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)}km` : `${gf.radius}m`}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
