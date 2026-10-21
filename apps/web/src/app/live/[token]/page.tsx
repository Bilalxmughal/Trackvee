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
interface ScheduleSlot { start: string; end: string; }
interface LiveShareData {
  status?: 'ok' | 'expired' | 'inactive' | 'not_found';
  vehicle: { id: string; licensePlate: string | null; name: string; make: string | null; model: string | null } | null;
  point: LivePoint | null;
  schedules?: ScheduleSlot[] | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}
interface AnimState {
  dispLat: number; dispLng: number;
  animFromLat: number; animFromLng: number;
  animToLat: number; animToLng: number;
  animStart: number; animDur: number;
  emaLat: number; emaLng: number;
  speedKmh: number; heading: number;
  timestamp: string | null;
}

const POLL_MS = 10_000;
const EMA_ALPHA = 0.75;

function predictDR(lat: number, lng: number, speedKmh: number, headingDeg: number, elapsedMs: number): [number, number] {
  if (speedKmh < 3) return [lat, lng];
  const distM = (speedKmh / 3.6) * (elapsedMs / 1000);
  const headRad = (headingDeg * Math.PI) / 180;
  const R = 6371000;
  const dLat = (distM * Math.cos(headRad)) / R * (180 / Math.PI);
  const cosLat = Math.cos(lat * Math.PI / 180);
  const dLng = cosLat > 0.001 ? (distM * Math.sin(headRad)) / (R * cosLat) * (180 / Math.PI) : 0;
  return [lat + dLat, lng + dLng];
}

function isInSlot(start: string, end: string, pktMin: number): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);
  if (startMin <= endMin) return pktMin >= startMin && pktMin <= endMin;
  return pktMin >= startMin || pktMin <= endMin;
}

function isWithinAnySchedule(slots: ScheduleSlot[]): boolean {
  if (!slots.length) return true;
  const now = new Date();
  const pktMin = (now.getUTCHours() * 60 + now.getUTCMinutes() + 300) % 1440;
  return slots.some(s => isInSlot(s.start, s.end, pktMin));
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
  const animRef = useRef<AnimState | null>(null);
  const rafRef = useRef<number>(0);
  const latestPtRef = useRef<{ lat: number; lng: number } | null>(null);

  const fetchData = async () => {
    try {
      const trackParam = isFirstFetch.current ? '?track=1' : '';
      isFirstFetch.current = false;
      const res = await fetch(`/api/v1/share-links/public/${encodeURIComponent(token)}${trackParam}`);
      const json = await res.json() as LiveShareData;
      if (!res.ok) throw new Error((json as { message?: string }).message ?? `HTTP ${res.status}`);
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
    intervalRef.current = setInterval(() => void fetchData(), POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // When map becomes visible after loading, invalidateSize + pan to vehicle
  useEffect(() => {
    if (!loading && !error && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        if (latestPtRef.current) {
          mapRef.current?.setView([latestPtRef.current.lat, latestPtRef.current.lng], 16);
        }
      }, 50);
    }
  }, [loading, error]);

  // Init Leaflet map once container is ready (client-only)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

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
      cancelAnimationFrame(rafRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; animRef.current = null; }
    };
  }, []);

  // rAF animation loop — smooth interpolation + dead reckoning
  useEffect(() => {
    let lastFrame = 0;
    function rafLoop(now: number) {
      rafRef.current = requestAnimationFrame(rafLoop);
      if (now - lastFrame < 33) return;
      const dt = lastFrame ? now - lastFrame : 33;
      lastFrame = now;

      const s = animRef.current;
      const map = mapRef.current;
      const marker = markerRef.current;
      if (!s || !map || !marker) return;

      const elapsed = now - s.animStart;
      let lat: number, lng: number;

      if (elapsed < s.animDur) {
        const t = elapsed / s.animDur;
        const ease = 1 - Math.pow(1 - t, 3);
        lat = s.animFromLat + (s.animToLat - s.animFromLat) * ease;
        lng = s.animFromLng + (s.animToLng - s.animFromLng) * ease;
      } else if (s.speedKmh >= 3) {
        [lat, lng] = predictDR(s.animToLat, s.animToLng, s.speedKmh, s.heading, now - s.animStart - s.animDur + dt);
      } else {
        lat = s.animToLat; lng = s.animToLng;
      }

      s.dispLat = lat; s.dispLng = lng;
      marker.setLatLng([lat, lng]);
    }
    rafRef.current = requestAnimationFrame(rafLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Update animation state when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data?.point?.latitude) return;
    const pt = data.point;
    const label = data.vehicle?.licensePlate ?? data.vehicle?.name ?? 'Vehicle';
    const rot = ((pt.heading ?? 0) + 180) % 360;
    const speedTxt = `${Math.round(pt.speedKmh)} km/h`;

    latestPtRef.current = { lat: pt.latitude, lng: pt.longitude };

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

      const isStationary = pt.speedKmh < 3;
      const existing = animRef.current;

      if (existing) {
        const posChanged = existing.timestamp !== (pt.timestamp ?? null);
        const emaLat = isStationary ? pt.latitude : EMA_ALPHA * pt.latitude + (1 - EMA_ALPHA) * existing.emaLat;
        const emaLng = isStationary ? pt.longitude : EMA_ALPHA * pt.longitude + (1 - EMA_ALPHA) * existing.emaLng;

        animRef.current = posChanged ? {
          ...existing,
          emaLat, emaLng,
          animFromLat: existing.dispLat, animFromLng: existing.dispLng,
          animToLat: emaLat, animToLng: emaLng,
          animStart: performance.now(), animDur: isStationary ? 0 : POLL_MS * 0.85,
          speedKmh: pt.speedKmh, heading: pt.heading ?? 0,
          timestamp: pt.timestamp ?? null,
        } : { ...existing, emaLat, emaLng, speedKmh: pt.speedKmh, heading: pt.heading ?? 0 };

        markerRef.current?.setIcon(icon);
        if (posChanged && !isStationary) {
          map.panTo([emaLat, emaLng], { animate: true, duration: 0.35 });
        }
      } else {
        if (!markerRef.current) {
          markerRef.current = L.marker([pt.latitude, pt.longitude], { icon }).addTo(map);
        } else {
          markerRef.current.setIcon(icon);
        }
        animRef.current = {
          dispLat: pt.latitude, dispLng: pt.longitude,
          emaLat: pt.latitude, emaLng: pt.longitude,
          animFromLat: pt.latitude, animFromLng: pt.longitude,
          animToLat: pt.latitude, animToLng: pt.longitude,
          animStart: 0, animDur: 1,
          speedKmh: pt.speedKmh, heading: pt.heading ?? 0,
          timestamp: pt.timestamp ?? null,
        };
        // Center on first fix — after invalidateSize if still loading, else immediately
        if (!loading) {
          map.setView([pt.latitude, pt.longitude], 16, { animate: true });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const vehicleLabel = data?.vehicle?.licensePlate ?? data?.vehicle?.name ?? 'Vehicle';
  const point = data?.point;
  const hasGps = !!(point?.latitude && point?.longitude);
  const ignition = point ? (point.speedKmh >= 5 ? true : point.ignition) : null;
  // Prefer new schedules array; fall back to legacy single slot
  const scheduleSlots: ScheduleSlot[] = data?.schedules?.length
    ? data.schedules
    : (data?.scheduleStart && data?.scheduleEnd ? [{ start: data.scheduleStart, end: data.scheduleEnd }] : []);
  const hasSchedule = scheduleSlots.length > 0;
  const inSchedule = isWithinAnySchedule(scheduleSlots);
  const scheduleStart = scheduleSlots[0]?.start ?? null;
  const scheduleEnd = scheduleSlots[0]?.end ?? null;
  const vehicleStatus = !hasGps ? null : point!.speedKmh >= 5 ? 'Moving' : point!.ignition ? 'Idle' : 'Parked';
  const statusColor = vehicleStatus === 'Moving' ? '#16a34a' : vehicleStatus === 'Idle' ? '#d97706' : '#6b7280';
  const updatedTime = point?.timestamp ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const linkStatus = data?.status;
  const showLoading = loading;
  const showUnavailable = !loading && (!error ? (linkStatus === 'expired' || linkStatus === 'inactive' || linkStatus === 'not_found') : true);
  const showScheduled = !loading && !showUnavailable && hasSchedule && !inSchedule;
  const showMap = !loading && !showUnavailable && inSchedule;

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

      {/* Map container — visible for showMap and showScheduled (faded overlay on scheduled) */}
      <div style={{ flex: 1, position: 'relative', display: (showMap || showScheduled) ? undefined : 'none' }}>
        {showMap && !hasGps && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.85)', pointerEvents: 'none' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No GPS fix available for this vehicle.</p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

        {/* Scheduled overlay — faded map background */}
        {showScheduled && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <img src="/logo.webp" alt="Trackvee" style={{ height: 36, width: 'auto', objectFit: 'contain', marginBottom: 20 }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{vehicleLabel}</div>
            {data?.vehicle?.make && data?.vehicle?.model && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>{data.vehicle.make} {data.vehicle.model}</div>
            )}
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Live tracking is not active right now.</div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Active hours</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {scheduleSlots.map((s, i) => (
                  <div key={i} style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{fmt12(s.start)} – {fmt12(s.end)}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom info card — full width on mobile */}
        {showMap && hasGps && (
          <div style={{
            position: 'absolute', bottom: 16, left: 12, right: 12,
            zIndex: 1000, background: '#fff', borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ textAlign: 'center', minWidth: 52, flexShrink: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{Math.round(point!.speedKmh)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>km/h</div>
            </div>

            <div style={{ width: 1, alignSelf: 'stretch', background: '#f3f4f6', flexShrink: 0 }} />

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
                <div style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                  <div style={{ marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Active</div>
                  {scheduleSlots.map((s, i) => (
                    <div key={i} style={{ fontWeight: 600, color: '#6b7280', lineHeight: 1.5 }}>{fmt12(s.start)}–{fmt12(s.end)}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#6b7280', margin: 0 }}>Loading live location…</p>
          </div>
        </div>
      )}

      {showUnavailable && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 32, textAlign: 'center' }}>
          {/* Car icon */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
            </svg>
          </div>

          {vehicleLabel !== 'Vehicle' && (
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{vehicleLabel}</div>
          )}
          {data?.vehicle?.make && data?.vehicle?.model && (
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{data.vehicle.make} {data.vehicle.model}</div>
          )}

          <div style={{ fontSize: 14, color: linkStatus === 'expired' ? '#f59e0b' : '#6b7280', fontWeight: 600, marginBottom: 4 }}>
            {linkStatus === 'expired' ? 'This share link has expired.' : linkStatus === 'not_found' ? 'Share link not found.' : 'This share link is no longer active.'}
          </div>

          {scheduleSlots.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', display: 'inline-block' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Was active</div>
              {scheduleSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmt12(s.start)} – {fmt12(s.end)} PKT</div>
              ))}
            </div>
          )}

          <p style={{ color: '#9ca3af', margin: '20px 0 0', fontSize: 11 }}>Powered by <strong style={{ color: '#dc2626' }}>Trackvee</strong></p>
        </div>
      )}

    </div>
  );
}
