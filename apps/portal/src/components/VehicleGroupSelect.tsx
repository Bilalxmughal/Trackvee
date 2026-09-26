import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';

export interface VehicleSelectItem {
  id: string; licensePlate: string | null; name?: string | null; make?: string | null; model?: string | null;
}
export interface VehicleSelectGroup { id: string; name: string; vehicleIds: string[]; }

interface Props {
  organizationId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  vehicles?: VehicleSelectItem[];
  groups?: VehicleSelectGroup[];
}

export default function VehicleGroupSelect({ organizationId, value, onChange, vehicles: propVehicles, groups: propGroups }: Props) {
  const [vehicles, setVehicles] = useState<VehicleSelectItem[]>(propVehicles ?? []);
  const [groups, setGroups]     = useState<VehicleSelectGroup[]>(propGroups ?? []);
  const [loading, setLoading]   = useState(!propVehicles);
  const [q, setQ]               = useState('');

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
      setVehicles(vs); setGroups(vgs); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId, propVehicles]);

  useEffect(() => { if (propGroups) setGroups(propGroups); }, [propGroups]);

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    return sq ? vehicles.filter(v => (v.licensePlate ?? '').toLowerCase().includes(sq) || (v.name ?? '').toLowerCase().includes(sq)) : vehicles;
  }, [vehicles, q]);

  const groupedIds  = useMemo(() => new Set(groups.flatMap(g => g.vehicleIds)), [groups]);
  const ungrouped   = useMemo(() => filtered.filter(v => !groupedIds.has(v.id)), [filtered, groupedIds]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  const selectAll   = () => onChange(filtered.map(v => v.id));
  const deselectAll = () => onChange(value.filter(id => !filtered.some(v => v.id === id)));

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#bbb', fontSize: 12 }}>Loading…</div>;
  if (vehicles.length === 0) return <div style={{ padding: 16, fontSize: 12, color: '#bbb', textAlign: 'center' }}>No vehicles found</div>;

  const selCount = value.filter(id => filtered.some(v => v.id === id)).length;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 340 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #ebebeb', background: '#fafafa' }}>
        <button onClick={selectAll}
          style={{ padding: '3px 8px', fontSize: 11.5, fontWeight: 500, borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Select All
        </button>
        <button onClick={deselectAll}
          style={{ padding: '3px 8px', fontSize: 11.5, fontWeight: 500, borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Deselect All
        </button>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, flexShrink: 0 }}>{selCount}/{filtered.length}</span>
        <div style={{ flex: 1 }} />
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0f0f0', borderRadius: 5, padding: '3px 8px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, color: '#111', width: 80 }}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#aaa' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* List — scrollable, toolbar stays fixed */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: '#bbb', textAlign: 'center' }}>No results</div>
        )}

        {/* Groups */}
        {groups.map(grp => {
          const grpVehicles = filtered.filter(v => grp.vehicleIds.includes(v.id));
          if (grpVehicles.length === 0) return null;
          return (
            <div key={grp.id}>
              <div style={{ padding: '6px 10px 3px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.6, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                {grp.name}
              </div>
              {grpVehicles.map(v => <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggle(v.id)} />)}
            </div>
          );
        })}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <div>
            {groups.length > 0 && (
              <div style={{ padding: '6px 10px 3px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.6, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                Other
              </div>
            )}
            {ungrouped.map(v => <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggle(v.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function VehicleRow({ v, checked, onToggle }: { v: VehicleSelectItem; checked: boolean; onToggle: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', background: checked ? 'rgba(220,38,38,0.05)' : 'transparent', borderBottom: '1px solid #f5f5f5', userSelect: 'none' }}
      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? 'rgba(220,38,38,0.05)' : 'transparent'; }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{ flexShrink: 0, width: 15, height: 15, borderRadius: 3, border: checked ? '1.5px solid #dc2626' : '1.5px solid #d1d5db', background: checked ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, border-color 0.1s' }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? '#dc2626' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.licensePlate ?? '—'}</span>
    </label>
  );
}
