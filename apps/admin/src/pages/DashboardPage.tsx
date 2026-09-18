import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCityFilter } from '../contexts/CityFilterContext';

interface RawItem { id: string; cityId?: string | null; }

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

const filterByCity = (arr: RawItem[], cityId: string) =>
  cityId ? arr.filter(x => x.cityId === cityId) : arr;

export default function DashboardPage() {
  const [raw, setRaw] = useState<{ users: RawItem[]; orgs: RawItem[]; vehicles: RawItem[]; devices: RawItem[] } | null>(null);
  const { user } = useAuth();
  const { selectedCityId } = useCityFilter();
  const { text, sub } = getGreeting();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

  useEffect(() => {
    Promise.all([
      api.get<RawItem[]>('/users'),
      api.get<RawItem[]>('/organizations'),
      api.get<RawItem[]>('/vehicles'),
      api.get<RawItem[]>('/devices'),
    ]).then(([u, o, v, d]) => {
      setRaw({ users: Array.isArray(u.data) ? u.data : [], orgs: Array.isArray(o.data) ? o.data : [], vehicles: Array.isArray(v.data) ? v.data : [], devices: Array.isArray(d.data) ? d.data : [] });
    }).catch(() => {});
  }, []);

  const stats: Stats | null = raw ? {
    users: filterByCity(raw.users, selectedCityId).length,
    organizations: filterByCity(raw.orgs, selectedCityId).length,
    vehicles: filterByCity(raw.vehicles, selectedCityId).length,
    devices: filterByCity(raw.devices, selectedCityId).length,
  } : null;

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
