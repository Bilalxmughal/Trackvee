import { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';

export interface VehicleOption { id: string; name: string; licensePlate: string | null; }
export interface VehicleGroup  { id: string; name: string; vehicleIds: string[]; }

interface Props {
  vehicles:  VehicleOption[];
  groups?:   VehicleGroup[];
  selected:  string[];
  onChange:  (ids: string[]) => void;
  placeholder?: string;
}

const CHECK = <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>;
const DASH  = <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>;

export default function VehicleMultiSelect({ vehicles, groups = [], selected, onChange, placeholder = 'Select vehicles' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Build grouped structure
  const groupedVehicleIds = new Set(groups.flatMap(g => g.vehicleIds));
  const ungrouped = vehicles.filter(v => !groupedVehicleIds.has(v.id));

  // Filter by search
  const matchV = (v: VehicleOption) =>
    v.name.toLowerCase().includes(q.toLowerCase()) ||
    (v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase());

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  const toggleAll = () =>
    onChange(selected.length === vehicles.length ? [] : vehicles.map(v => v.id));

  const toggleGroup = (vIds: string[]) => {
    const validIds = vIds.filter(id => vehicles.some(v => v.id === id));
    const allSel   = validIds.every(id => selected.includes(id));
    if (allSel) onChange(selected.filter(id => !validIds.includes(id)));
    else        onChange([...new Set([...selected, ...validIds])]);
  };

  const groupState = (vIds: string[]): 'all' | 'some' | 'none' => {
    const valid = vIds.filter(id => vehicles.some(v => v.id === id));
    const selCount = valid.filter(id => selected.includes(id)).length;
    if (selCount === 0)          return 'none';
    if (selCount === valid.length) return 'all';
    return 'some';
  };

  const allState: 'all' | 'some' | 'none' =
    selected.length === 0             ? 'none' :
    selected.length === vehicles.length ? 'all'  : 'some';

  const label =
    selected.length === 0 ? placeholder :
    selected.length === 1 ? (() => { const v = vehicles.find(v => v.id === selected[0]); return v ? (v.licensePlate ?? v.name) : '1 vehicle'; })() :
    `${selected.length} vehicles selected`;

  // Styles
  const btnSt: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
    borderRadius: 3, background: 'var(--input-bg)', cursor: 'pointer',
    fontSize: 12, color: selected.length ? 'var(--input-color)' : 'var(--text-muted)', width: '100%',
  };
  const drop: React.CSSProperties = {
    position: 'absolute', top: 33, left: 0, zIndex: 300,
    background: 'var(--card-bg)', border: '1px solid var(--input-border)',
    borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 260, maxHeight: 320, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  };
  const srchInp: React.CSSProperties = {
    width: '100%', height: 26, padding: '0 8px 0 26px', border: '1px solid var(--input-border)',
    borderRadius: 3, fontSize: 12, outline: 'none', background: 'var(--input-bg)', color: 'var(--input-color)',
  };
  const itemRow = (sel: boolean, indent = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: indent ? '5px 10px 5px 28px' : '6px 10px',
    cursor: 'pointer', fontSize: 12, color: 'var(--text)',
    background: sel ? 'rgba(220,38,38,0.06)' : 'transparent',
  });
  const groupRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    background: 'var(--bg2, rgba(0,0,0,0.03))',
    borderTop: '1px solid var(--input-border)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };
  const cb = (state: 'all' | 'some' | 'none'): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: 2,
    border: `2px solid ${state !== 'none' ? '#dc2626' : 'var(--input-border)'}`,
    background: state !== 'none' ? '#dc2626' : 'transparent',
    flexShrink: 0, display: 'grid', placeItems: 'center',
  });

  const VehicleItem = ({ v }: { v: VehicleOption }) => {
    const isSel = selected.includes(v.id);
    return (
      <div style={itemRow(isSel, groups.length > 0)} onClick={() => toggle(v.id)}>
        <div style={cb(isSel ? 'all' : 'none')}>{isSel && CHECK}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.licensePlate ?? v.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{v.name}</div>
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 220, userSelect: 'none' }}>
      <button type="button" style={btnSt} onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected.length > 0 && (
            <span onClick={e => { e.stopPropagation(); onChange([]); }} style={{ color: 'var(--text-muted)', lineHeight: 1 }}>
              <IconX size={11} />
            </span>
          )}
          <IconChevronDown size={12} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }} />
        </div>
      </button>

      {open && (
        <div style={drop}>
          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--input-border)', flexShrink: 0, position: 'relative' }}>
            <IconSearch size={13} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input autoFocus style={srchInp} placeholder="Search vehicles..." value={q} onChange={e => setQ(e.target.value)} />
          </div>

          {/* Select All / Deselect All */}
          <div style={{ ...itemRow(allState !== 'none'), borderBottom: '1px solid var(--input-border)', flexShrink: 0 }} onClick={toggleAll}>
            <div style={cb(allState)}>{allState === 'all' ? CHECK : allState === 'some' ? DASH : null}</div>
            <span style={{ fontWeight: 600 }}>
              {allState === 'all' ? `Deselect All (${vehicles.length})` : `Select All (${vehicles.length})`}
            </span>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {q ? (
              // Search mode — flat list, no groups
              vehicles.filter(matchV).length === 0
                ? <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No vehicles found</div>
                : vehicles.filter(matchV).map(v => <VehicleItem key={v.id} v={v} />)
            ) : (
              <>
                {/* Groups */}
                {groups.map(g => {
                  const gVehicles = g.vehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean) as VehicleOption[];
                  if (!gVehicles.length) return null;
                  const state = groupState(g.vehicleIds);
                  return (
                    <div key={g.id}>
                      <div style={groupRow} onClick={() => toggleGroup(g.vehicleIds)}>
                        <div style={cb(state)}>{state === 'all' ? CHECK : state === 'some' ? DASH : null}</div>
                        <span>{g.name} ({gVehicles.length})</span>
                      </div>
                      {gVehicles.map(v => <VehicleItem key={v.id} v={v} />)}
                    </div>
                  );
                })}

                {/* Ungrouped */}
                {ungrouped.length > 0 && (
                  <div>
                    {groups.length > 0 && (
                      <div style={{ ...groupRow, borderTop: groups.length ? '1px solid var(--input-border)' : 'none' }}
                           onClick={() => toggleGroup(ungrouped.map(v => v.id))}>
                        <div style={cb(groupState(ungrouped.map(v => v.id)))}>
                          {groupState(ungrouped.map(v => v.id)) === 'all' ? CHECK : groupState(ungrouped.map(v => v.id)) === 'some' ? DASH : null}
                        </div>
                        <span>Ungrouped ({ungrouped.length})</span>
                      </div>
                    )}
                    {ungrouped.map(v => <VehicleItem key={v.id} v={v} />)}
                  </div>
                )}

                {vehicles.length === 0 && (
                  <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No vehicles</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
