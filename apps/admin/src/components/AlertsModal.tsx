import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'over_speed' | 'idle' | 'ignition_on' | 'ignition_off'
  | 'power_cut' | 'low_battery' | 'no_gps' | 'offline'
  | 'tow' | 'over_parking' | 'geofence';

export interface AlertConfig {
  speedLimit?: number;
  minutes?: number;
  level?: number;
  geofenceId?: string;
  geofenceEvent?: 'enter' | 'exit' | 'both';
}

export interface AlertSchedule {
  from?: string; to?: string;
  days?: string[]; timeFrom?: string; timeTo?: string;
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
  id: string; name: string; type: 'circle' | 'polygon';
  coordinates: any;
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

const ALERT_TYPE_ICON: Record<AlertType, JSX.Element> = {
  over_speed: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2"/><polyline points="12 6 12 12 16 14"/></svg>,
  idle: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
  ignition_on: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
  ignition_off: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
  power_cut: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="13 2 13 9 20 9"/><polyline points="11 22 11 15 4 15"/><line x1="13" y1="9" x2="20" y2="15"/><line x1="4" y1="9" x2="11" y2="15"/></svg>,
  low_battery: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><line x1="11" y1="9" x2="11" y2="15"/><line x1="8" y1="12" x2="14" y2="12"/></svg>,
  no_gps: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  offline: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  tow: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  over_parking: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  geofence: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const;
const DAY_LABELS: Record<string,string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: value ? '#16a34a' : '#d1d5db', cursor: disabled ? 'default' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left .2s' }}/>
    </button>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>{label}</span>;
}

// ── AlertFormModal ─────────────────────────────────────────────────────────────

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

  const [name, setName] = useState(init?.name ?? '');
  const [active, setActive] = useState(init?.active ?? true);
  const [type, setType] = useState<AlertType>(init?.type ?? 'over_speed');
  const [config, setConfig] = useState<AlertConfig>(init?.config ?? {});
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set(init?.vehicleImeis ?? []));
  const [vSearch, setVSearch] = useState('');
  const [scheduled, setScheduled] = useState(!!init?.schedule);
  const [schedule, setSchedule] = useState<AlertSchedule>(init?.schedule ?? { days: [] });
  const [notif, setNotif] = useState<AlertNotifications>(init?.notifications ?? {});

  const inp: React.CSSProperties = { padding: '8px 11px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, width: '100%' };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: dark ? '#777' : '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 5, display: 'block' };
  const sect: React.CSSProperties = { marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}` };

  const filteredVehicles = vSearch.trim()
    ? vehicles.filter(v => v.plate.toLowerCase().includes(vSearch.toLowerCase()) || v.imei.includes(vSearch))
    : vehicles;

  const toggleImei = (imei: string) => {
    setSelectedImeis(prev => { const n = new Set(prev); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  };

  const toggleDay = (d: string) => {
    setSchedule(s => {
      const days = s.days ?? [];
      return { ...s, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] };
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...init,
      name: name.trim(), active, type, config,
      vehicleImeis: [...selectedImeis],
      schedule: scheduled ? schedule : null,
      notifications: notif,
    });
  };

  // Config fields per alert type
  const renderConfig = () => {
    switch (type) {
      case 'over_speed':
        return (
          <div>
            <span style={label}>Speed Limit (km/h)</span>
            <input type="number" min={1} max={300} value={config.speedLimit ?? 80} onChange={e => setConfig(c => ({ ...c, speedLimit: +e.target.value }))} style={inp} placeholder="e.g. 80"/>
          </div>
        );
      case 'idle': case 'no_gps': case 'offline': case 'over_parking':
        return (
          <div>
            <span style={label}>{type === 'idle' ? 'Idle Duration (minutes)' : type === 'over_parking' ? 'Max Parking Duration (minutes)' : 'Threshold (minutes)'}</span>
            <input type="number" min={1} max={1440} value={config.minutes ?? 10} onChange={e => setConfig(c => ({ ...c, minutes: +e.target.value }))} style={inp} placeholder="e.g. 10"/>
          </div>
        );
      case 'low_battery':
        return (
          <div>
            <span style={label}>Trigger when battery level ≤</span>
            <select value={config.level ?? 2} onChange={e => setConfig(c => ({ ...c, level: +e.target.value }))} style={inp}>
              {[1,2,3].map(l => <option key={l} value={l}>{['Critical (Level 1)','Low (Level 2)','Medium (Level 3)'][l-1]}</option>)}
            </select>
          </div>
        );
      case 'geofence':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={label}>Select Geofence</span>
              <select value={config.geofenceId ?? ''} onChange={e => setConfig(c => ({ ...c, geofenceId: e.target.value }))} style={inp}>
                <option value="">— Select geofence —</option>
                {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {geofences.length === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 5 }}>No geofences yet — draw them from the Map page.</div>}
            </div>
            <div>
              <span style={label}>Trigger on</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['enter','exit','both'] as const).map(ev => (
                  <button key={ev} onClick={() => setConfig(c => ({ ...c, geofenceEvent: ev }))}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${config.geofenceEvent === ev ? '#0891b2' : (dark ? '#333' : '#e5e7eb')}`, background: config.geofenceEvent === ev ? '#ecfeff' : 'transparent', color: config.geofenceEvent === ev ? '#0891b2' : (dark ? '#aaa' : '#555'), fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default: return <div style={{ fontSize: 12, color: dark ? '#666' : '#9ca3af' }}>No additional configuration needed.</div>;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 16, width: 'min(820px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, color: '#dc2626' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{isEdit ? 'Edit Alert' : 'New Alert'}</div>
            <div style={{ fontSize: 11, color: dark ? '#666' : '#9ca3af' }}>Configure alert conditions, vehicles and notifications</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: dark ? '#888' : '#6b7280' }}>Active</span>
            <Toggle value={active} onChange={setActive}/>
          </div>
          <button onClick={onClose} style={{ marginLeft: 16, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '5px 6px', borderRadius: 6, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body — 2 columns */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left column */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', borderRight: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>

            {/* 1. Alert Name */}
            <div style={sect}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Alert Name</span>
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lahore Fleet Speed Alert" style={inp}/>
            </div>

            {/* 2. Vehicles */}
            <div style={sect}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Vehicles</span>
                <span style={{ fontSize: 11, color: dark ? '#555' : '#aaa' }}>({selectedImeis.size === 0 ? 'All' : selectedImeis.size} selected)</span>
              </div>
              {/* Select All / Deselect */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button onClick={() => setSelectedImeis(new Set(vehicles.map(v => v.imei)))}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', cursor: 'pointer' }}>
                  Select All
                </button>
                <button onClick={() => setSelectedImeis(new Set())}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', cursor: 'pointer' }}>
                  Deselect All
                </button>
                <div style={{ flex: 1 }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 6, padding: '4px 9px', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input value={vSearch} onChange={e => setVSearch(e.target.value)} placeholder="Search" style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: dark ? '#e5e5e5' : '#111', outline: 'none', width: 90 }}/>
                </div>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${dark ? '#222' : '#e5e7eb'}`, borderRadius: 8 }}>
                {filteredVehicles.length === 0
                  ? <div style={{ padding: '12px 14px', fontSize: 12, color: dark ? '#555' : '#aaa', textAlign: 'center' }}>No vehicles</div>
                  : filteredVehicles.map(v => {
                    const chk = selectedImeis.has(v.imei);
                    return (
                      <label key={v.imei} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, background: chk ? (dark ? '#1a1010' : '#fff5f5') : 'transparent' }}>
                        <input type="checkbox" checked={chk} onChange={() => toggleImei(v.imei)} style={{ accentColor: '#dc2626', cursor: 'pointer', width: 13, height: 13, flexShrink: 0 }}/>
                        <span style={{ fontSize: 12.5, fontWeight: chk ? 600 : 400, color: chk ? '#dc2626' : (dark ? '#e5e5e5' : '#333') }}>{v.plate}</span>
                        <span style={{ fontSize: 10, color: dark ? '#444' : '#bbb', marginLeft: 'auto' }}>{v.imei.slice(-8)}</span>
                      </label>
                    );
                  })}
              </div>
              {selectedImeis.size === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 5 }}>No vehicles selected = alert applies to all vehicles</div>}
            </div>

            {/* 3. Alert Type */}
            <div style={sect}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Alert Type</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map(t => (
                  <button key={t} onClick={() => { setType(t); setConfig({}); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 7, border: `1px solid ${type === t ? ALERT_TYPE_COLOR[t] : (dark ? '#2a2a2a' : '#e5e7eb')}`, background: type === t ? `${ALERT_TYPE_COLOR[t]}14` : 'transparent', cursor: 'pointer', textAlign: 'left', color: type === t ? ALERT_TYPE_COLOR[t] : (dark ? '#aaa' : '#555'), fontSize: 12, fontWeight: type === t ? 700 : 400, transition: 'all .15s' }}>
                    <span style={{ color: type === t ? ALERT_TYPE_COLOR[t] : (dark ? '#555' : '#9ca3af'), flexShrink: 0 }}>{ALERT_TYPE_ICON[t]}</span>
                    {ALERT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {/* Type config */}
              <div style={{ padding: '14px', borderRadius: 8, background: dark ? '#111' : '#f9fafb', border: `1px solid ${dark ? '#222' : '#e5e7eb'}` }}>
                {renderConfig()}
              </div>
            </div>

          </div>

          {/* Right column */}
          <div style={{ width: 300, padding: '20px 24px', overflowY: 'auto', flexShrink: 0 }}>

            {/* 4. Schedule */}
            <div style={sect}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Schedule</span>
                <div style={{ flex: 1 }}/>
                <Toggle value={scheduled} onChange={setScheduled}/>
              </div>
              {!scheduled
                ? <div style={{ fontSize: 11.5, color: dark ? '#666' : '#9ca3af' }}>Alert is always active</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <span style={label}>Date From</span>
                      <input type="date" value={schedule.from ?? ''} onChange={e => setSchedule(s => ({ ...s, from: e.target.value }))} style={inp}/>
                    </div>
                    <div>
                      <span style={label}>Date To</span>
                      <input type="date" value={schedule.to ?? ''} onChange={e => setSchedule(s => ({ ...s, to: e.target.value }))} style={inp}/>
                    </div>
                    <div>
                      <span style={label}>Days of Week</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {DAYS.map(d => {
                          const active = (schedule.days ?? []).includes(d);
                          return (
                            <button key={d} onClick={() => toggleDay(d)}
                              style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${active ? '#dc2626' : (dark ? '#333' : '#e5e7eb')}`, background: active ? '#fef2f2' : 'transparent', color: active ? '#dc2626' : (dark ? '#aaa' : '#555'), fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              {DAY_LABELS[d]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <span style={label}>Time From</span>
                        <input type="time" value={schedule.timeFrom ?? ''} onChange={e => setSchedule(s => ({ ...s, timeFrom: e.target.value }))} style={inp}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={label}>Time To</span>
                        <input type="time" value={schedule.timeTo ?? ''} onChange={e => setSchedule(s => ({ ...s, timeTo: e.target.value }))} style={inp}/>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* 5. Notifications */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>5</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Notifications</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${dark ? '#222' : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* App Push */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? '#1a1a2e' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>App Push Notification</div>
                    <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>Mobile app alert</div>
                  </div>
                  <Toggle value={!!notif.appPush} onChange={v => setNotif(n => ({ ...n, appPush: v }))}/>
                </div>
                {/* Web Push */}
                <div style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? '#1a2a1a' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>Web Push Notification</div>
                      <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>Browser alert</div>
                    </div>
                    <Toggle value={!!notif.webPush} onChange={v => setNotif(n => ({ ...n, webPush: v, webSound: v ? n.webSound : false }))}/>
                  </div>
                  {notif.webPush && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 12px 54px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11.5, color: dark ? '#aaa' : '#555' }}>Sound notification</div>
                        <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>Play alert sound</div>
                      </div>
                      <Toggle value={!!notif.webSound} onChange={v => setNotif(n => ({ ...n, webSound: v }))}/>
                    </div>
                  )}
                </div>
                {/* Email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? '#1e1a10' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#e5e5e5' : '#111' }}>Email Notification</div>
                    <div style={{ fontSize: 10.5, color: dark ? '#555' : '#9ca3af' }}>Send to account email</div>
                  </div>
                  <Toggle value={!!notif.email} onChange={v => setNotif(n => ({ ...n, email: v }))}/>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '16px 24px', borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}
            style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: name.trim() ? '#dc2626' : '#e5e7eb', color: name.trim() ? '#fff' : '#aaa', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'default' }}>
            {isEdit ? 'Save Changes' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 3-dot Menu ─────────────────────────────────────────────────────────────────

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
            { label: 'Edit', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, action: () => { setOpen(false); onEdit(); } },
            { label: 'Delete', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>, action: () => { setOpen(false); onDelete(); }, danger: true },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 13px', border: 'none', background: 'transparent', color: (item as any).danger ? '#ef4444' : (dark ? '#e5e5e5' : '#333'), fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
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

// ── Main AlertsModal ──────────────────────────────────────────────────────────

export default function AlertsModal({ open, onClose, dark, vehicles }: {
  open: boolean; onClose: () => void; dark: boolean;
  vehicles: Array<{ imei: string; plate: string }>;
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

  useEffect(() => { if (open) load(); }, [open]);

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
    const r = await api.put<AlertRecord>(`/alerts/${alert.id}`, { active: !alert.active });
    setAlerts(a => a.map(x => x.id === alert.id ? r.data : x));
  };

  const filtered = alerts.filter(a => filter === 'all' ? true : filter === 'active' ? a.active : !a.active);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 16, width: 'min(720px,100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, color: '#dc2626' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Alerts</div>
              <div style={{ fontSize: 11, color: dark ? '#666' : '#9ca3af' }}>{alerts.filter(a => a.active).length} active · {alerts.length} total</div>
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 4, marginRight: 12 }}>
              {(['all','active','inactive'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '4px 11px', borderRadius: 6, border: `1px solid ${filter === f ? '#dc2626' : (dark ? '#2a2a2a' : '#e5e7eb')}`, background: filter === f ? '#fef2f2' : 'transparent', color: filter === f ? '#dc2626' : (dark ? '#666' : '#9ca3af'), fontSize: 11.5, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f}
                </button>
              ))}
            </div>
            {/* Add button */}
            <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginRight: 10 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Alert
            </button>
            <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '5px 6px', borderRadius: 6, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: dark ? '#555' : '#bbb', fontSize: 13 }}>Loading…</div>
            )}
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
              const typeColor = ALERT_TYPE_COLOR[alert.type];
              return (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, opacity: alert.active ? 1 : 0.6, transition: 'opacity .2s' }}>
                  {/* Type icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${typeColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeColor, flexShrink: 0 }}>
                    {ALERT_TYPE_ICON[alert.type]}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Chip label={ALERT_TYPE_LABELS[alert.type]} color={typeColor} bg={`${typeColor}14`}/>
                      <span style={{ fontSize: 10.5, color: dark ? '#555' : '#aaa' }}>
                        {alert.vehicleImeis.length === 0 ? 'All vehicles' : `${alert.vehicleImeis.length} vehicle${alert.vehicleImeis.length > 1 ? 's' : ''}`}
                      </span>
                      {alert.schedule && <Chip label="Scheduled" color="#0284c7" bg="#e0f2fe"/>}
                    </div>
                  </div>
                  {/* Active toggle */}
                  <Toggle value={alert.active} onChange={() => handleToggleActive(alert)}/>
                  {/* 3-dot */}
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
