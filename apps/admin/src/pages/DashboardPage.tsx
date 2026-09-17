import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  users: number;
  organizations: number;
  vehicles: number;
  devices: number;
}

function getGreeting(): { text: string; emoji: string; sub: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', emoji: '☀️', sub: 'Hope your day is going well.' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', emoji: '⚡', sub: 'Stay focused, you got this.' };
  if (h >= 17 && h < 21) return { text: 'Good evening', emoji: '🌙', sub: 'Wrapping up for the day?' };
  return { text: 'Up late?', emoji: '🌑', sub: 'Take it easy, you deserve rest.' };
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
  const { user } = useAuth();
  const { text, emoji, sub } = getGreeting();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'there';

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
      {/* Greeting */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              {text}, {fullName}
            </div>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>{sub}</div>
          </div>
        </div>
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
