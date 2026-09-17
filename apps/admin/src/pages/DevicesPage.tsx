import { useEffect, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { devicesApi, Device } from '../api/devices';

const STATUS_BORDER: Record<string, string> = {
  active: 'border-l-green-500',
  inactive: 'border-l-slate-300',
  offline: 'border-l-red-500',
  unassigned: 'border-l-yellow-400',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  inactive: 'bg-slate-300',
  offline: 'bg-red-500',
  unassigned: 'bg-yellow-400',
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    devicesApi.list().then((r) => setDevices(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = devices.filter(
    (d) =>
      d.imei.includes(search) ||
      (d.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.simNumber ?? '').includes(search),
  );

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString() : '—';

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle={`${devices.length} total`}
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <IconPlus size={16} strokeWidth={2} />
            Add Device
          </button>
        }
      />

      <div className="p-8">
        <div className="relative mb-5 max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by IMEI, name, SIM…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <Spinner className="h-40" />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IMEI / Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SIM</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">No devices found</td>
                  </tr>
                )}
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-l-4 hover:bg-slate-50 transition-colors ${STATUS_BORDER[d.status] ?? 'border-l-slate-300'}`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">#{d.displayId}</td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-slate-800 text-xs">{d.imei}</p>
                      {d.name && <p className="text-slate-500 text-xs mt-0.5">{d.name}</p>}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{d.simNumber ?? '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[d.status]}`} />
                        <span className="text-slate-700 capitalize">{d.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{formatDate(d.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
