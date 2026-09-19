import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CircleCoords { center: [number, number]; radius: number; }
export interface PolygonCoords { points: [number, number][]; }

export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: CircleCoords | PolygonCoords;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '© OpenStreetMap';
const GF_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];
const DEFAULT_CENTER: L.LatLngTuple = [30.3753, 69.3451];

function gfColor(i: number) { return GF_COLORS[i % GF_COLORS.length]; }

function fmtCoord(n: number) { return n.toFixed(5); }

// ── Embedded Map ─────────────────────────────────────────────────────────────

interface MapProps {
  geofences: Geofence[];
  editingId: string | null;
  formType: 'circle' | 'polygon';
  formCenter: [number, number] | null;
  formRadius: number;
  formPolygon: [number, number][];
  dark: boolean;
  onMapClick: (lat: number, lng: number) => void;
  drawActive: boolean;
}

function GeofenceMap({ geofences, editingId, formType, formCenter, formRadius, formPolygon, dark, onMapClick, drawActive }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    map.setView(DEFAULT_CENTER, 6);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    map.on('click', (e: L.LeafletMouseEvent) => onClickRef.current(e.latlng.lat, e.latlng.lng));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Cursor style when drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const el = map.getContainer();
    el.style.cursor = drawActive ? 'crosshair' : '';
  }, [drawActive]);

  // Redraw layers whenever state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];

    // All saved geofences (faded)
    geofences.forEach((gf, i) => {
      const color = gfColor(i);
      const isActive = gf.id === editingId;
      const opts = { color, fillOpacity: isActive ? 0 : 0.15, opacity: isActive ? 0 : 0.75, weight: 2 };
      let layer: L.Layer;
      if (gf.type === 'circle') {
        const c = gf.coordinates as CircleCoords;
        layer = L.circle([c.center[0], c.center[1]], { ...opts, radius: c.radius }).bindTooltip(gf.name, { permanent: false });
      } else {
        const p = gf.coordinates as PolygonCoords;
        layer = L.polygon(p.points as L.LatLngTuple[], opts).bindTooltip(gf.name, { permanent: false });
      }
      layer.addTo(map);
      layersRef.current.push(layer);
    });

    // Live preview of current drawing
    if (formType === 'circle' && formCenter) {
      const c = L.circle(formCenter as L.LatLngTuple, { radius: formRadius || 500, color: '#dc2626', weight: 2, dashArray: '7 5', fillOpacity: 0.18 });
      const dot = L.circleMarker(formCenter as L.LatLngTuple, { radius: 6, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1, weight: 2 });
      c.addTo(map); dot.addTo(map);
      layersRef.current.push(c, dot);
    }

    if (formType === 'polygon' && formPolygon.length > 0) {
      formPolygon.forEach((pt, i) => {
        const m = L.circleMarker(pt as L.LatLngTuple, { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1, weight: 2 });
        m.bindTooltip(`${i + 1}`, { permanent: true, className: 'gf-pt-label', direction: 'top', offset: [0, -6] });
        m.addTo(map);
        layersRef.current.push(m);
      });
      if (formPolygon.length >= 2) {
        const line = L.polyline(formPolygon as L.LatLngTuple[], { color: '#dc2626', weight: 2, dashArray: '6 4' });
        line.addTo(map);
        layersRef.current.push(line);
      }
      if (formPolygon.length >= 3) {
        const poly = L.polygon(formPolygon as L.LatLngTuple[], { color: '#dc2626', weight: 2, dashArray: '6 4', fillOpacity: 0.15 });
        poly.addTo(map);
        layersRef.current.push(poly);
      }
    }
  }, [geofences, editingId, formType, formCenter, formRadius, formPolygon]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>
      {drawActive && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 900, background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '6px 14px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {formType === 'circle' ? (formCenter ? 'Center set — adjust radius on the left' : 'Click on map to set center') : `Click to add points (${formPolygon.length} added)`}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 };

function TypeBtn({ label, icon, selected, onClick, dark }: { label: string; icon: React.ReactNode; selected: boolean; onClick: () => void; dark: boolean }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 12px', border: `2px solid ${selected ? '#dc2626' : (dark ? '#2a2a2a' : '#e5e7eb')}`, borderRadius: 7, background: selected ? '#fef2f2' : 'transparent', color: selected ? '#dc2626' : (dark ? '#888' : '#666'), fontSize: 13, fontWeight: selected ? 700 : 500, cursor: 'pointer', transition: 'all .15s' }}>
      {icon} {label}
    </button>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

interface ListViewProps {
  geofences: Geofence[];
  loading: boolean;
  q: string;
  setQ: (v: string) => void;
  onNew: () => void;
  onEdit: (gf: Geofence) => void;
  onDelete: (id: string) => void;
  dark: boolean;
}

function ListView({ geofences, loading, q, setQ, onNew, onEdit, onDelete, dark }: ListViewProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const border = `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`;
  const filtered = geofences.filter(g => !q || g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: '14px 18px', borderBottom: border, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: dark ? '#111' : '#f5f5f5', border, borderRadius: 6, padding: '6px 10px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search geofences…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none', flex: 1 }}/>
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🗺</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', marginBottom: 4 }}>No geofences yet</div>
            <div style={{ fontSize: 11.5, color: dark ? '#555' : '#9ca3af' }}>Click "New" to draw your first zone</div>
          </div>
        )}
        {filtered.map((gf, i) => (
          <div key={gf.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
            {/* Color dot */}
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: gfColor(geofences.indexOf(gf)), flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gf.name}</div>
              <div style={{ fontSize: 11, color: dark ? '#555' : '#9ca3af', marginTop: 1 }}>
                {gf.type === 'circle'
                  ? `Circle · ${((gf.coordinates as CircleCoords).radius / 1000).toFixed(2)} km radius`
                  : `Polygon · ${(gf.coordinates as PolygonCoords).points.length} points`}
              </div>
            </div>
            {/* Type badge */}
            <span style={{ fontSize: 10, fontWeight: 700, color: gfColor(geofences.indexOf(gf)), background: `${gfColor(geofences.indexOf(gf))}18`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
              {gf.type === 'circle' ? 'CIRCLE' : 'POLYGON'}
            </span>
            {/* 3-dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === gf.id ? null : gf.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', display: 'flex', padding: '3px 5px', borderRadius: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              {openMenu === gf.id && (
                <div onClick={() => setOpenMenu(null)} style={{ position: 'absolute', right: 0, top: 28, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 7, boxShadow: '0 6px 20px rgba(0,0,0,0.2)', minWidth: 120, zIndex: 999, overflow: 'hidden' }}>
                  {[
                    { label: 'Edit', action: () => onEdit(gf), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg> },
                    { label: 'Delete', action: () => onDelete(gf.id), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: item.label === 'Delete' ? '#dc2626' : (dark ? '#e5e5e5' : '#111'), textAlign: 'left' }}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer count */}
      <div style={{ padding: '10px 18px', borderTop: border, flexShrink: 0, fontSize: 11.5, color: dark ? '#555' : '#9ca3af' }}>
        {geofences.length} geofence{geofences.length !== 1 ? 's' : ''} total
      </div>
    </>
  );
}

// ── Form View ─────────────────────────────────────────────────────────────────

interface FormViewProps {
  editing: Geofence | null;
  formName: string; setFormName: (v: string) => void;
  formType: 'circle' | 'polygon'; setFormType: (v: 'circle' | 'polygon') => void;
  formCenter: [number, number] | null;
  formRadius: number; setFormRadius: (v: number) => void;
  formPolygon: [number, number][];
  setFormPolygon: React.Dispatch<React.SetStateAction<[number, number][]>>;
  drawActive: boolean; setDrawActive: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
  dark: boolean;
}

function FormView({ editing, formName, setFormName, formType, setFormType, formCenter, formRadius, setFormRadius, formPolygon, setFormPolygon, drawActive, setDrawActive, saving, onSave, onBack, dark }: FormViewProps) {
  const border = `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`;
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border, borderRadius: 7, background: dark ? '#111' : '#fff', color: dark ? '#e5e5e5' : '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  const canSave = formName.trim() && (
    (formType === 'circle' && formCenter !== null) ||
    (formType === 'polygon' && formPolygon.length >= 3)
  );

  const removePoint = (i: number) => setFormPolygon(p => p.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: border, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#555', display: 'flex', padding: 4, borderRadius: 5 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{editing ? 'Edit Geofence' : 'New Geofence'}</span>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          <span style={lbl}>Geofence Name</span>
          <input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Lahore Distribution Zone" style={inp}/>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 18 }}>
          <span style={lbl}>Shape Type</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <TypeBtn label="Circle" selected={formType === 'circle'} dark={dark} onClick={() => { setFormType('circle'); setDrawActive(false); }}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>}/>
            <TypeBtn label="Polygon" selected={formType === 'polygon'} dark={dark} onClick={() => { setFormType('polygon'); setDrawActive(false); }}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 22 20 2 20"/></svg>}/>
          </div>
        </div>

        {/* Circle config */}
        {formType === 'circle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Center point */}
            <div>
              <span style={lbl}>Center Point</span>
              {formCenter
                ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border, borderRadius: 7, background: dark ? '#111' : '#f9fafb' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="1"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="3" y1="12" x2="1" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
                    <span style={{ flex: 1, fontSize: 12, color: dark ? '#e5e5e5' : '#111', fontFamily: 'monospace' }}>{fmtCoord(formCenter[0])}, {fmtCoord(formCenter[1])}</span>
                    <button onClick={() => setDrawActive(true)} style={{ fontSize: 11, padding: '3px 8px', border, borderRadius: 5, background: 'transparent', color: dark ? '#aaa' : '#555', cursor: 'pointer' }}>Move</button>
                  </div>
                )
                : (
                  <button onClick={() => setDrawActive(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', border: `2px dashed ${drawActive ? '#dc2626' : (dark ? '#333' : '#d1d5db')}`, borderRadius: 7, background: drawActive ? '#fef2f2' : 'transparent', color: drawActive ? '#dc2626' : (dark ? '#666' : '#9ca3af'), fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="1"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="3" y1="12" x2="1" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
                    {drawActive ? 'Click map to set center…' : 'Click here then click map'}
                  </button>
                )}
            </div>

            {/* Radius */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>Radius</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  {formRadius >= 1000 ? `${(formRadius / 1000).toFixed(2)} km` : `${formRadius} m`}
                </span>
              </div>
              <input type="range" min={100} max={50000} step={100} value={formRadius} onChange={e => setFormRadius(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#dc2626' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: dark ? '#555' : '#aaa', marginTop: 2 }}>
                <span>100 m</span><span>50 km</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: dark ? '#888' : '#555' }}>Exact (m):</span>
                <input type="number" min={100} max={100000} value={formRadius} onChange={e => setFormRadius(Math.max(100, Number(e.target.value)))}
                  style={{ ...inp, width: 100, padding: '5px 8px', fontSize: 12 }}/>
              </div>
            </div>
          </div>
        )}

        {/* Polygon config */}
        {formType === 'polygon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>Points <span style={{ color: formPolygon.length < 3 ? '#dc2626' : '#16a34a' }}>({formPolygon.length}/3+ required)</span></span>
                {formPolygon.length > 0 && (
                  <button onClick={() => setFormPolygon([])} style={{ fontSize: 10.5, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear all</button>
                )}
              </div>

              {/* Points list */}
              {formPolygon.length > 0 && (
                <div style={{ border, borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
                  {formPolygon.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: i < formPolygon.length - 1 ? `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` : 'none', background: dark ? '#111' : '#f9fafb' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: dark ? '#e5e5e5' : '#111' }}>{fmtCoord(pt[0])}, {fmtCoord(pt[1])}</span>
                      <button onClick={() => removePoint(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', display: 'flex', padding: 2 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add point button */}
              <button onClick={() => setDrawActive(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: `2px dashed ${drawActive ? '#dc2626' : (dark ? '#333' : '#d1d5db')}`, borderRadius: 7, background: drawActive ? '#fef2f2' : 'transparent', color: drawActive ? '#dc2626' : (dark ? '#666' : '#9ca3af'), fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {drawActive ? 'Click map to add point…' : 'Click to add points on map'}
              </button>
            </div>

            {formPolygon.length >= 3 && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 11.5, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Polygon ready — add more points or save
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 18px', borderTop: border, display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ padding: '9px 16px', borderRadius: 7, border, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={!canSave || saving} style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: canSave && !saving ? '#dc2626' : '#e5e7eb', color: canSave && !saving ? '#fff' : '#aaa', fontSize: 13, fontWeight: 600, cursor: canSave && !saving ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Geofence'}
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function GeofencesModal({ open, onClose, dark }: { open: boolean; onClose: () => void; dark: boolean }) {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [q, setQ] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'circle' | 'polygon'>('circle');
  const [formCenter, setFormCenter] = useState<[number, number] | null>(null);
  const [formRadius, setFormRadius] = useState(500);
  const [formPolygon, setFormPolygon] = useState<[number, number][]>([]);
  const [drawActive, setDrawActive] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get<Geofence[]>('/geofences'); setGeofences(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    load();
    setView('list');
    setQ('');
  }, [open]);

  const openNew = () => {
    setEditing(null);
    setFormName('');
    setFormType('circle');
    setFormCenter(null);
    setFormRadius(500);
    setFormPolygon([]);
    setDrawActive(false);
    setView('form');
  };

  const openEdit = (gf: Geofence) => {
    setEditing(gf);
    setFormName(gf.name);
    setFormType(gf.type);
    if (gf.type === 'circle') {
      const c = gf.coordinates as CircleCoords;
      setFormCenter(c.center);
      setFormRadius(c.radius);
      setFormPolygon([]);
    } else {
      const p = gf.coordinates as PolygonCoords;
      setFormCenter(null);
      setFormRadius(500);
      setFormPolygon([...p.points]);
    }
    setDrawActive(false);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    try { await api.delete(`/geofences/${id}`); setGeofences(g => g.filter(x => x.id !== id)); }
    catch {}
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (formType === 'circle' && !formCenter) return;
    if (formType === 'polygon' && formPolygon.length < 3) return;

    const data = {
      name: formName.trim(),
      type: formType,
      coordinates: formType === 'circle'
        ? { center: formCenter!, radius: formRadius }
        : { points: formPolygon },
    };

    setSaving(true);
    try {
      if (editing) {
        const r = await api.put<Geofence>(`/geofences/${editing.id}`, data);
        setGeofences(g => g.map(x => x.id === editing.id ? r.data : x));
      } else {
        const r = await api.post<Geofence>('/geofences', data);
        setGeofences(g => [r.data, ...g]);
      }
      setView('list');
    } catch {} finally { setSaving(false); }
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!drawActive) return;
    if (formType === 'circle') {
      setFormCenter([lat, lng]);
      setDrawActive(false);
    } else {
      setFormPolygon(p => [...p, [lat, lng]]);
    }
  }, [drawActive, formType]);

  if (!open) return null;

  const border = `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: dark ? '#161616' : '#fff', border, borderRadius: 16, width: 'min(960px, 96vw)', height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 22px', borderBottom: border, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Geofences</div>
            <div style={{ fontSize: 11, color: dark ? '#666' : '#9ca3af' }}>{geofences.length} zone{geofences.length !== 1 ? 's' : ''} defined</div>
          </div>
          <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '5px 6px', borderRadius: 6, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel */}
          <div style={{ width: 340, flexShrink: 0, borderRight: border, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {view === 'list'
              ? <ListView geofences={geofences} loading={loading} q={q} setQ={setQ} onNew={openNew} onEdit={openEdit} onDelete={handleDelete} dark={dark}/>
              : <FormView
                  editing={editing}
                  formName={formName} setFormName={setFormName}
                  formType={formType} setFormType={setFormType}
                  formCenter={formCenter}
                  formRadius={formRadius} setFormRadius={setFormRadius}
                  formPolygon={formPolygon} setFormPolygon={setFormPolygon}
                  drawActive={drawActive} setDrawActive={setDrawActive}
                  saving={saving}
                  onSave={handleSave}
                  onBack={() => { setView('list'); setDrawActive(false); }}
                  dark={dark}
                />
            }
          </div>

          {/* Right panel — Map */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <GeofenceMap
              geofences={geofences}
              editingId={editing?.id ?? null}
              formType={formType}
              formCenter={formCenter}
              formRadius={formRadius}
              formPolygon={formPolygon}
              dark={dark}
              onMapClick={handleMapClick}
              drawActive={drawActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
