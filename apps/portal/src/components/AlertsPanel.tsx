import React, { useState, useEffect } from 'react';
import { IconBell, IconSearch, IconPlus, IconAlertTriangle, IconGauge, IconBolt,
  IconPower, IconEngine, IconBattery, IconSignalE, IconMapPin, IconStar,
  IconCar, IconParking, IconChevronRight, IconChevronLeft, IconCheck } from '@tabler/icons-react';
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

export type AlertItem = AlertRecord;

// ── Alert type definitions ─────────────────────────────────────────────────────

const ALERT_TYPES: { type: AlertType; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { type: 'over_speed',   label: 'Over Speed',    icon: <IconGauge size={22} strokeWidth={1.5}/>,   color: '#dc2626', desc: 'Alert when vehicle exceeds speed limit' },
  { type: 'idle',         label: 'Idle',           icon: <IconEngine size={22} strokeWidth={1.5}/>,  color: '#f59e0b', desc: 'Alert when engine idle too long' },
  { type: 'ignition_on',  label: 'Ignition ON',   icon: <IconPower size={22} strokeWidth={1.5}/>,   color: '#16a34a', desc: 'Alert when ignition turns on' },
  { type: 'ignition_off', label: 'Ignition OFF',  icon: <IconPower size={22} strokeWidth={1.5}/>,   color: '#6b7280', desc: 'Alert when ignition turns off' },
  { type: 'power_cut',    label: 'Power Cut',     icon: <IconBolt size={22} strokeWidth={1.5}/>,    color: '#7c3aed', desc: 'Alert on external power disconnection' },
  { type: 'low_battery',  label: 'Low Battery',   icon: <IconBattery size={22} strokeWidth={1.5}/>, color: '#ea580c', desc: 'Alert when internal battery is low' },
  { type: 'no_gps',       label: 'No GPS',        icon: <IconSignalE size={22} strokeWidth={1.5}/>,  color: '#0284c7', desc: 'Alert when GPS signal is lost' },
  { type: 'offline',      label: 'Offline',       icon: <IconSignalE size={22} strokeWidth={1.5}/>,  color: '#9ca3af', desc: 'Alert when vehicle goes offline' },
  { type: 'tow',          label: 'Tow Alert',     icon: <IconCar size={22} strokeWidth={1.5}/>,     color: '#be123c', desc: 'Alert when vehicle moves without ignition' },
  { type: 'over_parking', label: 'Over Parking',  icon: <IconParking size={22} strokeWidth={1.5}/>, color: '#a16207', desc: 'Alert when parked too long' },
  { type: 'geofence',     label: 'Geofence',      icon: <IconMapPin size={22} strokeWidth={1.5}/>,  color: '#0891b2', desc: 'Alert on geofence enter/exit' },
  { type: 'low_score',    label: 'Low Score',     icon: <IconStar size={22} strokeWidth={1.5}/>,    color: '#e11d48', desc: 'Alert when behavior score drops' },
];

const ALERT_TYPE_MAP = Object.fromEntries(ALERT_TYPES.map(t => [t.type, t])) as Record<AlertType, typeof ALERT_TYPES[0]>;

const TYPES_WITH_SPEED: AlertType[] = ['over_speed'];
const TYPES_WITH_MINUTES: AlertType[] = ['idle', 'no_gps', 'offline', 'over_parking'];

// ── Helpers ────────────────────────────────────────────────────────────────────

const inpSt: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${active ? '#dc2626' : done ? '#dc2626' : '#d1d5db'}`, background: done ? '#dc2626' : active ? '#fff5f5' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: active ? '#dc2626' : done ? '#fff' : '#9ca3af' }}>
        {done ? <IconCheck size={11} strokeWidth={3}/> : n}
      </div>
    </div>
  );
}

function DotMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 2, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: open ? '#dc2626' : '#9ca3af', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor"><circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6.5" r="1.5"/><circle cx="1.5" cy="11.5" r="1.5"/></svg>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.18)', minWidth: 120, overflow: 'hidden' }}>
          {[{ label: 'Edit', action: onEdit, red: false }, { label: 'Delete', action: onDelete, red: true }].map(it => (
            <button key={it.label} onClick={() => { it.action(); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', color: it.red ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── 3-Step Wizard Form ─────────────────────────────────────────────────────────

function AlertFormWizard({
  initial, devices, groups, onSave, onClose,
}: {
  initial?: AlertRecord | null;
  devices: { imei: string; label: string }[];
  groups: { id: string; name: string; imeis: string[] }[];
  onSave: (r: AlertRecord) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  // Step 1
  const [name, setName] = useState(initial?.name ?? '');
  const [selectedImeis, setSelectedImeis] = useState<string[]>(initial?.vehicleImeis ?? []);
  // Step 2
  const [type, setType] = useState<AlertType>(initial?.type ?? 'over_speed');
  const [speedLimit, setSpeedLimit] = useState(initial?.config?.speedLimit ?? 80);
  const [minutes, setMinutes] = useState(initial?.config?.minutes ?? 10);
  const [level, setLevel] = useState(initial?.config?.level ?? 2);
  const [active, setActive] = useState(initial?.active ?? true);
  // Step 3 (schedule - optional)
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const selectedType = ALERT_TYPE_MAP[type];

  const toggleImei = (imei: string) => setSelectedImeis(p => p.includes(imei) ? p.filter(i => i !== imei) : [...p, imei]);
  const toggleGroup = (imeis: string[]) => {
    const allSelected = imeis.every(i => selectedImeis.includes(i));
    if (allSelected) setSelectedImeis(p => p.filter(i => !imeis.includes(i)));
    else setSelectedImeis(p => [...new Set([...p, ...imeis])]);
  };

  const buildConfig = (): AlertConfig => {
    if (TYPES_WITH_SPEED.includes(type)) return { speedLimit };
    if (TYPES_WITH_MINUTES.includes(type)) return { minutes };
    if (type === 'low_battery') return { level };
    return {};
  };

  const submit = async () => {
    setSaving(true); setErr('');
    const payload = { name: name.trim(), type, config: buildConfig(), vehicleImeis: selectedImeis, active };
    try {
      let r: AlertRecord;
      if (initial?.id) {
        r = (await api.put<AlertRecord>(`/alerts/${initial.id}`, payload)).data;
      } else {
        r = (await api.post<AlertRecord>('/alerts', payload)).data;
      }
      onSave(r);
    } catch { setErr('Failed to save'); } finally { setSaving(false); }
  };

  const canNext1 = name.trim().length > 0;
  const canSubmit = name.trim().length > 0;

  const ungroupedImeis = devices.map(d => d.imei).filter(imei => !groups.some(g => g.imeis.includes(imei)));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 97vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <IconBell size={15} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>
            {initial?.id ? 'Edit Alert Rule' : 'New Alert Rule'}
          </span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Step indicators */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: '#fafafa' }}>
          <StepDot n={1} active={step === 1} done={step > 1} />
          <span style={{ fontSize: 11, color: step === 1 ? '#dc2626' : step > 1 ? '#16a34a' : '#9ca3af', fontWeight: step === 1 ? 700 : 500 }}>Vehicles</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 4px' }}/>
          <StepDot n={2} active={step === 2} done={step > 2} />
          <span style={{ fontSize: 11, color: step === 2 ? '#dc2626' : step > 2 ? '#16a34a' : '#9ca3af', fontWeight: step === 2 ? 700 : 500 }}>Alert Type</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 4px' }}/>
          <StepDot n={3} active={step === 3} done={false} />
          <span style={{ fontSize: 11, color: step === 3 ? '#dc2626' : '#9ca3af', fontWeight: step === 3 ? 700 : 500 }}>Settings</span>
        </div>

        {/* Step content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Step 1: Name + Vehicle selection */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={LBL}>Alert Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Speed Alert — Fleet A"
                  style={inpSt} autoFocus
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <label style={{ ...LBL, marginBottom: 0 }}>Vehicles</label>
                  <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>{selectedImeis.length}/{devices.length} selected</span>
                </div>
                {groups.length > 0 && groups.map(g => {
                  const gImeis = g.imeis.filter(i => devices.some(d => d.imei === i));
                  if (gImeis.length === 0) return null;
                  const allSel = gImeis.every(i => selectedImeis.includes(i));
                  return (
                    <div key={g.id} style={{ marginBottom: 6 }}>
                      <button onClick={() => toggleGroup(gImeis)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: allSel ? '#fff5f5' : '#f9fafb', cursor: 'pointer', marginBottom: 4, textAlign: 'left' }}>
                        <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${allSel ? '#dc2626' : '#d1d5db'}`, background: allSel ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {allSel && <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1,6 4,9 11,2"/></svg>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{g.name}</span>
                        <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>{gImeis.length} vehicles</span>
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, paddingLeft: 8 }}>
                        {gImeis.map(imei => {
                          const d = devices.find(x => x.imei === imei)!;
                          const chk = selectedImeis.includes(imei);
                          return (
                            <label key={imei} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', cursor: 'pointer', borderRadius: 4, background: chk ? '#fff5f5' : 'transparent' }}>
                              <input type="checkbox" checked={chk} onChange={() => toggleImei(imei)} style={{ flexShrink: 0, accentColor: '#dc2626', cursor: 'pointer' }}/>
                              <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chk ? '#dc2626' : '#333' }}>{d?.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {ungroupedImeis.length > 0 && (
                  <div>
                    {groups.length > 0 && <div style={{ fontSize: 10, color: '#bbb', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Ungrouped</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
                      {ungroupedImeis.map(imei => {
                        const d = devices.find(x => x.imei === imei)!;
                        const chk = selectedImeis.includes(imei);
                        return (
                          <label key={imei} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', cursor: 'pointer', borderRadius: 4, background: chk ? '#fff5f5' : 'transparent' }}>
                            <input type="checkbox" checked={chk} onChange={() => toggleImei(imei)} style={{ flexShrink: 0, accentColor: '#dc2626', cursor: 'pointer' }}/>
                            <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chk ? '#dc2626' : '#333' }}>{d?.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {devices.length === 0 && <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: '#bbb' }}>No vehicles available</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => setSelectedImeis(devices.map(d => d.imei))} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 4px' }}>Select all</button>
                  <button onClick={() => setSelectedImeis([])} style={{ fontSize: 10, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Alert type selection */}
          {step === 2 && (
            <div>
              <label style={LBL}>Select Alert Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {ALERT_TYPES.map(at => {
                  const sel = type === at.type;
                  return (
                    <button key={at.type} onClick={() => setType(at.type)} style={{
                      padding: '10px 8px', borderRadius: 8, border: `2px solid ${sel ? at.color : '#e5e7eb'}`,
                      background: sel ? `${at.color}12` : '#fafafa', cursor: 'pointer', textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ color: sel ? at.color : '#9ca3af' }}>{at.icon}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: sel ? at.color : '#555', lineHeight: 1.2 }}>{at.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Type-specific config */}
              {TYPES_WITH_SPEED.includes(type) && (
                <div style={{ marginTop: 14 }}>
                  <label style={LBL}>Speed Limit (km/h)</label>
                  <input type="number" value={speedLimit} onChange={e => setSpeedLimit(+e.target.value)} style={inpSt}
                    onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                </div>
              )}
              {TYPES_WITH_MINUTES.includes(type) && (
                <div style={{ marginTop: 14 }}>
                  <label style={LBL}>Duration (minutes)</label>
                  <input type="number" value={minutes} onChange={e => setMinutes(+e.target.value)} style={inpSt}
                    onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                </div>
              )}
              {type === 'low_battery' && (
                <div style={{ marginTop: 14 }}>
                  <label style={LBL}>Battery Level Threshold (1–5)</label>
                  <input type="number" min={1} max={5} value={level} onChange={e => setLevel(+e.target.value)} style={inpSt}
                    onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                </div>
              )}
              {selectedType && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: `${selectedType.color}0d`, borderRadius: 7, border: `1px solid ${selectedType.color}30`, fontSize: 11, color: '#555' }}>
                  {selectedType.desc}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={LBL}>Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setActive(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: active ? '#dc2626' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}/>
                  </button>
                  <span style={{ fontSize: 12, color: '#555' }}>{active ? 'Enabled — alert rule is active' : 'Disabled — alert rule is paused'}</span>
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 8 }}>Summary</div>
                <div style={{ fontSize: 11.5, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><span style={{ color: '#9ca3af' }}>Name:</span> {name || '—'}</div>
                  <div><span style={{ color: '#9ca3af' }}>Type:</span> {ALERT_TYPE_MAP[type]?.label}</div>
                  <div><span style={{ color: '#9ca3af' }}>Vehicles:</span> {selectedImeis.length === 0 ? 'All vehicles' : `${selectedImeis.length} selected`}</div>
                  {TYPES_WITH_SPEED.includes(type) && <div><span style={{ color: '#9ca3af' }}>Speed limit:</span> {speedLimit} km/h</div>}
                  {TYPES_WITH_MINUTES.includes(type) && <div><span style={{ color: '#9ca3af' }}>Duration:</span> {minutes} min</div>}
                </div>
              </div>
              {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>
            <IconChevronLeft size={13} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !canNext1}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 6, border: 'none', background: step === 1 && !canNext1 ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: step === 1 && !canNext1 ? 'not-allowed' : 'pointer' }}>
              Next <IconChevronRight size={13} />
            </button>
          ) : (
            <button onClick={submit} disabled={saving || !canSubmit}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: saving || !canSubmit ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving || !canSubmit ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create Alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'inactive';

export default function AlertsPanel({ alerts: initialAlerts, loading: initialLoading, setAlertList }: {
  alerts: AlertRecord[];
  loading: boolean;
  setAlertList?: (a: AlertRecord[]) => void;
}) {
  const { closePanel } = usePortalPanel();
  const [alerts, setAlerts] = useState<AlertRecord[]>(initialAlerts);
  const [loading, setLoading] = useState(initialLoading);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ imei: string; label: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; imeis: string[] }[]>([]);

  useEffect(() => { setAlerts(initialAlerts); }, [initialAlerts]);
  useEffect(() => { setLoading(initialLoading); }, [initialLoading]);

  useEffect(() => {
    api.get<{ imei: string; displayId: number; vehicle?: { licensePlate?: string | null; displayId: number } | null }[]>('/devices')
      .then(r => setDevices(r.data.map(d => ({ imei: d.imei, label: d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}` }))))
      .catch(() => {});
    // Load vehicle groups
    const stored = localStorage.getItem('yotrack_map_groups_v1');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setGroups(parsed);
      } catch {}
    }
    api.get<{ id: string; name: string; vehicleIds: string[] }[]>('/vehicle-groups').then(r => {
      // We need to map vehicleIds to imeis - will build from devices later
      // Store raw groups for now; mapping happens in wizard via devices
    }).catch(() => {});
  }, []);

  const allCount = alerts.length;
  const activeCount = alerts.filter(a => a.active).length;
  const inactiveCount = alerts.filter(a => !a.active).length;

  const tabFiltered = tab === 'all' ? alerts : tab === 'active' ? alerts.filter(a => a.active) : alerts.filter(a => !a.active);
  const filtered = q.trim() ? tabFiltered.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || ALERT_TYPE_MAP[a.type]?.label.toLowerCase().includes(q.toLowerCase())) : tabFiltered;

  const syncAlerts = (next: AlertRecord[]) => { setAlerts(next); setAlertList?.(next); };

  const toggleActive = async (a: AlertRecord) => {
    const updated = { ...a, active: !a.active };
    syncAlerts(alerts.map(x => x.id === a.id ? updated : x));
    try { await api.put(`/alerts/${a.id}`, { active: updated.active }); } catch { syncAlerts(alerts); }
  };

  const onSave = (r: AlertRecord) => {
    const next = editing?.id ? alerts.map(x => x.id === r.id ? r : x) : [r, ...alerts];
    syncAlerts(next);
    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/alerts/${id}`); syncAlerts(alerts.filter(a => a.id !== id)); } catch {}
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

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        {([['all', 'All', allCount], ['active', 'Active', activeCount], ['inactive', 'Inactive', inactiveCount]] as [FilterTab, string, number][]).map(([t, l, c]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '7px 4px', border: 'none', background: 'transparent', fontSize: 11, fontWeight: tab === t ? 700 : 400, color: tab === t ? '#dc2626' : '#666', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? '#dc2626' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {l}
            {c > 0 && <span style={{ fontSize: 9, background: tab === t ? '#dc2626' : '#e5e7eb', color: tab === t ? '#fff' : '#666', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>{c}</span>}
          </button>
        ))}
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
            <div style={{ fontSize: 11.5, color: '#bbb' }}>{q ? 'No results' : tab === 'active' ? 'No active alerts' : tab === 'inactive' ? 'No inactive alerts' : 'No alert rules yet'}</div>
          </div>
        ) : filtered.map(a => {
          const at = ALERT_TYPE_MAP[a.type];
          const color = at?.color ?? '#6b7280';
          return (
            <div key={a.id} style={{ padding: '9px 12px', borderBottom: '1px solid #f7f7f7', borderLeft: `3px solid ${a.active ? color : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: a.active ? color : '#d1d5db', flexShrink: 0, display: 'flex' }}>
                {at?.icon && React.cloneElement(at.icon as React.ReactElement, { size: 16, strokeWidth: 1.75 })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: `${color}18`, color, padding: '1px 5px', borderRadius: 3 }}>{at?.label}</span>
                  {a.vehicleImeis.length > 0 && <span style={{ fontSize: 9.5, color: '#bbb' }}>{a.vehicleImeis.length} vehicles</span>}
                </div>
              </div>
              <button onClick={() => toggleActive(a)} title={a.active ? 'Disable' : 'Enable'}
                style={{ width: 28, height: 16, borderRadius: 8, border: 'none', background: a.active ? '#dc2626' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 1.5, left: a.active ? 13 : 2, width: 13, height: 13, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}/>
              </button>
              <DotMenu onEdit={() => { setEditing(a); setFormOpen(true); }} onDelete={() => setDeleting(a.id)} />
            </div>
          );
        })}
      </div>

      {/* Wizard form */}
      {formOpen && (
        <AlertFormWizard
          initial={editing}
          devices={devices}
          groups={groups}
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
