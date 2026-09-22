import { useState, useEffect, useRef } from 'react';
import { POI_ICONS } from '../lib/poi-icons';
import { usePOI } from '../contexts/POIContext';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import { ORG_ROLES } from '../config/roles';
import type { UserRole } from '@yotrack/types';

export interface POIRecord {
  id: string;
  name: string;
  description: string | null;
  group: string | null;
  icon: string;
  latitude: number;
  longitude: number;
  radius: number;
  createdAt: string;
}

interface Props {
  dark: boolean;
  onClose: () => void;
  onRequestAlert?: (poi: POIRecord) => void;
  onPoisChange?: (pois: POIRecord[]) => void;
  orgId?: string;
}

const API = import.meta.env.VITE_API_URL ?? '/api/v1';

function getToken() { return localStorage.getItem('yt_token') || sessionStorage.getItem('yt_token') || ''; }

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ──────────────────────────────────────────────
// Icon picker grid
// ──────────────────────────────────────────────
function IconPicker({ value, onChange, dark }: { value: string; onChange: (id: string) => void; dark: boolean }) {
  const [search, setSearch] = useState('');
  const filtered = POI_ICONS.filter(ic => !search || ic.label.toLowerCase().includes(search.toLowerCase()) || ic.id.includes(search.toLowerCase()));

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search icons…"
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#1a1a1a' : '#fff', color: dark ? '#e5e7eb' : '#111', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {filtered.map(ic => (
          <button
            key={ic.id}
            type="button"
            title={ic.label}
            onClick={() => onChange(ic.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
              border: value === ic.id ? '2px solid #dc2626' : `1px solid ${dark ? '#333' : '#e5e7eb'}`,
              background: value === ic.id ? (dark ? '#2d1515' : '#fef2f2') : (dark ? '#1a1a1a' : '#fff'),
              color: value === ic.id ? '#dc2626' : (dark ? '#9ca3af' : '#6b7280'),
              flexShrink: 0,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d={ic.path} />
            </svg>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ gridColumn: '1 / -1', padding: 12, color: dark ? '#6b7280' : '#999', fontSize: 12, textAlign: 'center' }}>No icons found</div>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Form modal
// ──────────────────────────────────────────────
interface FormProps {
  dark: boolean;
  initial?: Partial<POIRecord>;
  groups: string[];
  onSave: (data: Partial<POIRecord>) => Promise<void>;
  onClose: () => void;
  onPickLocation: () => void;
  pendingCoords: [number, number] | null;
}

function POIFormModal({ dark, initial, groups, onSave, onClose, onPickLocation, pendingCoords }: FormProps) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [group, setGroup] = useState(initial?.group ?? '');
  const [newGroup, setNewGroup] = useState('');
  const [icon, setIcon] = useState(initial?.icon ?? 'map-pin');
  const [lat, setLat] = useState(initial?.latitude?.toString() ?? '');
  const [lng, setLng] = useState(initial?.longitude?.toString() ?? '');
  const [radius, setRadius] = useState(initial?.radius?.toString() ?? '200');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (pendingCoords) {
      setLat(pendingCoords[0].toFixed(6));
      setLng(pendingCoords[1].toFixed(6));
    }
  }, [pendingCoords]);

  const finalGroup = newGroup.trim() || group;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    const latN = parseFloat(lat), lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) { setErr('Valid coordinates required'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({ name: name.trim(), description: desc.trim() || null, group: finalGroup || null, icon, latitude: latN, longitude: lngN, radius: parseFloat(radius) || 200 });
      onClose();
    } catch (ex: any) {
      setErr(ex.message ?? 'Failed');
    } finally { setSaving(false); }
  }

  const label = (txt: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: dark ? '#9ca3af' : '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{txt}</div>
  );
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#1a1a1a' : '#fff', color: dark ? '#e5e7eb' : '#111', fontSize: 13, boxSizing: 'border-box' };

  const selectedIcon = POI_ICONS.find(i => i.id === icon);

  return (
    <Modal open title={isEdit ? 'Edit POI' : 'New POI'} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
          <div>
            {label('Name')}
            <input value={name} onChange={e => setName(e.target.value)} placeholder="POI name" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            {label('Description')}
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Group */}
          <div>
            {label('Group')}
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={group} onChange={e => setGroup(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                <option value="">— No group —</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="Or create new…" style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>

          {/* Location */}
          <div>
            {label('Location')}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude" type="number" step="any" style={{ ...inputStyle, flex: 1 }} />
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude" type="number" step="any" style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={onPickLocation} title="Click on map to pick location" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 7, border: `1px solid ${dark ? '#444' : '#ddd'}`, background: dark ? '#1e1e1e' : '#f9fafb', color: dark ? '#e5e7eb' : '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                </svg>
                Pick on Map
              </button>
            </div>
          </div>

          {/* Radius */}
          <div>
            {label('Radius (meters)')}
            <input value={radius} onChange={e => setRadius(e.target.value)} type="number" min={10} max={50000} style={inputStyle} />
          </div>

          {/* Icon */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              {label('Marker Icon')}
              {selectedIcon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d={selectedIcon.path} />
                  </svg>
                  {selectedIcon.label}
                </div>
              )}
            </div>
            <IconPicker value={icon} onChange={setIcon} dark={dark} />
          </div>

          {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: 'transparent', color: dark ? '#9ca3af' : '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saving ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create POI'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// POI row icon renderer
// ──────────────────────────────────────────────
function POIIcon({ iconId, size = 16 }: { iconId: string; size?: number }) {
  const ic = POI_ICONS.find(i => i.id === iconId);
  if (!ic) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={ic.path} />
    </svg>
  );
}

// ──────────────────────────────────────────────
// Dot menu
// ──────────────────────────────────────────────
function DotMenu({ dark, onEdit, onDelete, onAlert }: { dark: boolean; onEdit?: () => void; onDelete?: () => void; onAlert?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const btn = (label: string, cb: () => void, danger = false) => (
    <button onClick={() => { cb(); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: 'none', fontSize: 13, color: danger ? '#dc2626' : (dark ? '#e5e7eb' : '#111'), cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );

  const hasItems = onAlert || onEdit || onDelete;
  if (!hasItems) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#9ca3af' : '#6b7280', cursor: 'pointer' }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 1200, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#1e1e1e' : '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 130 }}>
          {onAlert && btn('Create Alert', onAlert)}
          {onEdit && btn('Edit', onEdit)}
          {onDelete && btn('Delete', onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main POI left panel
// ──────────────────────────────────────────────
export function POIsPanel({ dark, onClose, onRequestAlert, onPoisChange, orgId }: Props) {
  const { setPoiCount, pickingLocation, setPickingLocation, pendingCoords, setPendingCoords } = usePOI();
  const [pois, setPois] = useState<POIRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<POIRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const { user: poiUser } = useAuth();
  const { canOrgDo: poiCanOrgDo } = useOrgRolePerms();
  const poiRole = poiUser?.role ?? '';
  const poiIsOrg = ORG_ROLES.includes(poiRole as UserRole);
  const poiCanAdd    = poiIsOrg ? poiCanOrgDo(poiRole, 'pois', 'add')    : true;
  const poiCanEdit   = poiIsOrg ? poiCanOrgDo(poiRole, 'pois', 'edit')   : true;
  const poiCanDelete = poiIsOrg ? poiCanOrgDo(poiRole, 'pois', 'delete') : true;

  const orgQs = orgId ? `?orgId=${orgId}` : '';

  const groups = Array.from(new Set(pois.map(p => p.group).filter(Boolean) as string[])).sort();
  const displayed = pois.filter(p => {
    if (filterGroup && p.group !== filterGroup) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  async function load() {
    try {
      const data: POIRecord[] = await apiFetch(`/pois${orgQs}`);
      setPois(data);
      setPoiCount(data.length);
      onPoisChange?.(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [orgId]);

  async function handleSave(dto: Partial<POIRecord>) {
    if (editItem) {
      const updated: POIRecord = await apiFetch(`/pois/${editItem.id}`, { method: 'PUT', body: JSON.stringify(dto) });
      setPois(prev => { const next = prev.map(p => p.id === updated.id ? updated : p); onPoisChange?.(next); return next; });
      setPoiCount(pois.length);
    } else {
      const created: POIRecord = await apiFetch(`/pois${orgQs}`, { method: 'POST', body: JSON.stringify(dto) });
      setPois(prev => { const next = [created, ...prev]; onPoisChange?.(next); return next; });
      setPoiCount(pois.length + 1);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await apiFetch(`/pois/${id}`, { method: 'DELETE' });
      setPois(prev => { const next = prev.filter(p => p.id !== id); setPoiCount(next.length); onPoisChange?.(next); return next; });
    } finally { setDeleting(false); setDeleteId(null); }
  }

  function openCreate() { setEditItem(null); setPendingCoords(null); setFormOpen(true); }
  function openEdit(p: POIRecord) { setEditItem(p); setPendingCoords(null); setFormOpen(true); }

  function handlePickLocation() {
    setPickingLocation(true);
    setFormOpen(false); // minimize modal so user can click map
  }

  // When user picked coords, reopen form
  useEffect(() => {
    if (pendingCoords && !pickingLocation) {
      setFormOpen(true);
    }
  }, [pendingCoords, pickingLocation]);

  const bd = dark ? '#1e1e1e' : '#fff';
  const border = dark ? '#2d2d2d' : '#f0f0f0';
  const text = dark ? '#e5e7eb' : '#111';
  const text2 = dark ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bd }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 10px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14, color: text }}>Points of Interest</span>
          <span style={{ fontSize: 11, color: text2 }}>({pois.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {poiCanAdd && <button onClick={openCreate} title="Add new POI" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</button>}
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text2, cursor: 'pointer' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Picking location banner */}
      {pickingLocation && (
        <div style={{ padding: '10px 14px', background: dark ? '#1c1700' : '#fffbeb', borderBottom: `1px solid ${dark ? '#3d3200' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span style={{ fontSize: 12, color: dark ? '#fde68a' : '#92400e' }}>Click anywhere on the map to set location</span>
          </div>
          <button onClick={() => setPickingLocation(false)} style={{ fontSize: 11, color: dark ? '#fde68a' : '#b45309', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '8px 14px', flexShrink: 0 }}>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search POIs…" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#1a1a1a' : '#f9fafb', color: text, fontSize: 12, boxSizing: 'border-box' }} />
      </div>

      {/* Group filter tabs */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', padding: '0 14px', borderBottom: `1px solid ${border}`, flexShrink: 0, overflowX: 'auto' }}>
          {['', ...groups].map(g => (
            <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '7px 10px', border: 'none', borderBottom: `2px solid ${filterGroup === g ? '#dc2626' : 'transparent'}`, background: 'transparent', color: filterGroup === g ? '#dc2626' : text2, fontSize: 12, fontWeight: filterGroup === g ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1 }}>
              {g || 'All'}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: text2, fontSize: 13 }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: text2, fontSize: 13 }}>
            {pois.length === 0 ? 'No POIs yet — add one with +' : 'No POIs match the filter'}
          </div>
        ) : (
          displayed.map(poi => (
            <div key={poi.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${border}` }}>
              {/* Icon */}
              <div style={{ width: 32, height: 32, borderRadius: 8, background: dark ? '#2d1515' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                <POIIcon iconId={poi.icon} size={16} />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{poi.name}</div>
                <div style={{ fontSize: 11, color: text2, marginTop: 1 }}>
                  {poi.group && <span style={{ marginRight: 6 }}>{poi.group}</span>}
                  <span>{poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}</span>
                  <span style={{ marginLeft: 6 }}>{poi.radius}m</span>
                </div>
              </div>
              {/* Actions */}
              <DotMenu
                dark={dark}
                onEdit={poiCanEdit ? () => openEdit(poi) : undefined}
                onDelete={poiCanDelete ? () => setDeleteId(poi.id) : undefined}
                onAlert={() => onRequestAlert?.(poi)}
              />
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      {formOpen && (
        <POIFormModal
          dark={dark}
          initial={editItem ?? undefined}
          groups={groups}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditItem(null); setPendingCoords(null); }}
          onPickLocation={handlePickLocation}
          pendingCoords={pendingCoords}
        />
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete POI"
        message="Are you sure you want to delete this point of interest? This action cannot be undone."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
}
