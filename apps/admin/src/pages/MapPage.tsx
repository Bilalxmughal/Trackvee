import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useCityFilter } from '../contexts/CityFilterContext';

interface LivePoint {
  id: string; imei: string; deviceId: string | null;
  latitude: number; longitude: number; speedKmh: number;
  heading: number; satellites: number; gpsValid: boolean; timestamp: string;
  ignition?: boolean | null; externalPower?: boolean | null;
  immobilizer?: boolean | null; voltageLevel?: number | null;
  gsmSignal?: number | null; altitude?: number | null;
}
interface DeviceInfo {
  imei: string; cityId: string | null;
  vehicle: { id: string; licensePlate: string | null; displayId: number } | null;
}
interface VehicleDetail {
  id: string; make: string | null; model: string | null; year: number | null;
  licensePlate: string | null; displayId: number;
}
interface VehicleGroup { id: string; name: string; imeis: string[]; }
interface VehicleStats { stopDuration: number | null; odometer: number; engineHours: number; }
type DMap = Map<string, { plate: string | null; vehicleId: string | null; cityId: string | null }>;

// ── Utilities ────────────────────────────────────────────────────────────────

function isOffline(pt: LivePoint) { return Date.now() - new Date(pt.timestamp).getTime() > 10 * 60 * 1000; }
function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'offline' {
  if (isOffline(pt)) return 'offline';
  return pt.speedKmh > 0 ? 'moving' : 'idle';
}
const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', offline: '#9ca3af' } as const;
const STATUS_LABEL = { moving: 'Moving', idle: 'Stopped', offline: 'Offline' } as const;
const VOLT_LABELS = ['No Power', 'Critical', 'Low', 'Medium', 'High', 'Full'];

function formatTs(ts: string) {
  const d = new Date(ts);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${d.getDate().toString().padStart(2,'0')}-${mon}-${d.getFullYear()} ${h}:${d.getMinutes().toString().padStart(2,'0')} ${ap}`;
}
function formatAge(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ago`;
}
function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`; if (sec < 3600) return `${Math.floor(sec/60)}m`;
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Groups (localStorage) ────────────────────────────────────────────────────

const GK = 'yotrack_map_groups_v1';
function loadGroups(): VehicleGroup[] { try { return JSON.parse(localStorage.getItem(GK) ?? '[]'); } catch { return []; } }
function saveGroups(g: VehicleGroup[]) { try { localStorage.setItem(GK, JSON.stringify(g)); } catch {} }

// ── Stats / Geocode ──────────────────────────────────────────────────────────

const statsCache = new Map<string, VehicleStats>();
async function fetchStats(imei: string): Promise<VehicleStats> {
  if (statsCache.has(imei)) return statsCache.get(imei)!;
  const { data } = await api.get<VehicleStats>(`/telemetry/${imei}/stats`);
  statsCache.set(imei, data); return data;
}
const geocodeCache = new Map<string, string>();
async function reverseGeocode(lat: number, lon: number) {
  const k = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache.has(k)) return geocodeCache.get(k)!;
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  const j = await r.json() as { display_name?: string };
  const a = j.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  geocodeCache.set(k, a); return a;
}

// ── Car Icon + Popup HTML ────────────────────────────────────────────────────

function makeCarIcon(heading: number, offline: boolean, plate: string, speed: number): L.DivIcon {
  const color = offline ? '#dc2626' : '#16a34a';
  const glow = offline
    ? 'drop-shadow(0 0 5px #dc2626) drop-shadow(0 0 3px #dc2626bb)'
    : 'drop-shadow(0 0 5px #16a34a) drop-shadow(0 0 3px #16a34abb)';
  const label = `${plate} (${Math.round(speed)} kph)`;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-family:system-ui,sans-serif">
    <img src="/car-icon.png" style="display:block;width:34px;height:34px;transform:rotate(${heading}deg);transform-origin:center center;filter:${glow}"/>
    <div style="background:rgba(10,10,10,0.85);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;letter-spacing:0.3px;border-left:3px solid ${color}">${label}</div>
  </div>`;
  return L.divIcon({ html, className: '', iconSize: [150, 58], iconAnchor: [75, 40], popupAnchor: [0, -44] });
}

function row(label: string, value: string, extra = '') {
  return `<tr><td style="color:#888;padding-right:10px;padding-bottom:4px;white-space:nowrap;font-size:11px;vertical-align:top">${label}</td><td style="font-weight:500;padding-bottom:4px;font-size:12px;${extra}">${value}</td></tr>`;
}
function sec(title: string, pt = 'padding-top:2px') {
  return `<tr><td colspan="2" style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;${pt}">${title}</td></tr>`;
}

function buildPopupHtml(pt: LivePoint, dv: { plate: string | null; vehicleId: string | null } | undefined, vc: VehicleDetail | undefined, plate: string, address: string, stats?: VehicleStats | null): string {
  const status = vehicleStatus(pt);
  const sc = STATUS_COLOR[status];
  const gps = Math.min(100, Math.round((pt.satellites / 12) * 100));
  const onVal = (v: boolean | null | undefined) => v == null ? '—' : v ? 'On' : 'Off';
  const volt = pt.voltageLevel != null ? (VOLT_LABELS[pt.voltageLevel] ?? String(pt.voltageLevel)) : '—';
  const gsm = pt.gsmSignal != null ? `${pt.gsmSignal}/4` : '—';
  const stopD = stats?.stopDuration != null ? formatDuration(stats.stopDuration) : '—';
  const odo = stats != null ? `${stats.odometer.toFixed(1)} km` : '—';
  const eng = stats != null ? formatDuration(Math.round(stats.engineHours * 3600)) : '—';
  const vd = vc ? [vc.make, vc.model, vc.year ? String(vc.year) : null].filter(Boolean).join(' ') || '' : '';
  return `<div style="font-family:system-ui,sans-serif;padding:2px 0;min-width:260px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">
      <span style="width:10px;height:10px;border-radius:50%;background:${sc};display:inline-block;flex-shrink:0"></span>
      <div><div style="font-size:14px;font-weight:700">${plate}</div>${vd ? `<div style="font-size:11px;color:#888;margin-top:1px">${vd}</div>` : ''}</div>
      <span style="margin-left:auto;font-size:11px;font-weight:600;color:${sc}">${STATUS_LABEL[status]}</span>
    </div>
    <table style="border-collapse:collapse;width:100%"><tbody>
      ${sec('Location')}
      ${row('Address', `<span style="font-size:11px;color:#444;word-break:break-word">${address}</span>`)}
      ${row('Coordinates', `${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`)}
      ${row('Altitude', pt.altitude != null ? `${pt.altitude.toFixed(1)} m` : '—')}
      ${sec('Status', 'padding-top:8px')}
      ${row('Time', formatTs(pt.timestamp))}
      ${row('Last Seen', formatAge(pt.timestamp))}
      ${row('Speed', `${Math.round(pt.speedKmh)} km/h`)}
      ${row('Angle', `${pt.heading}°`)}
      ${row('Stop Duration', stopD)}
      ${sec('Device', 'padding-top:8px')}
      ${row('Ignition', onVal(pt.ignition), pt.ignition === true ? 'color:#16a34a' : pt.ignition === false ? 'color:#dc2626' : '')}
      ${row('Immobilizer', onVal(pt.immobilizer), pt.immobilizer === true ? 'color:#dc2626' : '')}
      ${row('Ext. Power', onVal(pt.externalPower), pt.externalPower === true ? 'color:#16a34a' : '')}
      ${row('Int. Battery', volt)}
      ${row('Engine Hours', eng)}
      ${row('Odometer', odo)}
      ${sec('Signal', 'padding-top:8px')}
      ${row('GPS', `${gps}%`)}
      ${row('Satellites', String(pt.satellites))}
      ${row('GSM', gsm)}
    </tbody></table>
  </div>`;
}

// ── Map Components ───────────────────────────────────────────────────────────

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 200);
    const t2 = setTimeout(() => map.invalidateSize(), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
}

function FitBounds({ points, resetKey }: { points: LivePoint[]; resetKey?: string }) {
  const map = useMap();
  const fitted = useRef('');
  useEffect(() => {
    const k = resetKey ?? '__all__';
    if (fitted.current === k || points.length === 0) return;
    const v = points.filter(p => p.gpsValid);
    if (!v.length) return;
    if (v.length === 1) map.setView([v[0]!.latitude, v[0]!.longitude], 14);
    else map.fitBounds(L.latLngBounds(v.map(p => [p.latitude, p.longitude])), { padding: [50, 50] });
    fitted.current = k;
  }, [map, points, resetKey]);
  return null;
}

function FlyToPoint({ target }: { target: { lat: number; lng: number; ts: number } | null }) {
  const map = useMap();
  const lastTs = useRef(0);
  useEffect(() => {
    if (!target || target.ts === lastTs.current) return;
    lastTs.current = target.ts;
    map.flyTo([target.lat, target.lng], 16, { animate: true, duration: 0.8 });
  }, [map, target]);
  return null;
}

function ClusterLayer({ points, deviceMap, vehicleDetails }: { points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>; }) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const sz = n >= 20 ? 44 : n >= 10 ? 40 : 34;
        return L.divIcon({
          html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#111;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${n>=10?12:13}px;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${n}</div>`,
          className: '', iconSize: [sz, sz], iconAnchor: [sz/2, sz/2],
        });
      },
    });
    for (const pt of points) {
      const dv = deviceMap.get(pt.imei);
      const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
      const plate = dv?.plate || pt.imei;
      const offline = isOffline(pt);
      const marker = L.marker([pt.latitude, pt.longitude], { icon: makeCarIcon(pt.heading, offline, plate, pt.speedKmh) });
      const popup = L.popup({ minWidth: 280, maxWidth: 340 }).setContent(buildPopupHtml(pt, dv, vc, plate, 'Fetching…'));
      marker.bindPopup(popup);
      let wasOpen = false;
      marker.on('mousedown', () => { wasOpen = marker.isPopupOpen(); });
      marker.on('click', () => { if (wasOpen) marker.closePopup(); });
      marker.on('popupopen', () => {
        Promise.all([
          reverseGeocode(pt.latitude, pt.longitude).catch(() => `${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`),
          fetchStats(pt.imei).catch(() => null),
        ]).then(([addr, stats]) => popup.setContent(buildPopupHtml(pt, dv, vc, plate, addr, stats)));
      });
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [map, points, deviceMap, vehicleDetails]);
  return null;
}

// ── Left Panel Icons ─────────────────────────────────────────────────────────

function IconPower({ on }: { on?: boolean | null }) {
  const c = on === true ? '#16a34a' : on === false ? '#dc2626' : '#9ca3af';
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
  );
}

function IconBattery({ level }: { level?: number | null }) {
  const pct = level != null ? level / 5 : 0;
  const fc = level == null ? '#9ca3af' : level <= 1 ? '#ef4444' : level <= 3 ? '#f59e0b' : '#16a34a';
  return (
    <svg width="17" height="10" viewBox="0 0 18 11" style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="15" height="10" rx="2" stroke="#9ca3af" strokeWidth="1" fill="none"/>
      <rect x="16" y="3.5" width="1.5" height="4" rx="0.75" fill="#9ca3af"/>
      {pct > 0 && <rect x="1.5" y="1.5" width={Math.max(1, 12 * pct)} height="8" rx="1.5" fill={fc}/>}
    </svg>
  );
}

function IconSignal({ level }: { level?: number | null }) {
  const bars = level != null ? Math.min(4, Math.max(0, level)) : 0;
  const fc = bars === 0 ? '#9ca3af' : bars <= 1 ? '#ef4444' : bars === 2 ? '#f59e0b' : '#16a34a';
  return (
    <svg width="15" height="12" viewBox="0 0 16 13" style={{ flexShrink: 0 }}>
      {[0,1,2,3].map(i => (
        <rect key={i} x={i*4} y={12-(i+1)*3} width="3" height={(i+1)*3} rx="0.5" fill={i < bars ? fc : '#d1d5db'}/>
      ))}
    </svg>
  );
}

function ThreeDots({ dark }: { dark: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, color: hov ? '#dc2626' : (dark ? '#555' : '#9ca3af'), display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.12s' }}
    >
      <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
        <circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6.5" r="1.5"/><circle cx="1.5" cy="11.5" r="1.5"/>
      </svg>
    </button>
  );
}

// ── Vehicle Card (3-col grid) ─────────────────────────────────────────────────

function VehicleCard({ pt, plate, onSelect, dark }: { pt: LivePoint; plate: string; onSelect: () => void; dark: boolean; }) {
  const offline = isOffline(pt);
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        padding: '7px 7px 6px 9px',
        border: `1px solid ${dark ? '#242424' : '#efefef'}`,
        borderLeft: `3px solid ${offline ? '#dc2626' : '#16a34a'}`,
        borderRadius: 6,
        cursor: 'pointer',
        background: hov ? (dark ? '#222' : '#f9fafb') : (dark ? '#1a1a1a' : '#fff'),
        transition: 'background 0.1s',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</div>
      <div style={{ fontSize: 10, color: dark ? '#555' : '#9ca3af', lineHeight: 1 }}>{Math.round(pt.speedKmh)} km/h</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
        <IconPower on={pt.ignition}/>
        <IconBattery level={pt.voltageLevel}/>
        <IconSignal level={pt.gsmSignal}/>
        <div style={{ flex: 1 }}/>
        <ThreeDots dark={dark}/>
      </div>
    </div>
  );
}

function VehicleGrid({ pts, deviceMap, onSelect, dark }: { pts: LivePoint[]; deviceMap: DMap; onSelect: (imei: string) => void; dark: boolean; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, padding: '6px 8px' }}>
      {pts.map(pt => {
        const plate = deviceMap.get(pt.imei)?.plate || pt.imei.slice(-8);
        return <VehicleCard key={pt.imei} pt={pt} plate={plate} onSelect={() => onSelect(pt.imei)} dark={dark}/>;
      })}
    </div>
  );
}

// ── Group Section ────────────────────────────────────────────────────────────

function GroupSection({ group, pts, deviceMap, onSelect, collapsed, onToggle, onEdit, dark }: {
  group: VehicleGroup; pts: LivePoint[]; deviceMap: DMap;
  onSelect: (imei: string) => void; collapsed: boolean;
  onToggle: () => void; onEdit: () => void; dark: boolean;
}) {
  const gpPts = pts.filter(p => group.imeis.includes(p.imei));
  const [hov, setHov] = useState(false);
  return (
    <div>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px 7px 10px', background: hov ? (dark ? '#222' : '#f0f0f0') : (dark ? '#1c1c1c' : '#f7f7f7'), borderBottom: `1px solid ${dark ? '#242424' : '#ebebeb'}`, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 9, color: dark ? '#555' : '#999', flexShrink: 0 }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
        <span style={{ fontSize: 10, color: dark ? '#555' : '#bbb', flexShrink: 0, marginRight: 2 }}>{gpPts.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, color: dark ? '#555' : '#aaa', display: 'flex', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
          </svg>
        </button>
      </div>
      {!collapsed && <VehicleGrid pts={gpPts} deviceMap={deviceMap} onSelect={onSelect} dark={dark}/>}
    </div>
  );
}

// ── Shared modal vehicle list ────────────────────────────────────────────────

function ModalVehicleList({ allImeis, points, deviceMap, sel, toggle, dark }: {
  allImeis: string[]; points: LivePoint[]; deviceMap: DMap;
  sel: Set<string>; toggle: (imei: string) => void; dark: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
      {allImeis.map(imei => {
        const plate = deviceMap.get(imei)?.plate || imei.slice(-8);
        const pt = points.find(p => p.imei === imei);
        const chk = sel.has(imei);
        const offline = pt ? isOffline(pt) : true;
        return (
          <label key={imei} onClick={() => toggle(imei)} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 8px', borderRadius: 7, border: `2px solid ${chk ? '#dc2626' : (dark ? '#2a2a2a' : '#e5e7eb')}`, cursor: 'pointer', background: chk ? (dark ? '#2a1010' : '#fff5f5') : (dark ? '#161616' : '#fafafa'), transition: 'border-color 0.12s, background 0.12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={chk} onChange={() => toggle(imei)} onClick={e => e.stopPropagation()} style={{ flexShrink: 0, accentColor: '#dc2626' }}/>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</span>
            </div>
            <span style={{ fontSize: 10, color: offline ? '#dc2626' : '#16a34a', fontWeight: 500 }}>{offline ? 'Offline' : `${Math.round(pt!.speedKmh)} km/h`}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Create Group Modal ───────────────────────────────────────────────────────

function CreateGroupModal({ points, deviceMap, onClose, onCreate, dark }: {
  points: LivePoint[]; deviceMap: DMap;
  onClose: () => void; onCreate: (name: string, imeis: string[]) => void; dark: boolean;
}) {
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (imei: string) => setSel(p => { const n = new Set(p); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  const allImeis = points.map(p => p.imei);
  const allSelected = allImeis.length > 0 && allImeis.every(i => sel.has(i));
  const card: React.CSSProperties = { background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 14, padding: 24, width: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', marginBottom: 16 }}>Create Group</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={inp} autoFocus/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: dark ? '#666' : '#aaa', flex: 1 }}>{sel.size} of {allImeis.length} selected</span>
          <button onClick={() => setSel(new Set(allImeis))} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' }}>Select All</button>
          <button onClick={() => setSel(new Set())} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' }}>Deselect All</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {points.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>No vehicles online</div>
          : <ModalVehicleList allImeis={allImeis} points={points} deviceMap={deviceMap} sel={sel} toggle={toggle} dark={dark}/>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { if (name.trim() && sel.size > 0) { onCreate(name.trim(), [...sel]); onClose(); } }} disabled={!name.trim() || sel.size === 0} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: !name.trim() || sel.size === 0 ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !name.trim() || sel.size === 0 ? 'not-allowed' : 'pointer' }}>
            Create {sel.size > 0 ? `(${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Group Modal ─────────────────────────────────────────────────────────

function EditGroupModal({ group, points, deviceMap, onClose, onSave, onDelete, dark }: {
  group: VehicleGroup; points: LivePoint[]; deviceMap: DMap;
  onClose: () => void; onSave: (id: string, name: string, imeis: string[]) => void;
  onDelete: (id: string) => void; dark: boolean;
}) {
  const [name, setName] = useState(group.name);
  const [sel, setSel] = useState<Set<string>>(new Set(group.imeis));
  const toggle = (imei: string) => setSel(p => { const n = new Set(p); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  const allImeis = [...new Set([...group.imeis, ...points.map(p => p.imei)])];
  const card: React.CSSProperties = { background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 14, padding: 24, width: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', marginBottom: 16 }}>Edit Group</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={inp}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: dark ? '#666' : '#aaa', flex: 1 }}>{sel.size} of {allImeis.length} selected</span>
          <button onClick={() => setSel(new Set(allImeis))} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' }}>Select All</button>
          <button onClick={() => setSel(new Set())} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' }}>Deselect All</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          <ModalVehicleList allImeis={allImeis} points={points} deviceMap={deviceMap} sel={sel} toggle={toggle} dark={dark}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => { onDelete(group.id); onClose(); }} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete Group</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { if (name.trim()) { onSave(group.id, name.trim(), [...sel]); onClose(); } }} disabled={!name.trim()} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: name.trim() ? '#dc2626' : '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel({ points, deviceMap, vehicleDetails: _vd, onSelectVehicle, dark }: {
  points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  onSelectVehicle: (imei: string) => void; dark: boolean;
}) {
  const [groups, setGroups] = useState<VehicleGroup[]>(loadGroups);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);

  useEffect(() => { saveGroups(groups); }, [groups]);

  const createGroup = (name: string, imeis: string[]) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setGroups(p => [...p, { id, name, imeis }]);
  };
  const saveGroup = (id: string, name: string, imeis: string[]) => setGroups(p => p.map(g => g.id === id ? { ...g, name, imeis } : g));
  const deleteGroup = (id: string) => setGroups(p => p.filter(g => g.id !== id));
  const toggleCollapse = (id: string) => setCollapsed(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const groupedImeis = new Set(groups.flatMap(g => g.imeis));
  const q = search.trim().toLowerCase();
  const matches = (imei: string) => {
    if (!q) return true;
    const plate = deviceMap.get(imei)?.plate ?? imei;
    return plate.toLowerCase().includes(q) || imei.includes(q);
  };
  const filtered = points.filter(p => matches(p.imei));
  const ungrouped = filtered.filter(p => !groupedImeis.has(p.imei));

  return (
    <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 10px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>
          Vehicles <span style={{ fontSize: 11, fontWeight: 400, color: dark ? '#555' : '#aaa' }}>{points.length}</span>
        </span>
        <button onClick={() => setShowCreate(true)} title="Create group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', color: dark ? '#888' : '#666' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 7, padding: '5px 9px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none' }}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map(group => {
          const gImeis = group.imeis.filter(matches);
          const gPts = points.filter(p => gImeis.includes(p.imei));
          if (q && gPts.length === 0) return null;
          return (
            <GroupSection key={group.id} group={{ ...group, imeis: gImeis }} pts={points} deviceMap={deviceMap}
              onSelect={onSelectVehicle} collapsed={collapsed.has(group.id)} onToggle={() => toggleCollapse(group.id)}
              onEdit={() => setEditingGroup(group)} dark={dark}/>
          );
        })}

        {ungrouped.length > 0 && (
          <>
            {groups.length > 0 && <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: dark ? '#444' : '#ccc', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>Ungrouped</div>}
            <VehicleGrid pts={ungrouped} deviceMap={deviceMap} onSelect={onSelectVehicle} dark={dark}/>
          </>
        )}

        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>{search ? 'No results' : 'No vehicles online'}</div>}
      </div>

      {showCreate && <CreateGroupModal points={points} deviceMap={deviceMap} onClose={() => setShowCreate(false)} onCreate={createGroup} dark={dark}/>}
      {editingGroup && <EditGroupModal group={editingGroup} points={points} deviceMap={deviceMap} onClose={() => setEditingGroup(null)} onSave={saveGroup} onDelete={deleteGroup} dark={dark}/>}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { dark } = useTheme();
  const { selectedCityId } = useCityFilter();
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceMap, setDeviceMap] = useState<DMap>(new Map());
  const [vehicleDetails, setVehicleDetails] = useState<Map<string, VehicleDetail>>(new Map());
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; ts: number } | null>(null);

  const load = async () => {
    try { const { data } = await api.get<LivePoint[]>('/telemetry/live'); setPoints(data.filter(p => p.gpsValid)); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    Promise.all([api.get<DeviceInfo[]>('/devices'), api.get<VehicleDetail[]>('/vehicles')]).then(([dr, vr]) => {
      const dm: DMap = new Map();
      dr.data.forEach(d => dm.set(d.imei, { plate: d.vehicle?.licensePlate ?? null, vehicleId: d.vehicle?.id ?? null, cityId: d.cityId }));
      setDeviceMap(dm);
      const vm = new Map<string, VehicleDetail>();
      vr.data.forEach(v => vm.set(v.id, v));
      setVehicleDetails(vm);
    }).catch(() => {});
  }, []);

  const visiblePoints = selectedCityId ? points.filter(p => deviceMap.get(p.imei)?.cityId === selectedCityId) : points;
  const counts = { moving: 0, idle: 0, offline: 0 };
  visiblePoints.forEach(p => counts[vehicleStatus(p)]++);

  const handleSelect = (imei: string) => {
    const pt = visiblePoints.find(p => p.imei === imei);
    if (pt) setFlyTarget({ lat: pt.latitude, lng: pt.longitude, ts: Date.now() });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader title="Live Map" count={visiblePoints.length}/>

      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails} onSelectVehicle={handleSelect} dark={dark}/>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Status chips */}
          <div style={{ display: 'flex', gap: 10, paddingBottom: 12, flexWrap: 'wrap' }}>
            {(['moving', 'idle', 'offline'] as const).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${STATUS_COLOR[s]}18`, fontSize: 12.5, fontWeight: 500, color: STATUS_COLOR[s] }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }}/>
                {STATUS_LABEL[s]}: {counts[s]}
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, position: 'relative' }}>
            {loading && <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#aaa', fontSize: 13, background: dark ? '#1a1a1a' : '#f8f9fa', borderRadius: 12 }}>Loading map…</div>}
            <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" className={dark ? 'map-tiles-dark' : ''}/>
              <InvalidateSize/>
              <FitBounds points={visiblePoints} resetKey={selectedCityId || '__all__'}/>
              <FlyToPoint target={flyTarget}/>
              <ClusterLayer points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails}/>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
