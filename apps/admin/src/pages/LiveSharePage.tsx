import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

interface LivePoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading?: number | null;
  timestamp?: string | null;
  ignition?: boolean | null;
}
interface LiveShareData {
  vehicle: { id: string; licensePlate: string | null; name: string; make: string | null; model: string | null } | null;
  point: LivePoint | null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom(), { animate: true }); }, [map, lat, lng]);
  return null;
}

const carSvg = (heading: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <g transform="rotate(${heading}, 16, 16)">
    <ellipse cx="16" cy="16" rx="11" ry="14" fill="#dc2626" stroke="white" stroke-width="2"/>
    <rect x="10" y="7" width="12" height="8" rx="2" fill="rgba(255,255,255,0.25)"/>
    <rect x="10" y="21" width="12" height="5" rx="1" fill="rgba(0,0,0,0.15)"/>
    <circle cx="10" cy="9" r="2.5" fill="rgba(255,255,255,0.9)"/>
    <circle cx="22" cy="9" r="2.5" fill="rgba(255,255,255,0.9)"/>
  </g>
</svg>`;

function makeMarkerIcon(heading: number) {
  return L.divIcon({
    html: carSvg((heading + 180) % 360),
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 20],
  });
}

export default function LiveSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<LiveShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const t = token ?? '';
      const endpoint = t.includes('.')
        ? `${API_URL}/telemetry/live-public/${encodeURIComponent(t)}`
        : `${API_URL}/share-links/public/${encodeURIComponent(t)}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as LiveShareData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const vehicleLabel = data?.vehicle?.licensePlate ?? data?.vehicle?.name ?? 'Vehicle';
  const point = data?.point;
  const lat = point?.latitude ?? 24.8607;
  const lng = point?.longitude ?? 67.0011;
  const hasGps = !!(point?.latitude && point?.longitude);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#6b7280', margin: 0 }}>Loading live location…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <h2 style={{ color: '#111827', margin: '0 0 8px' }}>Link unavailable</h2>
        <p style={{ color: '#6b7280', margin: 0 }}>{error.includes('expired') ? 'This share link has expired.' : 'This share link is no longer valid.'}</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{vehicleLabel}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {data?.vehicle?.make && data?.vehicle?.model ? `${data.vehicle.make} ${data.vehicle.model} · ` : ''}
            {hasGps ? `${Math.round(point!.speedKmh)} km/h · ${(point && (point.speedKmh >= 5 ? true : point.ignition)) ? 'Ignition ON' : 'Ignition OFF'}` : 'GPS unavailable'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasGps ? '#16a34a' : '#9ca3af', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {point?.timestamp ? `Updated ${new Date(point.timestamp).toLocaleTimeString()}` : 'No data'}
          </span>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {!hasGps && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.85)' }}>
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: '#6b7280', margin: 0 }}>No GPS fix available for this vehicle.</p>
            </div>
          </div>
        )}
        <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          {hasGps && (
            <>
              <FlyTo lat={lat} lng={lng} />
              <Marker position={[lat, lng]} icon={makeMarkerIcon(point?.heading ?? 0)}>
                <Popup>
                  <strong>{vehicleLabel}</strong><br />
                  {Math.round(point!.speedKmh)} km/h · {(point && (point.speedKmh >= 5 ? true : point.ignition)) ? 'Ignition ON' : 'Ignition OFF'}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
      <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '6px 16px', fontSize: 11, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
        Powered by <strong style={{ color: '#dc2626' }}>Trackvee</strong> · Updates every 10 seconds
      </div>
    </div>
  );
}
