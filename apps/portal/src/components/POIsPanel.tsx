import { useState } from 'react';
import { IconSearch, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import api from '../api/client';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface POI {
  id: string; name: string; category: string | null;
  latitude: number; longitude: number; radius: number;
  description: string | null;
}

const CATEGORIES = ['Fuel', 'Parking', 'Office', 'Warehouse', 'Workshop', 'Customer', 'Other'];
const CAT_COLOR: Record<string, string> = {
  fuel: '#f59e0b', parking: '#3b82f6', office: '#8b5cf6',
  warehouse: '#16a34a', workshop: '#ea580c', customer: '#06b6d4', other: '#6b7280',
};

const inpSt: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

function POIIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>;
}

// ── Form Modal ─────────────────────────────────────────────────────────────────

function POIFormModal({ initial, onSave, onClose }: { initial?: POI | null; onSave: (p: POI) => void; onClose: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'Other');
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : '');
  const [radius, setRadius] = useState(initial?.radius != null ? String(initial.radius) : '100');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius);
    if (isNaN(latN) || isNaN(lngN)) { setErr('Latitude and longitude are required'); return; }
    setSaving(true); setErr('');
    const payload = { name: name.trim(), category: category || null, latitude: latN, longitude: lngN, radius: isNaN(radN) ? 0 : radN, description: description.trim() || null };
    try {
      let r: POI;
      if (initial?.id) { r = (await api.put<POI>(`/pois/${initial.id}`, payload)).data; }
      else { r = (await api.post<POI>('/pois', payload)).data; }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(400px, 97vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <POIIcon />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit POI' : 'New POI'}</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={LBL}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Head Office" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>

          <div>
            <label style={LBL}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inpSt, cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={LBL}>Latitude</label>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="31.5204" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={LBL}>Longitude</label>
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="74.3587" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          </div>

          <div>
            <label style={LBL}>Radius (meters)</label>
            <input type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="100" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>

          <div>
            <label style={LBL}>Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>

          {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: saving ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function POIsPanel({
  pois: initialPois, loading, selectedId, onSelect, onListChange,
}: {
  pois: POI[]; loading: boolean;
  selectedId: string | null; onSelect: (poi: POI) => void;
  onListChange?: (p: POI[]) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [pois, setPois] = useState<POI[]>(initialPois);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<POI | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const update = (list: POI[]) => { setPois(list); onListChange?.(list); };
  const filtered = q.trim() ? pois.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.category ?? '').toLowerCase().includes(q.toLowerCase())) : pois;

  const onSave = (p: POI) => {
    const next = editing?.id ? pois.map(x => x.id === p.id ? p : x) : [p, ...pois];
    update(next); setFormOpen(false); setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/pois/${id}`); update(pois.filter(p => p.id !== id)); } catch {}
    setDeleting(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <POIIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Points of Interest <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{pois.length}</span>
        </span>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          <IconPlus size={10} strokeWidth={2.5} /> New
        </button>
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
              style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer', background: active ? '#fff5f5' : 'transparent', borderLeft: `3px solid ${active ? '#dc2626' : catColor}`, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#dc2626' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                  {poi.category && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: catColor, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize' }}>{poi.category}</span>}
                  {poi.description && <span style={{ fontSize: 10, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{poi.description}</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setEditing(poi); setFormOpen(true); }}
                style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb', borderRadius: 4, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}>
                <IconPencil size={12} />
              </button>
              <button onClick={e => { e.stopPropagation(); setDeleting(poi.id); }}
                style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb', borderRadius: 4, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}>
                <IconTrash size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {formOpen && <POIFormModal initial={editing} onSave={onSave} onClose={() => { setFormOpen(false); setEditing(null); }} />}

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 280, boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Delete POI</div>
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 20 }}>This point of interest will be permanently deleted.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleting(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmDelete(deleting)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
