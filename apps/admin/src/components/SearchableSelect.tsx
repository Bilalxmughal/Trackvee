import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';

export interface SelectOption { value: string; label: string; }

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  style?: React.CSSProperties;
}

export default function SearchableSelect({ value, onChange, options, placeholder = 'Select…', emptyLabel = 'None', style }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ('');
  }, [open]);

  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()));

  const triggerStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', border: `1px solid ${open ? '#dc2626' : '#e8e8e8'}`,
    borderRadius: 6, fontSize: 13, color: selected ? '#111' : '#aaa',
    background: '#fff', cursor: 'pointer', outline: 'none', textAlign: 'left',
    boxSizing: 'border-box',
    boxShadow: open ? '0 0 0 3px rgba(220,38,38,0.1)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    ...style,
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={triggerStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <IconChevronDown size={13} style={{ color: '#bbb', flexShrink: 0, marginLeft: 6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 600,
          background: '#fff', border: '1px solid #ebebeb', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)', overflow: 'hidden',
        }}>
          {options.length > 5 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconSearch size={12} style={{ color: '#ccc', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search…"
                style={{ border: 'none', outline: 'none', fontSize: 12.5, color: '#111', background: 'none', flex: 1, minWidth: 0 }}
              />
              {q && <button type="button" onClick={() => setQ('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex' }}><IconX size={11} /></button>}
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ width: '100%', padding: '9px 12px', border: 'none', background: value === '' ? 'rgba(220,38,38,0.06)' : 'none', color: value === '' ? '#dc2626' : '#aaa', fontSize: 12.5, textAlign: 'left', cursor: 'pointer' }}
              onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = '#f8f8f8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = value === '' ? 'rgba(220,38,38,0.06)' : 'none'; }}
            >
              {emptyLabel}
            </button>
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ width: '100%', padding: '9px 12px', border: 'none', background: value === o.value ? 'rgba(220,38,38,0.06)' : 'none', color: value === o.value ? '#dc2626' : '#333', fontSize: 12.5, textAlign: 'left', cursor: 'pointer', fontWeight: value === o.value ? 600 : 400 }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = '#f8f8f8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = value === o.value ? 'rgba(220,38,38,0.06)' : 'none'; }}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
