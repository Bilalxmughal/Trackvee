import { useState, useRef, useEffect } from 'react';

export interface VehicleOption { id: string; name: string; licensePlate: string | null; make?: string | null; model?: string | null; }
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
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const groupedIds = new Set(groups.flatMap(g => g.vehicleIds));
  const ungrouped = vehicles.filter(v => !groupedIds.has(v.id));

  const vName = (v: VehicleOption) => [v.make, v.model].filter(Boolean).join(' ') || v.name;
  const matchV = (v: VehicleOption) =>
    vName(v).toLowerCase().includes(q.toLowerCase()) ||
    (v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase());

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  const toggleAll = () =>
    onChange(selected.length === vehicles.length ? [] : vehicles.map(v => v.id));

  const toggleGroup = (vIds: string[]) => {
    const valid = vIds.filter(id => vehicles.some(v => v.id === id));
    const allSel = valid.every(id => selected.includes(id));
    if (allSel) onChange(selected.filter(id => !valid.includes(id)));
    else onChange([...new Set([...selected, ...valid])]);
  };

  const groupState = (vIds: string[]): 'all' | 'some' | 'none' => {
    const valid = vIds.filter(id => vehicles.some(v => v.id === id));
    const n = valid.filter(id => selected.includes(id)).length;
    return n === 0 ? 'none' : n === valid.length ? 'all' : 'some';
  };

  const allState: 'all' | 'some' | 'none' =
    selected.length === 0 ? 'none' : selected.length === vehicles.length ? 'all' : 'some';

  const label =
    selected.length === 0 ? placeholder :
    selected.length === 1 ? (() => { const v = vehicles.find(v => v.id === selected[0]); return v ? (v.licensePlate ?? v.name) : '1 vehicle'; })() :
    `${selected.length} vehicles selected`;

  const cb = (state: 'all' | 'some' | 'none'): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: 2, flexShrink: 0,
    border: `2px solid ${state !== 'none' ? '#dc2626' : '#d1d5db'}`,
    background: state !== 'none' ? '#dc2626' : 'transparent',
    display: 'grid', placeItems: 'center',
  });

  const itemSt = (sel: boolean, indent = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#333',
    padding: indent ? '5px 10px 5px 26px' : '5px 10px',
    background: sel ? 'rgba(220,38,38,0.05)' : 'transparent',
  });

  const groupSt: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    color: '#9ca3af', background: '#f9fafb',
    borderTop: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  const VehicleItem = ({ v }: { v: VehicleOption }) => {
    const isSel = selected.includes(v.id);
    return (
      <div style={itemSt(isSel, groups.length > 0)} onClick={() => toggle(v.id)}
        onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
        onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        <div style={cb(isSel ? 'all' : 'none')}>{isSel && CHECK}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.licensePlate ?? v.name}</div>
          {vName(v) && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{vName(v)}</div>}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 200, userSelect: 'none' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        padding: '6px 10px', border: `1px solid ${open ? '#dc2626' : '#e5e7eb'}`, borderRadius: 6,
        background: '#fff', cursor: 'pointer', fontSize: 12,
        color: selected.length ? '#111' : '#9ca3af', width: '100%', outline: 'none',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected.length > 0 && (
            <span onClick={e => { e.stopPropagation(); onChange([]); }} style={{ color: '#9ca3af', lineHeight: 1, display: 'flex' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }}>
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, zIndex: 9999,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.14)', minWidth: 240, maxHeight: 300,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, position: 'relative' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search vehicles..."
              style={{ width: '100%', height: 26, padding: '0 8px 0 26px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 12, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }} />
          </div>

          {/* Select All */}
          <div style={{ ...itemSt(allState !== 'none'), borderBottom: '1px solid #f0f0f0', flexShrink: 0 }} onClick={toggleAll}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = allState !== 'none' ? 'rgba(220,38,38,0.05)' : 'transparent'; }}>
            <div style={cb(allState)}>{allState === 'all' ? CHECK : allState === 'some' ? DASH : null}</div>
            <span style={{ fontWeight: 600, fontSize: 12 }}>
              {allState === 'all' ? `Deselect All (${vehicles.length})` : `Select All (${vehicles.length})`}
            </span>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {q ? (
              vehicles.filter(matchV).length === 0
                ? <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>No vehicles found</div>
                : vehicles.filter(matchV).map(v => <VehicleItem key={v.id} v={v} />)
            ) : (
              <>
                {groups.map(g => {
                  const gv = g.vehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean) as VehicleOption[];
                  if (!gv.length) return null;
                  const state = groupState(g.vehicleIds);
                  return (
                    <div key={g.id}>
                      <div style={groupSt} onClick={() => toggleGroup(g.vehicleIds)}>
                        <div style={cb(state)}>{state === 'all' ? CHECK : state === 'some' ? DASH : null}</div>
                        <span>{g.name} ({gv.length})</span>
                      </div>
                      {gv.map(v => <VehicleItem key={v.id} v={v} />)}
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <div>
                    {groups.length > 0 && (
                      <div style={groupSt} onClick={() => toggleGroup(ungrouped.map(v => v.id))}>
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
                  <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>No vehicles</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
