import { useState } from 'react';
import { IconBolt, IconBoltOff, IconX, IconSearch, IconLoader2, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import api from '../api/client';

interface LivePoint {
  imei: string;
  licensePlate?: string | null;
  vehicleName?: string | null;
  immobilizer?: boolean | null;
}

interface Props {
  onClose: () => void;
  livePoints: LivePoint[];
}

interface ConfirmState { point: LivePoint; action: 'immobilize' | 'activate'; }

function ConfirmDialog({ point, action, onClose, onSuccess }: {
  point: LivePoint; action: 'immobilize' | 'activate';
  onClose: () => void; onSuccess: (imei: string, immobilized: boolean) => void;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const last4 = point.imei.slice(-4);

  const confirm = async () => {
    if (input !== last4) { setError('Incorrect — please try again'); return; }
    setSending(true); setError('');
    try {
      await api.post(`/devices/${point.imei}/command`, { action });
      onSuccess(point.imei, action === 'immobilize');
      onClose();
    } catch { setError('Server error'); } finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 300, boxShadow: '0 16px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: action === 'immobilize' ? '#dc2626' : '#16a34a', marginBottom: 6 }}>
          {action === 'immobilize' ? 'Engine Cut Confirm' : 'Engine Restore Confirm'}
        </div>
        <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>
          Vehicle: <strong style={{ color: '#111' }}>{point.licensePlate || point.vehicleName || point.imei}</strong><br />
          IMEI: <span style={{ fontFamily: 'monospace' }}>{point.imei}</span>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>
          Enter last 4 digits of IMEI:
        </label>
        <input value={input} onChange={e => { setInput(e.target.value); setError(''); }} maxLength={4} autoFocus
          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: 4 }} />
        {error && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: '1px solid #d1d5db', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#555' }}>Cancel</button>
          <button onClick={() => { void confirm(); }} disabled={sending || input.length < 4}
            style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: action === 'immobilize' ? '#dc2626' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (sending || input.length < 4) ? 0.6 : 1 }}>
            {sending ? 'Sending…' : action === 'immobilize' ? 'Cut Engine' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommandCenterPanel({ onClose, livePoints }: Props) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuccess = (imei: string, immobilized: boolean) => {
    setOverrides(o => ({ ...o, [imei]: immobilized }));
    showToast(immobilized ? 'Engine cut sent' : 'Engine restore sent', true);
  };

  const filtered = livePoints.filter(p => {
    const term = query.toLowerCase();
    if (!term) return true;
    return [p.licensePlate ?? '', p.vehicleName ?? '', p.imei].some(s => s.toLowerCase().includes(term));
  });

  return (
    <>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconBolt size={16} color="#dc2626" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111' }}>Command Center</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2 }}>
          <IconX size={16} />
        </button>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 7, padding: '5px 9px' }}>
          <IconSearch size={14} color="#9ca3af" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicle or IMEI…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, color: '#333' }} />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}><IconX size={13} /></button>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>No vehicles found</div>
        ) : filtered.map(pt => {
          const immobilized = pt.imei in overrides ? overrides[pt.imei]! : !!pt.immobilizer;
          return (
            <div key={pt.imei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pt.licensePlate || pt.vehicleName || pt.imei}
                </div>
                <div style={{ fontSize: 10.5, color: '#9ca3af', fontFamily: 'monospace' }}>{pt.imei}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: immobilized ? '#fef2f2' : '#f0fdf4', color: immobilized ? '#dc2626' : '#16a34a' }}>
                  {immobilized ? 'Cut' : 'Active'}
                </span>
                <button onClick={() => setConfirm({ point: pt, action: immobilized ? 'activate' : 'immobilize' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: 'none', background: immobilized ? '#f0fdf4' : '#fef2f2', color: immobilized ? '#16a34a' : '#dc2626', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {immobilized ? <><IconBolt size={12} /> Restore</> : <><IconBoltOff size={12} /> Cut</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
          {toast.ok ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          point={confirm.point}
          action={confirm.action}
          onClose={() => setConfirm(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
