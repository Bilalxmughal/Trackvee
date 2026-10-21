import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
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
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom(), { animate: true }); }, [map, lat, lng]);
  return null;
}

function makeMarkerIcon(heading: number, label: string, speedKmh: number) {
  const rot = (heading + 180) % 360;
  const speedTxt = `${Math.round(speedKmh)} km/h`;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;transform:translateX(-50%)">
    <img src="/car-icon.png" style="width:36px;height:36px;transform:rotate(${rot}deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.45))"/>
    <div style="margin-top:3px;background:rgba(10,10,10,0.82);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;white-space:nowrap;pointer-events:none">${label} · ${speedTxt}</div>
  </div>`;
  return L.divIcon({ html, className: 'leaflet-interactive', iconSize: [0, 0], iconAnchor: [0, 44] });
}

function isWithinSchedule(start: string, end: string): boolean {
  const now = new Date();
  const pktMin = (now.getUTCHours() * 60 + now.getUTCMinutes() + 300) % 1440;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);
  if (startMin <= endMin) return pktMin >= startMin && pktMin <= endMin;
  return pktMin >= startMin || pktMin <= endMin;
}

function fmt12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function LiveSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<LiveShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstFetch = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const t = token ?? '';
      const trackParam = isFirstFetch.current ? '?track=1' : '';
      const endpoint = t.includes('.')
        ? `${API_URL}/telemetry/live-public/${encodeURIComponent(t)}`
        : `${API_URL}/share-links/public/${encodeURIComponent(t)}${trackParam}`;
      isFirstFetch.current = false;
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
  const ignition = point ? (point.speedKmh >= 5 ? true : point.ignition) : null;

  const scheduleStart = data?.scheduleStart;
  const scheduleEnd = data?.scheduleEnd;
  const hasSchedule = !!(scheduleStart && scheduleEnd);
  const inSchedule = hasSchedule ? isWithinSchedule(scheduleStart!, scheduleEnd!) : true;

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

  if (hasSchedule && !inSchedule) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🕐</div>
      <h2 style={{ color: '#111827', margin: '0 0 8px', fontSize: 20 }}>{vehicleLabel}</h2>
      <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 15 }}>Live tracking is not active right now.</p>
      <p style={{ color: '#374151', fontWeight: 600, margin: 0, fontSize: 14 }}>
        Tracking active {fmt12(scheduleStart!)} – {fmt12(scheduleEnd!)} PKT
      </p>
      <p style={{ color: '#9ca3af', margin: '12px 0 0', fontSize: 11 }}>Powered by <strong style={{ color: '#dc2626' }}>Trackvee</strong></p>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{vehicleLabel}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {data?.vehicle?.make && data?.vehicle?.model ? `${data.vehicle.make} ${data.vehicle.model} · ` : ''}
            {hasGps ? `${Math.round(point!.speedKmh)} km/h · ${ignition ? 'Ignition ON' : 'Ignition OFF'}` : 'GPS unavailable'}
            {hasSchedule && <span style={{ marginLeft: 8, color: '#9ca3af' }}>· Active {fmt12(scheduleStart!)}–{fmt12(scheduleEnd!)}</span>}
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
              <Marker position={[lat, lng]} icon={makeMarkerIcon(point?.heading ?? 0, vehicleLabel, point?.speedKmh ?? 0)} />
            </>
          )}
        </MapContainer>
      </div>
      <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '6px 16px', fontSize: 11, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
        Powered by <strong style={{ color: '#dc2626' }}>Trackvee</strong>
      </div>
    </div>
  );
}
