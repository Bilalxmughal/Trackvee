import { useState, useEffect } from 'react';
import api from '../api/client';

export interface VehicleSelectItem {
  id: string; plate: string; name?: string | null; make?: string | null; model?: string | null;
}
export interface VehicleSelectGroup { id: string; name: string; vehicleIds: string[]; }

interface Props {
  organizationId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Pass pre-loaded data to skip API fetch */
  vehicles?: VehicleSelectItem[];
  groups?: VehicleSelectGroup[];
}

export default function VehicleGroupSelect({ organizationId, value, onChange, vehicles: propVehicles, groups: propGroups }: Props) {
  const [vehicles, setVehicles] = useState<VehicleSelectItem[]>(propVehicles ?? []);
  const [groups, setGroups]     = useState<VehicleSelectGroup[]>(propGroups ?? []);
  const [loading, setLoading]   = useState(!propVehicles);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (propVehicles) { setVehicles(propVehicles); return; }
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get<VehicleSelectItem[]>(`/vehicles?organizationId=${organizationId}`).then(r => r.data).catch(() => []),
      api.get<VehicleSelectGroup[]>(`/vehicle-groups?organizationId=${organizationId}`).then(r => r.data).catch(() => []),
    ]).then(([vs, vgs]) => {
      if (cancelled) return;
      setVehicles(vs);
      setGroups(vgs);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId, propVehicles]);

  useEffect(() => { if (propGroups) setGroups(propGroups); }, [propGroups]);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const groupedIds  = new Set(groups.flatMap(g => g.vehicleIds));
  const ungrouped   = vehicles.filter(v => !groupedIds.has(v.id));

  const toggleVehicle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  const toggleGroup = (vIds: string[]) => {
    const allSel = vIds.every(id => value.includes(id));
    onChange(allSel ? value.filter(x => !vIds.includes(x)) : [...new Set([...value, ...vIds])]);
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#bbb', fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      {vehicles.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: '#bbb', textAlign: 'center' }}>No vehicles found</div>
      )}

      {/* Groups */}
      {groups.map(grp => {
        const grpVehicles = vehicles.filter(v => grp.vehicleIds.includes(v.id));
        if (grpVehicles.length === 0) return null;
        const isCollapsed = collapsed.has(grp.id);
        const allSel      = grpVehicles.every(v => value.includes(v.id));
        const someSel     = !allSel && grpVehicles.some(v => value.includes(v.id));
        return (
          <div key={grp.id}>
            <GroupHeader
              name={grp.name} count={grpVehicles.length}
              collapsed={isCollapsed} allSel={allSel} someSel={someSel}
              onToggleCollapse={() => toggleCollapse(grp.id)}
              onToggleSelect={() => toggleGroup(grpVehicles.map(v => v.id))}
            />
            {!isCollapsed && grpVehicles.map(v => (
              <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggleVehicle(v.id)} />
            ))}
          </div>
        );
      })}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div>
          {groups.length > 0 && (
            <GroupHeader
              name="Other" count={ungrouped.length}
              collapsed={collapsed.has('__ungrouped__')}
              allSel={ungrouped.every(v => value.includes(v.id))}
              someSel={!ungrouped.every(v => value.includes(v.id)) && ungrouped.some(v => value.includes(v.id))}
              onToggleCollapse={() => toggleCollapse('__ungrouped__')}
              onToggleSelect={() => toggleGroup(ungrouped.map(v => v.id))}
            />
          )}
          {!collapsed.has('__ungrouped__') && ungrouped.map(v => (
            <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggleVehicle(v.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Group Header ──────────────────────────────────────────────────────────────

function GroupHeader({ name, count, collapsed, allSel, someSel, onToggleCollapse, onToggleSelect }: {
  name: string; count: number; collapsed: boolean;
  allSel: boolean; someSel: boolean;
  onToggleCollapse: () => void; onToggleSelect: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px 7px 10px', background: hov ? '#f0f0f0' : '#f7f7f7', borderBottom: '1px solid #ebebeb', cursor: 'pointer', userSelect: 'none' }}
    >
      {/* Collapse chevron */}
      <span onClick={onToggleCollapse} style={{ display: 'flex', flexShrink: 0, color: '#999' }}>
        {collapsed
          ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,6 15,12 9,18"/></svg>
          : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>}
      </span>

      {/* Group select checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect(); }}
        style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${allSel || someSel ? '#dc2626' : '#d1d5db'}`, background: allSel ? '#dc2626' : someSel ? '#fef2f2' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
      >
        {allSel  && <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        {someSel && <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 4.5h5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>}
      </button>

      <span onClick={onToggleCollapse} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span onClick={onToggleCollapse} style={{ fontSize: 10, color: '#555', flexShrink: 0, marginRight: 2 }}>{count}</span>
    </div>
  );
}

// ── Vehicle Row ───────────────────────────────────────────────────────────────

function VehicleRow({ v, checked, onToggle }: { v: VehicleSelectItem; checked: boolean; onToggle: () => void }) {
  const [hov, setHov] = useState(false);
  const subtitle = v.name || [v.make, v.model].filter(Boolean).join(' ') || null;
  return (
    <label
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 28px', borderLeft: '3px solid #e5e7eb', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: checked ? 'rgba(220,38,38,0.04)' : hov ? '#f9fafb' : 'transparent', userSelect: 'none' }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ accentColor: '#dc2626', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{v.plate}</div>
        {subtitle && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{subtitle}</div>}
      </div>
    </label>
  );
}
