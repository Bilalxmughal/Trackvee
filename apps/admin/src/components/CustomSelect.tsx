import { useEffect, useRef, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

interface Option {
  value: string;
  label: string;
  isGroup?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  style?: React.CSSProperties;
  minWidth?: number;
}

export default function CustomSelect({ value, onChange, options, placeholder = 'Select...', style, minWidth }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: minWidth ?? 130, ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          height: 34, width: '100%', padding: '0 28px 0 10px',
          border: '1px solid var(--input-border)', borderRadius: 6,
          fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)',
          outline: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex',
          alignItems: 'center', position: 'relative', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {current?.label ?? <span style={{ color: 'var(--muted)' }}>{placeholder}</span>}
        </span>
        <IconChevronDown
          size={13}
          style={{
            position: 'absolute', right: 8, top: '50%',
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            color: 'var(--muted)', transition: 'transform 0.15s', flexShrink: 0,
          }}
        />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: '100%',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          zIndex: 500, maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map((o, i) => o.isGroup ? (
            <div
              key={`group-${i}`}
              style={{
                padding: '6px 12px 3px',
                fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: 0.6,
                borderTop: i > 0 ? '1px solid var(--border2)' : undefined,
                background: 'transparent', cursor: 'default',
              }}
            >
              {o.label}
            </div>
          ) : (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? 'rgba(220,38,38,.06)' : 'transparent'; }}
              style={{
                display: 'block', width: '100%', padding: '7px 12px 7px 20px',
                border: 0, borderBottom: '1px solid var(--border2)',
                background: o.value === value ? 'rgba(220,38,38,.06)' : 'transparent',
                color: o.value === value ? '#dc2626' : 'var(--text)',
                textAlign: 'left', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
