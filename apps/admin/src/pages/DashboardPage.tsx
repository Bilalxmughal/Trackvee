import { useEffect, useState } from 'react';
import api from '../api/client';

interface Stats {
  users: number;
  organizations: number;
  vehicles: number;
  devices: number;
}

const card = (label: string, value: number | undefined) => (
  <div style={{
    borderTop: '2px solid #dc2626',
    padding: '16px 20px',
    background: '#fff',
    minWidth: 140,
    flex: 1,
  }}>
    <div style={{ fontSize: 26, fontWeight: 700, color: '#111', lineHeight: 1 }}>
      {value ?? '—'}
    </div>
    <div style={{ fontSize: 11, color: '#aaa', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
  </div>
);

const len = (x: unknown): number => Array.isArray(x) ? x.length : 0;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/organizations'),
      api.get('/vehicles'),
      api.get('/devices'),
    ]).then(([u, o, v, d]) => {
      setStats({
        users: len(u.data),
        organizations: len(o.data),
        vehicles: len(v.data),
        devices: len(d.data),
      });
    }).catch(() => {});
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid #ececec',
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111' }}>Dashboard</h1>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 1,
        padding: '24px',
      }}>
        {card('Organizations', stats?.organizations)}
        {card('Users', stats?.users)}
        {card('Vehicles', stats?.vehicles)}
        {card('Devices', stats?.devices)}
      </div>
    </div>
  );
}
