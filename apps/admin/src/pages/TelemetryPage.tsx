import { useEffect, useState } from 'react';
import { IconRefresh, IconMapPin } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { devicesApi, Device } from '../api/devices';
import { api } from '../api/client';

interface TelemetryPoint {
  id: string;
  imei: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  satellites: number;
  gpsValid: boolean;
}

export default function TelemetryPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [point, setPoint] = useState<TelemetryPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDevices, setFetchingDevices] = useState(true);

  useEffect(() => {
    devicesApi.list().then((r) => {
      setDevices(r.data);
      if (r.data.length > 0) setSelected(r.data[0]!.imei);
    }).finally(() => setFetchingDevices(false));
  }, []);

  const fetchLatest = () => {
    if (!selected) return;
    setLoading(true);
    api.get<TelemetryPoint>(`/telemetry/${selected}/latest`)
      .then((r) => setPoint(r.data))
      .catch(() => setPoint(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected) fetchLatest();
  }, [selected]);

  return (
    <div>
      <PageHeader
        title="Telemetry"
        subtitle="Live device location data"
        action={
          <button
            onClick={fetchLatest}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400
                       text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <IconRefresh size={16} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="p-8">
        {/* Device selector */}
        {fetchingDevices ? (
          <Spinner className="h-20" />
        ) : (
          <div className="mb-6 max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Device</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.imei}>
                  {d.imei} {d.name ? `— ${d.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Latest point */}
        {loading ? (
          <Spinner className="h-40" />
        ) : point ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <IconMapPin size={18} className="text-green-600" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Latest GPS Fix</p>
                <p className="text-xs text-slate-400">{new Date(point.timestamp).toLocaleString()}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">Latitude</dt>
                <dd className="font-mono text-slate-800">{point.latitude.toFixed(6)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">Longitude</dt>
                <dd className="font-mono text-slate-800">{point.longitude.toFixed(6)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">Speed</dt>
                <dd className="text-slate-800">{point.speedKmh} km/h</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">Heading</dt>
                <dd className="text-slate-800">{point.heading}°</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">Satellites</dt>
                <dd className="text-slate-800">{point.satellites}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-0.5">GPS Valid</dt>
                <dd className={point.gpsValid ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {point.gpsValid ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <a
                href={`https://maps.google.com/?q=${point.latitude},${point.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                View on Google Maps →
              </a>
            </div>
          </div>
        ) : selected ? (
          <div className="text-slate-400 text-sm">No telemetry data found for this device</div>
        ) : null}
      </div>
    </div>
  );
}
