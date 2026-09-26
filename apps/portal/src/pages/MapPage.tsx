import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  IconSearch, IconX, IconCar, IconMapPin, IconHistory,
  IconGauge, IconClockHour4, IconBolt,
} from '@tabler/icons-react';
import api from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LivePoint {
  id: string; imei: string; deviceId: string | null;
  latitude: number; longitude: number; speedKmh: number;
  heading: number; satellites: number; gpsValid: boolean; timestamp: string;
  ignition?: boolean | null;
}

interface DeviceInfo {
  imei: string;
  vehicle: { id: string; licensePlate: string | null; displayId: number } | null;
}

interface VehicleDetail {
  id: string; make: string | null; model: string | null;
  licensePlate: string | null; displayId: number;
}

interface SelectedVehicle {
  imei: string;
  plate: string;
  name: string;
  status: Status;
  speedKmh: number;
  ignition: boolean | null;
  timestamp: string;
  lat: number;
  lng: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOVING_SPEED = 5;
const POLL_MS = 5000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Status = 'moving' | 'idle' | 'parked' | 'offline';
const STATUS_COLOR: Record<Status, string> = {
  moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af',
};
const STATUS_LABEL: Record<Status, string> = {
  moving: 'Moving', idle: 'Idle', parked: 'Parked', offline: 'Offline',
};

function isOffline(ts: string) { return Date.now() - new Date(ts).getTime() > 10 * 60 * 1000; }
function getStatus(pt: LivePoint): Status {
  if (isOffline(pt.timestamp)) return 'offline';
  if (pt.speedKmh >= MOVING_SPEED) return 'moving';
  if (pt.ignition === true) return 'idle';
  return 'parked';
}
function fmtTs(ts: string) {
  const d = new Date(ts);
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`;
}
function fmtAge(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}
function vehName(v: VehicleDetail) {
  return [v.make, v.model].filter(Boolean).join(' ') || `#${v.displayId}`;
}
function makeIcon(status: Status, plate: string, speed: number): L.DivIcon {
  const color = STATUS_COLOR[status];
  const label = plate.length > 8 ? plate.slice(0, 8) + '…' : plate;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
    <div style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap;letter-spacing:0.3px">${label}</div>
    <div style="width:10px;height:10px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
    ${status==='moving'?`<div style="background:rgba(0,0,0,.6);color:#fff;font-size:8px;padding:1px 4px;border-radius:2px">${Math.round(speed)} km/h</div>`:''}
  </div>`;
  return L.divIcon({ html, className: 'leaflet-interactive', iconAnchor: [20, 14], iconSize: [40, 28] });
}

// ── Cluster layer ─────────────────────────────────────────────────────────────

interface ClusterLayerProps {
  points: LivePoint[];
  deviceMap: Map<string, { plate: string | null; vehicleId: string | null }>;
  vehicleDetails: Map<string, VehicleDetail>;
  onSelect: (v: SelectedVehicle) => void;
}

function ClusterLayer({ points, deviceMap, vehicleDetails, onSelect }: ClusterLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerMapRef = useRef<Map<string, { marker: L.Marker; imei: string }>>(new Map());

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
      const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
      const plate = dv?.plate || `#${pt.imei.slice(-4)}`;
      const status = getStatus(pt);
      const icon = makeIcon(status, plate, pt.speedKmh);

      if (existing.has(pt.imei)) {
        const entry = existing.get(pt.imei)!;
        entry.marker.setLatLng([pt.latitude, pt.longitude]);
        entry.marker.setIcon(icon);
      } else {
        const marker = L.marker([pt.latitude, pt.longitude], { icon });
        marker.on('click', () => {
          onSelect({
            imei: pt.imei,
            plate,
            name: vc ? vehName(vc) : plate,
            status,
            speedKmh: pt.speedKmh,
            ignition: pt.ignition ?? null,
            timestamp: pt.timestamp,
            lat: pt.latitude,
            lng: pt.longitude,
          });
        });
        group.addLayer(marker);
        existing.set(pt.imei, { marker, imei: pt.imei });
      }
    }

    for (const [imei, entry] of existing) {
      if (!seen.has(imei)) { group.removeLayer(entry.marker); existing.delete(imei); }
    }
  }, [points, deviceMap, vehicleDetails, map, onSelect]);

  useEffect(() => () => {
    if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; }
  }, [map]);

  return null;
}

// ── Vehicle list item ─────────────────────────────────────────────────────────

interface ListEntry {
  imei: string;
  plate: string;
  name: string;
  status: Status;
  speedKmh: number;
  ignition: boolean | null;
  timestamp: string;
  lat: number;
  lng: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortalMapPage() {
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [deviceMap, setDeviceMap] = useState<Map<string, { plate: string | null; vehicleId: string | null }>>(new Map());
  const [vehicleDetails, setVehicleDetails] = useState<Map<string, VehicleDetail>>(new Map());
  const [selected, setSelected] = useState<SelectedVehicle | null>(null);
  const [search, setSearch] = useState('');
  const mapRef = useRef<L.Map | null>(null);

  // Load devices + vehicles once
  useEffect(() => {
    api.get<DeviceInfo[]>('/devices').then(r => {
      const dm = new Map<string, { plate: string | null; vehicleId: string | null }>();
      for (const d of r.data) dm.set(d.imei, { plate: d.vehicle?.licensePlate ?? null, vehicleId: d.vehicle?.id ?? null });
      setDeviceMap(dm);
    }).catch(() => {});
    api.get<VehicleDetail[]>('/vehicles').then(r => {
      const vm = new Map<string, VehicleDetail>();
      for (const v of r.data) vm.set(v.id, v);
      setVehicleDetails(vm);
    }).catch(() => {});
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

  // Build vehicle list from live points
  const list: ListEntry[] = points
    .filter(pt => pt.gpsValid || pt.latitude !== 0)
    .map(pt => {
      const dv = deviceMap.get(pt.imei);
      const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
      return {
        imei: pt.imei,
        plate: dv?.plate || `#${pt.imei.slice(-4)}`,
        name: vc ? vehName(vc) : (dv?.plate || pt.imei.slice(-4)),
        status: getStatus(pt),
        speedKmh: pt.speedKmh,
        ignition: pt.ignition ?? null,
        timestamp: pt.timestamp,
        lat: pt.latitude,
        lng: pt.longitude,
      };
    })
    .filter(v => {
      const q = search.toLowerCase();
      return !q || v.plate.toLowerCase().includes(q) || v.name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ord: Record<Status, number> = { moving: 0, idle: 1, parked: 2, offline: 3 };
      return ord[a.status] - ord[b.status];
    });

  const counts = { moving: 0, idle: 0, parked: 0, offline: 0 };
  for (const v of list) counts[v.status]++;

  const handleSelect = useCallback((v: SelectedVehicle) => {
    setSelected(v);
    if (mapRef.current) mapRef.current.setView([v.lat, v.lng], 16, { animate: true });
  }, []);

  const handleListClick = (v: ListEntry) => {
    setSelected({ imei: v.imei, plate: v.plate, name: v.name, status: v.status, speedKmh: v.speedKmh, ignition: v.ignition, timestamp: v.timestamp, lat: v.lat, lng: v.lng });
    if (mapRef.current) mapRef.current.setView([v.lat, v.lng], 16, { animate: true });
  };

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
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        <ClusterLayer
          points={points}
          deviceMap={deviceMap}
          vehicleDetails={vehicleDetails}
          onSelect={handleSelect}
        />
      </MapContainer>

      {/* Vehicle list — full height floating left with margin */}
      <div style={{
        position: 'absolute', top: 10, left: 10, bottom: 10, width: 220,
        background: '#fff', borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.07)',
        border: '0.5px solid #e8e8e8', display: 'flex', flexDirection: 'column', zIndex: 400,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '11px 12px 9px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconCar size={15} color="#dc2626" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>Vehicles</span>
            <span style={{ marginLeft: 'auto', background: '#f0f0f0', color: '#666', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>
              {list.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f5f5f5', borderRadius: 5, padding: '5px 8px' }}>
            <IconSearch size={12} color="#aaa" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search plate or name..."
              style={{ border: 'none', background: 'none', fontSize: 11, color: '#333', width: '100%', outline: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
                <IconX size={11} color="#aaa" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 11, color: '#bbb' }}>
              {search ? 'No vehicles found' : 'No live data'}
            </div>
          )}
          {list.map(v => (
            <div
              key={v.imei}
              onClick={() => handleListClick(v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                cursor: 'pointer', borderBottom: '0.5px solid #f5f5f5',
                background: selected?.imei === v.imei ? '#fef2f2' : undefined,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[v.status], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#111' }}>{v.plate}</div>
                <div style={{ fontSize: 10, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
              </div>
              <div style={{ fontSize: 10, color: '#777', fontWeight: 500, flexShrink: 0 }}>
                {v.status === 'moving' ? `${Math.round(v.speedKmh)} km/h` : STATUS_LABEL[v.status]}
              </div>
            </div>
          ))}
        </div>

        {/* Footer counts */}
        <div style={{ padding: '7px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {counts.moving > 0 && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>{counts.moving} Moving</span>}
          {counts.idle > 0 && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 500 }}>{counts.idle} Idle</span>}
          {counts.parked > 0 && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{counts.parked} Parked</span>}
          {counts.offline > 0 && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>{counts.offline} Offline</span>}
        </div>
      </div>

      {/* Vehicle detail panel — right floating */}
      {selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10, width: 210,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 6px 24px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.07)',
          border: '0.5px solid #e5e7eb', zIndex: 400,
        }}>
          {/* Header */}
          <div style={{ padding: '10px 11px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{selected.plate}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{selected.name}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, marginTop: 5,
                background: selected.status === 'moving' ? '#dcfce7' : selected.status === 'idle' ? '#fef9c3' : '#f3f4f6',
                color: selected.status === 'moving' ? '#15803d' : selected.status === 'idle' ? '#92400e' : '#374151',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[selected.status] }} />
                {STATUS_LABEL[selected.status]}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ width: 22, height: 22, background: '#f5f5f5', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <IconX size={12} color="#999" />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '8px 11px' }}>
            {[
              { icon: <IconGauge size={12} color="#888" />, label: 'Speed', value: selected.status === 'moving' ? `${Math.round(selected.speedKmh)} km/h` : '—' },
              { icon: <IconBolt size={12} color="#888" />, label: 'Ignition', value: selected.ignition === true ? <span style={{ color: '#16a34a', fontWeight: 600 }}>On</span> : selected.ignition === false ? <span style={{ color: '#6b7280' }}>Off</span> : '—' },
              { icon: <IconClockHour4 size={12} color="#888" />, label: 'Updated', value: fmtAge(selected.timestamp) },
              { icon: <IconMapPin size={12} color="#888" />, label: 'Position', value: `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}` },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '0.5px solid #f5f5f5', fontSize: 11 }}>
                {icon}
                <span style={{ color: '#888', flex: 1 }}>{label}</span>
                <span style={{ color: '#111', fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: '4px 0', fontSize: 10, color: '#bbb' }}>{fmtTs(selected.timestamp)}</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, padding: '0 11px 11px' }}>
            <button style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, fontWeight: 500, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IconHistory size={11} /> History
            </button>
            <button style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: 10, fontWeight: 500, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IconMapPin size={11} /> Track
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 20, right: 10, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 400 }}>
        {['+', '−'].map(lbl => (
          <button
            key={lbl}
            onClick={() => lbl === '+' ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut()}
            style={{ width: 30, height: 30, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
