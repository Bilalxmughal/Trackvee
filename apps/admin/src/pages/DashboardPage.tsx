import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCityFilter } from '../contexts/CityFilterContext';

interface Stats {
  users: number;
  organizations: number;
  vehicles: number;
  devices: number;
}

function getGreeting(): { text: string; sub: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', sub: 'Hope your day is going well.' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', sub: 'Stay focused, you got this.' };
  if (h >= 17 && h < 21) return { text: 'Good evening', sub: 'Wrapping up for the day?' };
  return { text: 'Up late?', sub: 'Take it easy, you deserve rest.' };
}

const card = (label: string, value: number | undefined) => (
  <div style={{
    borderTop: '2px solid #dc2626',
    padding: '16px 20px',
    background: 'var(--bg2)',
    minWidth: 140,
    flex: 1,
  }}>
    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
      {value ?? '—'}
    </div>
    <div style={{ fontSize: 11, color: '#aaa', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const { user } = useAuth();
  const { selectedCityId } = useCityFilter();
  const { text, sub } = getGreeting();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

  useEffect(() => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([
      api.get<{ id: string }[]>(`/users${p}`),
      api.get<{ id: string }[]>(`/organizations${p}`),
      api.get<{ id: string }[]>(`/vehicles${p}`),
      api.get<{ id: string }[]>(`/devices${p}`),
    ]).then(([u, o, v, d]) => {
      setStats({
        users: Array.isArray(u.data) ? u.data.length : 0,
        organizations: Array.isArray(o.data) ? o.data.length : 0,
        vehicles: Array.isArray(v.data) ? v.data.length : 0,
        devices: Array.isArray(d.data) ? d.data.length : 0,
      });
    }).catch(() => {});
  }, [selectedCityId]);

  return (
    <div>
      {/* Greeting */}
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
          {text}, {fullName}
        </div>
        <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>{sub}</div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 1,
        padding: '24px',
      }}>
        {card('Clients', stats?.organizations)}
        {card('Users', stats?.users)}
        {card('Vehicles', stats?.vehicles)}
        {card('Devices', stats?.devices)}
      </div>
    </div>
  );
}
