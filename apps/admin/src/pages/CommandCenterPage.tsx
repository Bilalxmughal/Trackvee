import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconRefresh, IconAlertTriangle, IconCheck, IconX,
  IconBolt, IconBoltOff, IconSearch, IconLoader2,
} from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { canAccessTopbar } from '../config/roles';
import type { UserRole } from '@yotrack/types';
import api from '../api/client';

interface VehicleCmd {
  id: string;
  displayId: number;
  licensePlate: string | null;
  name: string | null;
  imei: string | null;
  lastImmobilizer: boolean | null;
  lastSeen: string | null;
  status: string;
  orgName: string | null;
}

interface ConfirmState {
  vehicle: VehicleCmd;
  action: 'immobilize' | 'activate';
}

function ConfirmDialog({
  vehicle, action, onClose, onSuccess,
}: { vehicle: VehicleCmd; action: 'immobilize' | 'activate'; onClose: () => void; onSuccess: (vehicleId: string, immobilized: boolean) => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const last4 = vehicle.imei?.slice(-4) ?? '????';
  const [input, setInput] = useState('');

  const confirm = async () => {
    if (input !== last4) { setError('Incorrect last 4 digits of IMEI'); return; }
    setSending(true); setError('');
    try {
      await api.post(`/devices/${vehicle.imei}/command`, { action });
      onSuccess(vehicle.id, action === 'immobilize');
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Server error — command may not have been sent');
    } finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 320, boxShadow: '0 16px 50px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: action === 'immobilize' ? '#dc2626' : '#16a34a', marginBottom: 6 }}>
          {action === 'immobilize' ? '⚠️ Engine Cut Confirm' : '✅ Engine Restore Confirm'}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
          Vehicle: <strong style={{ color: '#111' }}>{vehicle.licensePlate || vehicle.name || `#${vehicle.displayId}`}</strong><br />
          IMEI: <span style={{ fontFamily: 'monospace' }}>{vehicle.imei ?? 'Unknown'}</span><br />
          Action: <strong style={{ color: action === 'immobilize' ? '#dc2626' : '#16a34a' }}>
            {action === 'immobilize' ? 'Cut Engine' : 'Restore Engine'}
          </strong>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>
            Enter last 4 digits of IMEI to confirm:
          </label>
          <input value={input} onChange={e => { setInput(e.target.value); setError(''); }} maxLength={4}
            placeholder={last4.replace(/./g, '•')} autoFocus
            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box' }} />
          {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={sending}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: '1px solid #d1d5db', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#555' }}>
            Cancel
          </button>
          <button onClick={() => { void confirm(); }} disabled={sending || input.length < 4}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', background: action === 'immobilize' ? '#dc2626' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (sending || input.length < 4) ? 0.6 : 1 }}>
            {sending ? 'Sending…' : action === 'immobilize' ? 'Cut Engine' : 'Restore Engine'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommandCenterPage() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const canUse = user?.role ? canAccessTopbar(user.role as UserRole, 'engine_cut') : false;

  const [vehicles, setVehicles] = useState<VehicleCmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await api.get<VehicleCmd[]>('/vehicles?includeDevice=true&limit=500');
      setVehicles(Array.isArray(r.data) ? r.data : (r.data as any).items ?? []);
    } catch {
      setError('Could not load vehicles.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSuccess = (vehicleId: string, immobilized: boolean) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, lastImmobilizer: immobilized } : v));
    showToast(immobilized ? 'Engine cut command sent' : 'Engine restore command sent', true);
  };

  const filtered = vehicles.filter(v => {
    const term = query.toLowerCase();
    if (!term) return true;
    return [v.licensePlate ?? '', v.name ?? '', v.imei ?? '', v.orgName ?? ''].some(s => s.toLowerCase().includes(term));
  });

  const bg = dark ? '#0d0d1a' : '#f8fafc';
  const card = { background: dark ? '#1e1e2e' : '#fff', border: `1px solid ${dark ? '#2d2d3d' : '#e5e7eb'}`, borderRadius: 10 };
  const cell = { padding: '11px 14px', fontSize: 12.5, color: dark ? '#d1d5db' : '#374151', borderBottom: `1px solid ${dark ? '#2d2d3d' : '#f3f4f6'}` };
  const th = { ...cell, fontWeight: 700, color: dark ? '#9ca3af' : '#6b7280', fontSize: 11, background: dark ? '#161622' : '#f9fafb', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ padding: '24px 28px', background: bg, minHeight: '100%' }}>
      <PageHeader
        title="Command Center"
        subtitle="Send engine cut / restore commands to fleet vehicles"
        actions={
          <button onClick={() => { void load(); }} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${dark ? '#3d3d4d' : '#d1d5db'}`, background: 'transparent', color: dark ? '#d1d5db' : '#374151', fontSize: 13, cursor: 'pointer' }}>
            <IconRefresh size={15} />
            Refresh
          </button>
        }
      />

      {!canUse && (
        <div style={{ padding: '14px 18px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 20, color: '#92400e', fontSize: 13 }}>
          Your role does not have permission to send engine commands.
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          <IconAlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><IconX size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Vehicles', value: vehicles.length, color: dark ? '#f3f4f6' : '#111' },
          { label: 'Engine Active', value: vehicles.filter(v => !v.lastImmobilizer).length, color: '#16a34a' },
          { label: 'Engine Cut', value: vehicles.filter(v => v.lastImmobilizer).length, color: '#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: '16px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{loading ? '—' : k.value}</div>
            <div style={{ fontSize: 11, color: dark ? '#9ca3af' : '#6b7280', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <IconSearch size={16} color={dark ? '#6b7280' : '#9ca3af'} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by plate, name, IMEI or organization…"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: dark ? '#f3f4f6' : '#111' }} />
        {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#6b7280' : '#9ca3af' }}><IconX size={14} /></button>}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Vehicle', 'Organization', 'IMEI', 'Engine Status', 'Last Seen', 'Action'].map(h => (
                  <th key={h} style={{ ...th, textAlign: h === 'Action' ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...cell, textAlign: 'center', padding: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: dark ? '#6b7280' : '#9ca3af' }}>
                    <IconLoader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading vehicles…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ ...cell, textAlign: 'center', padding: 40, color: dark ? '#6b7280' : '#9ca3af' }}>No vehicles found</td></tr>
              ) : filtered.map(v => {
                const isImmobilized = !!v.lastImmobilizer;
                const noImei = !v.imei;
                return (
                  <tr key={v.id}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600, color: dark ? '#f3f4f6' : '#111' }}>{v.licensePlate || `#${v.displayId}`}</div>
                      {v.name && v.licensePlate && <div style={{ fontSize: 11, color: dark ? '#9ca3af' : '#6b7280' }}>{v.name}</div>}
                    </td>
                    <td style={cell}>{v.orgName ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12 }}>{v.imei ?? <span style={{ color: dark ? '#6b7280' : '#9ca3af' }}>No device</span>}</td>
                    <td style={cell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, fontSize: 11.5, fontWeight: 700, background: isImmobilized ? '#fef2f2' : '#f0fdf4', color: isImmobilized ? '#dc2626' : '#16a34a' }}>
                        {isImmobilized ? <IconBoltOff size={12} /> : <IconBolt size={12} />}
                        {isImmobilized ? 'Engine Cut' : 'Active'}
                      </span>
                    </td>
                    <td style={{ ...cell, fontSize: 11.5, color: dark ? '#9ca3af' : '#6b7280' }}>
                      {v.lastSeen ? new Date(v.lastSeen).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {noImei ? <span style={{ fontSize: 11, color: dark ? '#6b7280' : '#9ca3af' }}>No device</span> : !canUse ? (
                        <span style={{ fontSize: 11, color: dark ? '#6b7280' : '#9ca3af' }}>No permission</span>
                      ) : sending[v.id] ? (
                        <IconLoader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <button
                          onClick={() => setConfirm({ vehicle: v, action: isImmobilized ? 'activate' : 'immobilize' })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: isImmobilized ? '#f0fdf4' : '#fef2f2', color: isImmobilized ? '#16a34a' : '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {isImmobilized ? <><IconBolt size={13} /> Restore</> : <><IconBoltOff size={13} /> Cut Engine</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          vehicle={confirm.vehicle}
          action={confirm.action}
          onClose={() => setConfirm(null)}
          onSuccess={handleSuccess}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 99999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast.ok ? <IconCheck size={15} /> : <IconAlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
