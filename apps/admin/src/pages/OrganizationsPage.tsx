import { useEffect, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';

interface Org {
  id: string;
  displayId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const inp: React.CSSProperties = {
  height: 30,
  padding: '0 10px 0 30px',
  border: '1px solid #e8e8e8',
  borderRadius: 3,
  fontSize: 12,
  color: '#111',
  outline: 'none',
  background: '#fff',
  width: 200,
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get<Org[]>('/organizations')
      .then(r => setOrgs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter(o =>
    !q || o.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Organizations"
        count={orgs.length}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search…"
                style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
              />
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              <IconPlus size={13} />
              Add Org
            </button>
          </div>
        }
      />

      {loading ? <Spinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['ID', 'Name', 'Status', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr
                key={o.id}
                style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${o.isActive ? '#22c55e' : '#aaa'}` }}
              >
                <td style={{ padding: '10px 16px', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>#{o.displayId}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{o.name}</td>
                <td style={{ padding: '10px 16px', color: o.isActive ? '#16a34a' : '#aaa' }}>
                  {o.isActive ? 'Active' : 'Inactive'}
                </td>
                <td style={{ padding: '10px 16px', color: '#aaa' }}>
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', color: '#ccc', fontSize: 12 }}>
                  No organizations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
