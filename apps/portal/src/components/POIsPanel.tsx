import React, { useState } from 'react';
import { IconSearch, IconPlus, IconMapPin } from '@tabler/icons-react';
import api from '../api/client';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface POI {
  id: string; name: string; category: string | null;
  latitude: number; longitude: number; radius: number;
  description: string | null;
}

const CATEGORIES = ['Fuel', 'Parking', 'Office', 'Warehouse', 'Workshop', 'Customer', 'Other'];

const inpSt: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

function POIIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>;
}

function DotMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 2, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: open ? '#dc2626' : '#9ca3af', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor"><circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6.5" r="1.5"/><circle cx="1.5" cy="11.5" r="1.5"/></svg>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.18)', minWidth: 120, overflow: 'hidden' }}>
          {[{ label: 'Edit', action: onEdit, red: false }, { label: 'Delete', action: onDelete, red: true }].map(it => (
            <button key={it.label} onClick={() => { it.action(); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', color: it.red ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── POI Form (inline) ─────────────────────────────────────────────────────────

function POIForm({ initial, drawActive, onToggleDraw, drawnPoint, onSave, onCancel }: {
  initial?: POI | null;
  drawActive: boolean;
  onToggleDraw: () => void;
  drawnPoint: { lat: number; lng: number } | null;
  onSave: (p: POI) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'Other');
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : '');
  const [radius, setRadius] = useState(initial?.radius != null ? String(initial.radius) : '100');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  React.useEffect(() => {
    if (drawnPoint) {
      setLat(drawnPoint.lat.toFixed(6));
      setLng(drawnPoint.lng.toFixed(6));
    }
  }, [drawnPoint]);

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius);
    if (isNaN(latN) || isNaN(lngN)) { setErr('Latitude and longitude are required'); return; }
    setSaving(true); setErr('');
    const payload = { name: name.trim(), category: category || null, latitude: latN, longitude: lngN, radius: radN || 100, description: description.trim() || null };
    try {
      let r: POI;
      if (initial?.id) { r = (await api.put<POI>(`/pois/${initial.id}`, payload)).data; }
      else { r = (await api.post<POI>('/pois', payload)).data; }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <POIIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit POI' : 'New POI'}</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={LBL}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Head Office" style={inpSt}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
        </div>

        <div>
          <label style={LBL}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding: '4px 9px', borderRadius: 5, border: `1.5px solid ${category === c ? '#dc2626' : '#e5e7eb'}`, background: category === c ? '#fff5f5' : '#fff', color: category === c ? '#dc2626' : '#555', fontSize: 11, cursor: 'pointer', fontWeight: category === c ? 600 : 400 }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ ...LBL, marginBottom: 0 }}>Location</label>
            <button type="button" onClick={onToggleDraw}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px solid ${drawActive ? '#dc2626' : '#e5e7eb'}`, background: drawActive ? '#fff5f5' : '#f5f5f5', color: drawActive ? '#dc2626' : '#555', fontSize: 11, cursor: 'pointer', fontWeight: drawActive ? 600 : 500 }}>
              <IconMapPin size={11} /> {drawActive ? 'Cancel' : 'Pick on Map'}
            </button>
          </div>
          {drawActive && (
            <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#dc2626' }}>
              Click on the map to place the POI
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={LBL}>Latitude</label>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="31.5204" style={inpSt}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={LBL}>Longitude</label>
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="74.3587" style={inpSt}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          </div>
          {lat && lng && (
            <div style={{ fontSize: 10.5, color: '#16a34a', marginTop: 4 }}>
              Location set: {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
            </div>
          )}
        </div>

        <div>
          <label style={LBL}>Radius (meters)</label>
          <input type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="100" style={inpSt}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
        </div>

        <div>
          <label style={LBL}>Description (optional)</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes…" style={inpSt}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
        </div>

        {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} disabled={saving}
          style={{ flex: 2, padding: '7px', borderRadius: 6, border: 'none', background: saving ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function POIsPanel({
  pois: initialPois, loading, selectedId, onSelect, onListChange,
  drawActive, onToggleDraw, drawnPoint,
}: {
  pois: POI[]; loading: boolean;
  selectedId: string | null; onSelect: (p: POI) => void;
  onListChange?: (p: POI[]) => void;
  drawActive?: boolean;
  onToggleDraw?: () => void;
  drawnPoint?: { lat: number; lng: number } | null;
}) {
  const { closePanel } = usePortalPanel();
  const [pois, setPois] = useState<POI[]>(initialPois);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<POI | null>(null);
  const [q, setQ] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  React.useEffect(() => { setPois(initialPois); }, [initialPois]);

  const update = (list: POI[]) => { setPois(list); onListChange?.(list); };
  const filtered = q.trim() ? pois.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : pois;

  const onSave = (p: POI) => {
    const next = editing?.id ? pois.map(x => x.id === p.id ? p : x) : [p, ...pois];
    update(next); setView('list'); setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/pois/${id}`); update(pois.filter(p => p.id !== id)); } catch {}
    setDeleting(null);
  };

  if (view === 'form') {
    return (
      <POIForm
        initial={editing}
        drawActive={drawActive ?? false}
        onToggleDraw={onToggleDraw ?? (() => {})}
        drawnPoint={drawnPoint ?? null}
        onSave={onSave}
        onCancel={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <POIIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Points of Interest <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{pois.length}</span>
        </span>
        <button onClick={() => { setEditing(null); setView('form'); }}
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
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : 'No POIs yet'}</div>
        ) : filtered.map(p => {
          const active = selectedId === p.id;
          return (
            <div key={p.id} onClick={() => onSelect(p)}
              style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer', background: active ? '#fff5f5' : 'transparent', borderLeft: `3px solid ${active ? '#dc2626' : '#6b7280'}`, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#dc2626' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  {p.category && <span style={{ fontSize: 9.5, color: '#888', background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>{p.category}</span>}
                  <span style={{ fontSize: 9.5, color: '#bbb' }}>{p.radius >= 1000 ? `${(p.radius / 1000).toFixed(1)}km` : `${p.radius}m`}</span>
                </div>
              </div>
              <DotMenu
                onEdit={() => { setEditing(p); setView('form'); }}
                onDelete={() => setDeleting(p.id)}
              />
            </div>
          );
        })}
      </div>

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 280, boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Delete POI</div>
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 20 }}>This POI will be permanently deleted.</div>
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
