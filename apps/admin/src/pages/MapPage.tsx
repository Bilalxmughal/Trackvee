import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';

interface LivePoint {
  id: string;
  imei: string;
  deviceId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  satellites: number;
  gpsValid: boolean;
  timestamp: string;
}

function vehicleStatus(pt: LivePoint): 'moving' | 'idle' | 'offline' {
  const ageMs = Date.now() - new Date(pt.timestamp).getTime();
  if (ageMs > 10 * 60 * 1000) return 'offline';
  return pt.speedKmh > 0 ? 'moving' : 'idle';
}

const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', offline: '#9ca3af' } as const;
const STATUS_LABEL = { moving: 'Moving', idle: 'Stopped', offline: 'Offline' } as const;

function makeIcon(heading: number, status: 'moving' | 'idle' | 'offline'): L.DivIcon {
  const color = STATUS_COLOR[status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <g transform="rotate(${heading},18,18)">
      <circle cx="18" cy="18" r="13" fill="${color}" fill-opacity="0.18"/>
      <circle cx="18" cy="18" r="8" fill="${color}"/>
      ${status !== 'offline' ? `<polygon points="18,4 21,13 15,13" fill="${color}" opacity="0.85"/>` : ''}
    </g>
    <circle cx="18" cy="18" r="4" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
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

function FitBounds({ points }: { points: LivePoint[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    const valid = points.filter(p => p.gpsValid);
    if (!valid.length) return;
    if (valid.length === 1) {
      map.setView([valid[0]!.latitude, valid[0]!.longitude], 14);
    } else {
      const bounds = L.latLngBounds(valid.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    fitted.current = true;
  }, [map, points]);
  return null;
}

function formatAge(ts: string): string {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function MapPage() {
  const { dark } = useTheme();
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    try {
      const { data } = await api.get<LivePoint[]>('/telemetry/live');
      setPoints(data.filter(p => p.gpsValid));
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const counts = { moving: 0, idle: 0, offline: 0 };
  points.forEach(p => counts[vehicleStatus(p)]++);

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttr = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Live Map"
        count={points.length}
      />

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 10, padding: '0 0 16px', flexWrap: 'wrap' }}>
        {(['moving', 'idle', 'offline'] as const).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${STATUS_COLOR[s]}18`, fontSize: 12.5, fontWeight: 500, color: STATUS_COLOR[s] }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }} />
            {STATUS_LABEL[s]}: {counts[s]}
          </div>
        ))}
      </div>

      {/* Map — always mounted so Leaflet never re-initializes */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, height: 'calc(100vh - 220px)', minHeight: 400, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#aaa', fontSize: 13, background: dark ? '#1a1a1a' : '#f8f9fa', borderRadius: 12 }}>
            Loading map…
          </div>
        )}
        <MapContainer
          center={[30.3753, 69.3451]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer url={tileUrl} attribution={tileAttr} />
          <InvalidateSize />
          <FitBounds points={points} />
          {points.map(pt => {
            const status = vehicleStatus(pt);
            return (
              <Marker
                key={pt.imei}
                position={[pt.latitude, pt.longitude]}
                icon={makeIcon(pt.heading, status)}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', flexShrink: 0 }} />
                      <strong style={{ fontSize: 13 }}>{STATUS_LABEL[status]}</strong>
                    </div>
                    <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {[
                          ['IMEI', pt.imei],
                          ['Speed', `${pt.speedKmh} km/h`],
                          ['Heading', `${pt.heading}°`],
                          ['Satellites', pt.satellites],
                          ['Location', `${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`],
                          ['Last seen', formatAge(pt.timestamp)],
                        ].map(([k, v]) => (
                          <tr key={k as string}>
                            <td style={{ color: '#888', paddingRight: 10, paddingBottom: 3, whiteSpace: 'nowrap' }}>{k}</td>
                            <td style={{ fontWeight: 500, paddingBottom: 3 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
