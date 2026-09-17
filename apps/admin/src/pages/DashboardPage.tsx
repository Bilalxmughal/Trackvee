import { useEffect, useState } from 'react';
import { IconUsers, IconCar, IconCpu, IconMap } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { usersApi } from '../api/users';
import { vehiclesApi } from '../api/vehicles';
import { devicesApi } from '../api/devices';
import { orgsApi } from '../api/organizations';

interface Stats {
  users: number;
  organizations: number;
  vehicles: number;
  devices: number;
  activeDevices: number;
}

const CARDS = [
  { key: 'users' as const, label: 'Total Users', icon: IconUsers, color: 'bg-blue-50 text-blue-600' },
  { key: 'organizations' as const, label: 'Organizations', icon: IconMap, color: 'bg-purple-50 text-purple-600' },
  { key: 'vehicles' as const, label: 'Vehicles', icon: IconCar, color: 'bg-green-50 text-green-600' },
  { key: 'devices' as const, label: 'Devices', icon: IconCpu, color: 'bg-orange-50 text-orange-600' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersApi.list(),
      orgsApi.list(),
      vehiclesApi.list(),
      devicesApi.list(),
    ]).then(([u, o, v, d]) => {
      setStats({
        users: u.data.length,
        organizations: o.data.length,
        vehicles: v.data.length,
        devices: d.data.length,
        activeDevices: d.data.filter((dev) => dev.status === 'active').length,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />

      <div className="p-8">
        {loading ? (
          <Spinner className="h-40" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {CARDS.map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-slate-500">{label}</span>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {stats?.[key] ?? 0}
                  </p>
                  {key === 'devices' && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      {stats?.activeDevices ?? 0} active
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">System Status</h2>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-slate-600">Gateway online — port 5023</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-slate-600">API online — port 3000</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
