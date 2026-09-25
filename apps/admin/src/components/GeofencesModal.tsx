// Left-panel UI for geofence management — no embedded map.
// All drawing happens on the main MapPage map via GeofenceDrawLayer.
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import { ORG_ROLES } from '../config/roles';
import type { UserRole } from '@yotrack/types';

export interface CircleCoords { center: [number, number]; radius: number; }
export interface PolygonCoords { points: [number, number][]; }
export interface GeofenceSchedule {
  enabled: boolean;
  days: number[];       // 0=Sun 1=Mon … 6=Sat
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
}

export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: CircleCoords | PolygonCoords;
  color: string;
  schedule?: GeofenceSchedule | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_SCHEDULE: GeofenceSchedule = { enabled: false, days: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' };

function fmtSchedule(s: GeofenceSchedule | null | undefined): string {
  if (!s?.enabled) return 'Always active';
  const days = s.days.slice().sort().map(d => DAY_LABELS[d]).join(', ');
  return `${days} · ${s.startTime}–${s.endTime}`;
}

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: 0.4,
  display: 'block', marginBottom: 5,
};

function fmtCoord(n: number) { return n.toFixed(5); }

// ── List ─────────────────────────────────────────────────────────────────────

interface ListProps {
  geofences: Geofence[];
  loading: boolean;
  onNew: () => void;
  onEdit: (gf: Geofence) => void;
  onDelete: (id: string) => void;
  dark: boolean;
  onClose: () => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

function GfList({ geofences, loading, onNew, onEdit, onDelete, dark, onClose, canAdd = true, canEdit = true, canDelete = true }: ListProps) {
  const [q, setQ] = useState('');
  const border = `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`;
  const filtered = geofences.filter(g => !q || g.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: border, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>
          Geofences <span style={{ fontSize: 11, fontWeight: 500, color: dark ? '#555' : '#aaa', marginLeft: 4 }}>{geofences.length}</span>
        </div>
        {canAdd && <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New
        </button>}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', display: 'flex', padding: 3 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px', borderBottom: border, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: dark ? '#111' : '#f5f5f5', border, borderRadius: 6, padding: '6px 10px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none', flex: 1 }}/>
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', marginBottom: 3 }}>No geofences</div>
            <div style={{ fontSize: 11, color: dark ? '#555' : '#aaa' }}>Click "New" to create a zone</div>
          </div>
        )}
        {filtered.map(gf => (
          <div key={gf.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: gf.color ?? '#dc2626', flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gf.name}</div>
              <div style={{ fontSize: 10.5, color: dark ? '#555' : '#aaa', marginTop: 1 }}>
                {gf.type === 'circle'
                  ? `Circle · ${((gf.coordinates as CircleCoords).radius / 1000).toFixed(2)} km`
                  : `Polygon · ${(gf.coordinates as PolygonCoords).points.length} pts`}
              </div>
              <div style={{ fontSize: 10, color: gf.schedule?.enabled ? '#dc2626' : (dark ? '#444' : '#ccc'), marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {fmtSchedule(gf.schedule)}
              </div>
            </div>
            {canEdit && <button onClick={() => onEdit(gf)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#bbb', display: 'flex', padding: 3 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>}
            {canDelete && <button onClick={() => onDelete(gf.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#bbb', display: 'flex', padding: 3 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────


interface FormProps {
  dark: boolean;
  editing: Geofence | null;
  name: string; onName: (v: string) => void;
  type: 'circle' | 'polygon'; onType: (v: 'circle' | 'polygon') => void;
  color: string; onColor: (v: string) => void;
  center: [number, number] | null;
  radius: number; onRadius: (v: number) => void;
  points: [number, number][]; onRemovePoint: (i: number) => void; onClearPoints: () => void;
  drawActive: boolean; onToggleDraw: () => void;
  schedule: GeofenceSchedule; onSchedule: (s: GeofenceSchedule) => void;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}

function GfForm({ dark, editing, name, onName, type, onType, color, onColor, center, radius, onRadius, points, onRemovePoint, onClearPoints, drawActive, onToggleDraw, schedule, onSchedule, saving, onSave, onBack }: FormProps) {
  const border = `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`;
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border, borderRadius: 6, background: dark ? '#111' : '#fff', color: dark ? '#e5e5e5' : '#111', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' };
  const canSave = name.trim() && (
    (type === 'circle' && center !== null) ||
    (type === 'polygon' && points.length >= 1)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: border, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', display: 'flex', padding: 3 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{editing ? 'Edit Geofence' : 'New Geofence'}</span>
      </div>

      {/* Draw mode hint — circle only */}
      {drawActive && type === 'circle' && (
        <div style={{ padding: '8px 14px', background: `${color}12`, borderBottom: `1px solid ${color}55`, fontSize: 11, color: color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="1"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="3" y1="12" x2="1" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          Click on map to set center
        </div>
      )}
      {/* Polygon always-draw hint */}
      {type === 'polygon' && (
        <div style={{ padding: '7px 14px', background: `${color}12`, borderBottom: `1px solid ${color}55`, fontSize: 11, color: color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Click on map to add points
        </div>
      )}

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Name</span>
          <input autoFocus value={name} onChange={e => onName(e.target.value)} placeholder="Zone name" style={inp}/>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Shape</span>
          <div style={{ display: 'flex', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}` }}>
            {(['circle', 'polygon'] as const).map(t => (
              <button key={t} onClick={() => onType(t)} style={{ flex: 1, padding: '6px 4px', border: 'none', borderBottom: `2px solid ${type === t ? color : 'transparent'}`, background: 'transparent', color: type === t ? color : (dark ? '#888' : '#999'), fontSize: 12, fontWeight: type === t ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'color 0.15s, border-color 0.15s', marginBottom: -1 }}>
                {t === 'circle'
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 22 20 2 20"/></svg>}
                {t === 'circle' ? 'Circle' : 'Polygon'}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Zone Color</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '9px 12px', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 8, background: dark ? '#111' : '#f9fafb', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: `2px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`, flexShrink: 0 }}/>
            <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: dark ? '#e5e5e5' : '#111', fontWeight: 600, flex: 1, textTransform: 'uppercase' }}>{color}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <input type="color" value={color} onChange={e => onColor(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}/>
          </label>
        </div>

        {/* Circle controls */}
        {type === 'circle' && (
          <>
            {/* Center */}
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Center Point</span>
              {center ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
                  <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: dark ? '#e5e5e5' : '#111' }}>{fmtCoord(center[0])}, {fmtCoord(center[1])}</span>
                  <span style={{ fontSize: 10, color: dark ? '#555' : '#aaa' }}>· drag marker on map</span>
                </div>
              ) : (
                <button onClick={onToggleDraw} style={{ width: '100%', padding: '10px', border: `2px dashed ${drawActive ? '#dc2626' : (dark ? '#333' : '#d1d5db')}`, borderRadius: 6, background: drawActive ? '#fef2f2' : 'transparent', color: drawActive ? '#dc2626' : (dark ? '#666' : '#9ca3af'), fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {drawActive ? 'Click on map…' : 'Click to pick center on map'}
                </button>
              )}
            </div>

            {/* Radius */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>Radius</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: color }}>
                  {radius >= 1000 ? `${(radius / 1000).toFixed(2)} km` : `${radius} m`}
                </span>
              </div>
              <input type="range" min={100} max={50000} step={100} value={radius} onChange={e => onRadius(Number(e.target.value))} style={{ width: '100%', accentColor: color }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: dark ? '#555' : '#aaa', marginTop: 2 }}>
                <span>100 m</span><span>50 km</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: dark ? '#888' : '#666' }}>Exact (m):</span>
                <input type="number" min={100} max={100000} value={radius} onChange={e => onRadius(Math.max(100, Number(e.target.value)))} style={{ ...inp, width: 90, padding: '4px 8px', fontSize: 11.5 }}/>
              </div>
            </div>
          </>
        )}

        {/* Polygon controls */}
        {type === 'polygon' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>Points <span style={{ color: '#9ca3af', fontWeight: 500, textTransform: 'none' }}>({points.length})</span></span>
              {points.length > 0 && <button onClick={onClearPoints} style={{ fontSize: 10.5, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Clear</button>}
            </div>

            {points.length > 0 && (
              <div style={{ border, borderRadius: 6, overflow: 'hidden', marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}>
                {points.map((pt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderBottom: i < points.length - 1 ? `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` : 'none', background: dark ? '#111' : '#f9fafb' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 10.5, fontFamily: 'monospace', color: dark ? '#e5e5e5' : '#111' }}>{fmtCoord(pt[0])}, {fmtCoord(pt[1])}</span>
                    <button onClick={() => onRemovePoint(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#bbb', display: 'flex', padding: 2 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {points.length === 0 && (
              <div style={{ fontSize: 11.5, color: dark ? '#666' : '#aaa', textAlign: 'center', padding: '10px 0' }}>Click on map to start adding points</div>
            )}
          </>
        )}

        {/* Schedule */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>Active Schedule</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: schedule.enabled ? '#dc2626' : (dark ? '#555' : '#aaa'), fontWeight: 600 }}>
                {schedule.enabled ? 'Custom' : 'Always'}
              </span>
              <div onClick={() => onSchedule({ ...schedule, enabled: !schedule.enabled })}
                style={{ width: 32, height: 18, borderRadius: 9, background: schedule.enabled ? '#dc2626' : (dark ? '#333' : '#e5e7eb'), position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: schedule.enabled ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
              </div>
            </label>
          </div>

          {schedule.enabled && (
            <>
              {/* Days */}
              <div style={{ marginBottom: 10 }}>
                <span style={{ ...lbl, marginBottom: 6 }}>Days</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DAY_LABELS.map((d, i) => {
                    const on = schedule.days.includes(i);
                    return (
                      <button key={i} onClick={() => {
                        const days = on ? schedule.days.filter(x => x !== i) : [...schedule.days, i];
                        onSchedule({ ...schedule, days });
                      }} style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${on ? '#dc2626' : (dark ? '#333' : '#e5e7eb')}`, background: on ? '#dc2626' : 'transparent', color: on ? '#fff' : (dark ? '#888' : '#666'), fontSize: 11, fontWeight: on ? 700 : 400, cursor: 'pointer' }}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time range */}
              <div>
                <span style={{ ...lbl, marginBottom: 6 }}>Time Window</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="time" value={schedule.startTime}
                    onChange={e => onSchedule({ ...schedule, startTime: e.target.value })}
                    style={{ flex: 1, padding: '7px 9px', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 6, background: dark ? '#111' : '#fff', color: dark ? '#e5e5e5' : '#111', fontSize: 12.5, outline: 'none' }}/>
                  <span style={{ fontSize: 11, color: dark ? '#555' : '#aaa', flexShrink: 0 }}>to</span>
                  <input type="time" value={schedule.endTime}
                    onChange={e => onSchedule({ ...schedule, endTime: e.target.value })}
                    style={{ flex: 1, padding: '7px 9px', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 6, background: dark ? '#111' : '#fff', color: dark ? '#e5e5e5' : '#111', fontSize: 12.5, outline: 'none' }}/>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: border, display: 'flex', gap: 7, flexShrink: 0 }}>
        <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 6, border, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={!canSave || saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: canSave && !saving ? '#dc2626' : '#e5e7eb', color: canSave && !saving ? '#fff' : '#aaa', fontSize: 12.5, fontWeight: 600, cursor: canSave && !saving ? 'pointer' : 'default' }}>
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export interface GeofencesPanelProps {
  dark: boolean;
  geofences: Geofence[];
  loading: boolean;
  view: 'list' | 'form';
  editing: Geofence | null;
  name: string; onName: (v: string) => void;
  type: 'circle' | 'polygon'; onType: (v: 'circle' | 'polygon') => void;
  color: string; onColor: (v: string) => void;
  center: [number, number] | null;
  radius: number; onRadius: (v: number) => void;
  points: [number, number][]; onRemovePoint: (i: number) => void; onClearPoints: () => void;
  drawActive: boolean; onToggleDraw: () => void;
  schedule: GeofenceSchedule; onSchedule: (s: GeofenceSchedule) => void;
  saving: boolean;
  onNew: () => void;
  onEdit: (gf: Geofence) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onBack: () => void;
  onClose: () => void;
}

export default function GeofencesPanel(p: GeofencesPanelProps) {
  const { user: gfUser } = useAuth();
  const { canOrgDo: gfCanOrgDo } = useOrgRolePerms();
  const gfRole = gfUser?.role ?? '';
  const gfIsOrg = ORG_ROLES.includes(gfRole as UserRole);
  const gfCanAdd    = gfIsOrg ? gfCanOrgDo(gfRole, 'geofences', 'add')    : true;
  const gfCanEdit   = gfIsOrg ? gfCanOrgDo(gfRole, 'geofences', 'edit')   : true;
  const gfCanDelete = gfIsOrg ? gfCanOrgDo(gfRole, 'geofences', 'delete') : true;

  return (
    <div style={{ height: '100%', background: p.dark ? '#161616' : '#fff', border: `1px solid ${p.dark ? '#2a2a2a' : '#e8e8e8'}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {p.view === 'list'
        ? <GfList geofences={p.geofences} loading={p.loading} onNew={p.onNew} onEdit={p.onEdit} onDelete={p.onDelete} dark={p.dark} onClose={p.onClose} canAdd={gfCanAdd} canEdit={gfCanEdit} canDelete={gfCanDelete}/>
        : <GfForm dark={p.dark} editing={p.editing} name={p.name} onName={p.onName} type={p.type} onType={p.onType} color={p.color} onColor={p.onColor} center={p.center} radius={p.radius} onRadius={p.onRadius} points={p.points} onRemovePoint={p.onRemovePoint} onClearPoints={p.onClearPoints} drawActive={p.drawActive} onToggleDraw={p.onToggleDraw} schedule={p.schedule} onSchedule={p.onSchedule} saving={p.saving} onSave={p.onSave} onBack={p.onBack}/>
      }
    </div>
  );
}
