import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import AlertsModal, { AlertRecord } from '../components/AlertsModal';
import GeofencesModal, { Geofence, CircleCoords, PolygonCoords } from '../components/GeofencesModal';
import { useTheme } from '../contexts/ThemeContext';
import { useCityFilter } from '../contexts/CityFilterContext';
import { useAlert, AlertSettings } from '../contexts/AlertContext';

// ── Interfaces ────────────────────────────────────────────────────────────────

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
interface TripPoint {
  id: string; imei: string; latitude: number; longitude: number;
  speedKmh: number; heading: number; timestamp: string; gpsValid: boolean;
  ignition?: boolean | null;
}
interface HistoryMode { imei: string; plate: string; from: string; to: string; }
interface TimelineEvent { type: 'parked' | 'idle' | 'driving'; startTime: string; endTime: string; durationSec: number; lat: number; lng: number; avgSpeed?: number; }

// ── Utilities ─────────────────────────────────────────────────────────────────

const MOVING_SPEED = 5; // km/h — professional threshold: GPS noise stays below this

function isOffline(pt: LivePoint) { return Date.now() - new Date(pt.timestamp).getTime() > 10 * 60 * 1000; }
function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'parked' | 'offline' {
  if (isOffline(pt)) return 'offline';
  if (pt.speedKmh >= MOVING_SPEED) return 'moving';
  if (pt.ignition === true) return 'idle';    // engine on, not moving
  return 'parked';                             // engine off (or no ignition data)
}
const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af' } as const;
const STATUS_LABEL = { moving: 'Moving', idle: 'Idle', parked: 'Parked', offline: 'Offline' } as const;
const VOLT_LABELS = ['No Power', 'Critical', 'Low', 'Medium', 'High', 'Full'];

type MapStyle = 'street' | 'satellite' | 'terrain' | 'dark';
const TILE_CONFIG: Record<MapStyle, { url: string; attribution: string; darkFilter?: boolean; label: string; icon: string }> = {
  street:    { label: 'Street',    icon: '🗺', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
  satellite: { label: 'Satellite', icon: '🛰', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  terrain:   { label: 'Terrain',   icon: '⛰', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  dark:      { label: 'Dark',      icon: '🌙', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', darkFilter: true },
};

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
function formatTsFull(ts: string) {
  const d = new Date(ts);
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}
function getPresetRange(preset: 'lastHour' | 'today' | 'yesterday'): { from: string; to: string } {
  const now = new Date();
  const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  if (preset === 'lastHour') return { from: toLocal(new Date(now.getTime() - 3_600_000)), to: toLocal(now) };
  if (preset === 'today') { const f = new Date(now); f.setHours(0,0,0,0); return { from: toLocal(f), to: toLocal(now) }; }
  const f = new Date(now); f.setDate(f.getDate()-1); f.setHours(0,0,0,0);
  const t = new Date(now); t.setDate(t.getDate()-1); t.setHours(23,59,0,0);
  return { from: toLocal(f), to: toLocal(t) };
}
function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const dL = (lng2 - lng1) * r;
  const y = Math.sin(dL) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dL);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function tripSegType(p: TripPoint): 'parked' | 'idle' | 'driving' {
  if (p.speedKmh >= MOVING_SPEED) return 'driving';
  if (p.ignition === true) return 'idle';  // engine on, speed < threshold
  return 'parked';                          // engine off or no ignition data
}
function deriveTimeline(pts: TripPoint[]): TimelineEvent[] {
  if (pts.length === 0) return [];
  const makeEvent = (type: 'parked' | 'idle' | 'driving', si: number, ei: number): TimelineEvent => {
    const sp = pts[si], ep = pts[ei];
    const seg = pts.slice(si, ei + 1);
    const avgSpeed = type === 'driving' && seg.length > 0
      ? Math.round(seg.reduce((s, p) => s + p.speedKmh, 0) / seg.length)
      : undefined;
    return { type, startTime: sp.timestamp, endTime: ep.timestamp, durationSec: Math.max(0, Math.round((new Date(ep.timestamp).getTime() - new Date(sp.timestamp).getTime()) / 1000)), lat: sp.latitude, lng: sp.longitude, avgSpeed };
  };
  const events: TimelineEvent[] = [];
  let type = tripSegType(pts[0]);
  let si = 0;
  for (let i = 1; i < pts.length; i++) {
    const next = tripSegType(pts[i]);
    if (next !== type) { events.push(makeEvent(type, si, i - 1)); type = next; si = i; }
  }
  events.push(makeEvent(type, si, pts.length - 1));
  return events;
}
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function predictDR(lat: number, lng: number, speedKmh: number, headingDeg: number, elapsedMs: number): [number, number] {
  if (speedKmh < 3) return [lat, lng];
  const distM = (speedKmh / 3.6) * (elapsedMs / 1000);
  const headRad = (headingDeg * Math.PI) / 180;
  const R = 6371000;
  const dLat = (distM * Math.cos(headRad)) / R * (180 / Math.PI);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = cosLat > 0.001 ? (distM * Math.sin(headRad)) / (R * cosLat) * (180 / Math.PI) : 0;
  return [lat + dLat, lng + dLng];
}

const EMA_ALPHA = 0.75;
const POLL_MS = 5_000;

const notifCooldownMap = new Map<string, number>();
function fireNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/car-icon.png' }); } catch {}
}

// ── Responsive hook ───────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ── Groups ────────────────────────────────────────────────────────────────────

const GK = 'yotrack_map_groups_v1';
function loadGroups(): VehicleGroup[] { try { return JSON.parse(localStorage.getItem(GK) ?? '[]'); } catch { return []; } }
function saveGroups(g: VehicleGroup[]) { try { localStorage.setItem(GK, JSON.stringify(g)); } catch {} }

// ── Stats / Geocode ───────────────────────────────────────────────────────────

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

// ── Road Snapping ─────────────────────────────────────────────────────────────

const snapCache = new Map<string, [number, number]>();
const snapPending = new Set<string>();
async function snapToRoad(lat: number, lng: number): Promise<[number, number]> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (snapCache.has(key)) return snapCache.get(key)!;
  if (snapPending.has(key)) return [lat, lng];
  snapPending.add(key);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`, { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await r.json() as { code: string; waypoints?: { location: [number, number] }[] };
    if (j.code === 'Ok' && j.waypoints?.[0]) {
      const [sLng, sLat] = j.waypoints[0].location;
      if (snapCache.size > 2000) snapCache.delete(snapCache.keys().next().value!);
      const result: [number, number] = [sLat, sLng];
      snapCache.set(key, result); snapPending.delete(key);
      return result;
    }
  } catch {}
  snapPending.delete(key);
  snapCache.set(key, [lat, lng]);
  return [lat, lng];
}

// ── Car Icon ──────────────────────────────────────────────────────────────────

function makeCarIcon(heading: number, status: 'moving' | 'idle' | 'parked' | 'offline', plate: string, speed: number, alertType?: 'speed' | 'idle'): L.DivIcon {
  const color = STATUS_COLOR[status];
  let glow: string;
  if (alertType === 'speed') glow = 'drop-shadow(0 0 10px #dc2626) drop-shadow(0 0 5px #dc2626)';
  else if (alertType === 'idle') glow = 'drop-shadow(0 0 10px #f59e0b) drop-shadow(0 0 5px #f59e0b)';
  else glow = `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 3px ${color}bb)`;
  const borderColor = alertType === 'speed' ? '#dc2626' : alertType === 'idle' ? '#f59e0b' : color;
  const label = plate ? `${plate} (${Math.round(speed)} kph)` : `${Math.round(speed)} kph`;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-family:system-ui,sans-serif">
    <img src="/car-icon.png" style="display:block;width:38px;height:38px;transform:rotate(${(heading + 180) % 360}deg);transform-origin:center center;filter:${glow};pointer-events:none"/>
    <div style="background:rgba(10,10,10,0.85);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;letter-spacing:0.3px;border-left:3px solid ${borderColor};pointer-events:none">${label}</div>
  </div>`;
  return L.divIcon({ html, className: 'leaflet-interactive', iconSize: [150, 62], iconAnchor: [75, 42], popupAnchor: [0, -46] });
}

// ── Popup HTML ─────────────────────────────────────────────────────────────────

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
  const svUrl = `https://maps.google.com/maps?layer=c&cbll=${pt.latitude},${pt.longitude}`;
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
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f0f0f0">
      <a href="${svUrl}" target="_blank" rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#1a73e8;text-decoration:none;padding:4px 10px;border-radius:5px;border:1px solid #d0e2f9;background:#f0f6ff">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Street View
      </a>
    </div>
  </div>`;
}

// ── MarkerState ───────────────────────────────────────────────────────────────

type DEntry = { plate: string | null; vehicleId: string | null; cityId: string | null };
interface MarkerState {
  marker: L.Marker; popup: L.Popup;
  ctx: { pt: LivePoint; dv: DEntry | undefined; vc: VehicleDetail | undefined; plate: string };
  pt: LivePoint;
  emaLat: number; emaLng: number;
  dispLat: number; dispLng: number;
  animFromLat: number; animFromLng: number;
  animToLat: number; animToLng: number;
  animStart: number; animDur: number;
}

// ── Map components ────────────────────────────────────────────────────────────

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
    map.flyTo([target.lat, target.lng], 18, { animate: true, duration: 0.8 });
  }, [map, target]);
  return null;
}

// Distance Tool — click to add points, right-click to undo, dblclick to reset
function DistanceTool({ active, distanceModeRef }: { active: boolean; distanceModeRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  const waypointsRef = useRef<L.LatLng[]>([]);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    distanceModeRef.current = active;
    if (!active) {
      if (layerRef.current) { layerRef.current.clearLayers(); map.removeLayer(layerRef.current); layerRef.current = null; }
      waypointsRef.current = [];
      map.getContainer().style.cursor = '';
      return;
    }
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    map.getContainer().style.cursor = 'crosshair';

    function redraw() {
      layer.clearLayers();
      const pts = waypointsRef.current;
      if (!pts.length) return;
      pts.forEach((p, i) => {
        L.circleMarker(p, { radius: 5, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1, weight: 2 }).addTo(layer);
        if (i === 0) {
          L.marker(p, { icon: L.divIcon({ html: '<div style="background:#dc2626;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;white-space:nowrap;font-family:system-ui;font-weight:600;margin-left:10px">Start</div>', className: 'leaflet-interactive', iconSize: [44, 18], iconAnchor: [-6, 9] }) }).addTo(layer);
        }
      });
      if (pts.length >= 2) {
        L.polyline(pts, { color: '#dc2626', weight: 2.5, opacity: 0.85, dashArray: '6 4' }).addTo(layer);
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i-1]!.lat, pts[i-1]!.lng, pts[i]!.lat, pts[i]!.lng);
        const label = total < 1 ? `${(total * 1000).toFixed(0)} m` : `${total.toFixed(2)} km`;
        const last = pts[pts.length - 1]!;
        L.marker(last, { icon: L.divIcon({ html: `<div style="background:#111;color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;white-space:nowrap;font-family:system-ui;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);margin-left:14px">${label}</div>`, className: 'leaflet-interactive', iconSize: [80, 22], iconAnchor: [-10, 11] }) }).addTo(layer);
      }
    }

    const onClick = (e: L.LeafletMouseEvent) => { waypointsRef.current = [...waypointsRef.current, e.latlng]; redraw(); };
    const onCtx = () => { waypointsRef.current = waypointsRef.current.slice(0, -1); redraw(); };
    const onDbl = () => { waypointsRef.current = []; redraw(); };
    map.on('click', onClick);
    map.on('contextmenu', onCtx);
    map.on('dblclick', onDbl);
    return () => {
      map.off('click', onClick); map.off('contextmenu', onCtx); map.off('dblclick', onDbl);
      if (layerRef.current) { layerRef.current.clearLayers(); map.removeLayer(layerRef.current); layerRef.current = null; }
      map.getContainer().style.cursor = '';
      distanceModeRef.current = false;
    };
  }, [active, map, distanceModeRef]);
  return null;
}

// Trip Replay inner — animates marker + polyline inside a MapContainer
function TripReplayInner({ points, currentIdx }: { points: TripPoint[]; currentIdx: number }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const passedRef = useRef<L.Polyline | null>(null);
  const fullRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!points.length) return;
    const coords: [number, number][] = points.map(p => [p.latitude, p.longitude]);
    fullRef.current = L.polyline(coords, { color: '#d1d5db', weight: 3, opacity: 0.5 }).addTo(map);
    passedRef.current = L.polyline([], { color: '#dc2626', weight: 3, opacity: 0.9 }).addTo(map);
    markerRef.current = L.marker(coords[0]!, { icon: makeCarIcon(points[0]!.heading, 'moving', '', points[0]!.speedKmh) }).addTo(map);
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    return () => {
      if (fullRef.current) map.removeLayer(fullRef.current);
      if (passedRef.current) map.removeLayer(passedRef.current);
      if (markerRef.current) map.removeLayer(markerRef.current);
    };
  }, [map, points]);

  useEffect(() => {
    const pt = points[currentIdx];
    if (!pt) return;
    const ll: [number, number] = [pt.latitude, pt.longitude];
    markerRef.current?.setLatLng(ll);
    markerRef.current?.setIcon(makeCarIcon(pt.heading, 'moving', '', pt.speedKmh));
    passedRef.current?.setLatLngs(points.slice(0, currentIdx + 1).map(p => [p.latitude, p.longitude]));
    map.panTo(ll, { animate: true, duration: 0.25 });
  }, [currentIdx, points, map]);
  return null;
}

// Cluster Layer with status colors + alert support
function ClusterLayer({ points, deviceMap, vehicleDetails, alertSettingsRef, distanceModeRef }: {
  points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  alertSettingsRef: React.MutableRefObject<AlertSettings>;
  distanceModeRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const stateRef = useRef<Map<string, MarkerState>>(new Map());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const sz = n >= 20 ? 44 : n >= 10 ? 40 : 34;
        const ms = cluster.getAllChildMarkers() as unknown as Array<{ _ytStatus?: string; _ytAlert?: string }>;
        let hasAlert = false;
        const counts: Record<string, number> = {};
        ms.forEach(m => {
          if (m._ytAlert) hasAlert = true;
          const s = m._ytStatus ?? 'offline';
          counts[s] = (counts[s] ?? 0) + 1;
        });
        let bg = '#6b7280', bdr = 'rgba(255,255,255,0.25)';
        if (hasAlert)              { bg = '#dc2626'; bdr = 'rgba(255,255,255,0.5)'; }
        else if (counts['moving']) { bg = '#16a34a'; bdr = 'rgba(255,255,255,0.3)'; }
        else if (counts['idle'])   { bg = '#f59e0b'; bdr = 'rgba(255,255,255,0.3)'; }
        return L.divIcon({
          html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};border:3px solid ${bdr};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${n>=10?12:13}px;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${n}</div>`,
          className: 'leaflet-interactive', iconSize: [sz, sz], iconAnchor: [sz/2, sz/2],
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);

    group.on('click', (e: L.LeafletEvent) => {
      if (distanceModeRef.current) return;
      const marker = (e as unknown as { layer: L.Marker }).layer;
      if (!marker?.getPopup?.()) return;
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
      marker.openPopup();
    });

    let prevTime = performance.now();
    function rafLoop(now: number) {
      const dt = now - prevTime; prevTime = now;
      stateRef.current.forEach(s => {
        const elapsed = now - s.animStart;
        const t = Math.min(elapsed / s.animDur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        let lat: number, lng: number;
        if (t < 1) { lat = s.animFromLat + (s.animToLat - s.animFromLat) * ease; lng = s.animFromLng + (s.animToLng - s.animFromLng) * ease; }
        else { [lat, lng] = predictDR(s.dispLat, s.dispLng, s.pt.speedKmh, s.pt.heading, dt); }
        s.dispLat = lat; s.dispLng = lng;
        s.marker.setLatLng([lat, lng]);
      });
      rafRef.current = requestAnimationFrame(rafLoop);
    }
    rafRef.current = requestAnimationFrame(rafLoop);
    return () => { cancelAnimationFrame(rafRef.current); map.removeLayer(group); stateRef.current.clear(); };
  }, [map, distanceModeRef]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const prev = stateRef.current;
    const next = new Map<string, MarkerState>();
    const imeiSet = new Set(points.map(p => p.imei));
    prev.forEach((s, imei) => { if (!imeiSet.has(imei)) group.removeLayer(s.marker); });

    for (const pt of points) {
      const dv = deviceMap.get(pt.imei);
      const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
      const plate = dv?.plate || pt.imei;
      const status = vehicleStatus(pt);
      const as = alertSettingsRef.current;
      const alertType: 'speed' | 'idle' | undefined =
        (as.speedLimit > 0 && pt.speedKmh > as.speedLimit) ? 'speed'
        : (as.idleMinutes > 0 && status === 'idle') ? 'idle'
        : undefined;
      const existing = prev.get(pt.imei);

      if (existing) {
        const emaLat = EMA_ALPHA * pt.latitude + (1 - EMA_ALPHA) * existing.emaLat;
        const emaLng = EMA_ALPHA * pt.longitude + (1 - EMA_ALPHA) * existing.emaLng;
        Object.assign(existing.ctx, { pt, dv, vc, plate });
        existing.marker.setIcon(makeCarIcon(pt.heading, status, plate, pt.speedKmh, alertType));
        (existing.marker as any)._ytStatus = status;
        (existing.marker as any)._ytAlert = alertType;
        const updated: MarkerState = {
          ...existing, pt, emaLat, emaLng,
          animFromLat: existing.dispLat, animFromLng: existing.dispLng,
          animToLat: emaLat, animToLng: emaLng,
          animStart: performance.now(), animDur: POLL_MS * 0.85,
        };
        next.set(pt.imei, updated);
        snapToRoad(emaLat, emaLng).then(([sLat, sLng]) => {
          const s = stateRef.current.get(pt.imei);
          if (s && (Math.abs(sLat - emaLat) > 0.000005 || Math.abs(sLng - emaLng) > 0.000005)) {
            s.animToLat = sLat; s.animToLng = sLng; s.emaLat = sLat; s.emaLng = sLng;
          }
        });
      } else {
        const popup = L.popup({ minWidth: 280, maxWidth: 340 });
        const ctx = { pt, dv, vc, plate };
        const marker = L.marker([pt.latitude, pt.longitude], { icon: makeCarIcon(pt.heading, status, plate, pt.speedKmh, alertType) });
        (marker as any)._ytStatus = status;
        (marker as any)._ytAlert = alertType;
        marker.bindPopup(popup.setContent(buildPopupHtml(pt, dv, vc, plate, 'Fetching…')));
        marker.on('popupopen', () => {
          Promise.all([
            reverseGeocode(ctx.pt.latitude, ctx.pt.longitude).catch(() => `${ctx.pt.latitude.toFixed(5)}, ${ctx.pt.longitude.toFixed(5)}`),
            fetchStats(ctx.pt.imei).catch(() => null),
          ]).then(([addr, stats]) => popup.setContent(buildPopupHtml(ctx.pt, ctx.dv, ctx.vc, ctx.plate, addr, stats)));
        });
        group.addLayer(marker);
        next.set(pt.imei, {
          marker, popup, ctx, pt,
          emaLat: pt.latitude, emaLng: pt.longitude,
          dispLat: pt.latitude, dispLng: pt.longitude,
          animFromLat: pt.latitude, animFromLng: pt.longitude,
          animToLat: pt.latitude, animToLng: pt.longitude,
          animStart: 0, animDur: 1,
        });
        snapToRoad(pt.latitude, pt.longitude).then(([sLat, sLng]) => {
          const s = stateRef.current.get(pt.imei);
          if (s) {
            s.emaLat = sLat; s.emaLng = sLng; s.dispLat = sLat; s.dispLng = sLng;
            s.animToLat = sLat; s.animToLng = sLng; s.marker.setLatLng([sLat, sLng]);
          }
        });
      }
    }
    stateRef.current = next;
    try { group.refreshClusters(); } catch {}
  }, [points, deviceMap, vehicleDetails, alertSettingsRef]);

  return null;
}

function TrailLayer({ trails, visibleImeis }: { trails: Map<string, [number,number][]>; visibleImeis: Set<string> }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Polyline[] = [];
    trails.forEach((pts, imei) => {
      if (!visibleImeis.has(imei) || pts.length < 2) return;
      const line = L.polyline(pts, { color: '#dc2626', weight: 2, opacity: 0.45, dashArray: '5 4' });
      line.addTo(map); layers.push(line);
    });
    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [map, trails, visibleImeis]);
  return null;
}

function GeofenceLayer({ geofences }: { geofences: Geofence[] }) {
  const map = useMap();
  const GF_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];
  useEffect(() => {
    const layers: L.Layer[] = [];
    geofences.forEach((gf, i) => {
      const color = GF_COLORS[i % GF_COLORS.length];
      let layer: L.Layer;
      if (gf.type === 'circle') {
        const c = gf.coordinates as CircleCoords;
        layer = L.circle([c.center[0], c.center[1]], { radius: c.radius, color, weight: 2, fillOpacity: 0.1 })
          .bindTooltip(gf.name, { sticky: true });
      } else {
        const p = gf.coordinates as PolygonCoords;
        layer = L.polygon(p.points as L.LatLngTuple[], { color, weight: 2, fillOpacity: 0.1 })
          .bindTooltip(gf.name, { sticky: true });
      }
      layer.addTo(map);
      layers.push(layer);
    });
    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [map, geofences]);
  return null;
}

function MapStyleSwitcher({ current, onChange, dark }: { current: MapStyle; onChange: (s: MapStyle) => void; dark: boolean }) {
  const [open, setOpen] = useState(false);
  const styles: MapStyle[] = ['street', 'satellite', 'terrain', 'dark'];
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
      <button onClick={() => setOpen(o => !o)} title="Map style"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#1e1e1e' : '#fff', color: dark ? '#e5e5e5' : '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>
        <span>{TILE_CONFIG[current].icon}</span> {TILE_CONFIG[current].label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 36, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 130 }}>
          {styles.map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: s === current ? (dark ? '#2a1010' : '#fff5f5') : 'transparent', color: s === current ? '#dc2626' : (dark ? '#e5e5e5' : '#333'), fontSize: 12.5, fontWeight: s === current ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { if (s !== current) e.currentTarget.style.background = dark ? '#222' : '#f5f5f5'; }}
              onMouseLeave={e => { if (s !== current) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontSize: 15 }}>{TILE_CONFIG[s].icon}</span> {TILE_CONFIG[s].label}
              {s === current && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Left Panel Icons ──────────────────────────────────────────────────────────

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

// ── Vehicle Menu (3-dot dropdown) ─────────────────────────────────────────────

// ── History Layer (map) ───────────────────────────────────────────────────────

function HistoryLayer({ points, speedLimit, selectedSegment }: { points: TripPoint[]; speedLimit: number; selectedSegment: TimelineEvent | null }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const highlightRef = useRef<L.Polyline | null>(null);
  const dPopupRef = useRef<L.Popup | null>(null);

  // Handle selectedSegment changes (timeline click)
  useEffect(() => {
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
    if (dPopupRef.current) { map.closePopup(dPopupRef.current); dPopupRef.current = null; }
    if (!selectedSegment) return;

    if (selectedSegment.type === 'parked' || selectedSegment.type === 'idle') {
      map.flyTo([selectedSegment.lat, selectedSegment.lng], 18, { animate: true, duration: 0.7 });
      const key = selectedSegment.startTime;
      const m = pMarkersRef.current.get(key);
      if (m) setTimeout(() => m.openPopup(), 800);
    } else {
      // Driving: highlight segment in green + popup with from/to
      const segPts = points.filter(p => p.timestamp >= selectedSegment.startTime && p.timestamp <= selectedSegment.endTime);
      if (segPts.length < 2) return;
      const coords: [number,number][] = segPts.map(p => [p.latitude, p.longitude]);
      highlightRef.current = L.polyline(coords, { color: '#16a34a', weight: 5, opacity: 0.95 }).addTo(map);
      try { map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], animate: true }); } catch {}
      // Popup at midpoint
      const mid = segPts[Math.floor(segPts.length / 2)];
      const addrFromId = `dhfrom-${Date.now()}`;
      const addrToId = `dhto-${Date.now()}`;
      const sp = segPts[0], ep = segPts[segPts.length - 1];
      const popupHtml = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:210px;line-height:1.6">
        <div style="font-weight:700;margin-bottom:6px;color:#16a34a;font-size:13px">Driving Segment</div>
        <div style="margin-bottom:5px">
          <div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">From</div>
          <div style="font-weight:600;font-size:11px">${formatTsFull(sp.timestamp)}</div>
          <div id="${addrFromId}" style="color:#555;font-size:10.5px">Loading…</div>
        </div>
        <div style="margin-bottom:5px">
          <div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">To</div>
          <div style="font-weight:600;font-size:11px">${formatTsFull(ep.timestamp)}</div>
          <div id="${addrToId}" style="color:#555;font-size:10.5px">Loading…</div>
        </div>
        <div style="display:flex;gap:14px;font-size:11px;margin-top:4px">
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase">Duration</div><div style="font-weight:600">${formatDuration(selectedSegment.durationSec)}</div></div>
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase">Avg Speed</div><div style="font-weight:600">${selectedSegment.avgSpeed ?? '—'} km/h</div></div>
        </div>
      </div>`;
      const popup = L.popup({ maxWidth: 280 }).setLatLng([mid.latitude, mid.longitude]).setContent(popupHtml);
      dPopupRef.current = popup;
      popup.addTo(map);
      reverseGeocode(sp.latitude, sp.longitude).then(a => { const el = document.getElementById(addrFromId); if (el) el.textContent = a; });
      reverseGeocode(ep.latitude, ep.longitude).then(a => { const el = document.getElementById(addrToId); if (el) el.textContent = a; });
    }
  }, [selectedSegment, map, points]);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    pMarkersRef.current.clear();
    if (points.length < 2) return;

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const coords: [number, number][] = points.map(p => [p.latitude, p.longitude]);
    L.polyline(coords, { color: '#dc2626', weight: 3.5, opacity: 0.85 }).addTo(layer);

    // Direction arrow markers — placed every ~N moving points, clickable with popup
    const step = Math.max(1, Math.floor(points.length / 200));
    for (let i = step; i < points.length - 1; i += step) {
      const p = points[i];
      if (p.speedKmh < MOVING_SPEED) continue; // only where vehicle is actually moving
      const bearing = calcBearing(points[i-1].latitude, points[i-1].longitude, p.latitude, p.longitude);
      const addrId = `arrow-${i}-${Date.now()}`;
      const html = `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%) rotate(${bearing}deg);cursor:pointer"><svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,2 17,18 10,14 3,18" fill="#2563eb" stroke="white" stroke-width="1.5"/></svg></div>`;
      const popup = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:175px;line-height:1.5">
        <div style="font-weight:700;margin-bottom:5px;color:#2563eb;font-size:13px">Moving</div>
        <div id="${addrId}" style="color:#555;margin-bottom:3px;font-size:11px">Loading address…</div>
        <div style="color:#9ca3af;font-size:10px;margin-bottom:5px">${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</div>
        <div style="display:flex;gap:14px;font-size:11px">
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">Time</div><div style="font-weight:600">${formatTsFull(p.timestamp)}</div></div>
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">Speed</div><div style="font-weight:600">${Math.round(p.speedKmh)} km/h</div></div>
        </div>
      </div>`;
      const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 60 });
      m.bindPopup(popup, { maxWidth: 260 }).addTo(layer);
      m.on('popupopen', async () => { const addr = await reverseGeocode(p.latitude, p.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
    }

    // Segment detection for P / I markers (3-state model)
    const segments: Array<{ type: 'parked'|'idle'|'driving'; start: number; end: number }> = [];
    let curSegType = tripSegType(points[0]);
    let si = 0;
    for (let i = 1; i < points.length; i++) {
      const nt = tripSegType(points[i]);
      if (nt !== curSegType) { segments.push({ type: curSegType, start: si, end: i-1 }); curSegType = nt; si = i; }
    }
    segments.push({ type: curSegType, start: si, end: points.length - 1 });

    segments.forEach((seg, idx) => {
      if (seg.type === 'driving') return;
      const sp = points[seg.start], ep = points[seg.end];
      const dur = Math.max(0, Math.round((new Date(ep.timestamp).getTime() - new Date(sp.timestamp).getTime()) / 1000));
      if (dur < 120) return; // skip stops shorter than 2 minutes
      const isIdle = seg.type === 'idle';
      const color = isIdle ? '#f59e0b' : '#dc2626';
      const label = isIdle ? 'I' : 'P';
      const title = isIdle ? 'Idle (Engine On)' : 'Parked';
      const addrId = `paddr-${idx}-${Date.now()}`;
      const html = `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:translate(-50%,-50%)">${label}</div>`;
      const popup = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:190px;line-height:1.5">
        <div style="font-weight:700;margin-bottom:5px;color:${color};font-size:13px">${title}</div>
        <div id="${addrId}" style="color:#555;margin-bottom:3px;font-size:11px">Loading address…</div>
        <div style="color:#9ca3af;font-size:10px;margin-bottom:6px">${sp.latitude.toFixed(5)}, ${sp.longitude.toFixed(5)}</div>
        <div style="display:flex;gap:14px;font-size:11px">
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">From</div><div style="font-weight:600">${formatTsFull(sp.timestamp)}</div></div>
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">To</div><div style="font-weight:600">${formatTsFull(ep.timestamp)}</div></div>
        </div>
        <div style="margin-top:5px;color:#6b7280;font-size:10.5px">Duration: ${formatDuration(dur)}</div>
      </div>`;
      const m = L.marker([sp.latitude, sp.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 100 });
      m.bindPopup(popup, { maxWidth: 280 }).addTo(layer);
      m.on('popupopen', async () => { const addr = await reverseGeocode(sp.latitude, sp.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
      pMarkersRef.current.set(sp.timestamp, m);
    });

    // Ignition-off (Stop) markers
    for (let i = 1; i < points.length; i++) {
      if (points[i-1].ignition === true && points[i].ignition === false) {
        const p = points[i];
        const addrId = `saddr-${i}-${Date.now()}`;
        const html = `<div style="width:28px;height:22px;border-radius:5px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:translate(-50%,-50%)">STOP</div>`;
        const popup = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:170px;line-height:1.5">
          <div style="font-weight:700;margin-bottom:5px;color:#f59e0b;font-size:13px">Ignition Off</div>
          <div id="${addrId}" style="color:#555;margin-bottom:3px;font-size:11px">Loading address…</div>
          <div style="color:#9ca3af;font-size:10px;margin-bottom:6px">${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</div>
          <div style="font-size:11px;font-weight:600">${formatTsFull(p.timestamp)}</div>
        </div>`;
        const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 200 });
        m.bindPopup(popup, { maxWidth: 260 }).addTo(layer);
        m.on('popupopen', async () => { const addr = await reverseGeocode(p.latitude, p.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
      }
    }

    // Speed alert labels
    if (speedLimit > 0) {
      let inOver = false, overStart = 0, maxSpd = 0;
      const flush = (endIdx: number) => {
        if (!inOver) return;
        const mid = Math.floor((overStart + endIdx) / 2);
        const p = points[Math.min(mid, points.length - 1)];
        const html = `<div style="background:#dc2626;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;border:1.5px solid #fff;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,0.3);transform:translate(-50%,-50%)">${Math.round(maxSpd)} km/h</div>`;
        L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 50 }).addTo(layer);
        inOver = false; maxSpd = 0;
      };
      for (let i = 0; i < points.length; i++) {
        if (points[i].speedKmh > speedLimit) { if (!inOver) { inOver = true; overStart = i; } maxSpd = Math.max(maxSpd, points[i].speedKmh); }
        else flush(i - 1);
      }
      flush(points.length - 1);
    }

    // Start dot (green) and end dot (black)
    const startHtml = `<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.4);transform:translate(-50%,-50%)"></div>`;
    const endHtml = `<div style="width:14px;height:14px;border-radius:50%;background:#111;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.4);transform:translate(-50%,-50%)"></div>`;
    L.marker([points[0].latitude, points[0].longitude], { icon: L.divIcon({ html: startHtml, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }) }).addTo(layer);
    L.marker([points[points.length-1].latitude, points[points.length-1].longitude], { icon: L.divIcon({ html: endHtml, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }) }).addTo(layer);

    try { map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] }); } catch {}

    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      if (dPopupRef.current) { map.closePopup(dPopupRef.current); dPopupRef.current = null; }
      pMarkersRef.current.clear();
    };
  }, [points, speedLimit, map]);

  return null;
}

// ── History Panel (left panel) ────────────────────────────────────────────────

function HistoryPanel({ mode, points, loading, dark, onLoad, onClear, allVehicles, onVehicleSelect, onSegmentClick }: {
  mode: HistoryMode; points: TripPoint[]; loading: boolean; dark: boolean;
  onLoad: (from: string, to: string) => void; onClear: () => void;
  allVehicles: Array<{ imei: string; plate: string }>;
  onVehicleSelect: (imei: string, plate: string, from: string, to: string) => void;
  onSegmentClick: (ev: TimelineEvent) => void;
}) {
  const [from, setFrom] = useState(mode.from);
  const [to, setTo] = useState(mode.to);
  const [vSearch, setVSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setFrom(mode.from); setTo(mode.to); }, [mode.from, mode.to]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDrop) return;
    const close = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showDrop]);

  const filteredVehicles = vSearch.trim()
    ? allVehicles.filter(v => v.plate.toLowerCase().includes(vSearch.toLowerCase()) || v.imei.includes(vSearch))
    : allVehicles;

  const timeline = useMemo(() => deriveTimeline(points), [points]);
  const totalKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += haversineKm(points[i-1].latitude, points[i-1].longitude, points[i].latitude, points[i].longitude);
    return d;
  }, [points]);

  const inp = (val: string, set: (v: string) => void) => (
    <input type="datetime-local" value={val} onChange={e => set(e.target.value)}
      style={{ width: '100%', fontSize: 11.5, padding: '5px 8px', border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, borderRadius: 6, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', outline: 'none', boxSizing: 'border-box' }}/>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: dark ? '#555' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Route History</div>
        </div>
        <button onClick={onClear} title="Exit history" style={{ border: 'none', background: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {/* Date form */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
        {/* Vehicle search */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: dark ? '#555' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Vehicle</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 7, padding: '5px 9px', border: `1px solid ${showDrop ? '#dc2626' : (dark ? '#333' : '#e5e7eb')}` }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              value={showDrop ? vSearch : mode.plate}
              onChange={e => { setVSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => { setVSearch(''); setShowDrop(true); }}
              placeholder="Search vehicle…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none' }}
            />
            {showDrop && vSearch && (
              <button onClick={() => setVSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex', flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {showDrop && filteredVehicles.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
              {filteredVehicles.slice(0, 20).map(v => (
                <button key={v.imei} onClick={() => { onVehicleSelect(v.imei, v.plate, from, to); setShowDrop(false); setVSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 11px', border: 'none', background: v.imei === mode.imei ? (dark ? '#2a1010' : '#fff0f0') : 'transparent', color: v.imei === mode.imei ? '#dc2626' : (dark ? '#e5e5e5' : '#333'), fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { if (v.imei !== mode.imei) { e.currentTarget.style.background = dark ? '#222' : '#f5f5f5'; } }}
                  onMouseLeave={e => { if (v.imei !== mode.imei) { e.currentTarget.style.background = 'transparent'; } }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {v.plate}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: dark ? '#555' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>From</div>
          {inp(from, setFrom)}
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: dark ? '#555' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>To</div>
          {inp(to, setTo)}
        </div>
        <button onClick={() => onLoad(from, to)} disabled={loading}
          style={{ padding: '8px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading
            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Loading…</>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>Show History</>}
        </button>
      </div>
      {/* Stats */}
      {points.length > 0 && (
        <div style={{ padding: '5px 12px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, display: 'flex', gap: 14, fontSize: 11, color: dark ? '#666' : '#9ca3af', flexShrink: 0 }}>
          <span>{points.length} points</span>
          <span>{totalKm.toFixed(1)} km</span>
        </div>
      )}
      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loading && points.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: dark ? '#555' : '#bbb', fontSize: 12 }}>No GPS data for this range</div>
        )}
        {points.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: dark ? '#2a2a2a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#888' : '#666'} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              </div>
              <div style={{ fontSize: 11, color: dark ? '#888' : '#666' }}>{formatTsFull(points[0].timestamp)}</div>
            </div>
            {timeline.map((ev, i) => (
              <div key={i} onClick={() => onSegmentClick(ev)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1a1a1a' : '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: ev.type === 'parked' ? '#dc2626' : ev.type === 'idle' ? '#f59e0b' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 10, fontWeight: 700 }}>
                  {ev.type === 'parked' ? 'P' : ev.type === 'idle' ? 'I' : 'D'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: dark ? '#ccc' : '#333' }}>{formatTsFull(ev.startTime)}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: ev.type === 'parked' ? '#dc2626' : ev.type === 'idle' ? '#f59e0b' : '#16a34a' }}>{formatDuration(ev.durationSec)}</div>
                </div>
                {ev.type === 'driving' && ev.avgSpeed !== undefined && (
                  <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{ev.avgSpeed} km/h</div>
                )}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={dark ? '#444' : '#ccc'} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9,18 15,12 9,6"/></svg>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function VehicleMenuButton({ pt, plate, dark, onViewOnMap, onTripReplay, onShowHistory, onCreateAlert, hasAlert }: {
  pt: LivePoint; plate: string; dark: boolean;
  onViewOnMap: () => void;
  onTripReplay: () => void;
  onShowHistory: (preset: 'lastHour' | 'today' | 'yesterday') => void;
  onCreateAlert: () => void;
  hasAlert: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

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
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };

  const svUrl = `https://maps.google.com/maps?layer=c&cbll=${pt.latitude},${pt.longitude}`;
  const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
  const CalIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

  const items: Array<{ label: string; icon: React.ReactNode; action: () => void; divider?: boolean }> = [
    { label: 'View on Map', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, action: () => { onViewOnMap(); setOpen(false); } },
    { label: 'Trip Replay', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5,3 19,12 5,21"/></svg>, action: () => { onTripReplay(); setOpen(false); } },
    { label: 'Street View', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, action: () => { window.open(svUrl, '_blank', 'noopener'); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: 'History: Last Hour', icon: <ClockIcon/>, action: () => { onShowHistory('lastHour'); setOpen(false); } },
    { label: 'History: Today', icon: <CalIcon/>, action: () => { onShowHistory('today'); setOpen(false); } },
    { label: 'History: Yesterday', icon: <CalIcon/>, action: () => { onShowHistory('yesterday'); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: hasAlert ? 'Edit Alert' : 'Create Alert', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="1" x2="12" y2="4"/></svg>, action: () => { onCreateAlert(); setOpen(false); } },
  ];

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, color: open ? '#dc2626' : (dark ? '#555' : '#9ca3af'), display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.12s' }}>
        <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
          <circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6.5" r="1.5"/><circle cx="1.5" cy="11.5" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9500, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, borderRadius: 9, boxShadow: '0 6px 24px rgba(0,0,0,0.22)', minWidth: 165, overflow: 'hidden' }}>
          {items.map((it, idx) => it.divider ? (
            <div key={idx} style={{ height: 1, background: dark ? '#2a2a2a' : '#f0f0f0', margin: '3px 0' }}/>
          ) : (
            <button key={it.label} onClick={(e) => { e.stopPropagation(); it.action(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 13px', border: 'none', background: 'transparent', color: dark ? '#e5e5e5' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = dark ? '#2a1010' : '#fff5f5'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = dark ? '#e5e5e5' : '#333'; }}>
              <span style={{ display: 'flex', flexShrink: 0 }}>{it.icon}</span> {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Vehicle Row ───────────────────────────────────────────────────────────────

function VehicleRow({ pt, plate, onSelect, dark, onTripReplay, onShowHistory, onCreateAlert, hasAlert }: {
  pt: LivePoint; plate: string; onSelect: () => void; dark: boolean;
  onTripReplay: () => void;
  onShowHistory: (preset: 'lastHour' | 'today' | 'yesterday') => void;
  onCreateAlert: () => void;
  hasAlert: boolean;
}) {
  const status = vehicleStatus(pt);
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 8px 7px 11px', borderLeft: `3px solid ${STATUS_COLOR[status]}`, borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: 'pointer', background: hov ? (dark ? '#1e1e1e' : '#f9fafb') : 'transparent' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</div>
      </div>
      <span style={{ fontSize: 10, color: dark ? '#666' : '#9ca3af', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>{Math.round(pt.speedKmh)} km/h</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <IconPower on={pt.ignition}/>
        <IconBattery level={pt.voltageLevel}/>
        <IconSignal level={pt.gsmSignal}/>
      </div>
      <VehicleMenuButton pt={pt} plate={plate} dark={dark} onViewOnMap={onSelect} onTripReplay={onTripReplay} onShowHistory={onShowHistory} onCreateAlert={onCreateAlert} hasAlert={hasAlert}/>
    </div>
  );
}

// ── Group Section ─────────────────────────────────────────────────────────────

function GroupSection({ group, pts, deviceMap, onSelect, collapsed, onToggle, onEdit, dark, onTripReplay, onShowHistory, onCreateAlert, getHasAlert }: {
  group: VehicleGroup; pts: LivePoint[]; deviceMap: DMap;
  onSelect: (imei: string) => void; collapsed: boolean;
  onToggle: () => void; onEdit: () => void; dark: boolean;
  onTripReplay: (imei: string, plate: string) => void;
  onShowHistory: (imei: string, plate: string, preset: 'lastHour' | 'today' | 'yesterday') => void;
  onCreateAlert: (imei: string) => void;
  getHasAlert: (imei: string) => boolean;
}) {
  const gpPts = pts.filter(p => group.imeis.includes(p.imei));
  const [hov, setHov] = useState(false);
  return (
    <div>
      <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px 7px 10px', background: hov ? (dark ? '#222' : '#f0f0f0') : (dark ? '#1c1c1c' : '#f7f7f7'), borderBottom: `1px solid ${dark ? '#242424' : '#ebebeb'}`, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ display: 'flex', flexShrink: 0, color: dark ? '#555' : '#999' }}>
          {collapsed
            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,6 15,12 9,18"/></svg>
            : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
        <span style={{ fontSize: 10, color: dark ? '#aaa' : '#555', flexShrink: 0, marginRight: 2 }}>{gpPts.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, color: dark ? '#aaa' : '#555', display: 'flex', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
          </svg>
        </button>
      </div>
      {!collapsed && gpPts.map(pt => {
        const plate = deviceMap.get(pt.imei)?.plate || pt.imei.slice(-8);
        return (
          <VehicleRow key={pt.imei} pt={pt} plate={plate}
            onSelect={() => onSelect(pt.imei)} dark={dark}
            onTripReplay={() => onTripReplay(pt.imei, plate)}
            onShowHistory={(preset) => onShowHistory(pt.imei, plate, preset)}
            onCreateAlert={() => onCreateAlert(pt.imei)}
            hasAlert={getHasAlert(pt.imei)}/>
        );
      })}
    </div>
  );
}

// ── Shared modal vehicle list ─────────────────────────────────────────────────

function ModalVehicleList({ allImeis, deviceMap, sel, toggle, dark, groups, excludeGroupId }: {
  allImeis: string[]; deviceMap: DMap; sel: Set<string>; toggle: (imei: string) => void;
  dark: boolean; groups?: VehicleGroup[]; excludeGroupId?: string;
}) {
  const activeGroups = (groups ?? []).filter(g => g.id !== excludeGroupId);
  const groupedSet = new Set(activeGroups.flatMap(g => g.imeis));
  const ungrouped = allImeis.filter(i => !groupedSet.has(i));
  const sections: { title?: string; imeis: string[] }[] = [];
  if (ungrouped.length > 0) sections.push({ imeis: ungrouped });
  activeGroups.forEach(g => {
    const gImeis = g.imeis.filter(i => allImeis.includes(i));
    if (gImeis.length > 0) sections.push({ title: g.name, imeis: gImeis });
  });
  if (sections.length === 0) sections.push({ imeis: allImeis });
  const VehicleItem = ({ imei }: { imei: string }) => {
    const plate = deviceMap.get(imei)?.plate || imei.slice(-8);
    const chk = sel.has(imei);
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', cursor: 'pointer', borderRadius: 4, background: chk ? (dark ? '#2a1010' : '#fff5f5') : 'transparent' }}>
        <input type="checkbox" checked={chk} onChange={() => toggle(imei)} style={{ flexShrink: 0, accentColor: '#dc2626', cursor: 'pointer' }}/>
        <span style={{ fontSize: 12, fontWeight: chk ? 600 : 400, color: chk ? '#dc2626' : (dark ? '#e5e5e5' : '#333'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</span>
      </label>
    );
  };
  return (
    <div style={{ padding: '4px 4px' }}>
      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: si < sections.length - 1 ? 8 : 0 }}>
          {section.title && <div style={{ padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: dark ? '#555' : '#bbb', textTransform: 'uppercase', letterSpacing: 0.6 }}>{section.title}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {section.imeis.map(imei => <VehicleItem key={imei} imei={imei}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalHeader({ title, onClose, dark }: { title: string; onClose: () => void; dark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', letterSpacing: 0.2 }}>{title}</span>
      <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = dark ? '#333' : '#ebebeb'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = dark ? '#2a2a2a' : '#f5f5f5'; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ── Create Group Modal ────────────────────────────────────────────────────────

function CreateGroupModal({ points, deviceMap, onClose, onCreate, dark, groups }: {
  points: LivePoint[]; deviceMap: DMap; onClose: () => void;
  onCreate: (name: string, imeis: string[]) => void; dark: boolean; groups: VehicleGroup[];
}) {
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const toggle = (imei: string) => setSel(p => { const n = new Set(p); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  const allImeis = points.map(p => p.imei);
  const filtered = q.trim() ? allImeis.filter(i => (deviceMap.get(i)?.plate ?? i).toLowerCase().includes(q.toLowerCase())) : allImeis;
  const card: React.CSSProperties = { background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 12, padding: 24, width: 'min(600px, 93vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' };
  const btnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
      <div style={card}>
        <ModalHeader title="Create Group" onClose={onClose} dark={dark}/>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={inp} autoFocus/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setSel(new Set(allImeis))} style={btnStyle}>Select All</button>
          <button onClick={() => setSel(new Set())} style={btnStyle}>Deselect All</button>
          <span style={{ fontSize: 11, color: dark ? '#555' : '#bbb', marginLeft: 4 }}>{sel.size}/{allImeis.length}</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 7, padding: '5px 10px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none', width: 120 }}/>
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, borderRadius: 8 }}>
          {points.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>No vehicles online</div>
          : <ModalVehicleList allImeis={filtered} deviceMap={deviceMap} sel={sel} toggle={toggle} dark={dark} groups={groups}/>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { if (name.trim() && sel.size > 0) { onCreate(name.trim(), [...sel]); onClose(); } }} disabled={!name.trim() || sel.size === 0}
            style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: !name.trim() || sel.size === 0 ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !name.trim() || sel.size === 0 ? 'not-allowed' : 'pointer' }}>
            Create {sel.size > 0 ? `(${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Group Modal ──────────────────────────────────────────────────────────

function EditGroupModal({ group, points, deviceMap, onClose, onSave, onDelete, dark, groups }: {
  group: VehicleGroup; points: LivePoint[]; deviceMap: DMap;
  onClose: () => void; onSave: (id: string, name: string, imeis: string[]) => void;
  onDelete: (id: string) => void; dark: boolean; groups: VehicleGroup[];
}) {
  const [name, setName] = useState(group.name);
  const [sel, setSel] = useState<Set<string>>(new Set(group.imeis));
  const [q, setQ] = useState('');
  const toggle = (imei: string) => setSel(p => { const n = new Set(p); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });
  const allImeis = [...new Set([...group.imeis, ...points.map(p => p.imei)])];
  const filtered = q.trim() ? allImeis.filter(i => (deviceMap.get(i)?.plate ?? i).toLowerCase().includes(q.toLowerCase())) : allImeis;
  const card: React.CSSProperties = { background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 12, padding: 24, width: 'min(600px, 93vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#f9fafb', color: dark ? '#e5e5e5' : '#111', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' };
  const btnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 5, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#aaa' : '#555', fontSize: 11, cursor: 'pointer' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
      <div style={card}>
        <ModalHeader title="Edit Group" onClose={onClose} dark={dark}/>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={inp}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setSel(new Set(allImeis))} style={btnStyle}>Select All</button>
          <button onClick={() => setSel(new Set())} style={btnStyle}>Deselect All</button>
          <span style={{ fontSize: 11, color: dark ? '#555' : '#bbb', marginLeft: 4 }}>{sel.size}/{allImeis.length}</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 7, padding: '5px 10px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none', width: 120 }}/>
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, borderRadius: 8 }}>
          <ModalVehicleList allImeis={filtered} deviceMap={deviceMap} sel={sel} toggle={toggle} dark={dark} groups={groups} excludeGroupId={group.id}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 4, borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
          <button onClick={() => { onDelete(group.id); onClose(); }} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>Delete Group</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#888' : '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { if (name.trim()) { onSave(group.id, name.trim(), [...sel]); onClose(); } }} disabled={!name.trim()}
              style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: name.trim() ? '#dc2626' : '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Active Alerts Panel ───────────────────────────────────────────────────────

interface VehicleAlert { imei: string; plate: string; type: 'speed' | 'idle'; value: number; }

function AlertsPanel({ alerts, dark, onClose }: { alerts: VehicleAlert[]; dark: boolean; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
      <div style={{ background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 14, padding: 24, width: 'min(420px, 95vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <ModalHeader title={`Active Alerts (${alerts.length})`} onClose={onClose} dark={dark}/>
        {alerts.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: dark ? '#555' : '#bbb', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
            </div>
            No active alerts
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${dark ? '#222' : '#f5f5f5'}` }}>
                <span style={{ display: 'flex', flexShrink: 0 }}>
                  {a.type === 'speed'
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{a.plate}</div>
                  <div style={{ fontSize: 11, color: a.type === 'speed' ? '#dc2626' : '#f59e0b', marginTop: 2 }}>
                    {a.type === 'speed' ? `Speed: ${a.value} km/h` : 'Vehicle is idle'}
                  </div>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: a.type === 'speed' ? '#dc2626' : '#f59e0b' }}>
                  {a.type === 'speed' ? 'SPEED' : 'IDLE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trip Replay Modal ─────────────────────────────────────────────────────────

function TripReplayModal({ imei, plate, onClose, dark }: { imei: string; plate: string; onClose: () => void; dark: boolean }) {
  const [history, setHistory] = useState<TripPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<TripPoint[]>(`/telemetry/${imei}/history?limit=500`)
      .then(r => {
        const sorted = [...r.data].reverse().filter(p => p.gpsValid && (p.latitude !== 0 || p.longitude !== 0));
        setHistory(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [imei]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing || history.length === 0) return;
    intervalRef.current = setInterval(() => {
      setFrameIdx(i => { if (i >= history.length - 1) { setPlaying(false); return i; } return i + 1; });
    }, Math.round(200 / playSpeed));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, playSpeed, history.length]);

  const currentPt = history[frameIdx];
  const totalKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < history.length; i++) d += haversineKm(history[i-1]!.latitude, history[i-1]!.longitude, history[i]!.latitude, history[i]!.longitude);
    return d;
  }, [history]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div style={{ width: 'min(900px, 96vw)', height: 'min(600px, 90vh)', background: dark ? '#1a1a1a' : '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, gap: 8, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="5,3 19,12 5,21"/></svg>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>Trip Replay — {plate}</span>
          {!loading && history.length > 0 && (
            <span style={{ fontSize: 11, color: dark ? '#666' : '#9ca3af' }}>{history.length} pts · {totalKm.toFixed(1)} km</span>
          )}
          <button onClick={onClose} style={{ background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', cursor: 'pointer', color: dark ? '#888' : '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#1a1a1a' : '#f8f9fa', zIndex: 10 }}>
              <span style={{ fontSize: 13, color: dark ? '#555' : '#aaa' }}>Loading trip data…</span>
            </div>
          )}
          {!loading && history.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dark ? '#444' : '#d1d5db'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 13, color: dark ? '#555' : '#9ca3af' }}>No GPS history for this vehicle</span>
            </div>
          )}
          {!loading && history.length > 0 && (
            <MapContainer center={[history[0]!.latitude, history[0]!.longitude]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM contributors"/>
              <TripReplayInner points={history} currentIdx={frameIdx}/>
            </MapContainer>
          )}
        </div>
        {/* Playback controls */}
        {!loading && history.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: dark ? '#141414' : '#fafafa', flexShrink: 0 }}>
            <button title="Restart" onClick={() => { setFrameIdx(0); setPlaying(false); }}
              style={{ background: dark ? '#2a2a2a' : '#eee', border: 'none', cursor: 'pointer', color: dark ? '#aaa' : '#555', padding: '6px 9px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="3"/></svg>
            </button>
            <button onClick={() => setPlaying(p => !p)}
              style={{ background: '#dc2626', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              {playing
                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Play</>}
            </button>
            <input type="range" min={0} max={Math.max(0, history.length - 1)} value={frameIdx}
              onChange={e => { setPlaying(false); setFrameIdx(+e.target.value); }}
              style={{ flex: 1, accentColor: '#dc2626', minWidth: 60 }}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 110 }}>
              {currentPt && <>
                <span style={{ fontSize: 10, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>{formatTs(currentPt.timestamp)}</span>
                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>{Math.round(currentPt.speedKmh)} km/h</span>
              </>}
            </div>
            <select value={playSpeed} onChange={e => setPlaySpeed(+e.target.value)}
              style={{ padding: '5px 7px', borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#111' : '#fff', color: dark ? '#e5e5e5' : '#333', fontSize: 12, cursor: 'pointer' }}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={8}>8×</option>
            </select>
            <span style={{ fontSize: 10, color: dark ? '#555' : '#bbb' }}>{frameIdx + 1}/{history.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Left Panel ────────────────────────────────────────────────────────────────

function LeftPanel({ points, deviceMap, vehicleDetails: _vd, onSelectVehicle, dark, onClose, onTripReplay, historyMode, historyPoints, historyLoading, onShowHistory, onLoadHistory, onClearHistory, allVehicles, onVehicleSelectForHistory, onSegmentClick, onCreateAlert, hasAlertImeis }: {
  points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  onSelectVehicle: (imei: string) => void; dark: boolean; onClose?: () => void;
  onTripReplay: (imei: string, plate: string) => void;
  historyMode: HistoryMode | null;
  historyPoints: TripPoint[];
  historyLoading: boolean;
  onShowHistory: (imei: string, plate: string, preset: 'lastHour' | 'today' | 'yesterday') => void;
  onLoadHistory: (from: string, to: string) => void;
  onClearHistory: () => void;
  allVehicles: Array<{ imei: string; plate: string }>;
  onVehicleSelectForHistory: (imei: string, plate: string, from: string, to: string) => void;
  onSegmentClick: (ev: TimelineEvent) => void;
  onCreateAlert: (imei: string) => void;
  hasAlertImeis: Map<string, AlertRecord[]>;
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
    <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, borderRadius: 12, overflow: 'hidden' }}>
      {historyMode ? (
        <HistoryPanel mode={historyMode} points={historyPoints} loading={historyLoading} dark={dark} onLoad={onLoadHistory} onClear={onClearHistory} allVehicles={allVehicles} onVehicleSelect={onVehicleSelectForHistory} onSegmentClick={onSegmentClick}/>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 10px', borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: dark ? '#e5e5e5' : '#111' }}>
              Vehicles <span style={{ fontSize: 11, fontWeight: 400, color: dark ? '#555' : '#aaa' }}>{points.length}</span>
            </span>
            <button onClick={() => setShowCreate(true)} title="Create group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', color: dark ? '#888' : '#666' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {onClose && (
              <button onClick={onClose} title="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, marginLeft: 4, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', color: dark ? '#888' : '#666' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#111' : '#f5f5f5', borderRadius: 7, padding: '5px 9px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#555' : '#aaa'} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: dark ? '#e5e5e5' : '#111', outline: 'none' }}/>
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#555' : '#aaa', padding: 0, display: 'flex' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {groups.map(group => {
              const gImeis = group.imeis.filter(matches);
              const gPts = points.filter(p => gImeis.includes(p.imei));
              if (q && gPts.length === 0) return null;
              return (
                <GroupSection key={group.id} group={{ ...group, imeis: gImeis }} pts={points} deviceMap={deviceMap}
                  onSelect={onSelectVehicle} collapsed={collapsed.has(group.id)} onToggle={() => toggleCollapse(group.id)}
                  onEdit={() => setEditingGroup(group)} dark={dark}
                  onTripReplay={onTripReplay}
                  onShowHistory={onShowHistory}
                  onCreateAlert={onCreateAlert}
                  getHasAlert={(imei) => (hasAlertImeis.get(imei)?.length ?? 0) > 0}/>
              );
            })}
            {ungrouped.length > 0 && (
              <>
                {groups.length > 0 && <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: dark ? '#444' : '#ccc', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}` }}>Ungrouped</div>}
                {ungrouped.map(pt => {
                  const plate = deviceMap.get(pt.imei)?.plate || pt.imei.slice(-8);
                  return (
                    <VehicleRow key={pt.imei} pt={pt} plate={plate}
                      onSelect={() => onSelectVehicle(pt.imei)} dark={dark}
                      onTripReplay={() => onTripReplay(pt.imei, plate)}
                      onShowHistory={(preset) => onShowHistory(pt.imei, plate, preset)}
                      onCreateAlert={() => onCreateAlert(pt.imei)}
                      hasAlert={(hasAlertImeis.get(pt.imei)?.length ?? 0) > 0}/>
                  );
                })}
              </>
            )}
            {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>{search ? 'No results' : 'No vehicles online'}</div>}
          </div>
          {showCreate && <CreateGroupModal points={points} deviceMap={deviceMap} onClose={() => setShowCreate(false)} onCreate={createGroup} dark={dark} groups={groups}/>}
          {editingGroup && <EditGroupModal group={editingGroup} points={points} deviceMap={deviceMap} onClose={() => setEditingGroup(null)} onSave={saveGroup} onDelete={deleteGroup} dark={dark} groups={groups}/>}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { dark } = useTheme();
  const { selectedCityId } = useCityFilter();
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceMap, setDeviceMap] = useState<DMap>(new Map());
  const [vehicleDetails, setVehicleDetails] = useState<Map<string, VehicleDetail>>(new Map());
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [trails, setTrails] = useState<Map<string, [number,number][]>>(new Map());
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');

  // Alert state — from global context
  const { alertSettings, alertSettingsRef, setActiveAlertCount } = useAlert();
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertCreateImei, setAlertCreateImei] = useState<string | undefined>(undefined);
  const [alertEditRecord, setAlertEditRecord] = useState<AlertRecord | undefined>(undefined);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertsByImei, setAlertsByImei] = useState<Map<string, AlertRecord[]>>(new Map());
  const [showGeofencesModal, setShowGeofencesModal] = useState(false);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  // Distance tool
  const [distanceMode, setDistanceMode] = useState(false);
  const distanceModeRef = useRef(false);

  // Trip replay
  const [tripReplay, setTripReplay] = useState<{ imei: string; plate: string } | null>(null);

  // Route history
  const [historyMode, setHistoryMode] = useState<HistoryMode | null>(null);
  const [historyPoints, setHistoryPoints] = useState<TripPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<TimelineEvent | null>(null);

  const handleShowHistory = async (imei: string, plate: string, preset: 'lastHour' | 'today' | 'yesterday') => {
    const range = getPresetRange(preset);
    setHistoryMode({ imei, plate, from: range.from, to: range.to });
    setHistoryPoints([]);
    setPanelOpen(true);
    setHistoryLoading(true);
    try {
      const { data } = await api.get<TripPoint[]>(`/telemetry/${imei}/history?from=${encodeURIComponent(new Date(range.from).toISOString())}&to=${encodeURIComponent(new Date(range.to).toISOString())}&limit=2000`);
      setHistoryPoints(data.filter(p => p.gpsValid));
    } catch {} finally { setHistoryLoading(false); }
  };

  const handleLoadHistory = async (from: string, to: string) => {
    if (!historyMode) return;
    setHistoryLoading(true);
    setHistoryPoints([]);
    try {
      const { data } = await api.get<TripPoint[]>(`/telemetry/${historyMode.imei}/history?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}&limit=2000`);
      setHistoryPoints(data.filter(p => p.gpsValid));
    } catch {} finally { setHistoryLoading(false); }
  };

  const handleClearHistory = () => { setHistoryMode(null); setHistoryPoints([]); setSelectedSegment(null); };

  const handleVehicleSelectForHistory = async (imei: string, plate: string, from: string, to: string) => {
    setHistoryMode({ imei, plate, from, to });
    setHistoryLoading(true);
    setHistoryPoints([]);
    try {
      const { data } = await api.get<TripPoint[]>(`/telemetry/${imei}/history?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}&limit=2000`);
      setHistoryPoints(data.filter(p => p.gpsValid));
    } catch {} finally { setHistoryLoading(false); }
  };

  const load = async () => {
    try {
      const { data } = await api.get<LivePoint[]>('/telemetry/live');
      const valid = data.filter(p => p.gpsValid);
      setTrails(prev => {
        const next = new Map(prev);
        valid.forEach(pt => {
          const trail = next.get(pt.imei) ? [...next.get(pt.imei)!] : [];
          const last = trail[trail.length - 1];
          if (!last || last[0] !== pt.latitude || last[1] !== pt.longitude) {
            trail.push([pt.latitude, pt.longitude]);
            if (trail.length > 15) trail.shift();
            next.set(pt.imei, trail);
          }
        });
        return next;
      });
      setPoints(valid);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, []);

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

  useEffect(() => {
    api.get<AlertRecord[]>('/alerts').then(r => {
      const m = new Map<string, AlertRecord[]>();
      r.data.forEach(alert => alert.vehicleImeis.forEach(imei => {
        const arr = m.get(imei) ?? [];
        arr.push(alert);
        m.set(imei, arr);
      }));
      setAlertsByImei(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Geofence[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {});
  }, []);

  const visiblePoints = selectedCityId ? points.filter(p => deviceMap.get(p.imei)?.cityId === selectedCityId) : points;
  const allVehicles = useMemo(() =>
    visiblePoints.map(p => ({ imei: p.imei, plate: deviceMap.get(p.imei)?.plate || p.imei.slice(-8) }))
      .sort((a, b) => a.plate.localeCompare(b.plate)),
    [visiblePoints, deviceMap]
  );
  const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
  visiblePoints.forEach(p => counts[vehicleStatus(p)]++);

  // Compute active alerts
  const activeAlerts = useMemo<VehicleAlert[]>(() => {
    const as = alertSettings;
    const alerts: VehicleAlert[] = [];
    visiblePoints.forEach(pt => {
      const plate = deviceMap.get(pt.imei)?.plate || pt.imei.slice(-8);
      const status = vehicleStatus(pt);
      if (as.speedLimit > 0 && pt.speedKmh > as.speedLimit) {
        alerts.push({ imei: pt.imei, plate, type: 'speed', value: Math.round(pt.speedKmh) });
      } else if (as.idleMinutes > 0 && status === 'idle') {
        alerts.push({ imei: pt.imei, plate, type: 'idle', value: 0 });
      }
    });
    return alerts;
  }, [visiblePoints, alertSettings, deviceMap]);

  // Sync active alert count to global context (topbar badge)
  useEffect(() => { setActiveAlertCount(activeAlerts.length); }, [activeAlerts, setActiveAlertCount]);

  // Browser notifications
  useEffect(() => {
    if (!alertSettings.notifications) return;
    activeAlerts.forEach(a => {
      const key = `${a.imei}_${a.type}`;
      const last = notifCooldownMap.get(key) ?? 0;
      if (Date.now() - last < 5 * 60 * 1000) return;
      notifCooldownMap.set(key, Date.now());
      if (a.type === 'speed') fireNotification(`Speed Alert: ${a.plate}`, `Traveling at ${a.value} km/h (limit: ${alertSettings.speedLimit} km/h)`);
      else fireNotification(`Idle Alert: ${a.plate}`, `Vehicle is currently idle`);
    });
  }, [activeAlerts, alertSettings]);

  const handleSelect = (imei: string) => {
    const pt = visiblePoints.find(p => p.imei === imei);
    if (pt) setFlyTarget({ lat: pt.latitude, lng: pt.longitude, ts: Date.now() });
  };

  const PanelToggleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader title="Live Map" count={visiblePoints.length} action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Alerts panel button (only when alerts exist) */}
          {activeAlerts.length > 0 && (
            <button
              onClick={() => setShowAlerts(true)}
              title="View active alerts"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: dark ? '#2a0a0a' : '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>{activeAlerts.length}</span>
              {!isMobile && <span>Alerts</span>}
            </button>
          )}
          {/* Geofences button */}
          <button
            onClick={() => setShowGeofencesModal(true)}
            title="Manage geofences"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: dark ? '#222' : '#f9fafb', color: dark ? '#aaa' : '#555', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {!isMobile && <span>Geofences</span>}
          </button>
          {/* Panel toggle */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            title={panelOpen ? 'Hide panel' : 'Show vehicles'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: panelOpen ? (dark ? '#2a1010' : '#fff0f0') : (dark ? '#222' : '#f9fafb'), color: panelOpen ? '#dc2626' : (dark ? '#aaa' : '#555'), cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <PanelToggleIcon/>
            {!isMobile && <span>{panelOpen ? 'Hide' : 'Vehicles'}</span>}
          </button>
        </div>
      }/>

      <div style={{ display: 'flex', flex: 1, gap: isMobile ? 0 : 12, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {/* Mobile backdrop */}
        {isMobile && panelOpen && <div onClick={() => setPanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8998, background: 'rgba(0,0,0,0.45)' }}/>}

        {/* Left panel */}
        <div style={isMobile ? {
          position: 'fixed', top: 0, left: panelOpen ? 0 : -300, bottom: 0,
          zIndex: 8999, width: 290, transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        } : {
          width: panelOpen ? 290 : 0, flexShrink: 0, overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <LeftPanel
            points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails}
            onSelectVehicle={(imei) => { handleSelect(imei); if (isMobile) setPanelOpen(false); }}
            dark={dark}
            onClose={isMobile ? () => setPanelOpen(false) : undefined}
            onTripReplay={(imei, plate) => setTripReplay({ imei, plate })}
            historyMode={historyMode}
            historyPoints={historyPoints}
            historyLoading={historyLoading}
            onShowHistory={handleShowHistory}
            onLoadHistory={handleLoadHistory}
            onClearHistory={handleClearHistory}
            allVehicles={allVehicles}
            onVehicleSelectForHistory={handleVehicleSelectForHistory}
            onSegmentClick={ev => setSelectedSegment(ev)}
            onCreateAlert={(imei) => {
              const vAlerts = alertsByImei.get(imei) ?? [];
              if (vAlerts.length === 1) {
                setAlertEditRecord(vAlerts[0]);
                setAlertCreateImei(undefined);
              } else if (vAlerts.length > 1) {
                setAlertEditRecord(undefined);
                setAlertCreateImei(undefined);
              } else {
                setAlertEditRecord(undefined);
                setAlertCreateImei(imei);
              }
              setShowAlertsModal(true);
            }}
            hasAlertImeis={alertsByImei}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Status chips + tools */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['moving', 'idle', 'parked', 'offline'] as const).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 4, background: `${STATUS_COLOR[s]}18`, fontSize: 11.5, fontWeight: 500, color: STATUS_COLOR[s] }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }}/>
                {STATUS_LABEL[s]}: {counts[s]}
              </div>
            ))}
            <div style={{ flex: 1 }}/>
            {/* Distance tool toggle */}
            <button
              onClick={() => setDistanceMode(d => !d)}
              title={distanceMode ? 'Exit distance mode (right-click undo, dblclick reset)' : 'Measure distance between points'}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 4, border: `1px solid ${distanceMode ? '#dc2626' : (dark ? '#333' : '#e5e7eb')}`, background: distanceMode ? (dark ? '#2a1010' : '#fff0f0') : 'transparent', color: distanceMode ? '#dc2626' : (dark ? '#888' : '#666'), fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>
              {distanceMode ? 'Stop' : 'Distance'}
            </button>
          </div>

          {/* Distance mode hint */}
          {distanceMode && (
            <div style={{ marginBottom: 8, padding: '6px 12px', borderRadius: 7, background: dark ? '#2a1010' : '#fff0f0', border: `1px solid ${dark ? '#3a1515' : '#fca5a5'}`, fontSize: 11, color: '#dc2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>
              Click to add points · Right-click to undo · Double-click to reset
            </div>
          )}

          {/* Map */}
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, position: 'relative' }}>
            {isMobile && !panelOpen && (
              <button
                onClick={() => setPanelOpen(true)}
                style={{ position: 'absolute', bottom: 20, left: 12, zIndex: 1001, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 6, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#333' : '#ddd'}`, color: dark ? '#e5e5e5' : '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
              >
                <PanelToggleIcon/> Vehicles
              </button>
            )}
            {loading && <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#aaa', fontSize: 13, background: dark ? '#1a1a1a' : '#f8f9fa', borderRadius: 12 }}>Loading map…</div>}
            <MapStyleSwitcher current={mapStyle} onChange={setMapStyle} dark={dark}/>
            <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer key={mapStyle} url={TILE_CONFIG[mapStyle].url} attribution={TILE_CONFIG[mapStyle].attribution}
                className={TILE_CONFIG[mapStyle].darkFilter || (mapStyle === 'street' && dark) ? 'map-tiles-dark' : ''}/>
              <InvalidateSize/>
              <FitBounds points={visiblePoints} resetKey={selectedCityId || '__all__'}/>
              <FlyToPoint target={flyTarget}/>
              {historyPoints.length > 0
                ? <HistoryLayer points={historyPoints} speedLimit={alertSettings.speedLimit} selectedSegment={selectedSegment}/>
                : <>
                    <TrailLayer trails={trails} visibleImeis={new Set(visiblePoints.map(p => p.imei))}/>
                    <ClusterLayer points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails} alertSettingsRef={alertSettingsRef} distanceModeRef={distanceModeRef}/>
                  </>}
              <DistanceTool active={distanceMode} distanceModeRef={distanceModeRef}/>
              <GeofenceLayer geofences={geofences}/>
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAlerts && (
        <AlertsPanel alerts={activeAlerts} dark={dark} onClose={() => { setShowAlerts(false); }}/>
      )}
      {tripReplay && (
        <TripReplayModal imei={tripReplay.imei} plate={tripReplay.plate} onClose={() => setTripReplay(null)} dark={dark}/>
      )}
      <AlertsModal
        open={showAlertsModal}
        onClose={() => { setShowAlertsModal(false); setAlertCreateImei(undefined); setAlertEditRecord(undefined); }}
        dark={dark}
        vehicles={allVehicles}
        preSelectedImei={alertCreateImei}
        editAlertRecord={alertEditRecord}
      />
      <GeofencesModal
        open={showGeofencesModal}
        onClose={() => setShowGeofencesModal(false)}
        dark={dark}
      />
    </div>
  );
}
