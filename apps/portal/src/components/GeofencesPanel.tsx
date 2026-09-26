import { useState } from 'react';
import { IconSearch, IconPlus, IconPencil, IconTrash, IconMapPin } from '@tabler/icons-react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
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

// ── Map Picker ─────────────────────────────────────────────────────────────────

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function GfMapPicker({ initLat, initLng, initRadius, color, onConfirm, onClose }: {
  initLat?: number | null; initLng?: number | null; initRadius?: number | null; color: string;
  onConfirm: (lat: number, lng: number, radius: number) => void; onClose: () => void;
}) {
  const [center, setCenter] = useState<[number, number] | null>(
    initLat != null && initLng != null ? [initLat, initLng] : null
  );
  const [radius, setRadius] = useState(initRadius ?? 500);

  const defaultCenter: [number, number] = center ?? [30.3753, 69.3451];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb', flexShrink: 0, zIndex: 1 }}>
        <GeoIcon />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111' }}>
          {center ? 'Click to move center · drag slider to adjust radius' : 'Click on the map to set the geofence center'}
        </span>
        <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555' }}>Cancel</button>
        <button onClick={() => center && onConfirm(center[0], center[1], radius)} disabled={!center}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: center ? '#dc2626' : '#9ca3af', color: '#fff', fontSize: 12, fontWeight: 600, cursor: center ? 'pointer' : 'not-allowed' }}>
          Confirm Location
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={defaultCenter} zoom={center ? 13 : 5} style={{ height: '100%', width: '100%', cursor: 'crosshair' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM contributors" />
          <MapClickHandler onPick={(lat, lng) => setCenter([lat, lng])} />
          {center && (
            <Circle center={center} radius={radius} color={color} fillColor={color} fillOpacity={0.15} weight={2} />
          )}
        </MapContainer>
      </div>
      <div style={{ background: '#fff', padding: '10px 16px', borderTop: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap', minWidth: 80 }}>
          Radius: <strong>{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</strong>
        </span>
        <input type="range" min={100} max={50000} step={100} value={radius} onChange={e => setRadius(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#dc2626' }} />
        {center && (
          <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
            {center[0].toFixed(5)}, {center[1].toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Form Modal ─────────────────────────────────────────────────────────────────

function GfFormModal({ initial, onSave, onClose }: { initial?: Geofence | null; onSave: (g: Geofence) => void; onClose: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : '');
  const [radius, setRadius] = useState(initial?.radius != null ? String(initial.radius) : '500');
  const [onEnter, setOnEnter] = useState(initial?.triggerOnEnter ?? true);
  const [onExit, setOnExit] = useState(initial?.triggerOnExit ?? false);
  const [color, setColor] = useState(initial?.color ?? '#2563eb');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius);
    if (isNaN(latN) || isNaN(lngN)) { setErr('Latitude and longitude are required'); return; }
    if (isNaN(radN) || radN <= 0) { setErr('Radius must be a positive number'); return; }
    setSaving(true); setErr('');
    const payload = { name: name.trim(), type: 'circle', latitude: latN, longitude: lngN, radius: radN, triggerOnEnter: onEnter, triggerOnExit: onExit, color };
    try {
      let r: Geofence;
      if (initial?.id) { r = (await api.put<Geofence>(`/geofences/${initial.id}`, payload)).data; }
      else { r = (await api.post<Geofence>('/geofences', payload)).data; }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  return (
    <>
    {mapPickerOpen && (
      <GfMapPicker
        initLat={lat ? parseFloat(lat) : null}
        initLng={lng ? parseFloat(lng) : null}
        initRadius={radius ? parseFloat(radius) : null}
        color={color}
        onConfirm={(pickedLat, pickedLng, pickedRadius) => {
          setLat(pickedLat.toFixed(6));
          setLng(pickedLng.toFixed(6));
          setRadius(String(pickedRadius));
          setMapPickerOpen(false);
        }}
        onClose={() => setMapPickerOpen(false)}
      />
    )}
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(400px, 97vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GeoIcon />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit Geofence' : 'New Geofence'}</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={LBL}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lahore Office" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...LBL, marginBottom: 0 }}>Location &amp; Radius</label>
              <button type="button" onClick={() => setMapPickerOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#f5f5f5', color: '#555', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; }}>
                <IconMapPin size={11} /> Pick on Map
              </button>
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
            <div style={{ marginTop: 8 }}>
              <label style={LBL}>Radius (meters)</label>
              <input type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="500" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          </div>

          <div>
            <label style={LBL}>Trigger Events</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['onEnter', onEnter, setOnEnter, 'On Enter'] as const, ['onExit', onExit, setOnExit, 'On Exit'] as const]).map(([, val, set, lbl]) => (
                <button key={lbl} onClick={() => set(!val)}
                  style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1.5px solid ${val ? '#dc2626' : '#e5e7eb'}`, background: val ? '#fff5f5' : '#fff', color: val ? '#dc2626' : '#888', fontSize: 11.5, fontWeight: val ? 600 : 400, cursor: 'pointer' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={LBL}>Color</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '2px solid #111' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
              ))}
            </div>
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
    </>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function GeofencesPanel({
  geofences: initialGf, loading, selectedId, onSelect, onListChange,
}: {
  geofences: Geofence[]; loading: boolean;
  selectedId: string | null; onSelect: (gf: Geofence) => void;
  onListChange?: (g: Geofence[]) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [geofences, setGeofences] = useState<Geofence[]>(initialGf);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const update = (list: Geofence[]) => { setGeofences(list); onListChange?.(list); };
  const filtered = q.trim() ? geofences.filter(g => g.name.toLowerCase().includes(q.toLowerCase())) : geofences;

  const onSave = (g: Geofence) => {
    const next = editing?.id ? geofences.map(x => x.id === g.id ? g : x) : [g, ...geofences];
    update(next); setFormOpen(false); setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/geofences/${id}`); update(geofences.filter(g => g.id !== id)); } catch {}
    setDeleting(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <GeoIcon />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Geofences <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>{geofences.length}</span>
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
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setEditing(gf); setFormOpen(true); }}
                style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb', borderRadius: 4, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}>
                <IconPencil size={12} />
              </button>
              <button onClick={e => { e.stopPropagation(); setDeleting(gf.id); }}
                style={{ padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb', borderRadius: 4, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}>
                <IconTrash size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {formOpen && <GfFormModal initial={editing} onSave={onSave} onClose={() => { setFormOpen(false); setEditing(null); }} />}

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
