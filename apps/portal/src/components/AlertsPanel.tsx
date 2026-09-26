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
  | 'tow' | 'over_parking' | 'geofence' | 'low_score' | 'speed_zone';

export interface AlertConfig {
  speedLimit?: number; minutes?: number; level?: number;
  geofenceId?: string; geofenceEvent?: 'enter' | 'exit' | 'both';
  scoreThreshold?: number; speedZoneId?: string;
}

export interface AlertSchedule {
  from?: string; to?: string; days?: string[]; timeFrom?: string; timeTo?: string;
}

export interface AlertNotifications {
  appPush?: boolean; webPush?: boolean; webSound?: boolean; email?: boolean;
}

export interface AlertRecord {
  id: string; name: string; active: boolean; type: AlertType;
  config: AlertConfig; vehicleImeis: string[];
  schedule?: AlertSchedule | null; notifications?: AlertNotifications;
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
  { type: 'speed_zone',   label: 'Speed Zone',    icon: <IconGauge size={22} strokeWidth={1.5}/>,   color: '#f59e0b', desc: 'Alert when speeding inside a defined zone' },
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

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const;
const DAY_LABELS: Record<string,string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: value ? '#16a34a' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left .2s' }}/>
    </button>
  );
}

function AlertFormWizard({
  initial, devices, groups, geofences, onSave, onClose,
}: {
  initial?: AlertRecord | null;
  devices: { imei: string; label: string }[];
  groups: { id: string; name: string; imeis: string[] }[];
  geofences: { id: string; name: string }[];
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
  const [geofenceId, setGeofenceId] = useState(initial?.config?.geofenceId ?? '');
  const [geofenceEvent, setGeofenceEvent] = useState<'enter'|'exit'|'both'>(initial?.config?.geofenceEvent ?? 'both');
  const [scoreThreshold, setScoreThreshold] = useState(initial?.config?.scoreThreshold ?? 70);
  const [active, setActive] = useState(initial?.active ?? true);
  // Step 3
  const [scheduled, setScheduled] = useState(!!initial?.schedule);
  const [schedule, setSchedule] = useState<AlertSchedule>(initial?.schedule ?? { days: [] });
  const [notif, setNotif] = useState<AlertNotifications>(initial?.notifications ?? {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggleDay = (d: string) => setSchedule(s => { const days = s.days ?? []; return { ...s, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }; });

  const selectedType = ALERT_TYPE_MAP[type];

  const toggleImei = (imei: string) => setSelectedImeis(p => p.includes(imei) ? p.filter(i => i !== imei) : [...p, imei]);
  const toggleGroup = (imeis: string[]) => {
    const allSelected = imeis.every(i => selectedImeis.includes(i));
    if (allSelected) setSelectedImeis(p => p.filter(i => !imeis.includes(i)));
    else setSelectedImeis(p => [...new Set([...p, ...imeis])]);
  };

  const buildConfig = (): AlertConfig => {
    if (type === 'over_speed') return { speedLimit };
    if (type === 'speed_zone') return { geofenceId, speedLimit };
    if (type === 'geofence') return { geofenceId, geofenceEvent };
    if (TYPES_WITH_MINUTES.includes(type)) return { minutes };
    if (type === 'low_battery') return { level };
    if (type === 'low_score') return { scoreThreshold };
    return {};
  };

  const submit = async () => {
    setSaving(true); setErr('');
    const payload = { name: name.trim(), type, config: buildConfig(), vehicleImeis: selectedImeis, active, schedule: scheduled ? schedule : null, notifications: notif };
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
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(1200px, 97vw)', height: 'min(800px, 96vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
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
                            <label key={imei} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', cursor: 'pointer', borderRadius: 4, background: 'transparent', userSelect: 'none' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <input type="checkbox" checked={chk} onChange={() => toggleImei(imei)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}/>
                              <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: 3, border: chk ? '1.5px solid #dc2626' : '1.5px solid #d1d5db', background: chk ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}>
                                {chk && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </span>
                              <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chk ? '#dc2626' : '#333', fontWeight: chk ? 600 : 400 }}>{d?.label}</span>
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
                          <label key={imei} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', cursor: 'pointer', borderRadius: 4, background: 'transparent', userSelect: 'none' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <input type="checkbox" checked={chk} onChange={() => toggleImei(imei)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}/>
                            <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: 3, border: chk ? '1.5px solid #dc2626' : '1.5px solid #d1d5db', background: chk ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}>
                              {chk && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </span>
                            <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: chk ? '#dc2626' : '#333', fontWeight: chk ? 600 : 400 }}>{d?.label}</span>
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
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 10 }}>Configuration</div>
                {type === 'over_speed' && (
                  <>
                    <label style={LBL}>Speed Limit (km/h)</label>
                    <input type="number" min={1} max={300} value={speedLimit} onChange={e => setSpeedLimit(+e.target.value)} style={inpSt}
                      onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                  </>
                )}
                {TYPES_WITH_MINUTES.includes(type) && (
                  <>
                    <label style={LBL}>{type === 'idle' ? 'Idle Duration (min)' : type === 'over_parking' ? 'Max Parking (min)' : 'Threshold (min)'}</label>
                    <input type="number" min={1} max={1440} value={minutes} onChange={e => setMinutes(+e.target.value)} style={inpSt}
                      onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                  </>
                )}
                {type === 'low_battery' && (
                  <>
                    <label style={LBL}>Trigger when battery level ≤</label>
                    <select value={level} onChange={e => setLevel(+e.target.value)} style={inpSt}>
                      {[1,2,3].map(l => <option key={l} value={l}>{['Critical (Level 1)','Low (Level 2)','Medium (Level 3)'][l-1]}</option>)}
                    </select>
                  </>
                )}
                {type === 'geofence' && (
                  <>
                    <label style={LBL}>Select Geofence</label>
                    <select value={geofenceId} onChange={e => setGeofenceId(e.target.value)} style={{ ...inpSt, marginBottom: 10 }}>
                      <option value="">— Select geofence —</option>
                      {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <label style={LBL}>Trigger on</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['enter','exit','both'] as const).map(ev => (
                        <button key={ev} onClick={() => setGeofenceEvent(ev)}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 5, border: `2px solid ${geofenceEvent === ev ? '#0891b2' : '#e5e7eb'}`, background: geofenceEvent === ev ? '#ecfeff' : 'transparent', color: geofenceEvent === ev ? '#0891b2' : '#666', fontSize: 11.5, fontWeight: geofenceEvent === ev ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize' }}>
                          {ev}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {type === 'speed_zone' && (
                  <>
                    <label style={LBL}>Select Geofence (as Speed Zone)</label>
                    <select value={geofenceId} onChange={e => setGeofenceId(e.target.value)} style={{ ...inpSt, marginBottom: 10 }}>
                      <option value="">— Select geofence —</option>
                      {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <label style={LBL}>Speed Limit inside zone (km/h)</label>
                    <input type="number" min={1} max={300} value={speedLimit} onChange={e => setSpeedLimit(+e.target.value)} style={inpSt}
                      onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                  </>
                )}
                {type === 'low_score' && (
                  <>
                    <label style={LBL}>Alert when daily score drops at or below</label>
                    <input type="number" min={1} max={99} value={scoreThreshold} onChange={e => setScoreThreshold(+e.target.value)} style={inpSt}
                      onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                  </>
                )}
                {type === 'tow' && (
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>Triggers when the vehicle is <strong>moving at 15+ km/h with ignition off</strong> — no configuration needed.</div>
                )}
                {['ignition_on','ignition_off','power_cut','offline','no_gps'].includes(type) && !TYPES_WITH_MINUTES.includes(type) && (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>No additional configuration needed.</div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Schedule + Notifications */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Active status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#333' }}>Active</span>
                <Toggle value={active} onChange={setActive}/>
              </div>

              {/* Schedule */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f9fafb', borderBottom: scheduled ? '1px solid #e5e7eb' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111' }}>Schedule</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{scheduled ? 'Active in specific times only' : 'Always active'}</div>
                  </div>
                  <Toggle value={scheduled} onChange={setScheduled}/>
                </div>
                {scheduled && (
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>From Date</label>
                        <input type="date" value={schedule.from ?? ''} onChange={e => setSchedule(s => ({ ...s, from: e.target.value }))} style={inpSt}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>To Date</label>
                        <input type="date" value={schedule.to ?? ''} onChange={e => setSchedule(s => ({ ...s, to: e.target.value }))} style={inpSt}/>
                      </div>
                    </div>
                    <div>
                      <label style={LBL}>Days of Week</label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {DAYS.map(d => {
                          const isActive = (schedule.days ?? []).includes(d);
                          return (
                            <button key={d} onClick={() => toggleDay(d)}
                              style={{ padding: '4px 9px', borderRadius: 5, border: `2px solid ${isActive ? '#dc2626' : '#e5e7eb'}`, background: isActive ? '#fff5f5' : 'transparent', color: isActive ? '#dc2626' : '#555', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                              {DAY_LABELS[d]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>From Time</label>
                        <input type="time" value={schedule.timeFrom ?? ''} onChange={e => setSchedule(s => ({ ...s, timeFrom: e.target.value }))} style={inpSt}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>To Time</label>
                        <input type="time" value={schedule.timeTo ?? ''} onChange={e => setSchedule(s => ({ ...s, timeTo: e.target.value }))} style={inpSt}/>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div>
                <label style={LBL}>Notifications</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { key: 'appPush', label: 'App Push Notification', sub: 'Mobile app alert', iconColor: '#2563eb', bg: '#eff6ff' },
                    { key: 'webPush', label: 'Web Push Notification', sub: 'Browser alert', iconColor: '#16a34a', bg: '#f0fdf4' },
                    { key: 'email', label: 'Email Notification', sub: 'Send to account email', iconColor: '#d97706', bg: '#fffbeb' },
                  ].map((item, idx, arr) => (
                    <div key={item.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: idx < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={item.iconColor} strokeWidth="2.2" strokeLinecap="round">
                            {item.key === 'appPush' && <><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>}
                            {item.key === 'webPush' && <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>}
                            {item.key === 'email' && <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>}
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111' }}>{item.label}</div>
                          <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{item.sub}</div>
                        </div>
                        <Toggle value={!!(notif as Record<string,boolean>)[item.key]} onChange={v => setNotif(n => ({ ...n, [item.key]: v, ...(item.key === 'webPush' && !v ? { webSound: false } : {}) }))}/>
                      </div>
                      {item.key === 'webPush' && notif.webPush && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px 8px 50px', borderBottom: '1px solid #f5f5f5', background: '#fafafa' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11.5, color: '#555' }}>Sound notification</div>
                            <div style={{ fontSize: 10.5, color: '#9ca3af' }}>Play alert sound</div>
                          </div>
                          <Toggle value={!!notif.webSound} onChange={v => setNotif(n => ({ ...n, webSound: v }))}/>
                        </div>
                      )}
                    </div>
                  ))}
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

export default function AlertsPanel({ alerts: initialAlerts, loading: initialLoading, setAlertList, initialImei }: {
  alerts: AlertRecord[];
  loading: boolean;
  setAlertList?: (a: AlertRecord[]) => void;
  initialImei?: string | null;
}) {
  const { closePanel } = usePortalPanel();
  const [alerts, setAlerts] = useState<AlertRecord[]>(initialAlerts);
  const [loading, setLoading] = useState(initialLoading);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRecord | null>(null);

  // Auto-open create form when a vehicle IMEI is pre-seeded from vehicle menu
  useEffect(() => {
    if (initialImei) {
      setEditing({ vehicleImeis: [initialImei] } as AlertRecord);
      setFormOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImei]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ imei: string; label: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; imeis: string[] }[]>([]);
  const [geofences, setGeofences] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { setAlerts(initialAlerts); }, [initialAlerts]);
  useEffect(() => { setLoading(initialLoading); }, [initialLoading]);

  useEffect(() => {
    api.get<{ imei: string; displayId: number; vehicle?: { licensePlate?: string | null; displayId: number } | null }[]>('/devices')
      .then(r => setDevices(r.data.map(d => ({ imei: d.imei, label: d.vehicle?.licensePlate || `#${d.vehicle?.displayId ?? d.displayId}` }))))
      .catch(() => {});
    api.get<{ id: string; name: string }[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {});
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
          geofences={geofences}
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
