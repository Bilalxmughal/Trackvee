import { useEffect, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { orgsApi, Organization } from '../api/organizations';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    orgsApi.list().then((r) => setOrgs(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle={`${orgs.length} total`}
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <IconPlus size={16} strokeWidth={2} />
            Add Organization
          </button>
        }
      />

      <div className="p-8">
        <div className="relative mb-5 max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations…"
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Slug</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400">No organizations found</td>
                  </tr>
                )}
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-l-4 hover:bg-slate-50 transition-colors ${
                      o.isActive ? 'border-l-green-500' : 'border-l-slate-300'
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">#{o.displayId}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{o.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{o.slug}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(o.createdAt).toLocaleDateString()}
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
