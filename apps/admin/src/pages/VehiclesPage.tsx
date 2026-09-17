import { useEffect, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { vehiclesApi, Vehicle } from '../api/vehicles';

const TYPE_LABEL: Record<string, string> = {
  car: 'Car', motorcycle: 'Motorcycle', truck: 'Truck',
  van: 'Van', bus: 'Bus', other: 'Other',
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    vehiclesApi.list().then((r) => setVehicles(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = vehicles.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.licensePlate ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${vehicles.length} total`}
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <IconPlus size={16} strokeWidth={2} />
            Add Vehicle
          </button>
        }
      />

      <div className="p-8">
        <div className="relative mb-5 max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicles…"
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plate</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">No vehicles found</td>
                  </tr>
                )}
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-l-4 hover:bg-slate-50 transition-colors ${
                      v.isActive ? 'border-l-green-500' : 'border-l-slate-300'
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">#{v.displayId}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{v.name}</p>
                      {(v.make || v.model) && (
                        <p className="text-slate-400 text-xs">
                          {[v.make, v.model].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 text-xs">
                      {v.licensePlate ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{TYPE_LABEL[v.type] ?? v.type}</td>
                    <td className="px-6 py-4 text-slate-500">{v.year ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
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
