import { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';

export interface VehicleOption { id: string; name: string; licensePlate: string | null; }

interface Props {
  vehicles: VehicleOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export default function VehicleMultiSelect({ vehicles, selected, onChange, placeholder = 'Select vehicles' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = vehicles.filter(v =>
    v.name.toLowerCase().includes(q.toLowerCase()) ||
    (v.licensePlate ?? '').toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const toggleAll = () => {
    onChange(selected.length === vehicles.length ? [] : vehicles.map(v => v.id));
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? (vehicles.find(v => v.id === selected[0])?.name ?? '1 vehicle')
    : `${selected.length} vehicles selected`;

  const wrap: React.CSSProperties = {
    position: 'relative', minWidth: 220, userSelect: 'none',
  };
  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
    borderRadius: 3, background: 'var(--input-bg)', cursor: 'pointer',
    fontSize: 12, color: selected.length ? 'var(--input-color)' : 'var(--text-muted)',
    width: '100%',
  };
  const drop: React.CSSProperties = {
    position: 'absolute', top: 33, left: 0, right: 0, zIndex: 300,
    background: 'var(--card-bg)', border: '1px solid var(--input-border)',
    borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 240, maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  };
  const srchWrap: React.CSSProperties = {
    padding: '6px 8px', borderBottom: '1px solid var(--input-border)', flexShrink: 0, position: 'relative',
  };
  const srchInp: React.CSSProperties = {
    width: '100%', height: 26, padding: '0 8px 0 26px', border: '1px solid var(--input-border)',
    borderRadius: 3, fontSize: 12, outline: 'none', background: 'var(--input-bg)', color: 'var(--input-color)',
  };
  const list: React.CSSProperties = {
    overflowY: 'auto', flex: 1,
  };
  const item = (sel: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
    fontSize: 12, color: 'var(--text)',
    background: sel ? 'rgba(220,38,38,0.06)' : 'transparent',
  });
  const checkbox = (sel: boolean): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: 2, border: `2px solid ${sel ? '#dc2626' : 'var(--input-border)'}`,
    background: sel ? '#dc2626' : 'transparent', flexShrink: 0,
    display: 'grid', placeItems: 'center',
  });

  return (
    <div ref={ref} style={wrap}>
      <button type="button" style={btn} onClick={() => setOpen(o => !o)}>
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
          <div style={srchWrap}>
            <IconSearch size={13} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input autoFocus style={srchInp} placeholder="Search vehicles..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={list}>
            {/* Select All */}
            <div style={{ ...item(selected.length === vehicles.length), borderBottom: '1px solid var(--input-border)' }} onClick={toggleAll}>
              <div style={checkbox(selected.length === vehicles.length)}>
                {selected.length === vehicles.length && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Select All ({vehicles.length})</span>
            </div>
            {filtered.map(v => {
              const sel = selected.includes(v.id);
              return (
                <div key={v.id} style={item(sel)} onClick={() => toggle(v.id)}>
                  <div style={checkbox(sel)}>
                    {sel && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                  </div>
                  <div>
                    <div>{v.name}</div>
                    {v.licensePlate && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.licensePlate}</div>}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No vehicles found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
