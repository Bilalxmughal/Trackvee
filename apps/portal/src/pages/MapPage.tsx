import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../api/client';
import { usePortalPanel } from '../contexts/PortalPanelContext';
import AlertsPanel, { type AlertItem } from '../components/AlertsPanel';
import GeofencesPanel, { type Geofence } from '../components/GeofencesPanel';
import POIsPanel, { type POI } from '../components/POIsPanel';
import ReportsModal from '../components/ReportsModal';
import DriverBehaviorModal from '../components/DriverBehaviorModal';
import UsersModal from '../components/UsersModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LivePoint {
  id: string; imei: string; deviceId: string | null;
  latitude: number; longitude: number; speedKmh: number;
  heading: number; satellites: number; gpsValid: boolean; timestamp: string;
  ignition?: boolean | null; immobilizer?: boolean | null;
  voltageLevel?: number | null; gsmSignal?: number | null;
}
interface DeviceInfo {
  imei: string; displayId: number;
  vehicle: { id: string; licensePlate: string | null; displayId: number } | null;
}
interface VehicleDetail {
  id: string; make: string | null; model: string | null;
  licensePlate: string | null; displayId: number;
}
interface VehicleGroup { id: string; name: string; imeis: string[]; }
interface ApiVehicleGroup { id: string; name: string; organizationId: string; vehicleIds: string[]; }
type DMap = Map<string, { plate: string | null; vehicleId: string | null; displayId: number | null }>;
interface TripPoint {
  id: string; imei: string; latitude: number; longitude: number;
  speedKmh: number; heading: number; timestamp: string; gpsValid: boolean;
  ignition?: boolean | null;
}
interface HistoryMode { imei: string; plate: string; from: string; to: string; }
interface TimelineEvent {
  type: 'parked' | 'idle' | 'driving';
  startTime: string; endTime: string; durationSec: number;
  lat: number; lng: number; avgSpeed?: number;
}

// ── Constants / Utilities ─────────────────────────────────────────────────────

const MOVING_SPEED = 5;
const POLL_MS = 5000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Status = 'moving' | 'idle' | 'parked' | 'offline';
const STATUS_COLOR: Record<Status, string> = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af' };
const STATUS_LABEL: Record<Status, string> = { moving: 'Moving', idle: 'Idle', parked: 'Parked', offline: 'Offline' };

type MapStyle = 'street' | 'satellite' | 'terrain' | 'dark';
const TILE_CONFIG: Record<MapStyle, { url: string; attribution: string; label: string; icon: string; darkFilter?: boolean }> = {
  street:    { label: 'Street',    icon: '🗺', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
  satellite: { label: 'Satellite', icon: '🛰', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  terrain:   { label: 'Terrain',   icon: '⛰', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  dark:      { label: 'Dark',      icon: '🌙', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', darkFilter: true },
};

const GK_COLLAPSED = 'portal_map_groups_collapsed_v1';
function loadCollapsed(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(GK_COLLAPSED) ?? '[]')); } catch { return new Set(); } }
function saveCollapsed(s: Set<string>) { try { localStorage.setItem(GK_COLLAPSED, JSON.stringify([...s])); } catch {} }

function isOffline(pt: LivePoint) { return Date.now() - new Date(pt.timestamp).getTime() > 10 * 60 * 1000; }
function vehicleStatus(pt: LivePoint): Status {
  if (isOffline(pt)) return 'offline';
  if (pt.speedKmh >= MOVING_SPEED) return 'moving';
  if (pt.ignition === true) return 'idle';
  return 'parked';
}
function fmtPlate(dv: { plate: string | null; displayId: number | null } | undefined, imei: string): string {
  return dv?.plate || (dv?.displayId != null ? `#${dv.displayId}` : imei.slice(-4));
}
function formatTs(ts: string) {
  const d = new Date(ts);
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`;
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
function tripSegType(p: TripPoint): 'parked' | 'idle' | 'driving' {
  if (p.speedKmh >= MOVING_SPEED) return 'driving';
  if (p.ignition === true) return 'idle';
  return 'parked';
}
function deriveTimeline(pts: TripPoint[]): TimelineEvent[] {
  if (pts.length === 0) return [];
  const makeEvent = (type: 'parked' | 'idle' | 'driving', si: number, ei: number): TimelineEvent => {
    const sp = pts[si]!, ep = pts[ei]!;
    const seg = pts.slice(si, ei + 1);
    const avgSpeed = type === 'driving' && seg.length > 0
      ? Math.round(seg.reduce((s, p) => s + p.speedKmh, 0) / seg.length) : undefined;
    return { type, startTime: sp.timestamp, endTime: ep.timestamp, durationSec: Math.max(0, Math.round((new Date(ep.timestamp).getTime() - new Date(sp.timestamp).getTime()) / 1000)), lat: sp.latitude, lng: sp.longitude, avgSpeed };
  };
  const events: TimelineEvent[] = [];
  let type = tripSegType(pts[0]!);
  let si = 0;
  for (let i = 1; i < pts.length; i++) {
    const next = tripSegType(pts[i]!);
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
function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const dL = (lng2 - lng1) * r;
  const y = Math.sin(dL) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dL);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
const geocodeCache = new Map<string, string>();
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const k = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache.has(k)) return geocodeCache.get(k)!;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const j = await r.json() as { display_name?: string };
    const a = j.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    geocodeCache.set(k, a);
    return a;
  } catch { return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
}

// ── Car Icon ──────────────────────────────────────────────────────────────────

function makeCarIcon(heading: number, status: Status, plate: string, speed: number): L.DivIcon {
  const color = STATUS_COLOR[status];
  const glow = `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 3px ${color}bb)`;
  const label = plate ? `${plate} (${Math.round(speed)} kph)` : `${Math.round(speed)} kph`;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-family:system-ui,sans-serif">
    <img src="/car-icon.png" style="display:block;width:38px;height:38px;transform:rotate(${(heading + 180) % 360}deg);transform-origin:center center;filter:${glow};pointer-events:none"/>
    <div style="background:rgba(10,10,10,0.85);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;letter-spacing:0.3px;border-left:3px solid ${color};pointer-events:none">${label}</div>
  </div>`;
  return L.divIcon({ html, className: 'leaflet-interactive', iconSize: [150, 70], iconAnchor: [75, 42], popupAnchor: [0, -46] });
}

// ── Map Layers ────────────────────────────────────────────────────────────────

function ClusterLayer({ points, deviceMap, vehicleDetails, onSelect }: {
  points: LivePoint[]; deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  onSelect: (imei: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!groupRef.current) {
      groupRef.current = (L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup })
        .markerClusterGroup({ maxClusterRadius: 40, disableClusteringAtZoom: 14, spiderfyOnMaxZoom: true });
      map.addLayer(groupRef.current);
    }
    const group = groupRef.current;
    const existing = markerMapRef.current;
    const seen = new Set<string>();

    for (const pt of points) {
      if (!pt.gpsValid && pt.latitude === 0 && pt.longitude === 0) continue;
      seen.add(pt.imei);
      const dv = deviceMap.get(pt.imei);
      const plate = fmtPlate(dv, pt.imei);
      const status = vehicleStatus(pt);
      const icon = makeCarIcon(pt.heading ?? 0, status, plate, pt.speedKmh);

      if (existing.has(pt.imei)) {
        const m = existing.get(pt.imei)!;
        m.setLatLng([pt.latitude, pt.longitude]);
        m.setIcon(icon);
      } else {
        const marker = L.marker([pt.latitude, pt.longitude], { icon });
        marker.on('click', () => onSelect(pt.imei));
        group.addLayer(marker);
        existing.set(pt.imei, marker);
      }
    }

    for (const [imei, marker] of existing) {
      if (!seen.has(imei)) { group.removeLayer(marker); existing.delete(imei); }
    }
  }, [points, deviceMap, vehicleDetails, map, onSelect]);

  useEffect(() => () => {
    if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; }
  }, [map]);

  return null;
}

function HistoryLayer({ points, selectedSegment }: { points: TripPoint[]; selectedSegment: TimelineEvent | null }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const highlightRef = useRef<L.Polyline | null>(null);
  const dPopupRef = useRef<L.Popup | null>(null);

  useEffect(() => {
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
    if (dPopupRef.current) { map.closePopup(dPopupRef.current); dPopupRef.current = null; }
    if (!selectedSegment) return;

    if (selectedSegment.type === 'parked' || selectedSegment.type === 'idle') {
      map.flyTo([selectedSegment.lat, selectedSegment.lng], 18, { animate: true, duration: 0.7 });
      const m = pMarkersRef.current.get(selectedSegment.startTime);
      if (m) setTimeout(() => m.openPopup(), 800);
    } else {
      const segPts = points.filter(p => p.timestamp >= selectedSegment.startTime && p.timestamp <= selectedSegment.endTime);
      if (segPts.length < 2) return;
      const coords: [number,number][] = segPts.map(p => [p.latitude, p.longitude]);
      highlightRef.current = L.polyline(coords, { color: '#16a34a', weight: 5, opacity: 0.95 }).addTo(map);
      try { map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], animate: true }); } catch {}
      const mid = segPts[Math.floor(segPts.length / 2)]!;
      const sp = segPts[0]!, ep = segPts[segPts.length - 1]!;
      const addrFromId = `dhfrom-${Date.now()}`;
      const addrToId = `dhto-${Date.now()}`;
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
  }, [selectedSegment, points, map]);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
    if (dPopupRef.current) { map.closePopup(dPopupRef.current); dPopupRef.current = null; }
    pMarkersRef.current.clear();
    if (points.length < 2) return;

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const coords: [number,number][] = points.map(p => [p.latitude, p.longitude]);
    L.polyline(coords, { color: '#dc2626', weight: 3.5, opacity: 0.85 }).addTo(layer);

    // Direction arrow markers — clickable SVG polygon, placed every ~N moving points
    const step = Math.max(1, Math.floor(points.length / 200));
    for (let i = step; i < points.length - 1; i += step) {
      const p = points[i]!;
      if (p.speedKmh < MOVING_SPEED) continue;
      const bearing = calcBearing(points[i-1]!.latitude, points[i-1]!.longitude, p.latitude, p.longitude);
      const addrId = `arrow-${i}-${Date.now()}`;
      const html = `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%) rotate(${bearing}deg);cursor:pointer"><svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,2 17,18 10,14 3,18" fill="#2563eb" stroke="white" stroke-width="1.5"/></svg></div>`;
      const popupContent = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:175px;line-height:1.5">
        <div style="font-weight:700;margin-bottom:5px;color:#2563eb;font-size:13px">Moving</div>
        <div id="${addrId}" style="color:#555;margin-bottom:3px;font-size:11px">Loading address…</div>
        <div style="color:#9ca3af;font-size:10px;margin-bottom:5px">${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</div>
        <div style="display:flex;gap:14px;font-size:11px">
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">Time</div><div style="font-weight:600">${formatTsFull(p.timestamp)}</div></div>
          <div><div style="color:#9ca3af;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px">Speed</div><div style="font-weight:600">${Math.round(p.speedKmh)} km/h</div></div>
        </div>
      </div>`;
      const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 60 });
      m.bindPopup(popupContent, { maxWidth: 260 }).addTo(layer);
      m.on('popupopen', async () => { const addr = await reverseGeocode(p.latitude, p.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
    }

    // P / I segment markers (26px, with async address lookup)
    const segments: Array<{ type: 'parked'|'idle'|'driving'; start: number; end: number }> = [];
    let curSegType = tripSegType(points[0]!);
    let si = 0;
    for (let i = 1; i < points.length; i++) {
      const nt = tripSegType(points[i]!);
      if (nt !== curSegType) { segments.push({ type: curSegType, start: si, end: i-1 }); curSegType = nt; si = i; }
    }
    segments.push({ type: curSegType, start: si, end: points.length - 1 });

    segments.forEach((seg, idx) => {
      if (seg.type === 'driving') return;
      const sp = points[seg.start]!, ep = points[seg.end]!;
      const dur = Math.max(0, Math.round((new Date(ep.timestamp).getTime() - new Date(sp.timestamp).getTime()) / 1000));
      if (dur < 120) return;
      const isIdle = seg.type === 'idle';
      const color = isIdle ? '#f59e0b' : '#dc2626';
      const lbl = isIdle ? 'I' : 'P';
      const title = isIdle ? 'Idle (Engine On)' : 'Parked';
      const addrId = `paddr-${idx}-${Date.now()}`;
      const html = `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:translate(-50%,-50%)">${lbl}</div>`;
      const popupContent = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:190px;line-height:1.5">
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
      m.bindPopup(popupContent, { maxWidth: 280 }).addTo(layer);
      m.on('popupopen', async () => { const addr = await reverseGeocode(sp.latitude, sp.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
      pMarkersRef.current.set(sp.timestamp, m);
    });

    // Ignition-off (STOP) markers
    for (let i = 1; i < points.length; i++) {
      if (points[i-1]!.ignition === true && points[i]!.ignition === false) {
        const p = points[i]!;
        const addrId = `saddr-${i}-${Date.now()}`;
        const html = `<div style="width:28px;height:22px;border-radius:5px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:translate(-50%,-50%)">STOP</div>`;
        const popupContent = `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:170px;line-height:1.5">
          <div style="font-weight:700;margin-bottom:5px;color:#f59e0b;font-size:13px">Ignition Off</div>
          <div id="${addrId}" style="color:#555;margin-bottom:3px;font-size:11px">Loading address…</div>
          <div style="color:#9ca3af;font-size:10px;margin-bottom:6px">${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</div>
          <div style="font-size:11px;font-weight:600">${formatTsFull(p.timestamp)}</div>
        </div>`;
        const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }), zIndexOffset: 200 });
        m.bindPopup(popupContent, { maxWidth: 260 }).addTo(layer);
        m.on('popupopen', async () => { const addr = await reverseGeocode(p.latitude, p.longitude); const el = document.getElementById(addrId); if (el) el.textContent = addr; });
      }
    }

    // Start (green) and end (black) dots
    const startHtml = `<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.4);transform:translate(-50%,-50%)"></div>`;
    const endHtml = `<div style="width:14px;height:14px;border-radius:50%;background:#111;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.4);transform:translate(-50%,-50%)"></div>`;
    L.marker([points[0]!.latitude, points[0]!.longitude], { icon: L.divIcon({ html: startHtml, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }) }).addTo(layer);
    L.marker([points[points.length-1]!.latitude, points[points.length-1]!.longitude], { icon: L.divIcon({ html: endHtml, className: 'leaflet-interactive', iconSize: [0,0], iconAnchor: [0,0] }) }).addTo(layer);

    try { map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] }); } catch {}

    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      if (dPopupRef.current) { map.closePopup(dPopupRef.current); dPopupRef.current = null; }
      pMarkersRef.current.clear();
    };
  }, [points, map]);

  return null;
}

function FlyTo({ lat, lng, ts }: { lat: number; lng: number; ts: number }) {
  const map = useMap();
  const lastTs = useRef(0);
  useEffect(() => {
    if (ts === lastTs.current) return;
    lastTs.current = ts;
    map.setView([lat, lng], 16, { animate: true });
  }, [lat, lng, ts, map]);
  return null;
}

function MapStyleTileLayer({ style }: { style: MapStyle }) {
  const cfg = TILE_CONFIG[style];
  const map = useMap();
  useEffect(() => {
    if (cfg.darkFilter) {
      map.getContainer().style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
      map.getContainer().style.filter = '';
    }
  }, [cfg.darkFilter, map]);
  return <TileLayer url={cfg.url} attribution={cfg.attribution} />;
}

// ── Map Style Switcher ────────────────────────────────────────────────────────

function MapStyleSwitcher({ current, onChange }: { current: MapStyle; onChange: (s: MapStyle) => void }) {
  const [open, setOpen] = useState(false);
  const styles: MapStyle[] = ['street', 'satellite', 'terrain', 'dark'];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Map style"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.18)', whiteSpace: 'nowrap' }}>
        <span>{TILE_CONFIG[current].icon}</span> {TILE_CONFIG[current].label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18,15 12,9 6,15"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, bottom: 36, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 130 }}>
          {styles.map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: s === current ? '#fff5f5' : 'transparent', color: s === current ? '#dc2626' : '#333', fontSize: 12.5, fontWeight: s === current ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { if (s !== current) e.currentTarget.style.background = '#f5f5f5'; }}
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

// ── Status Icons ──────────────────────────────────────────────────────────────

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

// ── Vehicle Menu Button (3-dot) ───────────────────────────────────────────────

function EngineCutConfirm({ imei, plate, isImmobilized, onClose }: { imei: string; plate: string; isImmobilized: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const last4 = imei.slice(-4);
  const action = isImmobilized ? 'activate' : 'immobilize';
  const confirm = async () => {
    if (input.trim() !== last4) { setErr(`Enter last 4 digits of IMEI: ${last4}`); return; }
    setSaving(true); setErr('');
    try {
      await api.post(`/devices/${imei}/command`, { action });
      onClose();
    } catch { setErr('Command failed. Try again.'); } finally { setSaving(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 300, boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
          {isImmobilized ? 'Restore Engine' : 'Cut Engine'}
        </div>
        <div style={{ fontSize: 12.5, color: '#555', marginBottom: 14 }}>
          Vehicle: <strong>{plate}</strong>. Enter the last 4 digits of the IMEI to confirm.
        </div>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Last 4 IMEI digits"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
          onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
          onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
        {err && <div style={{ fontSize: 11.5, color: '#dc2626', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Sending…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleMenuButton({ pt, plate, onTripReplay, onShowHistory, onFollow, onCreateAlert, hasAlert }: {
  pt: LivePoint; plate: string;
  onTripReplay: () => void;
  onShowHistory: (preset: 'lastHour' | 'today' | 'yesterday') => void;
  onFollow: () => void;
  onCreateAlert: () => void;
  hasAlert: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const [engineCutOpen, setEngineCutOpen] = useState(false);
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

  const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
  const CalIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  const svUrl = `https://maps.google.com/maps?layer=c&cbll=${pt.latitude},${pt.longitude}`;
  const isImmobilized = !!pt.immobilizer;

  const items: Array<{ label: string; icon: React.ReactNode; action: () => void; divider?: boolean; red?: boolean }> = [
    { label: 'Follow Vehicle', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" strokeDasharray="4 2"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>, action: () => { onFollow(); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: 'Trip Replay', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5,3 19,12 5,21"/></svg>, action: () => { onTripReplay(); setOpen(false); } },
    { label: 'Street View', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, action: () => { window.open(svUrl, '_blank', 'noopener'); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: 'History: Last Hour', icon: <ClockIcon/>, action: () => { onShowHistory('lastHour'); setOpen(false); } },
    { label: 'History: Today', icon: <CalIcon/>, action: () => { onShowHistory('today'); setOpen(false); } },
    { label: 'History: Yesterday', icon: <CalIcon/>, action: () => { onShowHistory('yesterday'); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: hasAlert ? 'Edit Alert' : 'Create Alert', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="1" x2="12" y2="4"/></svg>, action: () => { onCreateAlert(); setOpen(false); } },
    { label: '──', icon: null, action: () => {}, divider: true },
    { label: isImmobilized ? 'Restore Engine' : 'Cut Engine', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>, action: () => { setEngineCutOpen(true); setOpen(false); }, red: true },
  ];

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, color: open ? '#dc2626' : '#9ca3af', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
          <circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="6.5" r="1.5"/><circle cx="1.5" cy="11.5" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, boxShadow: '0 6px 24px rgba(0,0,0,0.22)', minWidth: 165, overflow: 'hidden' }}>
          {items.map((it, idx) => it.divider ? (
            <div key={idx} style={{ height: 1, background: '#f0f0f0', margin: '3px 0' }}/>
          ) : (
            <button key={it.label} onClick={(e) => { e.stopPropagation(); it.action(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 13px', border: 'none', background: 'transparent', color: it.red ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = it.red ? '#dc2626' : '#333'; }}>
              <span style={{ display: 'flex', flexShrink: 0 }}>{it.icon}</span> {it.label}
            </button>
          ))}
        </div>
      )}
      {engineCutOpen && <EngineCutConfirm imei={pt.imei} plate={plate} isImmobilized={isImmobilized} onClose={() => setEngineCutOpen(false)} />}
    </>
  );
}

// ── Vehicle Row ───────────────────────────────────────────────────────────────

function VehicleRow({ pt, plate, onSelect, onTripReplay, onShowHistory, onFollow, onCreateAlert, hasAlert }: {
  pt: LivePoint; plate: string; onSelect: () => void;
  onTripReplay: () => void;
  onShowHistory: (preset: 'lastHour' | 'today' | 'yesterday') => void;
  onFollow: () => void;
  onCreateAlert: () => void;
  hasAlert: boolean;
}) {
  const status = vehicleStatus(pt);
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 8px 7px 11px', borderLeft: `3px solid ${STATUS_COLOR[status]}`, borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: hov ? '#f9fafb' : 'transparent' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</div>
      </div>
      <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>{Math.round(pt.speedKmh)} km/h</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <IconPower on={pt.ignition}/>
        <IconBattery level={pt.voltageLevel}/>
        <IconSignal level={pt.gsmSignal}/>
      </div>
      <VehicleMenuButton pt={pt} plate={plate} onTripReplay={onTripReplay} onShowHistory={onShowHistory} onFollow={onFollow} onCreateAlert={onCreateAlert} hasAlert={hasAlert}/>
    </div>
  );
}

// ── Group Section ─────────────────────────────────────────────────────────────

function GroupSection({ group, pts, deviceMap, onSelect, collapsed, onToggle, onEdit, onTripReplay, onShowHistory, onFollow, onCreateAlert, getHasAlert }: {
  group: VehicleGroup; pts: LivePoint[]; deviceMap: DMap;
  onSelect: (imei: string) => void; collapsed: boolean;
  onToggle: () => void; onEdit: () => void;
  onTripReplay: (imei: string, plate: string) => void;
  onShowHistory: (imei: string, plate: string, preset: 'lastHour' | 'today' | 'yesterday') => void;
  onFollow: (imei: string) => void;
  onCreateAlert: (imei: string) => void;
  getHasAlert: (imei: string) => boolean;
}) {
  const gpPts = pts.filter(p => group.imeis.includes(p.imei));
  const [hov, setHov] = useState(false);
  return (
    <div>
      <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px 7px 10px', background: hov ? '#f0f0f0' : '#f7f7f7', borderBottom: '1px solid #ebebeb', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ display: 'flex', flexShrink: 0, color: '#999' }}>
          {collapsed
            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,6 15,12 9,18"/></svg>
            : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
        <span style={{ fontSize: 10, color: '#555', flexShrink: 0, marginRight: 2 }}>{gpPts.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, color: '#555', display: 'flex', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
          </svg>
        </button>
      </div>
      {!collapsed && gpPts.map(pt => {
        const plate = fmtPlate(deviceMap.get(pt.imei), pt.imei);
        return (
          <VehicleRow key={pt.imei} pt={pt} plate={plate}
            onSelect={() => onSelect(pt.imei)}
            onTripReplay={() => onTripReplay(pt.imei, plate)}
            onShowHistory={(preset) => onShowHistory(pt.imei, plate, preset)}
            onFollow={() => onFollow(pt.imei)}
            onCreateAlert={() => onCreateAlert(pt.imei)}
            hasAlert={getHasAlert(pt.imei)}/>
        );
      })}
    </div>
  );
}

// ── Group Modals ──────────────────────────────────────────────────────────────

function ModalVehicleList({ allImeis, deviceMap, sel, toggle, groups, excludeGroupId }: {
  allImeis: string[]; deviceMap: DMap; sel: Set<string>; toggle: (imei: string) => void;
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
  return (
    <div style={{ padding: '4px 4px' }}>
      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: si < sections.length - 1 ? 8 : 0 }}>
          {section.title && <div style={{ padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.6 }}>{section.title}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {section.imeis.map(imei => {
              const plate = fmtPlate(deviceMap.get(imei), imei);
              const chk = sel.has(imei);
              return (
                <label key={imei} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', cursor: 'pointer', borderRadius: 4, background: chk ? '#fff5f5' : 'transparent' }}>
                  <input type="checkbox" checked={chk} onChange={() => toggle(imei)} style={{ flexShrink: 0, accentColor: '#dc2626', cursor: 'pointer' }}/>
                  <span style={{ fontSize: 12, fontWeight: chk ? 600 : 400, color: chk ? '#dc2626' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupModal({ title, name, setName, points, deviceMap, sel, setSel, groups, excludeGroupId, onClose, onSubmit, submitLabel, extraLeft }: {
  title: string; name: string; setName: (n: string) => void;
  points: LivePoint[]; deviceMap: DMap; sel: Set<string>; setSel: (s: Set<string>) => void;
  groups: VehicleGroup[]; excludeGroupId?: string;
  onClose: () => void; onSubmit: () => void; submitLabel: string;
  extraLeft?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const toggle = (imei: string) => { const n = new Set(sel); n.has(imei) ? n.delete(imei) : n.add(imei); setSel(n); };
  const allImeis = points.map(p => p.imei);
  const filtered = q.trim() ? allImeis.filter(i => (deviceMap.get(i)?.plate ?? i).toLowerCase().includes(q.toLowerCase())) : allImeis;
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#111', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' };
  const btnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 5, border: '1px solid #e5e7eb', background: 'transparent', color: '#555', fontSize: 11, cursor: 'pointer' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, width: 'min(600px, 93vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: 0.2 }}>{title}</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={inp} autoFocus/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setSel(new Set(allImeis))} style={btnStyle}>Select All</button>
          <button onClick={() => setSel(new Set())} style={btnStyle}>Deselect All</button>
          <span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>{sel.size}/{allImeis.length}</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 7, padding: '5px 10px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#111', outline: 'none', width: 120 }}/>
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
          {points.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>No vehicles online</div>
          : <ModalVehicleList allImeis={filtered} deviceMap={deviceMap} sel={sel} toggle={toggle} groups={groups} excludeGroupId={excludeGroupId}/>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
          <div>{extraLeft}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: 'transparent', color: '#666', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={onSubmit} disabled={!name.trim() || sel.size === 0}
              style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: !name.trim() || sel.size === 0 ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !name.trim() || sel.size === 0 ? 'not-allowed' : 'pointer' }}>
              {submitLabel} {sel.size > 0 ? `(${sel.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ mode, points, loading, onLoad, onClear, allVehicles, onVehicleSelect, onSegmentClick }: {
  mode: HistoryMode; points: TripPoint[]; loading: boolean;
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

  useEffect(() => {
    if (!showDrop) return;
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowDrop(false); setVSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDrop]);

  const timeline = useMemo(() => deriveTimeline(points), [points]);
  const totalKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += haversineKm(points[i-1]!.latitude, points[i-1]!.longitude, points[i]!.latitude, points[i]!.longitude);
    return d;
  }, [points]);

  const filteredVehicles = allVehicles.filter(v => !vSearch || v.plate.toLowerCase().includes(vSearch.toLowerCase()));

  const inp = (val: string, set: (v: string) => void) => (
    <input type="datetime-local" value={val} onChange={e => set(e.target.value)}
      style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11.5, color: '#111', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.currentTarget.style.borderColor = '#dc2626'}
      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}/>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <div style={{ flex: 1, fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Route History</div>
        <button onClick={onClear} title="Exit history" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f5f5f5', display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
        <div ref={searchRef} style={{ position: 'relative' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Vehicle</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 7, padding: '5px 9px', border: `1px solid ${showDrop ? '#dc2626' : '#e5e7eb'}` }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={showDrop ? vSearch : mode.plate} onChange={e => { setVSearch(e.target.value); setShowDrop(true); }} onFocus={() => { setVSearch(''); setShowDrop(true); }} placeholder="Search vehicle…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#111', outline: 'none' }}/>
            {showDrop && vSearch && <button onClick={() => setVSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>
          {showDrop && filteredVehicles.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
              {filteredVehicles.slice(0, 20).map(v => (
                <button key={v.imei} onClick={() => { onVehicleSelect(v.imei, v.plate, from, to); setShowDrop(false); setVSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 11px', border: 'none', background: v.imei === mode.imei ? '#fff0f0' : 'transparent', color: v.imei === mode.imei ? '#dc2626' : '#333', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { if (v.imei !== mode.imei) e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={e => { if (v.imei !== mode.imei) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {v.plate}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>From</div>
          {inp(from, setFrom)}
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>To</div>
          {inp(to, setTo)}
        </div>
        <button onClick={() => onLoad(from, to)} disabled={loading}
          style={{ padding: '8px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? 'Loading…' : 'Show History'}
        </button>
      </div>
      {points.length > 0 && (
        <div style={{ padding: '5px 12px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 14, fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
          <span>{points.length} pts</span>
          <span>{totalKm.toFixed(1)} km</span>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loading && points.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#bbb', fontSize: 12 }}>No GPS data for this range</div>}
        {points.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>{formatTsFull(points[0]!.timestamp)}</div>
            </div>
            {timeline.map((ev, i) => (
              <div key={i} onClick={() => onSegmentClick(ev)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: ev.type === 'parked' ? '#dc2626' : ev.type === 'idle' ? '#f59e0b' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 10, fontWeight: 700 }}>
                  {ev.type === 'parked' ? 'P' : ev.type === 'idle' ? 'I' : 'D'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#333' }}>{formatTsFull(ev.startTime)}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: ev.type === 'parked' ? '#dc2626' : ev.type === 'idle' ? '#f59e0b' : '#16a34a' }}>{formatDuration(ev.durationSec)}</div>
                </div>
                {ev.type === 'driving' && ev.avgSpeed !== undefined && (
                  <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{ev.avgSpeed} km/h</div>
                )}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9,18 15,12 9,6"/></svg>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Trip Replay Modal ─────────────────────────────────────────────────────────

type TripPreset = 'today' | 'yesterday' | 'last7' | 'custom';

function TripReplayInner({ points, currentIdx }: { points: TripPoint[]; currentIdx: number }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const passedRef = useRef<L.Polyline | null>(null);
  const fullRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!points.length) return;
    const coords: [number,number][] = points.map(p => [p.latitude, p.longitude]);
    fullRef.current = L.polyline(coords, { color: '#d1d5db', weight: 3, opacity: 0.5 }).addTo(map);
    passedRef.current = L.polyline([], { color: '#dc2626', weight: 3, opacity: 0.9 }).addTo(map);
    markerRef.current = L.marker(coords[0]!, { icon: makeCarIcon(points[0]!.heading ?? 0, 'moving', '', points[0]!.speedKmh) }).addTo(map);
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
    const ll: [number,number] = [pt.latitude, pt.longitude];
    markerRef.current?.setLatLng(ll);
    markerRef.current?.setIcon(makeCarIcon(pt.heading ?? 0, 'moving', '', pt.speedKmh));
    passedRef.current?.setLatLngs(points.slice(0, currentIdx + 1).map(p => [p.latitude, p.longitude]));
    map.panTo(ll, { animate: true, duration: 0.25 });
  }, [currentIdx, points, map]);
  return null;
}

function TripReplayModal({ imei, plate, onClose }: { imei: string; plate: string; onClose: () => void }) {
  const [preset, setPreset] = useState<TripPreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [history, setHistory] = useState<TripPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const doFetch = async () => {
      let from: string, to: string;
      if (preset === 'custom') {
        if (!customFrom || !customTo) return;
        from = new Date(customFrom).toISOString(); to = new Date(customTo).toISOString();
      } else {
        const p = preset === 'last7' ? (() => { const now = new Date(); const f = new Date(now); f.setDate(f.getDate()-7); f.setHours(0,0,0,0); return { from: f.toISOString(), to: now.toISOString() }; })()
          : getPresetRange(preset as 'today' | 'yesterday');
        from = new Date(p.from).toISOString(); to = new Date(p.to).toISOString();
      }
      setLoading(true); setPlaying(false); setFrameIdx(0);
      try {
        const { data } = await api.get<TripPoint[]>(`/telemetry/${imei}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=2000`);
        setHistory(data);
      } catch { setHistory([]); } finally { setLoading(false); }
    };
    doFetch();
  }, [imei, fetchKey, preset]);

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
      <div style={{ width: 'min(1200px, 98vw)', height: 'min(800px, 95vh)', background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="5,3 19,12 5,21"/></svg>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>Trip Replay — {plate}</span>
          {!loading && history.length > 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>{history.length} pts · {totalKm.toFixed(1)} km</span>}
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0, flexWrap: 'wrap' }}>
          {(['today', 'yesterday', 'last7', 'custom'] as TripPreset[]).map(p => {
            const label = p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'last7' ? 'Last 7 Days' : 'Custom';
            const active = preset === p;
            return <button key={p} type="button" onClick={() => { setPreset(p); if (p !== 'custom') setFetchKey(k => k + 1); }}
              style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${active ? '#dc2626' : '#e5e7eb'}`, background: active ? '#dc2626' : '#fff', color: active ? '#fff' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>;
          })}
          {preset === 'custom' && (<>
            <input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 11 }}/>
            <span style={{ fontSize: 11, color: '#aaa' }}>to</span>
            <input type="datetime-local" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 11 }}/>
            <button type="button" onClick={() => setFetchKey(k => k + 1)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Load</button>
          </>)}
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {(loading) && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', zIndex: 10 }}><span style={{ fontSize: 13, color: '#aaa' }}>Loading trip data…</span></div>}
          {!loading && history.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 13, color: '#9ca3af' }}>No GPS history for this vehicle</span></div>}
          {!loading && history.length > 0 && (
            <MapContainer center={[history[0]!.latitude, history[0]!.longitude]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM contributors"/>
              <TripReplayInner points={history} currentIdx={frameIdx}/>
            </MapContainer>
          )}
        </div>
        {!loading && history.length > 0 && (() => {
          const maxSpd = Math.max(...history.map(p => p.speedKmh), 1);
          const W = 300, H = 32;
          const sparkPts = history.map((p, i) => `${Math.round((i / (history.length - 1)) * W)},${Math.round(H - (p.speedKmh / maxSpd) * H)}`).join(' ');
          const curX = Math.round((frameIdx / (history.length - 1)) * W);
          return (
            <>
              {/* Speed sparkline */}
              <div style={{ padding: '6px 14px 0', background: '#fafafa', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width={W} height={H} style={{ flex: 1, maxWidth: '100%', display: 'block' }} preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
                    <polyline points={sparkPts} fill="none" stroke="#dc2626" strokeWidth="1.5" opacity="0.7"/>
                    <line x1={curX} y1="0" x2={curX} y2={H} stroke="#dc2626" strokeWidth="1.5"/>
                  </svg>
                  <div style={{ minWidth: 80, textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{Math.round(currentPt?.speedKmh ?? 0)}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>km/h</div>
                  </div>
                </div>
              </div>
              {/* Controls */}
              <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#fafafa', flexShrink: 0 }}>
                <button title="Restart" onClick={() => { setFrameIdx(0); setPlaying(false); }}
                  style={{ background: '#eee', border: 'none', cursor: 'pointer', color: '#555', padding: '6px 9px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="3"/></svg>
                </button>
                <button onClick={() => setPlaying(p => !p)} style={{ background: '#dc2626', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {playing ? 'Pause' : 'Play'}
                </button>
                <input type="range" min={0} max={Math.max(0, history.length - 1)} value={frameIdx}
                  onChange={e => { setPlaying(false); setFrameIdx(+e.target.value); }}
                  style={{ flex: 1, accentColor: '#dc2626', minWidth: 60 }}/>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 110 }}>
                  {currentPt && <>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{formatTs(currentPt.timestamp)}</span>
                    <span style={{ fontSize: 10, color: '#555' }}>Ign: {currentPt.ignition === true ? 'ON' : currentPt.ignition === false ? 'OFF' : '—'}</span>
                  </>}
                </div>
                <select value={playSpeed} onChange={e => setPlaySpeed(+e.target.value)}
                  style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#333', fontSize: 12, cursor: 'pointer' }}>
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                  <option value={8}>8×</option>
                </select>
                <span style={{ fontSize: 10, color: '#bbb' }}>{frameIdx + 1}/{history.length}</span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── Follow Window ─────────────────────────────────────────────────────────────

function FollowMiniMapMarker({ pt, plate }: { pt: LivePoint; plate: string }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const icon = makeCarIcon(pt.heading ?? 0, vehicleStatus(pt), plate, pt.speedKmh);
    const m = L.marker([pt.latitude, pt.longitude], { icon, zIndexOffset: 100 }).addTo(map);
    markerRef.current = m;
    return () => { m.remove(); markerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  useEffect(() => {
    const m = markerRef.current;
    if (!m) return;
    m.setLatLng([pt.latitude, pt.longitude]);
    m.setIcon(makeCarIcon(pt.heading ?? 0, vehicleStatus(pt), plate, pt.speedKmh));
    map.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.35 });
  }, [pt, plate, map]);
  return null;
}

function FollowWindow({ plate, pt, onStop, initPos }: { plate: string; pt: LivePoint | undefined; onStop: () => void; initPos: { x: number; y: number } }) {
  const [pos, setPos] = useState(initPos);
  const winRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const status = pt ? vehicleStatus(pt) : 'offline';
  const lat = pt?.latitude ?? 30.3753;
  const lng = pt?.longitude ?? 69.3451;

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const el = winRef.current;
      const w = el ? el.offsetWidth : 480;
      const h = el ? el.offsetHeight : 380;
      setPos({ x: Math.max(0, Math.min(window.innerWidth - w, dragRef.current.px + ev.clientX - dragRef.current.sx)), y: Math.max(0, Math.min(window.innerHeight - h, dragRef.current.py + ev.clientY - dragRef.current.sy)) });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={winRef} style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9200, width: 480, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden', userSelect: 'none' }}>
      <div onMouseDown={onHeaderMouseDown} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 10px 14px', background: '#dc2626', cursor: 'move' }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Following {plate}</span>
        <button onClick={onStop} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 3, display: 'flex', borderRadius: 3, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ height: 260, pointerEvents: 'none' }}>
        <MapContainer center={[lat, lng]} zoom={17} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} attributionControl={false} keyboard={false}>
          <TileLayer url={TILE_CONFIG['street'].url} />
          {pt && <FollowMiniMapMarker pt={pt} plate={plate} />}
        </MapContainer>
      </div>
      <div style={{ padding: '9px 14px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', flexShrink: 0 }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#555' }}>{pt ? `${Math.round(pt.speedKmh)} km/h` : '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 12, color: '#bbb' }}>
          <span style={{ color: pt?.ignition ? '#22c55e' : '#d1d5db' }}>IGN {pt?.ignition ? 'On' : 'Off'}</span>
          {pt?.heading != null && <span>Hdg {pt.heading}°</span>}
          {pt && <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Vehicle Detail Panel ──────────────────────────────────────────────────────

function VehicleDetailPanel({ imei, pt, deviceMap, vehicleDetails, onClose, onFollow, onTripReplay, onShowHistory }: {
  imei: string; pt: LivePoint | undefined;
  deviceMap: DMap; vehicleDetails: Map<string, VehicleDetail>;
  onClose: () => void;
  onFollow: () => void;
  onTripReplay: () => void;
  onShowHistory: (preset: 'lastHour' | 'today' | 'yesterday') => void;
}) {
  const dv = deviceMap.get(imei);
  const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
  const plate = fmtPlate(dv, imei);
  const vName = vc ? ([vc.make, vc.model].filter(Boolean).join(' ') || `#${vc.displayId}`) : plate;
  const status = pt ? vehicleStatus(pt) : 'offline';

  return (
    <div style={{ position: 'absolute', top: 10, right: 10, width: 220, background: '#fff', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.13)', border: '0.5px solid #e5e7eb', zIndex: 400 }}>
      <div style={{ padding: '10px 11px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{plate}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{vName}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, marginTop: 5, background: status === 'moving' ? '#dcfce7' : status === 'idle' ? '#fef9c3' : '#f3f4f6', color: status === 'moving' ? '#15803d' : status === 'idle' ? '#92400e' : '#374151' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[status] }}/>
            {STATUS_LABEL[status]}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 22, height: 22, background: '#f5f5f5', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {pt && (
        <div style={{ padding: '8px 11px' }}>
          {[
            { label: 'Speed', value: status === 'moving' ? `${Math.round(pt.speedKmh)} km/h` : '—' },
            { label: 'Ignition', value: pt.ignition === true ? 'On' : pt.ignition === false ? 'Off' : '—', color: pt.ignition ? '#16a34a' : undefined },
            { label: 'Updated', value: formatAge(pt.timestamp) },
            { label: 'Position', value: `${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}` },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '0.5px solid #f5f5f5', fontSize: 11 }}>
              <span style={{ color: '#888', flex: 1 }}>{label}</span>
              <span style={{ color: color || '#111', fontWeight: 500, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
          <div style={{ padding: '4px 0', fontSize: 10, color: '#bbb' }}>{formatTs(pt.timestamp)}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, padding: '0 11px 11px' }}>
        <button onClick={onFollow} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: 10, fontWeight: 500, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          Follow
        </button>
        <button onClick={() => onShowHistory('today')} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, fontWeight: 500, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          History
        </button>
        <button onClick={onTripReplay} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, fontWeight: 500, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          Replay
        </button>
      </div>
    </div>
  );
}

// ── Geofence & POI Map Layers ─────────────────────────────────────────────────

function GeofenceMapLayer({ geofences, selectedId }: { geofences: Geofence[]; selectedId: string | null }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (geofences.length === 0) return;
    const lg = L.layerGroup().addTo(map);
    layerRef.current = lg;
    for (const gf of geofences) {
      const color = selectedId === gf.id ? '#dc2626' : (gf.color ?? '#3b82f6');
      const opts = { color, fillColor: color, fillOpacity: 0.1, weight: selectedId === gf.id ? 2.5 : 1.5 };
      let layer: L.Circle | L.Polygon | null = null;
      if (gf.type === 'circle' && gf.latitude != null && gf.longitude != null && gf.radius != null) {
        layer = L.circle([gf.latitude, gf.longitude], { ...opts, radius: gf.radius });
      } else if (gf.type === 'polygon' && gf.coordinates && gf.coordinates.length >= 3) {
        layer = L.polygon(gf.coordinates, opts);
      }
      if (layer) {
        layer.bindTooltip(gf.name, { permanent: false, direction: 'center', className: '' });
        layer.addTo(lg);
      }
    }
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [geofences, selectedId, map]);

  return null;
}

function POIMarkerLayer({ pois, selectedId }: { pois: POI[]; selectedId: string | null }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (pois.length === 0) return;
    const lg = L.layerGroup().addTo(map);
    layerRef.current = lg;
    for (const poi of pois) {
      const active = selectedId === poi.id;
      const color = active ? '#dc2626' : '#6b7280';
      if (poi.radius > 0) L.circle([poi.latitude, poi.longitude], { color, fillColor: color, fillOpacity: 0.12, radius: poi.radius, weight: active ? 2.5 : 1.5, dashArray: active ? undefined : '4,3' }).addTo(lg);
      const markerIcon = L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" transform="rotate(45)"><circle cx="12" cy="12" r="4"/></svg></div>`,
        className: 'leaflet-interactive', iconSize: [22, 22], iconAnchor: [11, 22],
      });
      const m = L.marker([poi.latitude, poi.longitude], { icon: markerIcon });
      m.bindTooltip(`<strong>${poi.name}</strong><br>${poi.latitude.toFixed(5)}, ${poi.longitude.toFixed(5)}<br>Radius: ${poi.radius}m`, { direction: 'top', offset: [0, -20] });
      m.addTo(lg);
    }
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [pois, selectedId, map]);

  return null;
}

// ── Draw Layers ───────────────────────────────────────────────────────────────

function GeofenceDrawLayer({ active, mode, polygonPts, onCirclePick, onPolygonUpdate }: {
  active: boolean;
  mode: 'circle' | 'polygon';
  polygonPts: [number, number][];
  onCirclePick: (lat: number, lng: number, radius: number) => void;
  onPolygonUpdate: (pts: [number, number][]) => void;
}) {
  const map = useMap();
  const circleRef = useRef<L.Circle | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(500);

  useEffect(() => {
    if (!active) {
      map.getContainer().style.cursor = '';
      if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }
      if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; }
      setCenter(null);
      return;
    }
    map.getContainer().style.cursor = 'crosshair';
    return () => { map.getContainer().style.cursor = ''; };
  }, [active, mode, map]);

  // Circle preview
  useEffect(() => {
    if (!active || mode !== 'circle' || !center) return;
    if (circleRef.current) map.removeLayer(circleRef.current);
    circleRef.current = L.circle(center, { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.15, radius, weight: 2, dashArray: '6,4' }).addTo(map);
    return () => { if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; } };
  }, [active, mode, center, radius, map]);

  // Polygon preview
  useEffect(() => {
    if (!active || mode !== 'polygon') return;
    if (polygonRef.current) map.removeLayer(polygonRef.current);
    if (polygonPts.length >= 2) {
      polygonRef.current = L.polygon(polygonPts, { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.15, weight: 2, dashArray: '6,4' }).addTo(map);
    }
    return () => { if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; } };
  }, [active, mode, polygonPts, map]);

  useMapEvents({
    click(e) {
      if (!active) return;
      if (mode === 'circle') {
        const c: [number, number] = [e.latlng.lat, e.latlng.lng];
        setCenter(c);
        onCirclePick(c[0], c[1], radius);
      } else {
        onPolygonUpdate([...polygonPts, [e.latlng.lat, e.latlng.lng]]);
      }
    },
  });

  if (!active) return null;

  // Radius slider for circle mode
  if (mode === 'circle' && center) {
    return (
      <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fff', borderRadius: 8, padding: '6px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'all' }}>
        <span style={{ fontSize: 11, color: '#555' }}>Radius:</span>
        <input type="range" min={100} max={50000} step={100} value={radius} onChange={e => { setRadius(+e.target.value); if (center) onCirclePick(center[0], center[1], +e.target.value); }} style={{ width: 110, accentColor: '#dc2626' }} />
        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, minWidth: 54 }}>{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</span>
      </div>
    );
  }

  return null;
}

function POIDrawLayer({ active, onPick }: {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!active) { map.getContainer().style.cursor = ''; return; }
    map.getContainer().style.cursor = 'crosshair';
    return () => { map.getContainer().style.cursor = ''; };
  }, [active, map]);
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortalMapPage() {
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [deviceMap, setDeviceMap] = useState<DMap>(new Map());
  const [vehicleDetails, setVehicleDetails] = useState<Map<string, VehicleDetail>>(new Map());
  const [apiGroups, setApiGroups] = useState<ApiVehicleGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);
  const [createName, setCreateName] = useState('');
  const [createSel, setCreateSel] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState('');
  const [editSel, setEditSel] = useState<Set<string>>(new Set());

  // Map state
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; ts: number } | null>(null);

  // Selected vehicle
  const [selectedImei, setSelectedImei] = useState<string | null>(null);

  // History mode
  const [historyMode, setHistoryMode] = useState<HistoryMode | null>(null);
  const [historyPoints, setHistoryPoints] = useState<TripPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<TimelineEvent | null>(null);

  // Trip replay
  const [tripReplay, setTripReplay] = useState<{ imei: string; plate: string } | null>(null);

  // Follow
  const [followImei, setFollowImei] = useState<string | null>(null);
  const [followPos] = useState({ x: 260, y: 60 });

  // Panel context
  const { activePanel, openPanel, setAlertCount, closePanel } = usePortalPanel();

  // Create alert from vehicle menu
  const [createAlertImei, setCreateAlertImei] = useState<string | null>(null);
  const handleCreateAlert = (imei: string) => {
    setCreateAlertImei(imei);
    openPanel('alerts');
  };

  // Panel data
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [gfLoading, setGfLoading] = useState(false);
  const [pois, setPois] = useState<POI[]>([]);
  const [poisLoading, setPoisLoading] = useState(false);
  const [selectedGfId, setSelectedGfId] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  // Draw state for geofence/POI
  const [gfDrawActive, setGfDrawActive] = useState(false);
  const [gfDrawType, setGfDrawType] = useState<'circle' | 'polygon'>('circle');
  const [gfDrawnCircle, setGfDrawnCircle] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [gfDrawnPolygon, setGfDrawnPolygon] = useState<[number, number][] | null>(null);
  const [poiDrawActive, setPoiDrawActive] = useState(false);
  const [poiDrawnPoint, setPoiDrawnPoint] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  // vidToImei reverse map
  const vidToImei = useMemo(() => {
    const m = new Map<string, string>();
    deviceMap.forEach((info, imei) => { if (info.vehicleId) m.set(info.vehicleId, imei); });
    return m;
  }, [deviceMap]);

  // Convert API groups to local groups
  const groups = useMemo<VehicleGroup[]>(() =>
    apiGroups.map(g => ({ id: g.id, name: g.name, imeis: g.vehicleIds.map(vid => vidToImei.get(vid) ?? '').filter(Boolean) })),
  [apiGroups, vidToImei]);

  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);

  // Load devices + vehicles once
  useEffect(() => {
    api.get<DeviceInfo[]>('/devices').then(r => {
      const dm = new Map<string, { plate: string | null; vehicleId: string | null; displayId: number | null }>();
      for (const d of r.data) dm.set(d.imei, { plate: d.vehicle?.licensePlate ?? null, vehicleId: d.vehicle?.id ?? null, displayId: d.vehicle?.displayId ?? d.displayId });
      setDeviceMap(dm);
    }).catch(() => {});
    api.get<VehicleDetail[]>('/vehicles').then(r => {
      const vm = new Map<string, VehicleDetail>();
      for (const v of r.data) vm.set(v.id, v);
      setVehicleDetails(vm);
    }).catch(() => {});
    api.get<ApiVehicleGroup[]>('/vehicle-groups').then(r => setApiGroups(r.data)).catch(() => {});
  }, []);

  // Poll live telemetry
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      api.get<LivePoint[]>('/telemetry/live').then(r => setPoints(r.data)).catch(() => {}).finally(() => { timer = setTimeout(poll, POLL_MS); });
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  // Initial alert count badge
  useEffect(() => {
    api.get<AlertItem[]>('/alerts?limit=200').then(r => {
      setAlerts(r.data);
      setAlertCount(r.data.filter(a => a.active).length);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy panel data fetch
  useEffect(() => {
    if (activePanel === 'alerts') {
      setAlertsLoading(true);
      api.get<AlertItem[]>('/alerts?limit=500').then(r => {
        setAlerts(r.data);
        setAlertCount(r.data.filter(a => a.active).length);
      }).catch(() => {}).finally(() => setAlertsLoading(false));
    } else if (activePanel === 'geofences') {
      setGfLoading(true);
      api.get<Geofence[]>('/geofences').then(r => setGeofences(r.data)).catch(() => {}).finally(() => setGfLoading(false));
    } else if (activePanel === 'pois') {
      setPoisLoading(true);
      api.get<POI[]>('/pois').then(r => setPois(r.data)).catch(() => {}).finally(() => setPoisLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  // History load
  const loadHistory = useCallback(async (imei: string, plate: string, from: string, to: string) => {
    setHistoryLoading(true);
    setHistoryPoints([]);
    setSelectedSegment(null);
    setHistoryMode({ imei, plate, from, to });
    try {
      const { data } = await api.get<TripPoint[]>(`/telemetry/${imei}/history?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}&limit=2000`);
      setHistoryPoints(data);
    } catch { setHistoryPoints([]); } finally { setHistoryLoading(false); }
  }, []);

  const showHistory = useCallback((imei: string, plate: string, preset: 'lastHour' | 'today' | 'yesterday') => {
    const range = getPresetRange(preset);
    loadHistory(imei, plate, range.from, range.to);
  }, [loadHistory]);

  const clearHistory = () => { setHistoryMode(null); setHistoryPoints([]); setSelectedSegment(null); };

  const allVehicles = useMemo(() =>
    points.map(pt => ({ imei: pt.imei, plate: fmtPlate(deviceMap.get(pt.imei), pt.imei) }))
      .sort((a, b) => a.plate.localeCompare(b.plate)),
  [points, deviceMap]);

  const handleFollow = (imei: string) => {
    setFollowImei(imei);
  };

  const handleSelect = useCallback((imei: string) => {
    const pt = points.find(p => p.imei === imei);
    if (pt) setFlyTarget({ lat: pt.latitude, lng: pt.longitude, ts: Date.now() });
    setSelectedImei(imei);
  }, [points]);

  // Groups management
  const createGroup = async (name: string, imeis: string[]) => {
    const vehicleIds = imeis.map(i => deviceMap.get(i)?.vehicleId).filter(Boolean) as string[];
    try {
      const r = await api.post<ApiVehicleGroup>('/vehicle-groups', { name, vehicleIds });
      setApiGroups(p => [...p, r.data]);
    } catch {}
  };
  const saveGroup = async (id: string, name: string, imeis: string[]) => {
    const vehicleIds = imeis.map(i => deviceMap.get(i)?.vehicleId).filter(Boolean) as string[];
    try {
      const r = await api.put<ApiVehicleGroup>(`/vehicle-groups/${id}`, { name, vehicleIds });
      setApiGroups(p => p.map(g => g.id === id ? r.data : g));
    } catch {}
  };
  const deleteGroup = async (id: string) => {
    try { await api.delete(`/vehicle-groups/${id}`); setApiGroups(p => p.filter(g => g.id !== id)); } catch {}
  };
  const toggleCollapse = (id: string) => setCollapsed(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Build filtered lists
  const q = search.trim().toLowerCase();
  const matches = (imei: string) => {
    if (!q) return true;
    const plate = fmtPlate(deviceMap.get(imei), imei);
    return plate.toLowerCase().includes(q) || imei.includes(q);
  };
  const filteredPoints = points.filter(p => matches(p.imei));
  const groupedImeis = new Set(groups.flatMap(g => g.imeis));
  const ungrouped = filteredPoints.filter(p => !groupedImeis.has(p.imei));

  const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
  for (const pt of points) counts[vehicleStatus(pt)]++;

  const followPt = followImei ? points.find(p => p.imei === followImei) : undefined;
  const followPlate = followImei ? fmtPlate(deviceMap.get(followImei), followImei) : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Map */}
      <MapContainer
        center={[31.5204, 74.3587]}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        ref={mapRef}
      >
        <MapStyleTileLayer style={mapStyle} />
        {historyMode ? (
          <HistoryLayer points={historyPoints} selectedSegment={selectedSegment} />
        ) : (
          <ClusterLayer points={points} deviceMap={deviceMap} vehicleDetails={vehicleDetails} onSelect={handleSelect} />
        )}
        {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} ts={flyTarget.ts} />}
        {activePanel === 'geofences' && <GeofenceMapLayer geofences={geofences} selectedId={selectedGfId} />}
        {activePanel === 'pois' && <POIMarkerLayer pois={pois} selectedId={selectedPoiId} />}
        {activePanel === 'geofences' && gfDrawActive && (
          <GeofenceDrawLayer
            active={gfDrawActive}
            mode={gfDrawType}
            polygonPts={gfDrawnPolygon ?? []}
            onCirclePick={(lat, lng, r) => { setGfDrawnCircle({ lat, lng, radius: r }); }}
            onPolygonUpdate={pts => setGfDrawnPolygon(pts)}
          />
        )}
        {activePanel === 'pois' && poiDrawActive && (
          <POIDrawLayer active={poiDrawActive} onPick={(lat, lng) => { setPoiDrawnPoint({ lat, lng }); setPoiDrawActive(false); }} />
        )}
      </MapContainer>

      {/* Bottom-right controls: zoom → map style → status counts */}
      <div style={{ position: 'absolute', bottom: 30, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {/* Zoom */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {['+', '−'].map(lbl => (
            <button key={lbl} onClick={() => lbl === '+' ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut()}
              style={{ width: 30, height: 30, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
              {lbl}
            </button>
          ))}
        </div>
        {/* Map style */}
        <MapStyleSwitcher current={mapStyle} onChange={setMapStyle} />
        {/* Status counts */}
        <div style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', display: 'flex', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Moving: {counts.moving}</span>
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>Idle: {counts.idle}</span>
          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Parked: {counts.parked}</span>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Offline: {counts.offline}</span>
        </div>
      </div>

      {/* Left floating panel */}
      <div style={{
        position: 'absolute', top: 10, left: 10, bottom: 10, width: 360,
        background: '#fff', borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.07)',
        border: '0.5px solid #e8e8e8', display: 'flex', flexDirection: 'column', zIndex: 400,
        overflow: 'hidden',
      }}>
        {activePanel === 'alerts' ? (
          <AlertsPanel alerts={alerts} loading={alertsLoading}
            setAlertList={list => { setAlerts(list); setAlertCount(list.filter(a => a.active).length); }}
            initialImei={createAlertImei}
            key={createAlertImei ?? 'alerts'} />
        ) : activePanel === 'geofences' ? (
          <GeofencesPanel geofences={geofences} loading={gfLoading} selectedId={selectedGfId}
            onSelect={gf => {
              setSelectedGfId(gf.id);
              if (gf.type === 'circle' && gf.latitude != null && gf.longitude != null) {
                mapRef.current?.flyTo([gf.latitude, gf.longitude], 14, { animate: true, duration: 0.7 });
              } else if (gf.type === 'polygon' && gf.coordinates && gf.coordinates.length > 0) {
                try { mapRef.current?.fitBounds(L.latLngBounds(gf.coordinates), { padding: [40, 40], animate: true }); } catch {}
              }
            }}
            onListChange={setGeofences}
            drawActive={gfDrawActive}
            onToggleDraw={() => { setGfDrawActive(a => !a); setGfDrawnCircle(null); setGfDrawnPolygon(null); }}
            drawnCircle={gfDrawnCircle}
            drawnPolygon={gfDrawnPolygon}
            onTypeChange={t => { setGfDrawType(t); setGfDrawnCircle(null); setGfDrawnPolygon(null); }}
            onPolygonPointRemove={idx => setGfDrawnPolygon(pts => pts ? pts.filter((_, i) => i !== idx) : null)}
            onPolygonClear={() => setGfDrawnPolygon(null)}
          />
        ) : activePanel === 'pois' ? (
          <POIsPanel pois={pois} loading={poisLoading} selectedId={selectedPoiId}
            onSelect={poi => {
              setSelectedPoiId(poi.id);
              mapRef.current?.flyTo([poi.latitude, poi.longitude], 16, { animate: true, duration: 0.7 });
            }}
            onListChange={setPois}
            drawActive={poiDrawActive}
            onToggleDraw={() => { setPoiDrawActive(a => !a); setPoiDrawnPoint(null); }}
            drawnPoint={poiDrawnPoint}
          />
        ) : historyMode ? (
          <HistoryPanel
            mode={historyMode}
            points={historyPoints}
            loading={historyLoading}
            onLoad={(from, to) => loadHistory(historyMode.imei, historyMode.plate, from, to)}
            onClear={clearHistory}
            allVehicles={allVehicles}
            onVehicleSelect={(imei, plate, from, to) => loadHistory(imei, plate, from, to)}
            onSegmentClick={ev => setSelectedSegment(ev)}
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 10px', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111' }}>
                Vehicles <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa' }}>{points.length}</span>
              </span>
              <button onClick={() => { setCreateName(''); setCreateSel(new Set()); setShowCreate(true); }} title="Create group"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#666' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 7, padding: '5px 9px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#111', outline: 'none' }}/>
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex' }}>
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
                    onSelect={handleSelect} collapsed={collapsed.has(group.id)} onToggle={() => toggleCollapse(group.id)}
                    onEdit={() => { setEditingGroup(group); setEditName(group.name); setEditSel(new Set(group.imeis)); }}
                    onTripReplay={(imei, plate) => setTripReplay({ imei, plate })}
                    onShowHistory={showHistory}
                    onFollow={handleFollow}
                    onCreateAlert={handleCreateAlert}
                    getHasAlert={(imei) => alerts.some(a => a.active && a.vehicleImeis.includes(imei))}/>
                );
              })}
              {ungrouped.length > 0 && (
                <>
                  {groups.length > 0 && <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f5f5f5' }}>Ungrouped</div>}
                  {ungrouped.map(pt => {
                    const plate = fmtPlate(deviceMap.get(pt.imei), pt.imei);
                    return (
                      <VehicleRow key={pt.imei} pt={pt} plate={plate}
                        onSelect={() => handleSelect(pt.imei)}
                        onTripReplay={() => setTripReplay({ imei: pt.imei, plate })}
                        onShowHistory={(preset) => showHistory(pt.imei, plate, preset)}
                        onFollow={() => handleFollow(pt.imei)}
                        onCreateAlert={() => handleCreateAlert(pt.imei)}
                        hasAlert={alerts.some(a => a.active && a.vehicleImeis.includes(pt.imei))}/>
                    );
                  })}
                </>
              )}
              {filteredPoints.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#aaa' }}>{search ? 'No results' : 'No vehicles online'}</div>}
            </div>
            {/* Footer counts */}
            <div style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
              {counts.moving > 0 && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>{counts.moving} Moving</span>}
              {counts.idle > 0 && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 500 }}>{counts.idle} Idle</span>}
              {counts.parked > 0 && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{counts.parked} Parked</span>}
              {counts.offline > 0 && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>{counts.offline} Offline</span>}
            </div>
          </>
        )}
      </div>

      {/* Vehicle detail panel */}
      {selectedImei && !historyMode && (
        <VehicleDetailPanel
          imei={selectedImei}
          pt={points.find(p => p.imei === selectedImei)}
          deviceMap={deviceMap}
          vehicleDetails={vehicleDetails}
          onClose={() => setSelectedImei(null)}
          onFollow={() => handleFollow(selectedImei)}
          onTripReplay={() => {
            const plate = fmtPlate(deviceMap.get(selectedImei), selectedImei);
            setTripReplay({ imei: selectedImei, plate });
          }}
          onShowHistory={(preset) => {
            const plate = fmtPlate(deviceMap.get(selectedImei), selectedImei);
            showHistory(selectedImei, plate, preset);
          }}
        />
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <GroupModal title="Create Group" name={createName} setName={setCreateName}
          points={points} deviceMap={deviceMap} sel={createSel} setSel={setCreateSel}
          groups={groups}
          onClose={() => setShowCreate(false)}
          onSubmit={() => { if (createName.trim() && createSel.size > 0) { createGroup(createName.trim(), [...createSel]); setShowCreate(false); } }}
          submitLabel="Create"
        />
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <GroupModal title="Edit Group" name={editName} setName={setEditName}
          points={points} deviceMap={deviceMap} sel={editSel} setSel={setEditSel}
          groups={groups} excludeGroupId={editingGroup.id}
          onClose={() => setEditingGroup(null)}
          onSubmit={() => { if (editName.trim()) { saveGroup(editingGroup.id, editName.trim(), [...editSel]); setEditingGroup(null); } }}
          submitLabel="Save"
          extraLeft={
            <button onClick={() => { deleteGroup(editingGroup.id); setEditingGroup(null); }}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>
              Delete Group
            </button>
          }
        />
      )}

      {/* Trip Replay Modal */}
      {tripReplay && (
        <TripReplayModal imei={tripReplay.imei} plate={tripReplay.plate} onClose={() => setTripReplay(null)} />
      )}

      {/* Follow Window */}
      {followImei && (
        <FollowWindow plate={followPlate} pt={followPt} onStop={() => setFollowImei(null)} initPos={followPos} />
      )}

      {/* Reports Modal */}
      {activePanel === 'reports' && <ReportsModal onClose={closePanel} />}

      {/* Driver Behavior Modal */}
      {activePanel === 'behavior' && <DriverBehaviorModal onClose={closePanel} />}

      {/* Users Modal */}
      {activePanel === 'users' && <UsersModal onClose={closePanel} />}
    </div>
  );
}
