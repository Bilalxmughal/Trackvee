import { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';
import { IconCalendar, IconX } from '@tabler/icons-react';

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

export default function DateRangePicker({ value, onChange, placeholder = 'Date range' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'dd MMM')} – ${format(value.to, 'dd MMM')}`
      : format(value.from, 'dd MMM yyyy')
    : placeholder;

  const hasValue = !!value?.from;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 30,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 10px',
          border: `1px solid ${open ? '#dc2626' : '#e8e8e8'}`,
          borderRadius: 3,
          background: '#fff',
          fontSize: 12,
          color: hasValue ? '#111' : '#bbb',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <IconCalendar size={13} style={{ color: hasValue ? '#dc2626' : '#ccc' }} />
        {label}
        {hasValue && (
          <span
            onClick={e => { e.stopPropagation(); onChange(undefined); }}
            style={{ marginLeft: 2, color: '#ccc', lineHeight: 1, cursor: 'pointer' }}
          >
            <IconX size={11} />
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 36,
          right: 0,
          zIndex: 300,
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: '8px',
        }}>
          <style>{`
            .rdp { --rdp-accent-color: #dc2626; --rdp-background-color: #fff5f5; font-size: 12px; margin: 0; }
            .rdp-day_selected { background: #dc2626 !important; }
            .rdp-day_range_middle { background: #fff5f5 !important; color: #111 !important; }
            .rdp-button:hover:not([disabled]) { background: #fff5f5; }
          `}</style>
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0', borderTop: '1px solid #f5f5f5', gap: 8 }}>
            <button
              onClick={() => { onChange(undefined); setOpen(false); }}
              style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ fontSize: 11, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 3, cursor: 'pointer', padding: '4px 12px' }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
