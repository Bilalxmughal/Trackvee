import { useEffect, useState, useRef } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';

interface Telemetry {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  satellites: number | null;
  ignition: boolean | null;
  timestamp: string;
}

export default function TelemetryPage() {
  const [rows, setRows] = useState<Telemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    api.get<Telemetry[] | { data: Telemetry[] }>('/telemetry?limit=100')
      .then(r => setRows(Array.isArray(r.data) ? r.data : (r.data as { data: Telemetry[] })?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (auto) {
      timerRef.current = setInterval(load, 5000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto]);

  return (
    <div>
      <PageHeader
        title="Telemetry"
        count={rows.length}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={auto}
                onChange={e => setAuto(e.target.checked)}
                style={{ accentColor: '#dc2626' }}
              />
              Auto-refresh 5s
            </label>
            <button
              onClick={load}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', background: '#fff', color: '#555',
                border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, cursor: 'pointer',
              }}
            >
              <IconRefresh size={13} />
              Refresh
            </button>
          </div>
        }
      />

      {loading ? <Spinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['Time', 'Device', 'Lat / Lng', 'Speed', 'Hdg', 'Alt', 'Sats', 'IGN'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${t.ignition ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '9px 16px', color: '#aaa', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {new Date(t.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 10, color: '#999' }}>
                  {t.deviceId.slice(0, 8)}…
                </td>
                <td style={{ padding: '9px 16px', fontVariantNumeric: 'tabular-nums' }}>
                  {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                </td>
                <td style={{ padding: '9px 16px', fontVariantNumeric: 'tabular-nums' }}>
                  {t.speed != null ? `${t.speed} km/h` : '—'}
                </td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.heading != null ? `${t.heading}°` : '—'}</td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.altitude != null ? `${t.altitude}m` : '—'}</td>
                <td style={{ padding: '9px 16px', color: '#aaa' }}>{t.satellites ?? '—'}</td>
                <td style={{ padding: '9px 16px', color: t.ignition ? '#16a34a' : '#ccc' }}>
                  {t.ignition ? 'On' : 'Off'}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: '#ccc', fontSize: 12 }}>
                  No telemetry data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
