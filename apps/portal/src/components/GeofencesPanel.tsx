import React, { useState } from 'react';
import { IconSearch, IconPlus, IconPencil, IconTrash, IconMapPin } from '@tabler/icons-react';
import api from '../api/client';
import { usePortalPanel } from '../contexts/PortalPanelContext';

export interface Geofence {
  id: string; name: string; type: 'circle' | 'polygon';
  latitude: number | null; longitude: number | null; radius: number | null;
  coordinates: [number, number][] | null;
  triggerOnEnter: boolean; triggerOnExit: boolean; color: string | null;
}

const PRESET_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#ea580c'];
const inpSt: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

function GeoIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
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

// ── Geofence Form (inline within panel) ──────────────────────────────────────

interface FormProps {
  initial?: Geofence | null;
  drawActive: boolean;
  onToggleDraw: () => void;
  drawnCircle: { lat: number; lng: number; radius: number } | null;
  drawnPolygon: [number, number][] | null;
  onSave: (g: Geofence) => void;
  onCancel: () => void;
}

function GfForm({ initial, drawActive, onToggleDraw, drawnCircle, drawnPolygon, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [gfType, setGfType] = useState<'circle' | 'polygon'>(initial?.type ?? 'circle');
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : '');
  const [radius, setRadius] = useState(initial?.radius != null ? String(initial.radius) : '500');
  const [onEnter, setOnEnter] = useState(initial?.triggerOnEnter ?? true);
  const [onExit, setOnExit] = useState(initial?.triggerOnExit ?? false);
  const [color, setColor] = useState(initial?.color ?? '#2563eb');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Apply drawn result when it arrives
  React.useEffect(() => {
    if (drawnCircle && gfType === 'circle') {
      setLat(drawnCircle.lat.toFixed(6));
      setLng(drawnCircle.lng.toFixed(6));
      setRadius(String(drawnCircle.radius));
    }
  }, [drawnCircle, gfType]);

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    let payload: Record<string, unknown>;
    if (gfType === 'circle') {
      const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius);
      if (isNaN(latN) || isNaN(lngN)) { setErr('Latitude and longitude are required'); return; }
      if (isNaN(radN) || radN <= 0) { setErr('Radius must be a positive number'); return; }
      payload = { name: name.trim(), type: 'circle', latitude: latN, longitude: lngN, radius: radN, triggerOnEnter: onEnter, triggerOnExit: onExit, color };
    } else {
      const coords = drawnPolygon ?? initial?.coordinates;
      if (!coords || coords.length < 3) { setErr('Draw a polygon on the map (at least 3 points)'); return; }
      payload = { name: name.trim(), type: 'polygon', coordinates: coords, triggerOnEnter: onEnter, triggerOnExit: onExit, color };
    }
    setSaving(true); setErr('');
    try {
      let r: Geofence;
      if (initial?.id) { r = (await api.put<Geofence>(`/geofences/${initial.id}`, payload)).data; }
      else { r = (await api.post<Geofence>('/geofences', payload)).data; }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  const circleSet = gfType === 'circle' && lat && lng;
  const polygonSet = gfType === 'polygon' && ((drawnPolygon && drawnPolygon.length >= 3) || (initial?.coordinates && initial.coordinates.length >= 3));

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <GeoIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit Geofence' : 'New Geofence'}</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={LBL}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lahore Office" style={inpSt}
            onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
        </div>

        <div>
          <label style={LBL}>Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['circle', 'polygon'] as const).map(t => (
              <button key={t} onClick={() => setGfType(t)}
                style={{ padding: '6px', borderRadius: 6, border: `1.5px solid ${gfType === t ? '#dc2626' : '#e5e7eb'}`, background: gfType === t ? '#fff5f5' : '#fff', color: gfType === t ? '#dc2626' : '#888', fontSize: 11.5, fontWeight: gfType === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {gfType === 'circle' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...LBL, marginBottom: 0 }}>Location &amp; Radius</label>
              <button type="button" onClick={onToggleDraw}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px solid ${drawActive ? '#dc2626' : '#e5e7eb'}`, background: drawActive ? '#fff5f5' : '#f5f5f5', color: drawActive ? '#dc2626' : '#555', fontSize: 11, cursor: 'pointer', fontWeight: drawActive ? 600 : 500 }}>
                <IconMapPin size={11} /> {drawActive ? 'Cancel Draw' : 'Pick on Map'}
              </button>
            </div>
            {drawActive && (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#dc2626' }}>
                Click on the map to place the geofence center, then adjust radius
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
            <div style={{ marginTop: 8 }}>
              <label style={LBL}>Radius (meters)</label>
              <input type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="500" style={inpSt}
                onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
            {circleSet && (
              <div style={{ fontSize: 10.5, color: '#16a34a', marginTop: 4 }}>Location set: {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</div>
            )}
          </div>
        )}

        {gfType === 'polygon' && (
          <div>
            <label style={LBL}>Polygon</label>
            <button type="button" onClick={onToggleDraw}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', borderRadius: 6, border: `1.5px solid ${drawActive ? '#dc2626' : '#e5e7eb'}`, background: drawActive ? '#fff5f5' : '#f5f5f5', color: drawActive ? '#dc2626' : '#555', fontSize: 12, cursor: 'pointer', fontWeight: drawActive ? 600 : 500, justifyContent: 'center' }}>
              <IconMapPin size={13} /> {drawActive ? 'Cancel Drawing (click to finish)' : 'Draw Polygon on Map'}
            </button>
            {drawActive && (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 11, color: '#dc2626' }}>
                Click on map to add points. Double-click or press Enter to finish.
              </div>
            )}
            {polygonSet && (
              <div style={{ fontSize: 10.5, color: '#16a34a', marginTop: 6 }}>
                Polygon set: {(drawnPolygon ?? initial?.coordinates)?.length} points
              </div>
            )}
          </div>
        )}

        <div>
          <label style={LBL}>Trigger Events</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['Enter', onEnter, setOnEnter] as const, ['Exit', onExit, setOnExit] as const]).map(([lbl, val, set]) => (
              <button key={lbl} onClick={() => set(!val)}
                style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1.5px solid ${val ? '#dc2626' : '#e5e7eb'}`, background: val ? '#fff5f5' : '#fff', color: val ? '#dc2626' : '#888', fontSize: 11.5, fontWeight: val ? 600 : 400, cursor: 'pointer' }}>
                On {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={LBL}>Color</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
            ))}
            <label style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 11 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: '#555' }}>{color}</span>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }} />
            </label>
          </div>
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

export default function GeofencesPanel({
  geofences: initialGf, loading, selectedId, onSelect, onListChange,
  drawActive, onToggleDraw, drawnCircle, drawnPolygon,
}: {
  geofences: Geofence[]; loading: boolean;
  selectedId: string | null; onSelect: (gf: Geofence) => void;
  onListChange?: (g: Geofence[]) => void;
  drawActive?: boolean;
  onToggleDraw?: () => void;
  drawnCircle?: { lat: number; lng: number; radius: number } | null;
  drawnPolygon?: [number, number][] | null;
}) {
  const { closePanel } = usePortalPanel();
  const [geofences, setGeofences] = useState<Geofence[]>(initialGf);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [q, setQ] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  React.useEffect(() => { setGeofences(initialGf); }, [initialGf]);

  const update = (list: Geofence[]) => { setGeofences(list); onListChange?.(list); };
  const filtered = q.trim() ? geofences.filter(g => g.name.toLowerCase().includes(q.toLowerCase())) : geofences;

  const onSave = (g: Geofence) => {
    const next = editing?.id ? geofences.map(x => x.id === g.id ? g : x) : [g, ...geofences];
    update(next); setView('list'); setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/geofences/${id}`); update(geofences.filter(g => g.id !== id)); } catch {}
    setDeleting(null);
  };

  if (view === 'form') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <GfForm
          initial={editing}
          drawActive={drawActive ?? false}
          onToggleDraw={onToggleDraw ?? (() => {})}
          drawnCircle={drawnCircle ?? null}
          drawnPolygon={drawnPolygon ?? null}
          onSave={onSave}
          onCancel={() => { setView('list'); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <GeoIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Geofences <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{geofences.length}</span>
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
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search geofences…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : 'No geofences yet'}</div>
        ) : filtered.map(gf => {
          const active = selectedId === gf.id;
          const borderC = active ? '#dc2626' : (gf.color ?? '#6b7280');
          return (
            <div key={gf.id} onClick={() => onSelect(gf)}
              style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer', background: active ? '#fff5f5' : 'transparent', borderLeft: `3px solid ${borderC}`, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#dc2626' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gf.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#888', background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>{gf.type}</span>
                  {gf.triggerOnEnter && <span style={{ fontSize: 9.5, color: '#16a34a', background: '#f0fdf4', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>Enter</span>}
                  {gf.triggerOnExit && <span style={{ fontSize: 9.5, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>Exit</span>}
                  {gf.type === 'circle' && gf.radius != null && <span style={{ fontSize: 9.5, color: '#888' }}>{gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)}km` : `${gf.radius}m`}</span>}
                  {gf.type === 'polygon' && gf.coordinates && <span style={{ fontSize: 9.5, color: '#888' }}>{gf.coordinates.length} pts</span>}
                </div>
              </div>
              <DotMenu
                onEdit={() => { setEditing(gf); setView('form'); }}
                onDelete={() => setDeleting(gf.id)}
              />
            </div>
          );
        })}
      </div>

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 280, boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Delete Geofence</div>
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 20 }}>This geofence will be permanently deleted.</div>
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
