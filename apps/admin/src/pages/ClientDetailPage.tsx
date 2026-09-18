import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconBuilding, IconUsers, IconCar, IconCpu, IconMapPin, IconPhone, IconMail, IconLock, IconCalendar } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import Spinner from '../components/Spinner';

interface Client {
  id: string; displayId: number; name: string;
  pocName: string | null; contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  customerCount: number; vehicleCount: number; deviceCount: number;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const { cities } = useCityFilter();

  useEffect(() => {
    api.get<Client>(`/organizations/${id}`)
      .then(r => setClient(r.data))
      .catch(() => navigate('/clients', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner style={{ height: '60vh' }} />;
  if (!client) return null;

  const cityName = cities.find(c => c.id === client.cityId)?.name ?? '—';

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => navigate('/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '4px 0', marginBottom: 20 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
        <IconArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconBuilding size={24} color="#dc2626" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{client.name}</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Client #{client.displayId}</div>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          borderLeft: `3px solid ${client.isActive ? '#22c55e' : '#e5e7eb'}`,
          color: client.isActive ? '#16a34a' : 'var(--muted)',
          background: 'var(--bg2)' }}>
          {client.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: IconUsers, label: 'Customers', value: client.customerCount },
          { icon: IconCar, label: 'Vehicles', value: client.vehicleCount },
          { icon: IconCpu, label: 'Devices', value: client.deviceCount },
        ].map(s => (
          <div key={s.label} style={{ padding: '20px 24px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={19} color="#dc2626" />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Contact Info */}
        <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Contact Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: IconUsers, label: 'POC Name', value: client.pocName ?? '—' },
              { icon: IconPhone, label: 'Contact No', value: client.contactNo ?? '—' },
              { icon: IconMail, label: 'Email', value: client.email ?? '—' },
              { icon: IconMapPin, label: 'City', value: cityName },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)' }}>
                <row.icon size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portal & Dates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Portal Access</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconLock size={16} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {client.email ? 'Portal Login Enabled' : 'No Portal Access'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {client.email ? client.email : 'No email or password configured.'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Dates</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)' }}>
              <IconCalendar size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>Added on</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{fmtDate(client.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
