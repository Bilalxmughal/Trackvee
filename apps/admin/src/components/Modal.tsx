import { useEffect, ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export default function Modal({ open, title, onClose, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden', maxWidth: 'calc(100vw - 32px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#555')}
            onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
            <IconX size={16} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}
