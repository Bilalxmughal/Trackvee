import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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

function isOffline(pt: LivePoint): boolean {
  return Date.now() - new Date(pt.timestamp).getTime() > 10 * 60 * 1000;
}

function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'offline' {
  if (isOffline(pt)) return 'offline';
  return pt.speedKmh > 0 ? 'moving' : 'idle';
}

const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', offline: '#9ca3af' } as const;
const STATUS_LABEL = { moving: 'Moving', idle: 'Stopped', offline: 'Offline' } as const;
const VOLT_LABELS = ['No Power', 'Critical', 'Low', 'Medium', 'High', 'Full'];

function formatTs(ts: string): string {
  const d = new Date(ts);
  const day = d.getDate().toString().padStart(2, '0');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const yr = d.getFullYear();
  let h = d.getHours(); const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (!h) h = 12;
  return `${day}-${mon}-${yr} ${h}:${d.getMinutes().toString().padStart(2,'0')} ${ampm}`;
}

function formatAge(ts: string): string {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ago`;
}

const geocodeCache = new Map<string, string>();
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  const j = await r.json() as { display_name?: string };
  const addr = j.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  geocodeCache.set(key, addr);
  return addr;
}

function makeCarIcon(heading: number, offline: boolean, plate: string, speed: number): L.DivIcon {
  const color  = offline ? '#dc2626' : '#16a34a';
  const dark   = offline ? '#a01010' : '#0d7a3a';
  const label  = `${plate} (${Math.round(speed)} kph)`;

  // Top-down car silhouette using paths for a realistic look
  const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 50" width="22" height="37" style="display:block">
    <g transform="rotate(${heading} 15 25)">
      <!-- Shadow -->
      <ellipse cx="15" cy="47" rx="10" ry="2.5" fill="rgba(0,0,0,0.18)"/>
      <!-- Body silhouette -->
      <path d="M15,2 C20,4 24,9 24,14 L24,37 C24,43 20,47 15,47 C10,47 6,43 6,37 L6,14 C6,9 10,4 15,2Z" fill="${color}"/>
      <!-- Hood highlight -->
      <path d="M15,3 C19,5 22,9 22,13 L8,13 C8,9 11,5 15,3Z" fill="rgba(255,255,255,0.18)"/>
      <!-- Windshield -->
      <path d="M9,14 L21,14 L20,23 L10,23Z" fill="rgba(180,225,255,0.6)" stroke="rgba(0,0,0,0.08)" stroke-width="0.3"/>
      <!-- Roof centre (darker panel) -->
      <rect x="10" y="23" width="10" height="9" rx="1" fill="${dark}" opacity="0.55"/>
      <!-- Rear window -->
      <path d="M10,32 L20,32 L21,39 L9,39Z" fill="rgba(180,225,255,0.35)" stroke="rgba(0,0,0,0.06)" stroke-width="0.3"/>
      <!-- Headlights -->
      <path d="M10,4 Q15,2 20,4 L19,7 Q15,5 11,7Z" fill="rgba(255,255,210,0.95)"/>
      <!-- Taillights -->
      <rect x="9"  y="43" width="5" height="2.5" rx="1" fill="#ff4444" opacity="0.85"/>
      <rect x="16" y="43" width="5" height="2.5" rx="1" fill="#ff4444" opacity="0.85"/>
      <!-- Wheels (black with tyre detail) -->
      <ellipse cx="6"  cy="16" rx="3.5" ry="4.5" fill="#111"/>
      <ellipse cx="24" cy="16" rx="3.5" ry="4.5" fill="#111"/>
      <ellipse cx="6"  cy="37" rx="3.5" ry="4.5" fill="#111"/>
      <ellipse cx="24" cy="37" rx="3.5" ry="4.5" fill="#111"/>
      <!-- Wheel rim glint -->
      <ellipse cx="6"  cy="16" rx="1.5" ry="1.8" fill="#555"/>
      <ellipse cx="24" cy="16" rx="1.5" ry="1.8" fill="#555"/>
      <ellipse cx="6"  cy="37" rx="1.5" ry="1.8" fill="#555"/>
      <ellipse cx="24" cy="37" rx="1.5" ry="1.8" fill="#555"/>
    </g>
  </svg>`;

  const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;font-family:system-ui,sans-serif">
    ${carSvg}
    <div style="background:rgba(10,10,10,0.82);color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap;letter-spacing:0.3px;border-left:3px solid ${color}">${label}</div>
  </div>`;

  return L.divIcon({ html, className: '', iconSize: [130, 55], iconAnchor: [65, 37], popupAnchor: [0, -38] });
}

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
  const fittedForKey = useRef<string>('');
  useEffect(() => {
    const key = resetKey ?? '__all__';
    if (fittedForKey.current === key || points.length === 0) return;
    const valid = points.filter(p => p.gpsValid);
    if (!valid.length) return;
    if (valid.length === 1) {
      map.setView([valid[0]!.latitude, valid[0]!.longitude], 14);
    } else {
      map.fitBounds(L.latLngBounds(valid.map(p => [p.latitude, p.longitude])), { padding: [50, 50] });
    }
    fittedForKey.current = key;
  }, [map, points, resetKey]);
  return null;
}

function PopupRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: string }) {
  return (
    <tr>
      <td style={{ color: '#888', paddingRight: 10, paddingBottom: 4, whiteSpace: 'nowrap', fontSize: 11, verticalAlign: 'top' }}>{label}</td>
      <td style={{ fontWeight: 500, paddingBottom: 4, fontSize: 12, color: highlight ?? 'inherit' }}>{value}</td>
    </tr>
  );
}

function LiveMarker({ pt, deviceMap, vehicleDetails }: {
  pt: LivePoint;
  deviceMap: Map<string, { plate: string | null; vehicleId: string | null }>;
  vehicleDetails: Map<string, VehicleDetail>;
}) {
  const [address, setAddress] = useState('Fetching…');

  const dv = deviceMap.get(pt.imei);
  const vc = dv?.vehicleId ? vehicleDetails.get(dv.vehicleId) : undefined;
  const plate = dv?.plate || pt.imei;
  const offline = isOffline(pt);
  const status = vehicleStatus(pt);
  const statusColor = STATUS_COLOR[status];
  const gpsPercent = Math.min(100, Math.round((pt.satellites / 12) * 100));

  const onVal = (v: boolean | null | undefined) => v == null ? '—' : v ? 'On' : 'Off';
  const voltLabel = pt.voltageLevel != null ? (VOLT_LABELS[pt.voltageLevel] ?? `${pt.voltageLevel}`) : '—';
  const gsmLabel = pt.gsmSignal != null ? `${pt.gsmSignal}/4` : '—';

  return (
    <Marker
      position={[pt.latitude, pt.longitude]}
      icon={makeCarIcon(pt.heading, offline, plate, pt.speedKmh)}
      eventHandlers={{
        popupopen: () => {
          reverseGeocode(pt.latitude, pt.longitude)
            .then(a => setAddress(a))
            .catch(() => setAddress(`${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`));
        },
      }}
    >
      <Popup minWidth={280} maxWidth={340}>
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{plate}</div>
              {vc && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                {[vc.make, vc.model, vc.year ? String(vc.year) : null].filter(Boolean).join(' ') || '—'}
              </div>}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: statusColor }}>{STATUS_LABEL[status]}</span>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {/* Section: Location */}
              <tr><td colSpan={2} style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, paddingTop: 2 }}>Location</td></tr>
              <PopupRow label="Address" value={<span style={{ fontSize: 11, color: '#444', wordBreak: 'break-word' }}>{address}</span>} />
              <PopupRow label="Coordinates" value={`${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`} />
              <PopupRow label="Altitude" value={pt.altitude != null ? `${pt.altitude.toFixed(1)} m` : '—'} />

              {/* Section: Status */}
              <tr><td colSpan={2} style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, paddingTop: 8 }}>Status</td></tr>
              <PopupRow label="Time" value={formatTs(pt.timestamp)} />
              <PopupRow label="Last Seen" value={formatAge(pt.timestamp)} />
              <PopupRow label="Speed" value={`${Math.round(pt.speedKmh)} km/h`} />
              <PopupRow label="Angle" value={`${pt.heading}°`} />
              <PopupRow label="Stop Duration" value="—" />

              {/* Section: Device */}
              <tr><td colSpan={2} style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, paddingTop: 8 }}>Device</td></tr>
              <PopupRow label="Ignition" value={onVal(pt.ignition)} highlight={pt.ignition === true ? '#16a34a' : pt.ignition === false ? '#dc2626' : undefined} />
              <PopupRow label="Immobilizer" value={onVal(pt.immobilizer)} highlight={pt.immobilizer === true ? '#dc2626' : undefined} />
              <PopupRow label="Ext. Power" value={onVal(pt.externalPower)} highlight={pt.externalPower === true ? '#16a34a' : undefined} />
              <PopupRow label="Ext. Volts" value="—" />
              <PopupRow label="Int. Battery" value={voltLabel} />
              <PopupRow label="Engine Hours" value="—" />
              <PopupRow label="Odometer" value="—" />

              {/* Section: Signal */}
              <tr><td colSpan={2} style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4, paddingTop: 8 }}>Signal</td></tr>
              <PopupRow label="GPS" value={`${gpsPercent}%`} />
              <PopupRow label="Satellites" value={pt.satellites} />
              <PopupRow label="GSM" value={gsmLabel} />
              <PopupRow label="IMEI" value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{pt.imei}</span>} />
            </tbody>
          </table>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapPage() {
  const { dark } = useTheme();
  const { selectedCityId } = useCityFilter();
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceMap, setDeviceMap] = useState<Map<string, { plate: string | null; vehicleId: string | null; cityId: string | null }>>(new Map());
  const [vehicleDetails, setVehicleDetails] = useState<Map<string, VehicleDetail>>(new Map());

  const load = async () => {
    try {
      const { data } = await api.get<LivePoint[]>('/telemetry/live');
      setPoints(data.filter(p => p.gpsValid));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<DeviceInfo[]>('/devices'),
      api.get<VehicleDetail[]>('/vehicles'),
    ]).then(([dr, vr]) => {
      const dm = new Map<string, { plate: string | null; vehicleId: string | null; cityId: string | null }>();
      dr.data.forEach(d => dm.set(d.imei, { plate: d.vehicle?.licensePlate ?? null, vehicleId: d.vehicle?.id ?? null, cityId: d.cityId }));
      setDeviceMap(dm);

      const vm = new Map<string, VehicleDetail>();
      vr.data.forEach(v => vm.set(v.id, v));
      setVehicleDetails(vm);
    }).catch(() => {});
  }, []);

  const visiblePoints = selectedCityId
    ? points.filter(p => deviceMap.get(p.imei)?.cityId === selectedCityId)
    : points;

  const counts = { moving: 0, idle: 0, offline: 0 };
  visiblePoints.forEach(p => counts[vehicleStatus(p)]++);

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttr = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Live Map" count={visiblePoints.length} />

      <div style={{ display: 'flex', gap: 10, padding: '0 0 16px', flexWrap: 'wrap' }}>
        {(['moving', 'idle', 'offline'] as const).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${STATUS_COLOR[s]}18`, fontSize: 12.5, fontWeight: 500, color: STATUS_COLOR[s] }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }} />
            {STATUS_LABEL[s]}: {counts[s]}
          </div>
        ))}
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, height: 'calc(100vh - 220px)', minHeight: 400, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#aaa', fontSize: 13, background: dark ? '#1a1a1a' : '#f8f9fa', borderRadius: 12 }}>
            Loading map…
          </div>
        )}
        <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl>
          <TileLayer url={tileUrl} attribution={tileAttr} />
          <InvalidateSize />
          <FitBounds points={visiblePoints} resetKey={selectedCityId || '__all__'} />
          {visiblePoints.map(pt => (
            <LiveMarker key={pt.imei} pt={pt} deviceMap={deviceMap} vehicleDetails={vehicleDetails} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
