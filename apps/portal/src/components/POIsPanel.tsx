import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface POI {
  id: string; name: string; category: string | null;
  latitude: number; longitude: number; radius: number;
  description: string | null;
}

const CAT_COLOR: Record<string, string> = {
  fuel: '#f59e0b', parking: '#3b82f6', office: '#8b5cf6',
  warehouse: '#16a34a', workshop: '#ea580c', customer: '#06b6d4',
};

function POIIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>;
}

export default function POIsPanel({
  pois, loading, selectedId, onSelect,
}: {
  pois: POI[]; loading: boolean;
  selectedId: string | null; onSelect: (poi: POI) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [q, setQ] = useState('');

  const filtered = q.trim()
    ? pois.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.category ?? '').toLowerCase().includes(q.toLowerCase()))
    : pois;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <POIIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Points of Interest <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{pois.length}</span>
        </span>
        <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 6, padding: '4px 8px' }}>
          <IconSearch size={11} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search POIs…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : 'No points of interest'}</div>
        ) : filtered.map(poi => {
          const active = selectedId === poi.id;
          const catColor = poi.category ? (CAT_COLOR[poi.category.toLowerCase()] ?? '#6b7280') : '#6b7280';
          return (
            <div key={poi.id} onClick={() => onSelect(poi)}
              style={{ padding: '10px 12px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer', background: active ? '#fff5f5' : 'transparent', borderLeft: `3px solid ${active ? '#dc2626' : catColor}`, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: poi.description ? 3 : 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#dc2626' : '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>
                {poi.category && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: catColor, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize', flexShrink: 0 }}>{poi.category}</span>
                )}
              </div>
              {poi.description && (
                <div style={{ fontSize: 10.5, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{poi.description}</div>
              )}
              <div style={{ fontSize: 10, color: '#bbb' }}>{poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
