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
function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'parked' | 'offline' {
  if (isOffline(pt)) return 'offline';
  if (pt.speedKmh > 0) return 'moving';
  if (pt.ignition === false) return 'parked';
  return 'idle';
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

// Dead reckoning: predict position from last known speed + heading
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

const EMA_ALPHA = 0.75; // GPS smoothing: 0=fully smooth, 1=raw
const POLL_MS = 5_000;

type DEntry = { plate: string | null; vehicleId: string | null; cityId: string | null };
interface MarkerState {
  marker: L.Marker;
  popup: L.Popup;
  ctx: { pt: LivePoint; dv: DEntry | undefined; vc: VehicleDetail | undefined; plate: string };
  pt: LivePoint;
  emaLat: number; emaLng: number;
  dispLat: number; dispLng: number;
  animFromLat: number; animFromLng: number;
  animToLat: number; animToLng: number;
  animStart: number; animDur: number;
}

// ── Responsive hook ─────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
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

// ── Road Snapping (OSRM) ─────────────────────────────────────────────────────
const snapCache = new Map<string, [number, number]>();
const snapPending = new Set<string>();
async function snapToRoad(lat: number, lng: number): Promise<[number, number]> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`; // ~11 m grid
  if (snapCache.has(key)) return snapCache.get(key)!;
  if (snapPending.has(key)) return [lat, lng];
  snapPending.add(key);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    const j = await r.json() as { code: string; waypoints?: { location: [number, number] }[] };
    if (j.code === 'Ok' && j.waypoints?.[0]) {
      const [sLng, sLat] = j.waypoints[0].location;
      if (snapCache.size > 2000) snapCache.delete(snapCache.keys().next().value!);
      const result: [number, number] = [sLat, sLng];
      snapCache.set(key, result);
      snapPending.delete(key);
      return result;
    }
  } catch { /* timeout / network — fall through */ }
  snapPending.delete(key);
  snapCache.set(key, [lat, lng]);
  return [lat, lng];
}

// ── Car Icon + Popup HTML ────────────────────────────────────────────────────

function makeCarIcon(heading: number, status: 'moving' | 'idle' | 'parked' | 'offline', plate: string, speed: number): L.DivIcon {
  const color = STATUS_COLOR[status];
  const glow = `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 3px ${color}bb)`;
  const label = `${plate} (${Math.round(speed)} kph)`;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-family:system-ui,sans-serif">
    <img src="/car-icon.png" style="display:block;width:38px;height:38px;transform:rotate(${(heading + 180) % 360}deg);transform-origin:center center;filter:${glow};pointer-events:none"/>
    <div style="background:rgba(10,10,10,0.85);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;letter-spacing:0.3px;border-left:3px solid ${color};pointer-events:none">${label}</div>
  </div>`;
  return L.divIcon({ html, className: 'leaflet-interactive', iconSize: [150, 62], iconAnchor: [75, 42], popupAnchor: [0, -46] });
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

function ClusterLayer({ points, deviceMap, vehicleDetails }: { points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail> }) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const stateRef = useRef<Map<string, MarkerState>>(new Map());
  const rafRef = useRef<number>(0);

  // Mount once: create cluster group + start animation/dead-reckoning RAF loop
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const sz = n >= 20 ? 44 : n >= 10 ? 40 : 34;
        return L.divIcon({
          html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#111;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${n>=10?12:13}px;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${n}</div>`,
          className: 'leaflet-interactive', iconSize: [sz, sz], iconAnchor: [sz/2, sz/2],
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);

    // Group-level click: reliable popup open + zoom in (bindPopup click is unreliable in markercluster)
    group.on('click', (e: L.LeafletEvent) => {
      const marker = (e as unknown as { layer: L.Marker }).layer;
      if (!marker?.getPopup?.()) return;
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
      marker.openPopup();
    });

    let prevTime = performance.now();
    function rafLoop(now: number) {
      const dt = now - prevTime;
      prevTime = now;
      stateRef.current.forEach(s => {
        const elapsed = now - s.animStart;
        const t = Math.min(elapsed / s.animDur, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        let lat: number, lng: number;
        if (t < 1) {
          lat = s.animFromLat + (s.animToLat - s.animFromLat) * ease;
          lng = s.animFromLng + (s.animToLng - s.animFromLng) * ease;
        } else {
          // Animation done — continuously dead-reckon from last display position
          [lat, lng] = predictDR(s.dispLat, s.dispLng, s.pt.speedKmh, s.pt.heading, dt);
        }
        s.dispLat = lat;
        s.dispLng = lng;
        s.marker.setLatLng([lat, lng]);
      });
      rafRef.current = requestAnimationFrame(rafLoop);
    }
    rafRef.current = requestAnimationFrame(rafLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.removeLayer(group);
      stateRef.current.clear();
    };
  }, [map]);

  // Sync to latest GPS data on each poll
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const prev = stateRef.current;
    const next = new Map<string, MarkerState>();
    const imeiSet = new Set(points.map(p => p.imei));

    // Remove vehicles that left the visible set
    prev.forEach((s, imei) => { if (!imeiSet.has(imei)) group.removeLayer(s.marker); });

    for (const pt of points) {
      const dv = deviceMap.get(pt.imei);
      const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
      const plate = dv?.plate || pt.imei;
      const existing = prev.get(pt.imei);

      if (existing) {
        // EMA-smooth incoming GPS to reduce noise / wrong-street jumps
        const emaLat = EMA_ALPHA * pt.latitude + (1 - EMA_ALPHA) * existing.emaLat;
        const emaLng = EMA_ALPHA * pt.longitude + (1 - EMA_ALPHA) * existing.emaLng;
        Object.assign(existing.ctx, { pt, dv, vc, plate });
        existing.marker.setIcon(makeCarIcon(pt.heading, vehicleStatus(pt), plate, pt.speedKmh));
        const updated: MarkerState = {
          ...existing,
          pt, emaLat, emaLng,
          animFromLat: existing.dispLat,
          animFromLng: existing.dispLng,
          animToLat: emaLat,
          animToLng: emaLng,
          animStart: performance.now(),
          animDur: POLL_MS * 0.85,
        };
        next.set(pt.imei, updated);
        // Async road snap — updates animation target once OSRM responds (~50-200ms)
        snapToRoad(emaLat, emaLng).then(([sLat, sLng]) => {
          const s = stateRef.current.get(pt.imei);
          if (s && (Math.abs(sLat - emaLat) > 0.000005 || Math.abs(sLng - emaLng) > 0.000005)) {
            s.animToLat = sLat; s.animToLng = sLng;
            s.emaLat = sLat;   s.emaLng = sLng;
          }
        });
      } else {
        // First time seeing this vehicle — create marker
        const popup = L.popup({ minWidth: 280, maxWidth: 340 });
        const ctx = { pt, dv, vc, plate };
        const marker = L.marker([pt.latitude, pt.longitude], {
          icon: makeCarIcon(pt.heading, vehicleStatus(pt), plate, pt.speedKmh),
        });
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
        // Snap initial placement to road
        snapToRoad(pt.latitude, pt.longitude).then(([sLat, sLng]) => {
          const s = stateRef.current.get(pt.imei);
          if (s) {
            s.emaLat = sLat; s.emaLng = sLng;
            s.dispLat = sLat; s.dispLng = sLng;
            s.animToLat = sLat; s.animToLng = sLng;
            s.marker.setLatLng([sLat, sLng]);
          }
        });
      }
    }
    stateRef.current = next;
  }, [points, deviceMap, vehicleDetails]);

  return null;
}

// ── Trail Layer ───────────────────────────────────────────────────────────────

function TrailLayer({ trails, visibleImeis }: { trails: Map<string, [number,number][]>; visibleImeis: Set<string> }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Polyline[] = [];
    trails.forEach((pts, imei) => {
      if (!visibleImeis.has(imei) || pts.length < 2) return;
      const line = L.polyline(pts, { color: '#dc2626', weight: 2, opacity: 0.45, dashArray: '5 4' });
      line.addTo(map);
      layers.push(line);
    });
    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [map, trails, visibleImeis]);
  return null;
}

// ── Map Style Switcher ────────────────────────────────────────────────────────

function MapStyleSwitcher({ current, onChange, dark }: { current: MapStyle; onChange: (s: MapStyle) => void; dark: boolean }) {
  const [open, setOpen] = useState(false);
  const styles: MapStyle[] = ['street', 'satellite', 'terrain', 'dark'];
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Map style"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#1e1e1e' : '#fff', color: dark ? '#e5e5e5' : '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.18)' }}
      >
        <span>{TILE_CONFIG[current].icon}</span> {TILE_CONFIG[current].label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 36, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 130 }}>
          {styles.map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: s === current ? (dark ? '#2a1010' : '#fff5f5') : 'transparent', color: s === current ? '#dc2626' : (dark ? '#e5e5e5' : '#333'), fontSize: 12.5, fontWeight: s === current ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { if (s !== current) e.currentTarget.style.background = dark ? '#222' : '#f5f5f5'; }}
              onMouseLeave={e => { if (s !== current) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 15 }}>{TILE_CONFIG[s].icon}</span> {TILE_CONFIG[s].label}
              {s === current && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

// ── Vehicle Row ───────────────────────────────────────────────────────────────

function VehicleRow({ pt, plate, onSelect, dark }: { pt: LivePoint; plate: string; onSelect: () => void; dark: boolean; }) {
  const status = vehicleStatus(pt);
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 8px 7px 11px',
        borderLeft: `3px solid ${STATUS_COLOR[status]}`,
        borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`,
        cursor: 'pointer',
        background: hov ? (dark ? '#1e1e1e' : '#f9fafb') : 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? '#e5e5e5' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</div>
      </div>
      <span style={{ fontSize: 10, color: dark ? '#666' : '#9ca3af', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>{Math.round(pt.speedKmh)} km/h</span>
      <IconPower on={pt.ignition}/>
      <IconBattery level={pt.voltageLevel}/>
      <IconSignal level={pt.gsmSignal}/>
      <ThreeDots dark={dark}/>
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
        return <VehicleRow key={pt.imei} pt={pt} plate={plate} onSelect={() => onSelect(pt.imei)} dark={dark}/>;
      })}
    </div>
  );
}

// ── Shared modal vehicle list ────────────────────────────────────────────────

function ModalVehicleList({ allImeis, deviceMap, sel, toggle, dark, groups, excludeGroupId }: {
  allImeis: string[]; deviceMap: DMap;
  sel: Set<string>; toggle: (imei: string) => void; dark: boolean;
  groups?: VehicleGroup[]; excludeGroupId?: string;
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
          {section.title && (
            <div style={{ padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: dark ? '#555' : '#bbb', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {section.title}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {section.imeis.map(imei => <VehicleItem key={imei} imei={imei}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Create Group Modal ───────────────────────────────────────────────────────

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


function CreateGroupModal({ points, deviceMap, onClose, onCreate, dark, groups }: {
  points: LivePoint[]; deviceMap: DMap;
  onClose: () => void; onCreate: (name: string, imeis: string[]) => void; dark: boolean;
  groups: VehicleGroup[];
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
          <button onClick={() => { if (name.trim() && sel.size > 0) { onCreate(name.trim(), [...sel]); onClose(); } }} disabled={!name.trim() || sel.size === 0} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: !name.trim() || sel.size === 0 ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !name.trim() || sel.size === 0 ? 'not-allowed' : 'pointer' }}>
            Create {sel.size > 0 ? `(${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Group Modal ─────────────────────────────────────────────────────────

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
            <button onClick={() => { if (name.trim()) { onSave(group.id, name.trim(), [...sel]); onClose(); } }} disabled={!name.trim()} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: name.trim() ? '#dc2626' : '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel({ points, deviceMap, vehicleDetails: _vd, onSelectVehicle, dark, onClose }: {
  points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  onSelectVehicle: (imei: string) => void; dark: boolean; onClose?: () => void;
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
      {/* Header */}
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
            {ungrouped.map(pt => {
              const plate = deviceMap.get(pt.imei)?.plate || pt.imei.slice(-8);
              return <VehicleRow key={pt.imei} pt={pt} plate={plate} onSelect={() => onSelectVehicle(pt.imei)} dark={dark}/>;
            })}
          </>
        )}

        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: dark ? '#555' : '#aaa' }}>{search ? 'No results' : 'No vehicles online'}</div>}
      </div>

      {showCreate && <CreateGroupModal points={points} deviceMap={deviceMap} onClose={() => setShowCreate(false)} onCreate={createGroup} dark={dark} groups={groups}/>}
      {editingGroup && <EditGroupModal group={editingGroup} points={points} deviceMap={deviceMap} onClose={() => setEditingGroup(null)} onSave={saveGroup} onDelete={deleteGroup} dark={dark} groups={groups}/>}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

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
    }
    catch {} finally { setLoading(false); }
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

  const visiblePoints = selectedCityId ? points.filter(p => deviceMap.get(p.imei)?.cityId === selectedCityId) : points;
  const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
  visiblePoints.forEach(p => counts[vehicleStatus(p)]++);

  const handleSelect = (imei: string) => {
    const pt = visiblePoints.find(p => p.imei === imei);
    if (pt) setFlyTarget({ lat: pt.latitude, lng: pt.longitude, ts: Date.now() });
  };

  // Toggle icon SVG (hamburger list)
  const PanelToggleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader title="Live Map" count={visiblePoints.length} action={
        <button
          onClick={() => setPanelOpen(o => !o)}
          title={panelOpen ? 'Hide panel' : 'Show vehicles'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, background: panelOpen ? (dark ? '#2a1010' : '#fff0f0') : (dark ? '#222' : '#f9fafb'), color: panelOpen ? '#dc2626' : (dark ? '#aaa' : '#555'), cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
        >
          <PanelToggleIcon/>
          {!isMobile && <span>{panelOpen ? 'Hide' : 'Vehicles'}</span>}
        </button>
      }/>

      <div style={{ display: 'flex', flex: 1, gap: isMobile ? 0 : 12, overflow: 'hidden', minHeight: 0, position: 'relative' }}>

        {/* Mobile backdrop */}
        {isMobile && panelOpen && (
          <div onClick={() => setPanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8998, background: 'rgba(0,0,0,0.45)' }}/>
        )}

        {/* Panel — desktop: sliding width | mobile: fixed drawer */}
        <div style={isMobile ? {
          position: 'fixed', top: 0, left: panelOpen ? 0 : -300, bottom: 0,
          zIndex: 8999, width: 290,
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        } : {
          width: panelOpen ? 290 : 0, flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <LeftPanel
            points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails}
            onSelectVehicle={(imei) => { handleSelect(imei); if (isMobile) setPanelOpen(false); }}
            dark={dark}
            onClose={isMobile ? () => setPanelOpen(false) : undefined}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Status chips */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 12, flexWrap: 'wrap' }}>
            {(['moving', 'idle', 'parked', 'offline'] as const).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${STATUS_COLOR[s]}18`, fontSize: 11.5, fontWeight: 500, color: STATUS_COLOR[s] }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }}/>
                {STATUS_LABEL[s]}: {counts[s]}
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, position: 'relative' }}>
            {/* Floating panel toggle on mobile (bottom-left of map) */}
            {isMobile && !panelOpen && (
              <button
                onClick={() => setPanelOpen(true)}
                style={{ position: 'absolute', bottom: 20, left: 12, zIndex: 1001, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 24, background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#333' : '#ddd'}`, color: dark ? '#e5e5e5' : '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
              >
                <PanelToggleIcon/> Vehicles
              </button>
            )}
            {loading && <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#aaa', fontSize: 13, background: dark ? '#1a1a1a' : '#f8f9fa', borderRadius: 12 }}>Loading map…</div>}
            <MapStyleSwitcher current={mapStyle} onChange={setMapStyle} dark={dark}/>
            <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer
                key={mapStyle}
                url={TILE_CONFIG[mapStyle].url}
                attribution={TILE_CONFIG[mapStyle].attribution}
                className={TILE_CONFIG[mapStyle].darkFilter || (mapStyle === 'street' && dark) ? 'map-tiles-dark' : ''}
              />
              <InvalidateSize/>
              <FitBounds points={visiblePoints} resetKey={selectedCityId || '__all__'}/>
              <FlyToPoint target={flyTarget}/>
              <TrailLayer trails={trails} visibleImeis={new Set(visiblePoints.map(p => p.imei))}/>
              <ClusterLayer points={visiblePoints} deviceMap={deviceMap} vehicleDetails={vehicleDetails}/>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
