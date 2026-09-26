import { useEffect, ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string | number;
  height?: string | number;
}

export default function Modal({ open, title, onClose, children, width = 480, height }: Props) {
  const { dark } = useTheme();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width, height, background: dark ? '#1a1a1a' : '#fff', borderRadius: 10, boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.7)' : '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden', maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: dark ? '#555' : '#bbb', padding: 2, display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.color = dark ? '#aaa' : '#555')}
            onMouseLeave={e => (e.currentTarget.style.color = dark ? '#555' : '#bbb')}>
            <IconX size={16} />
          </button>
        </div>
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
