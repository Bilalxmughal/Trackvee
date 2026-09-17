import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard, IconBuilding, IconUsers,
  IconCar, IconCpu, IconMap, IconLogout,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/dashboard', icon: IconLayoutDashboard, label: 'Dashboard' },
  { to: '/organizations', icon: IconBuilding, label: 'Organizations' },
  { to: '/users', icon: IconUsers, label: 'Users' },
  { to: '/vehicles', icon: IconCar, label: 'Vehicles' },
  { to: '/devices', icon: IconCpu, label: 'Devices' },
  { to: '/telemetry', icon: IconMap, label: 'Telemetry' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 52,
        flexShrink: 0,
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 12,
        background: '#fff',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', letterSpacing: -0.5 }}>Y</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              style={({ isActive }) => ({
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                color: isActive ? '#dc2626' : '#aaa',
                background: isActive ? '#fff5f5' : 'transparent',
                textDecoration: 'none',
                transition: 'color 0.1s',
              })}
            >
              <Icon size={17} strokeWidth={1.75} />
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login'); }}
          title="Logout"
          style={{
            width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'none', cursor: 'pointer',
            color: '#ccc', borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
          onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
        >
          <IconLogout size={16} strokeWidth={1.75} />
        </button>
      </aside>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 44,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 20,
          flexShrink: 0,
          background: '#fff',
        }}>
          <span style={{ fontSize: 12, color: '#bbb' }}>
            {user?.firstName ?? user?.email.split('@')[0]}
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#fafafa' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
