import { useState, useEffect } from 'react';
import api from '../api/client';

export interface VehicleSelectItem { id: string; plate: string; name?: string | null; make?: string | null; model?: string | null; }
export interface VehicleSelectGroup { id: string; name: string; vehicleIds: string[]; }

interface Props {
  organizationId: string;
  /** null = all vehicles access; string[] = specific vehicle IDs */
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
  /** Pass pre-loaded data to skip API fetch */
  vehicles?: VehicleSelectItem[];
  groups?: VehicleSelectGroup[];
}

export default function VehicleGroupSelect({ organizationId, value, onChange, vehicles: propVehicles, groups: propGroups }: Props) {
  const [vehicles, setVehicles] = useState<VehicleSelectItem[]>(propVehicles ?? []);
  const [groups, setGroups]     = useState<VehicleSelectGroup[]>(propGroups ?? []);
  const [loading, setLoading]   = useState(!propVehicles);

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

  const groupedIds     = new Set(groups.flatMap(g => g.vehicleIds));
  const ungrouped      = vehicles.filter(v => !groupedIds.has(v.id));

  const toggleVehicle = (id: string) => {
    const ids = value ?? [];
    onChange(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const toggleGroup = (vIds: string[]) => {
    const ids    = value ?? [];
    const allSel = vIds.every(id => ids.includes(id));
    onChange(allSel ? ids.filter(x => !vIds.includes(x)) : [...new Set([...ids, ...vIds])]);
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#bbb', fontSize: 12 }}>Loading…</div>;

  return (
    <div>
      {/* All / Specific radio */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
          <input type="radio" checked={value === null} onChange={() => onChange(null)} style={{ accentColor: '#dc2626' }} />
          All Vehicles
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
          <input type="radio" checked={value !== null} onChange={() => onChange([])} style={{ accentColor: '#dc2626' }} />
          Specific Vehicles
        </label>
      </div>

      {value !== null && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {vehicles.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: '#bbb', textAlign: 'center' }}>No vehicles found</div>
          )}

          {/* Groups */}
          {groups.map(grp => {
            const grpVehicles = vehicles.filter(v => grp.vehicleIds.includes(v.id));
            if (grpVehicles.length === 0) return null;
            const allSel  = grpVehicles.every(v => value.includes(v.id));
            const someSel = !allSel && grpVehicles.some(v => value.includes(v.id));
            return (
              <div key={grp.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <button
                    onClick={() => toggleGroup(grpVehicles.map(v => v.id))}
                    style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${allSel || someSel ? '#dc2626' : '#d1d5db'}`, background: allSel ? '#dc2626' : someSel ? '#fef2f2' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
                  >
                    {allSel  && <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                    {someSel && <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 4.5h5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </button>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#374151' }}>{grp.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{grpVehicles.length} vehicles</span>
                </div>
                <div style={{ padding: '4px 12px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {grpVehicles.map(v => (
                    <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggleVehicle(v.id)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div>
              {groups.length > 0 && (
                <div style={{ padding: '7px 12px', background: '#f9fafb', borderBottom: '1px solid #f0f0f0', fontSize: 11.5, fontWeight: 700, color: '#9ca3af' }}>
                  Other
                </div>
              )}
              <div style={{ padding: '4px 12px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ungrouped.map(v => (
                  <VehicleRow key={v.id} v={v} checked={value.includes(v.id)} onToggle={() => toggleVehicle(v.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleRow({ v, checked, onToggle }: { v: VehicleSelectItem; checked: boolean; onToggle: () => void }) {
  const subtitle = v.name || [v.make, v.model].filter(Boolean).join(' ') || null;
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '3px 0' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ accentColor: '#dc2626' }} />
      <span style={{ fontWeight: 600, color: '#111', fontFamily: 'monospace', fontSize: 12 }}>{v.plate}</span>
      {subtitle && <span style={{ color: '#9ca3af', fontSize: 11 }}>{subtitle}</span>}
    </label>
  );
}
