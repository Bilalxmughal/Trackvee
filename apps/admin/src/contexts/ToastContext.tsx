import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { IconCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

export type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; text: string; type: ToastType; }
interface ToastCtx { toast: (text: string, type?: ToastType) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });
let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = ++_id;
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const bg: Record<ToastType, string> = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  const Icon = ({ type }: { type: ToastType }) => {
    if (type === 'success') return <IconCheck size={15} />;
    if (type === 'error')   return <IconAlertCircle size={15} />;
    return <IconInfoCircle size={15} />;
  };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: bg[t.type], color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,.28)', animation: 'toastIn .22s ease', minWidth: 220, maxWidth: 360, pointerEvents: 'auto' }}>
            <Icon type={t.type} />
            {t.text}
          </div>
        ))}
        <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
