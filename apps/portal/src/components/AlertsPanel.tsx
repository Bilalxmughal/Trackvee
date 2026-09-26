import { useState, useEffect } from 'react';
import { IconBell, IconSearch, IconPlus, IconPencil, IconTrash, IconAlertTriangle, IconGauge } from '@tabler/icons-react';
import api from '../api/client';
import { usePortalPanel } from '../contexts/PortalPanelContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'over_speed' | 'idle' | 'ignition_on' | 'ignition_off'
  | 'power_cut' | 'low_battery' | 'no_gps' | 'offline'
  | 'tow' | 'over_parking' | 'geofence' | 'low_score';

export interface AlertConfig {
  speedLimit?: number; minutes?: number; level?: number;
  geofenceId?: string; geofenceEvent?: 'enter' | 'exit' | 'both';
  scoreThreshold?: number;
}

export interface AlertRecord {
  id: string; name: string; active: boolean; type: AlertType;
  config: AlertConfig; vehicleImeis: string[];
  createdAt?: string;
}

// Keep this export so MapPage can still use it for counting
export type AlertItem = AlertRecord;

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  over_speed: 'Over Speed', idle: 'Idle', ignition_on: 'Ignition ON',
  ignition_off: 'Ignition OFF', power_cut: 'Power Cut', low_battery: 'Low Battery',
  no_gps: 'No GPS', offline: 'Offline', tow: 'Tow Alert',
  over_parking: 'Over Parking', geofence: 'Geofence', low_score: 'Low Score',
};

const ALERT_TYPE_COLOR: Record<AlertType, string> = {
  over_speed: '#dc2626', idle: '#f59e0b', ignition_on: '#16a34a', ignition_off: '#6b7280',
  power_cut: '#7c3aed', low_battery: '#ea580c', no_gps: '#0284c7', offline: '#9ca3af',
  tow: '#be123c', over_parking: '#a16207', geofence: '#0891b2', low_score: '#e11d48',
};

const TYPES_WITH_SPEED: AlertType[] = ['over_speed'];
const TYPES_WITH_MINUTES: AlertType[] = ['idle', 'no_gps', 'offline', 'over_parking'];

// ── Helpers ────────────────────────────────────────────────────────────────────

const inpSt: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

// ── Alert Form Modal ────────────────────────────────────────────────────────────

function AlertFormModal({
  initial, devices, onSave, onClose,
}: {
  initial?: AlertRecord | null;
  devices: { imei: string; label: string }[];
  onSave: (r: AlertRecord) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AlertType>(initial?.type ?? 'over_speed');
  const [speedLimit, setSpeedLimit] = useState(initial?.config?.speedLimit ?? 80);
  const [minutes, setMinutes] = useState(initial?.config?.minutes ?? 10);
  const [level, setLevel] = useState(initial?.config?.level ?? 2);
  const [active, setActive] = useState(initial?.active ?? true);
  const [selectedImeis, setSelectedImeis] = useState<string[]>(initial?.vehicleImeis ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggleImei = (imei: string) => setSelectedImeis(p => p.includes(imei) ? p.filter(i => i !== imei) : [...p, imei]);
  const toggleAll = () => setSelectedImeis(p => p.length === devices.length ? [] : devices.map(d => d.imei));

  const buildConfig = (): AlertConfig => {
    if (TYPES_WITH_SPEED.includes(type)) return { speedLimit };
    if (TYPES_WITH_MINUTES.includes(type)) return { minutes };
    if (type === 'low_battery') return { level };
    return {};
  };

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    const payload = { name: name.trim(), type, config: buildConfig(), vehicleImeis: selectedImeis, active };
    try {
      let r: AlertRecord;
      if (initial?.id) {
        const res = await api.put<AlertRecord>(`/alerts/${initial.id}`, payload);
        r = res.data;
      } else {
        const res = await api.post<AlertRecord>('/alerts', payload);
        r = res.data;
      }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(440px, 97vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <IconBell size={15} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit Alert Rule' : 'New Alert Rule'}</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>Alert Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Speed Alert HiMax" style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>

          <div>
            <label style={LBL}>Alert Type</label>
            <select value={type} onChange={e => setType(e.target.value as AlertType)} style={{ ...inpSt, cursor: 'pointer' }}>
              {(Object.entries(ALERT_TYPE_LABELS) as [AlertType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {TYPES_WITH_SPEED.includes(type) && (
            <div>
              <label style={LBL}>Speed Limit (km/h)</label>
              <input type="number" value={speedLimit} onChange={e => setSpeedLimit(+e.target.value)} style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          )}

          {TYPES_WITH_MINUTES.includes(type) && (
            <div>
              <label style={LBL}>Duration (minutes)</label>
              <input type="number" value={minutes} onChange={e => setMinutes(+e.target.value)} style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          )}

          {type === 'low_battery' && (
            <div>
              <label style={LBL}>Battery Level Threshold (1–5)</label>
              <input type="number" min={1} max={5} value={level} onChange={e => setLevel(+e.target.value)} style={inpSt} onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          )}

          {devices.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...LBL, marginBottom: 0 }}>Vehicles ({selectedImeis.length}/{devices.length} selected)</label>
                <button onClick={toggleAll} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {selectedImeis.length === devices.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 7, overflow: 'hidden', maxHeight: 140, overflowY: 'auto' }}>
                {devices.map(d => {
                  const chk = selectedImeis.includes(d.imei);
                  return (
                    <div key={d.imei} onClick={() => toggleImei(d.imei)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: chk ? '#fff5f5' : '#fff' }}
                      onMouseEnter={e => { if (!chk) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                      onMouseLeave={e => { if (!chk) (e.currentTarget as HTMLElement).style.background = '#fff'; }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${chk ? '#dc2626' : '#d1d5db'}`, background: chk ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {chk && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1,6 4,9 11,2"/></svg>}
                      </div>
                      <span style={{ fontSize: 12, color: '#333' }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ ...LBL, marginBottom: 0 }}>Active</label>
            <button onClick={() => setActive(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: active ? '#dc2626' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}/>
            </button>
            <span style={{ fontSize: 11.5, color: '#666' }}>{active ? 'Enabled' : 'Disabled'}</span>
          </div>

          {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: saving ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function AlertsPanel({ alerts: initialAlerts, loading: initialLoading, setAlertList }: {
  alerts: AlertRecord[];
  loading: boolean;
  setAlertList?: (a: AlertRecord[]) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [alerts, setAlerts] = useState<AlertRecord[]>(initialAlerts);
  const [loading, setLoading] = useState(initialLoading);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ imei: string; label: string }[]>([]);

  useEffect(() => { setAlerts(initialAlerts); }, [initialAlerts]);
  useEffect(() => { setLoading(initialLoading); }, [initialLoading]);

  useEffect(() => {
    api.get<{ imei: string; displayId: number; vehicle?: { licensePlate?: string | null; displayId: number } | null }[]>('/devices')
      .then(r => setDevices(r.data.map(d => ({ imei: d.imei, label: d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}` }))))
      .catch(() => {});
  }, []);

  const filtered = q.trim() ? alerts.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || ALERT_TYPE_LABELS[a.type]?.toLowerCase().includes(q.toLowerCase())) : alerts;
  const activeCount = alerts.filter(a => a.active).length;

  const toggleActive = async (a: AlertRecord) => {
    const updated = { ...a, active: !a.active };
    setAlerts(p => p.map(x => x.id === a.id ? updated : x));
    setAlertList?.(alerts.map(x => x.id === a.id ? updated : x));
    try { await api.put(`/alerts/${a.id}`, { active: updated.active }); } catch { setAlerts(p => p.map(x => x.id === a.id ? a : x)); }
  };

  const onSave = (r: AlertRecord) => {
    const next = editing?.id ? alerts.map(x => x.id === r.id ? r : x) : [r, ...alerts];
    setAlerts(next);
    setAlertList?.(next);
    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/alerts/${id}`); const next = alerts.filter(a => a.id !== id); setAlerts(next); setAlertList?.(next); } catch {}
    setDeleting(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <IconBell size={13} color="#dc2626" strokeWidth={2} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>
          Alerts
          {activeCount > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, marginLeft: 5 }}>{activeCount}</span>}
        </span>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          <IconPlus size={10} strokeWidth={2.5} /> New
        </button>
        <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 6, padding: '4px 8px' }}>
          <IconSearch size={11} color="#bbb" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search alerts…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11.5, color: '#111', outline: 'none' }} />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <IconAlertTriangle size={28} color="#e5e7eb" strokeWidth={1.25} style={{ display: 'block', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : 'No alert rules yet'}</div>
          </div>
        ) : filtered.map(a => {
          const color = ALERT_TYPE_COLOR[a.type] ?? '#6b7280';
          return (
            <div key={a.id} style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', borderLeft: `3px solid ${a.active ? color : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: `${color}18`, color, padding: '1px 5px', borderRadius: 3 }}>{ALERT_TYPE_LABELS[a.type]}</span>
                  {a.vehicleImeis.length > 0 && <span style={{ fontSize: 9.5, color: '#bbb' }}>{a.vehicleImeis.length} vehicles</span>}
                </div>
              </div>
              {/* Active toggle */}
              <button onClick={() => toggleActive(a)} title={a.active ? 'Disable' : 'Enable'}
                style={{ width: 28, height: 16, borderRadius: 8, border: 'none', background: a.active ? '#dc2626' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 1.5, left: a.active ? 13 : 2, width: 13, height: 13, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}/>
              </button>
              {/* Edit */}
              <button onClick={() => { setEditing(a); setFormOpen(true); }}
                style={{ display: 'flex', padding: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#aaa', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#555'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; }}>
                <IconPencil size={12} />
              </button>
              {/* Delete */}
              <button onClick={() => setDeleting(a.id)}
                style={{ display: 'flex', padding: '3px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#aaa', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; }}>
                <IconTrash size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Form modal */}
      {formOpen && (
        <AlertFormModal
          initial={editing}
          devices={devices}
          onSave={onSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 280, boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Delete Alert Rule</div>
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 20 }}>This alert rule will be permanently deleted.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleting(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmDelete(deleting)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
