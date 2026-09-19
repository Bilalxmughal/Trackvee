import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'over_speed' | 'idle' | 'ignition_on' | 'ignition_off'
  | 'power_cut' | 'low_battery' | 'no_gps' | 'offline'
  | 'tow' | 'over_parking' | 'geofence';

export interface AlertConfig {
  speedLimit?: number; minutes?: number; level?: number;
  geofenceId?: string; geofenceEvent?: 'enter' | 'exit' | 'both';
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
  schedule: AlertSchedule | null; notifications: AlertNotifications;
  createdAt: string;
}

export interface Geofence {
  id: string; name: string; type: 'circle' | 'polygon'; coordinates: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  over_speed: 'Over Speed', idle: 'Idle Too Long', ignition_on: 'Ignition ON',
  ignition_off: 'Ignition OFF', power_cut: 'Power Cut', low_battery: 'Low Battery',
  no_gps: 'No GPS Signal', offline: 'Offline', tow: 'Tow Alert',
  over_parking: 'Over Parking', geofence: 'Geofence',
};

const ALERT_TYPE_COLOR: Record<AlertType, string> = {
  over_speed: '#dc2626', idle: '#f59e0b', ignition_on: '#16a34a', ignition_off: '#6b7280',
  power_cut: '#7c3aed', low_battery: '#ea580c', no_gps: '#0284c7', offline: '#9ca3af',
  tow: '#be123c', over_parking: '#a16207', geofence: '#0891b2',
};

const ALERT_TYPE_ICONS: Record<AlertType, JSX.Element> = {
  over_speed: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2"/><polyline points="12 6 12 12 16 14"/></svg>,
  idle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
  ignition_on: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
  ignition_off: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
  power_cut: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="13 2 13 9 20 9"/><polyline points="11 22 11 15 4 15"/><line x1="13" y1="9" x2="20" y2="15"/><line x1="4" y1="9" x2="11" y2="15"/></svg>,
  low_battery: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><line x1="11" y1="9" x2="11" y2="15"/><line x1="8" y1="12" x2="14" y2="12"/></svg>,
  no_gps: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  offline: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  tow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  over_parking: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  geofence: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const;
const DAY_LABELS: Record<string,string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: value ? '#16a34a' : '#d1d5db', cursor: disabled ? 'default' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left .2s' }}/>
    </button>
  );
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, transition: 'all .2s',
        background: done ? '#16a34a' : active ? '#dc2626' : 'transparent',
        border: `2px solid ${done ? '#16a34a' : active ? '#dc2626' : '#d1d5db'}`,
        color: done || active ? '#fff' : '#9ca3af' }}>
        {done ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : n}
      </div>
    </div>
  );
}

// ── Vehicle Group types (mirror MapPage) ────────────────────────────────────

interface VehicleGroup { id: string; name: string; imeis: string[]; }
const GK = 'yotrack_map_groups_v1';
function loadVehicleGroups(): VehicleGroup[] { try { return JSON.parse(localStorage.getItem(GK) ?? '[]'); } catch { return []; } }

// ── Wizard Form Modal ──────────────────────────────────────────────────────────

interface Vehicle { imei: string; plate: string; }

function AlertFormModal({ alert: init, vehicles, geofences, dark, onSave, onClose }: {
  alert: Partial<AlertRecord> | null;
  vehicles: Vehicle[];
  geofences: Geofence[];
  dark: boolean;
  onSave: (data: Partial<AlertRecord>) => void;
  onClose: () => void;
}) {
  const isEdit = !!init?.id;
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState(init?.name ?? '');
  const [active, setActive] = useState(init?.active ?? true);
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set(init?.vehicleImeis ?? []));
  const [vSearch, setVSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groups] = useState<VehicleGroup[]>(loadVehicleGroups);

  // Step 2
  const [type, setType] = useState<AlertType>(init?.type ?? 'over_speed');
  const [config, setConfig] = useState<AlertConfig>(init?.config ?? {});

  // Step 3
  const [scheduled, setScheduled] = useState(!!init?.schedule);
  const [schedule, setSchedule] = useState<AlertSchedule>(init?.schedule ?? { days: [] });
  const [notif, setNotif] = useState<AlertNotifications>(init?.notifications ?? {});

  const dark_bg = dark ? '#111' : '#f9fafb';
  const border = `1px solid ${dark ? '#333' : '#e5e7eb'}`;
  const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border, background: dark_bg, color: dark ? '#e5e5e5' : '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: dark ? '#666' : '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 5 };

  const q = vSearch.trim().toLowerCase();
  const matchesSearch = (v: Vehicle) => !q || v.plate.toLowerCase().includes(q) || v.imei.includes(q);
  const vehicleMap = new Map(vehicles.map(v => [v.imei, v]));

  const toggleImei = (imei: string) => setSelectedImeis(prev => { const n = new Set(prev); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  const toggleGroup = (id: string) => setCollapsedGroups(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroupSelect = (imeis: string[]) => {
    const available = imeis.filter(i => vehicleMap.has(i));
    const allSel = available.every(i => selectedImeis.has(i));
    setSelectedImeis(prev => { const n = new Set(prev); available.forEach(i => allSel ? n.delete(i) : n.add(i)); return n; });
  };

  const groupedImeis = new Set(groups.flatMap(g => g.imeis));
  const ungrouped = vehicles.filter(v => !groupedImeis.has(v.imei) && matchesSearch(v));
  const toggleDay = (d: string) => setSchedule(s => { const days = s.days ?? []; return { ...s, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }; });

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ ...init, name: name.trim(), active, type, config, vehicleImeis: [...selectedImeis], schedule: scheduled ? schedule : null, notifications: notif });
  };

  // ── Config field per type ──
  const renderConfig = () => {
    switch (type) {
      case 'over_speed':
        return <>
          <span style={lbl}>Speed Limit (km/h)</span>
          <input type="number" min={1} max={300} value={config.speedLimit ?? 80} onChange={e => setConfig(c => ({ ...c, speedLimit: +e.target.value }))} style={inp} placeholder="e.g. 80"/>
        </>;
      case 'idle': case 'no_gps': case 'offline': case 'over_parking':
        return <>
          <span style={lbl}>{type === 'idle' ? 'Idle Duration (min)' : type === 'over_parking' ? 'Max Parking (min)' : 'Threshold (min)'}</span>
          <input type="number" min={1} max={1440} value={config.minutes ?? 10} onChange={e => setConfig(c => ({ ...c, minutes: +e.target.value }))} style={inp} placeholder="e.g. 10"/>
        </>;
      case 'low_battery':
        return <>
          <span style={lbl}>Trigger when battery level ≤</span>
          <select value={config.level ?? 2} onChange={e => setConfig(c => ({ ...c, level: +e.target.value }))} style={inp}>
            {[1,2,3].map(l => <option key={l} value={l}>{['Critical (Level 1)','Low (Level 2)','Medium (Level 3)'][l-1]}</option>)}
          </select>
        </>;
      case 'geofence':
        return <>
          <span style={lbl}>Select Geofence</span>
          <select value={config.geofenceId ?? ''} onChange={e => setConfig(c => ({ ...c, geofenceId: e.target.value }))} style={{ ...inp, marginBottom: 10 }}>
            <option value="">— Select geofence —</option>
            {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <span style={lbl}>Trigger on</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['enter','exit','both'] as const).map(ev => (
              <button key={ev} onClick={() => setConfig(c => ({ ...c, geofenceEvent: ev }))}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 7, border: `2px solid ${config.geofenceEvent === ev ? '#0891b2' : (dark ? '#333' : '#e5e7eb')}`, background: config.geofenceEvent === ev ? '#ecfeff' : 'transparent', color: config.geofenceEvent === ev ? '#0891b2' : (dark ? '#aaa' : '#555'), fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {ev}
              </button>
            ))}
          </div>
        </>;
      default:
        return <div style={{ fontSize: 12.5, color: dark ? '#555' : '#9ca3af', padding: '10px 0' }}>No additional configuration needed.</div>;
    }
  };

  const STEP_LABELS = ['Name & Vehicles', 'Alert Type', 'Schedule & Notifications'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 16, width: 'min(960px, 96vw)', height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>
              {isEdit ? 'Edit Alert' : 'New Alert'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
              <span style={{ fontSize: 12, color: dark ? '#666' : '#9ca3af' }}>Active</span>
              <Toggle value={active} onChange={setActive}/>
            </div>
            <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '5px 6px', borderRadius: 6, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: active || done ? 1 : 0.4 }}>
                    <StepDot n={n} active={active} done={done}/>
                    <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? '#dc2626' : done ? '#16a34a' : (dark ? '#666' : '#9ca3af'), whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: done ? '#16a34a' : (dark ? '#2a2a2a' : '#e5e7eb'), margin: '0 10px', transition: 'background .3s' }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>

          {/* ─ Step 1: Name + Vehicles ─ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
              {/* Alert name */}
              <div>
                <span style={lbl}>Alert Name</span>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lahore Fleet Speed Alert"
                  style={{ ...inp, fontSize: 14, padding: '11px 14px' }}/>
              </div>

              {/* Vehicle selection */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ ...lbl, margin: 0, flex: 1 }}>Select Vehicles</span>
                  <span style={{ fontSize: 11, color: selectedImeis.size === 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    {selectedImeis.size === 0 ? 'None selected' : `${selectedImeis.size} selected`}
                  </span>
                </div>
                {/* Toolbar — 3 equal columns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => setSelectedImeis(new Set(vehicles.map(v => v.imei)))}
                    style={{ fontSize: 11, padding: '6px 8px', borderRadius: 5, border, background: 'transparent', color: dark ? '#aaa' : '#555', cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}>
                    Select All
                  </button>
                  <button onClick={() => setSelectedImeis(new Set())}
                    style={{ fontSize: 11, padding: '6px 8px', borderRadius: 5, border, background: 'transparent', color: dark ? '#aaa' : '#555', cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}>
                    Deselect All
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: dark ? '#111' : '#f5f5f5', borderRadius: 5, padding: '6px 8px', border }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={vSearch} onChange={e => setVSearch(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 11, color: dark ? '#e5e5e5' : '#111', outline: 'none', width: '100%', minWidth: 0 }}/>
                    {vSearch && <button onClick={() => setVSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex', flexShrink: 0 }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                  </div>
                </div>

                {/* Group-style vehicle list */}
                {vehicles.length === 0
                  ? <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa', border, borderRadius: 8 }}>No vehicles online</div>
                  : (
                    <div style={{ border, borderRadius: 9, overflow: 'hidden', flex: 1, overflowY: 'auto' }}>
                      {/* Grouped vehicles */}
                      {groups.map(group => {
                        const gVehicles = group.imeis.map(i => vehicleMap.get(i)).filter((v): v is Vehicle => !!v && matchesSearch(v));
                        if (gVehicles.length === 0) return null;
                        const collapsed = collapsedGroups.has(group.id);
                        const allSel = gVehicles.every(v => selectedImeis.has(v.imei));
                        const someSel = gVehicles.some(v => selectedImeis.has(v.imei));
                        return (
                          <div key={group.id}>
                            {/* Group header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px 7px 10px', background: dark ? '#1c1c1c' : '#f7f7f7', borderBottom: `1px solid ${dark ? '#242424' : '#ebebeb'}`, cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => toggleGroup(group.id)}>
                              <span style={{ color: dark ? '#555' : '#999', display: 'flex', flexShrink: 0 }}>
                                {collapsed
                                  ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,6 15,12 9,18"/></svg>
                                  : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>}
                              </span>
                              <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{group.name}</span>
                              <span style={{ fontSize: 10, color: dark ? '#555' : '#aaa', marginRight: 6 }}>{gVehicles.length}</span>
                              {/* Group checkbox */}
                              <span onClick={e => { e.stopPropagation(); toggleGroupSelect(group.imeis); }}
                                style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${allSel ? '#dc2626' : someSel ? '#dc2626' : (dark ? '#444' : '#d1d5db')}`, background: allSel ? '#dc2626' : someSel ? '#fca5a5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                {allSel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                              </span>
                            </div>
                            {/* Group vehicles */}
                            {!collapsed && gVehicles.map(v => {
                              const sel = selectedImeis.has(v.imei);
                              return (
                                <label key={v.imei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 28px', borderBottom: `1px solid ${dark ? '#1c1c1c' : '#f5f5f5'}`, cursor: 'pointer', background: sel ? (dark ? '#1a0808' : '#fff5f5') : 'transparent', transition: 'background .12s' }}>
                                  <div style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${sel ? '#dc2626' : (dark ? '#444' : '#d1d5db')}`, background: sel ? '#dc2626' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    onClick={() => toggleImei(v.imei)}>
                                    {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                  </div>
                                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? 700 : 500, color: sel ? '#dc2626' : (dark ? '#e5e5e5' : '#111'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => toggleImei(v.imei)}>{v.plate}</span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}
                      {/* Ungrouped vehicles */}
                      {ungrouped.length > 0 && (
                        <>
                          {groups.length > 0 && <div style={{ padding: '5px 10px 4px', fontSize: 10, fontWeight: 700, color: dark ? '#444' : '#ccc', textTransform: 'uppercase', letterSpacing: 0.5, background: dark ? '#1c1c1c' : '#f7f7f7', borderBottom: `1px solid ${dark ? '#242424' : '#ebebeb'}` }}>Ungrouped</div>}
                          {ungrouped.map(v => {
                            const sel = selectedImeis.has(v.imei);
                            return (
                              <label key={v.imei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${dark ? '#1c1c1c' : '#f5f5f5'}`, cursor: 'pointer', background: sel ? (dark ? '#1a0808' : '#fff5f5') : 'transparent', transition: 'background .12s' }}>
                                <div style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${sel ? '#dc2626' : (dark ? '#444' : '#d1d5db')}`, background: sel ? '#dc2626' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                  onClick={() => toggleImei(v.imei)}>
                                  {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                                <span style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? 700 : 500, color: sel ? '#dc2626' : (dark ? '#e5e5e5' : '#111'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => toggleImei(v.imei)}>{v.plate}</span>
                              </label>
                            );
                          })}
                        </>
                      )}
                      {/* Empty search */}
                      {q && groups.every(g => g.imeis.every(i => !vehicleMap.has(i) || !matchesSearch(vehicleMap.get(i)!))) && ungrouped.length === 0 && (
                        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>No results for "{vSearch}"</div>
                      )}
                    </div>
                  )}
                {selectedImeis.size === 0 && vehicles.length > 0 && (
                  <div style={{ marginTop: 7, fontSize: 11, color: '#dc2626' }}>At least one vehicle must be selected</div>
                )}
              </div>
            </div>
          )}

          {/* ─ Step 2: Alert Type + Config ─ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div>
                <span style={lbl}>Alert Type</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map(t => {
                    const sel = type === t;
                    const color = ALERT_TYPE_COLOR[t];
                    return (
                      <button key={t} onClick={() => { setType(t); setConfig({}); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
                          border: `2px solid ${sel ? color : (dark ? '#2a2a2a' : '#e5e7eb')}`,
                          background: sel ? `${color}10` : 'transparent',
                          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                          color: sel ? color : (dark ? '#aaa' : '#555'), fontSize: 12.5, fontWeight: sel ? 700 : 400 }}>
                        <span style={{ color: sel ? color : (dark ? '#555' : '#9ca3af'), flexShrink: 0 }}>{ALERT_TYPE_ICONS[t]}</span>
                        {ALERT_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Config panel */}
              <div style={{ padding: 14, borderRadius: 9, background: dark ? '#111' : '#f9fafb', border }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: ALERT_TYPE_COLOR[type], marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: ALERT_TYPE_COLOR[type] }}>{ALERT_TYPE_ICONS[type]}</span>
                  {ALERT_TYPE_LABELS[type]} — Configuration
                </div>
                {renderConfig()}
              </div>
            </div>
          )}

          {/* ─ Step 3: Schedule + Notifications ─ */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {/* Schedule */}
              <div style={{ border, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: dark ? '#111' : '#f9fafb', borderBottom: scheduled ? `1px solid ${dark ? '#222' : '#e5e7eb'}` : 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? '#1a1a2e' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>Schedule</div>
                    <div style={{ fontSize: 11, color: dark ? '#555' : '#9ca3af' }}>{scheduled ? 'Active in specific times only' : 'Always active'}</div>
                  </div>
                  <Toggle value={scheduled} onChange={setScheduled}/>
                </div>
                {scheduled && (
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={lbl}>From Date</span>
                        <input type="date" value={schedule.from ?? ''} onChange={e => setSchedule(s => ({ ...s, from: e.target.value }))} style={inp}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={lbl}>To Date</span>
                        <input type="date" value={schedule.to ?? ''} onChange={e => setSchedule(s => ({ ...s, to: e.target.value }))} style={inp}/>
                      </div>
                    </div>
                    <div>
                      <span style={lbl}>Days of Week</span>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {DAYS.map(d => {
                          const isActive = (schedule.days ?? []).includes(d);
                          return (
                            <button key={d} onClick={() => toggleDay(d)}
                              style={{ padding: '5px 10px', borderRadius: 5, border: `2px solid ${isActive ? '#dc2626' : (dark ? '#333' : '#e5e7eb')}`, background: isActive ? '#fef2f2' : 'transparent', color: isActive ? '#dc2626' : (dark ? '#aaa' : '#555'), fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                              {DAY_LABELS[d]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={lbl}>From Time</span>
                        <input type="time" value={schedule.timeFrom ?? ''} onChange={e => setSchedule(s => ({ ...s, timeFrom: e.target.value }))} style={inp}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={lbl}>To Time</span>
                        <input type="time" value={schedule.timeTo ?? ''} onChange={e => setSchedule(s => ({ ...s, timeTo: e.target.value }))} style={inp}/>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div>
                <span style={lbl}>Notifications</span>
                <div style={{ border, borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { key: 'appPush', label: 'App Push Notification', sub: 'Mobile app alert', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, bg: dark ? '#1a1a2e' : '#eff6ff' },
                    { key: 'webPush', label: 'Web Push Notification', sub: 'Browser alert', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, bg: dark ? '#1a2a1a' : '#f0fdf4' },
                    { key: 'email', label: 'Email Notification', sub: 'Send to account email', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, bg: dark ? '#1e1a10' : '#fffbeb' },
                  ].map((item, idx, arr) => (
                    <div key={item.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: idx < arr.length - 1 ? `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` : 'none' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>{item.label}</div>
                          <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>{item.sub}</div>
                        </div>
                        <Toggle value={!!(notif as Record<string, boolean>)[item.key]} onChange={v => setNotif(n => ({ ...n, [item.key]: v, ...(item.key === 'webPush' && !v ? { webSound: false } : {}) }))}/>
                      </div>
                      {/* Web sound sub-option */}
                      {item.key === 'webPush' && notif.webPush && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 10px 54px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, background: dark ? '#0d0d0d' : '#fafafa' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11.5, color: dark ? '#aaa' : '#555' }}>Sound notification</div>
                            <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>Play alert sound</div>
                          </div>
                          <Toggle value={!!notif.webSound} onChange={v => setNotif(n => ({ ...n, webSound: v }))}/>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 24px', borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0, alignItems: 'center' }}>
          {/* Progress text */}
          <span style={{ fontSize: 11, color: dark ? '#555' : '#bbb', flex: 1 }}>Step {step} of 3</span>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ padding: '9px 18px', borderRadius: 8, border, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 8, border, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && (!name.trim() || selectedImeis.size === 0)}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: (step === 1 && (!name.trim() || selectedImeis.size === 0)) ? '#e5e7eb' : '#dc2626', color: (step === 1 && (!name.trim() || selectedImeis.size === 0)) ? '#aaa' : '#fff', fontSize: 13, fontWeight: 600, cursor: (step === 1 && (!name.trim() || selectedImeis.size === 0)) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ) : (
            <button onClick={handleSave} disabled={!name.trim()}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: name.trim() ? '#dc2626' : '#e5e7eb', color: name.trim() ? '#fff' : '#aaa', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              {isEdit ? 'Save Changes' : 'Create Alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 3-dot menu ────────────────────────────────────────────────────────────────

function DotMenu({ dark, onEdit, onDelete }: { dark: boolean; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#9ca3af', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 30, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.2)', minWidth: 120, zIndex: 999, overflow: 'hidden' }}>
          {[
            { label: 'Edit', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, action: () => { setOpen(false); onEdit(); }, danger: false },
            { label: 'Delete', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>, action: () => { setOpen(false); onDelete(); }, danger: true },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 13px', border: 'none', background: 'transparent', color: item.danger ? '#ef4444' : (dark ? '#e5e5e5' : '#333'), fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = dark ? '#222' : '#f5f5f5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>{label}</span>;
}

// ── Main AlertsModal ───────────────────────────────────────────────────────────

export default function AlertsModal({ open, onClose, dark, vehicles, preSelectedImei, editAlertRecord }: {
  open: boolean; onClose: () => void; dark: boolean;
  vehicles: Array<{ imei: string; plate: string }>;
  preSelectedImei?: string;
  editAlertRecord?: AlertRecord;
}) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<AlertRecord> | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [ar, gr] = await Promise.all([api.get<AlertRecord[]>('/alerts'), api.get<Geofence[]>('/geofences')]);
      setAlerts(ar.data);
      setGeofences(gr.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    load();
    if (editAlertRecord) {
      setEditTarget(editAlertRecord);
      setFormOpen(true);
    } else if (preSelectedImei) {
      setEditTarget({ vehicleImeis: [preSelectedImei], active: true });
      setFormOpen(true);
    }
  }, [open, preSelectedImei, editAlertRecord]);

  if (!open) return null;

  const handleSave = async (data: Partial<AlertRecord>) => {
    try {
      if (data.id) { const r = await api.put<AlertRecord>(`/alerts/${data.id}`, data); setAlerts(a => a.map(x => x.id === data.id ? r.data : x)); }
      else { const r = await api.post<AlertRecord>('/alerts', data); setAlerts(a => [r.data, ...a]); }
      setFormOpen(false); setEditTarget(null);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    await api.delete(`/alerts/${id}`);
    setAlerts(a => a.filter(x => x.id !== id));
  };

  const handleToggleActive = async (alert: AlertRecord) => {
    try {
      const r = await api.put<AlertRecord>(`/alerts/${alert.id}`, { active: !alert.active });
      setAlerts(a => a.map(x => x.id === alert.id ? r.data : x));
    } catch {}
  };

  const filtered = alerts.filter(a => filter === 'all' ? true : filter === 'active' ? a.active : !a.active);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 16, width: 'min(960px, 96vw)', height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, color: '#dc2626' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Alerts</div>
              <div style={{ fontSize: 11, color: dark ? '#666' : '#9ca3af' }}>
                {alerts.filter(a => a.active).length} active · {alerts.length} total
              </div>
            </div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, marginRight: 12 }}>
              {(['all','active','inactive'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '4px 11px', borderRadius: 6, border: `1px solid ${filter === f ? '#dc2626' : (dark ? '#2a2a2a' : '#e5e7eb')}`, background: filter === f ? '#fef2f2' : 'transparent', color: filter === f ? '#dc2626' : (dark ? '#666' : '#9ca3af'), fontSize: 11.5, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f}
                </button>
              ))}
            </div>
            {/* New Alert */}
            <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginRight: 10 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Alert
            </button>
            <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '5px 6px', borderRadius: 6, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* ── List ── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: dark ? '#555' : '#bbb' }}>Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: dark ? '#1e1e1e' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#444' : '#ccc' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div style={{ fontSize: 13, color: dark ? '#555' : '#aaa' }}>No alerts yet</div>
                <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
                  style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  Create First Alert
                </button>
              </div>
            )}
            {!loading && filtered.map(alert => {
              const color = ALERT_TYPE_COLOR[alert.type];
              return (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, opacity: alert.active ? 1 : 0.6 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                    {ALERT_TYPE_ICONS[alert.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      <Chip label={ALERT_TYPE_LABELS[alert.type]} color={color} bg={`${color}14`}/>
                      <span style={{ fontSize: 10.5, color: dark ? '#555' : '#aaa' }}>
                        {`${alert.vehicleImeis.length} vehicle${alert.vehicleImeis.length !== 1 ? 's' : ''}`}
                      </span>
                      {alert.schedule && <Chip label="Scheduled" color="#0284c7" bg="#e0f2fe"/>}
                    </div>
                  </div>
                  <Toggle value={alert.active} onChange={() => handleToggleActive(alert)}/>
                  <DotMenu dark={dark} onEdit={() => { setEditTarget(alert); setFormOpen(true); }} onDelete={() => handleDelete(alert.id)}/>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {formOpen && (
        <AlertFormModal
          alert={editTarget}
          vehicles={vehicles}
          geofences={geofences}
          dark={dark}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
        />
      )}
    </>
  );
}
