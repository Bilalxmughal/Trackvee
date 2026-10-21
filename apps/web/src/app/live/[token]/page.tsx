'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

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
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [data, setData] = useState<LiveShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstFetch = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const trackParam = isFirstFetch.current ? '?track=1' : '';
      isFirstFetch.current = false;
      const res = await fetch(`/api/v1/share-links/public/${encodeURIComponent(token)}${trackParam}`);
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
    if (!token) return;
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Init Leaflet map once container is ready (client-only)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Inject Leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([24.8607, 67.0011], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, []);

  // Update marker position when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data?.point?.latitude) return;
    const pt = data.point;
    const label = data.vehicle?.licensePlate ?? data.vehicle?.name ?? 'Vehicle';
    const rot = ((pt.heading ?? 0) + 180) % 360;
    const speedTxt = `${Math.round(pt.speedKmh)} km/h`;

    import('leaflet').then((L) => {
      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateX(-50%)">
          <img src="/car-icon.png" style="width:36px;height:36px;transform:rotate(${rot}deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.45))"/>
          <div style="margin-top:3px;background:rgba(10,10,10,0.82);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;white-space:nowrap;pointer-events:none">${label} · ${speedTxt}</div>
        </div>`,
        className: 'leaflet-interactive',
        iconSize: [0, 0] as [number, number],
        iconAnchor: [0, 44] as [number, number],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([pt.latitude, pt.longitude]);
        markerRef.current.setIcon(icon);
      } else {
        markerRef.current = L.marker([pt.latitude, pt.longitude], { icon }).addTo(map);
      }
      map.setView([pt.latitude, pt.longitude], map.getZoom(), { animate: true });
    });
  }, [data]);

  const vehicleLabel = data?.vehicle?.licensePlate ?? data?.vehicle?.name ?? 'Vehicle';
  const point = data?.point;
  const hasGps = !!(point?.latitude && point?.longitude);
  const ignition = point ? (point.speedKmh >= 5 ? true : point.ignition) : null;
  const scheduleStart = data?.scheduleStart;
  const scheduleEnd = data?.scheduleEnd;
  const hasSchedule = !!(scheduleStart && scheduleEnd);
  const inSchedule = hasSchedule ? isWithinSchedule(scheduleStart!, scheduleEnd!) : true;
  const vehicleStatus = !hasGps ? null : point!.speedKmh >= 5 ? 'Moving' : point!.ignition ? 'Idle' : 'Parked';
  const statusColor = vehicleStatus === 'Moving' ? '#16a34a' : vehicleStatus === 'Idle' ? '#d97706' : '#6b7280';
  const updatedTime = point?.timestamp ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  // Overlay state — keep map container always in DOM so Leaflet can init on mount
  const showLoading = loading;
  const showError = !loading && !!error;
  const showScheduled = !loading && !error && hasSchedule && !inSchedule;
  const showMap = !loading && !error && inSchedule;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.webp" alt="Trackvee" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.2 }}>
              {data?.vehicle?.licensePlate ?? data?.vehicle?.name ?? (loading ? '…' : 'Vehicle')}
            </div>
            {data?.vehicle?.make && data?.vehicle?.model && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{data.vehicle.make} {data.vehicle.model}</div>
            )}
          </div>
        </div>
        {showMap && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasGps ? '#16a34a' : '#9ca3af', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{hasGps ? 'Live' : 'No GPS'}</span>
          </div>
        )}
      </div>

      {/* Map container — always rendered so Leaflet ref is available on mount */}
      <div style={{ flex: 1, position: 'relative', display: showMap ? undefined : 'none' }}>
        {showMap && !hasGps && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.85)', pointerEvents: 'none' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No GPS fix available for this vehicle.</p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

        {/* Bottom info card — full width on mobile */}
        {showMap && hasGps && (
          <div style={{
            position: 'absolute', bottom: 16, left: 12, right: 12,
            zIndex: 1000, background: '#fff', borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            {/* Speed */}
            <div style={{ textAlign: 'center', minWidth: 52, flexShrink: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{Math.round(point!.speedKmh)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>km/h</div>
            </div>

            <div style={{ width: 1, alignSelf: 'stretch', background: '#f3f4f6', flexShrink: 0 }} />

            {/* Status + ignition */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{vehicleStatus}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: ignition ? '#16a34a' : '#e5e7eb',
                  border: '2px solid', borderColor: ignition ? '#16a34a' : '#d1d5db',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Ignition {ignition ? 'ON' : 'OFF'}</span>
              </div>
              {updatedTime && (
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 5 }}>Updated {updatedTime}</div>
              )}
            </div>

            {hasSchedule && (
              <>
                <div style={{ width: 1, alignSelf: 'stretch', background: '#f3f4f6', flexShrink: 0 }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                  <div style={{ marginBottom: 2 }}>Active</div>
                  <div style={{ fontWeight: 600, color: '#6b7280' }}>{fmt12(scheduleStart!)}–{fmt12(scheduleEnd!)}</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {showLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#6b7280', margin: 0 }}>Loading live location…</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {showError && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
            <h2 style={{ color: '#111827', margin: '0 0 8px' }}>Link unavailable</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>{error!.includes('expired') ? 'This share link has expired.' : 'This share link is no longer valid.'}</p>
          </div>
        </div>
      )}

      {/* Scheduled (outside window) */}
      {showScheduled && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🕐</div>
          <h2 style={{ color: '#111827', margin: '0 0 8px', fontSize: 20 }}>{vehicleLabel}</h2>
          <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 15 }}>Live tracking is not active right now.</p>
          <p style={{ color: '#374151', fontWeight: 600, margin: 0, fontSize: 14 }}>
            Tracking active {fmt12(scheduleStart!)} – {fmt12(scheduleEnd!)} PKT
          </p>
          <p style={{ color: '#9ca3af', margin: '12px 0 0', fontSize: 11 }}>Powered by <strong style={{ color: '#dc2626' }}>Trackvee</strong></p>
        </div>
      )}
    </div>
  );
}
