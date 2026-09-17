import { useEffect, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const PRESETS = [
  { label: 'Today', apply: () => { const d = new Date(); return { from: d, to: d }; } },
  { label: 'This Week', apply: () => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const from = new Date(now); from.setDate(now.getDate() - day); from.setHours(0,0,0,0);
    const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
    return { from, to };
  }},
  { label: 'This Month', apply: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from, to };
  }},
  { label: 'Last 30 days', apply: () => {
    const to = new Date();
    const from = new Date(); from.setDate(to.getDate() - 29);
    return { from, to };
  }},
];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthCells(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmtDate(d: Date) {
  return format(d, 'd MMM yyyy');
}

function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}

function dateToISO(d: Date) {
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthLabel(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function DateRangePicker({ value, onChange, placeholder = 'Pick a date range' }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [, tick] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false); setDraft(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setDraft(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const fromISO = value?.from ? dateToISO(value.from) : null;
  const toISO2 = value?.to ? dateToISO(value.to) : null;

  const label = value?.from
    ? (value.to && value.to !== value.from ? `${fmtDate(value.from)} – ${fmtDate(value.to)}` : fmtDate(value.from))
    : placeholder;

  const goMonth = (delta: number) => {
    let m = viewM + delta, y = viewY;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  };

  const pickDay = (iso: string) => {
    if (!draft) { setDraft(iso); return; }
    const [a, b] = draft <= iso ? [draft, iso] : [iso, draft];
    onChange({ from: new Date(a + 'T00:00:00'), to: new Date(b + 'T00:00:00') });
    setDraft(null); setOpen(false);
  };

  const inRange = (iso: string) => {
    const lo = draft || fromISO;
    const hi = draft ? (hoverRef.current ?? null) : toISO2;
    if (!lo || !hi) return false;
    const [start, end] = lo <= hi ? [lo, hi] : [hi, lo];
    return iso >= start && iso <= end;
  };

  const nextM = viewM === 11 ? 0 : viewM + 1;
  const nextY = viewM === 11 ? viewY + 1 : viewY;
  const today = todayISO();

  const renderMonth = (y: number, m: number) => (
    <div key={`${y}-${m}`}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', textAlign: 'center', marginBottom: 8 }}>
        {monthLabel(y, m)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map(w => (
          <span key={w} style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textAlign: 'center' }}>{w}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gridAutoRows: 30, gap: 2 }}>
        {monthCells(y, m).map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toISO(y, m, d);
          const isFrom = iso === (draft || fromISO);
          const isTo = !draft && iso === toISO2;
          const sel = isFrom || isTo;
          const between = !sel && inRange(iso);
          const isToday = iso === today;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pickDay(iso)}
              onMouseEnter={() => { if (draft) { hoverRef.current = iso; tick(t => t + 1); } }}
              style={{
                display: 'grid', placeItems: 'center', border: 0,
                borderRadius: sel ? 5 : (between ? 0 : 5),
                background: sel ? '#dc2626' : between ? 'rgba(220,38,38,0.1)' : 'none',
                color: sel ? '#fff' : isToday ? '#dc2626' : '#1a1a1a',
                fontWeight: sel ? 700 : isToday ? 700 : 400,
                fontSize: 12, cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseLeave={e => {
                if (!sel && !between) e.currentTarget.style.background = 'none';
              }}
              onMouseOver={e => {
                if (!sel && !between) e.currentTarget.style.background = '#f5f5f5';
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 34,
          padding: '0 12px', border: `1px solid ${open ? '#dc2626' : '#e8e8e8'}`,
          borderRadius: 5, background: '#fff',
          color: open ? '#dc2626' : value?.from ? '#1a1a1a' : '#aaa',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#dc2626';
          e.currentTarget.style.color = '#dc2626';
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = '#e8e8e8';
            e.currentTarget.style.color = value?.from ? '#1a1a1a' : '#aaa';
          }
        }}
      >
        <IconCalendar size={14} style={{ color: open ? '#dc2626' : '#ccc', flexShrink: 0 }} />
        {label}
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: 'calc(100% + 6px)', right: 0,
          display: 'flex', background: '#fff',
          border: '1px solid #e8e8e8', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)', overflow: 'hidden',
        }}>
          {/* Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 10, borderRight: '1px solid #f0f0f0', minWidth: 130 }}>
            {PRESETS.map(p => {
              const r = p.apply();
              const isActive = value?.from && dateToISO(value.from) === dateToISO(r.from) && value?.to && dateToISO(value.to) === dateToISO(r.to);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { onChange(r); setDraft(null); setOpen(false); }}
                  style={{
                    padding: '8px 10px', border: 0, borderRadius: 5, textAlign: 'left',
                    background: isActive ? 'rgba(220,38,38,0.08)' : 'none',
                    color: isActive ? '#dc2626' : '#555',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8f8f8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(220,38,38,0.08)' : 'none'; }}
                >
                  {p.label}
                </button>
              );
            })}
            {value?.from && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setDraft(null); setOpen(false); }}
                style={{ padding: '8px 10px', border: 0, borderRadius: 5, textAlign: 'left', background: 'none', color: '#bbb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.color = '#555'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#bbb'; }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Calendar */}
          <div style={{ padding: '10px 14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={() => goMonth(-1)} style={{ width: 28, height: 28, border: '1px solid #e8e8e8', borderRadius: 5, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#555' }}>
                <IconChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {draft ? 'Pick end date' : 'Pick start date'}
              </span>
              <button type="button" onClick={() => goMonth(1)} style={{ width: 28, height: 28, border: '1px solid #e8e8e8', borderRadius: 5, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#555' }}>
                <IconChevronRight size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 22 }}>
              {renderMonth(viewY, viewM)}
              {renderMonth(nextY, nextM)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
