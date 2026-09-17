import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard, IconBuilding, IconUsers,
  IconCar, IconCpu, IconMap, IconLogout,
  IconSearch, IconChevronDown,
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

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  dispatcher: 'Dispatcher',
  viewer: 'Viewer',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email.split('@')[0] ?? '';

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
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <div key={to} style={{ position: 'relative' }}>
              <NavLink
                to={to}
                style={({ isActive }) => ({
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  color: isActive ? '#dc2626' : hoveredNav === to ? '#dc2626' : '#bbb',
                  background: isActive ? '#fff5f5' : hoveredNav === to ? '#fff5f5' : 'transparent',
                  textDecoration: 'none',
                  transition: 'color 0.15s, background 0.15s',
                })}
                onMouseEnter={() => setHoveredNav(to)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                <Icon size={17} strokeWidth={1.75} />
              </NavLink>

              {/* Tooltip label */}
              {hoveredNav === to && (
                <div style={{
                  position: 'absolute',
                  left: 42,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#111',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 8px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}>
                  {label}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            title="Logout"
            style={{
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#ccc', borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; }}
          >
            <IconLogout size={16} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 48,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 20,
          flexShrink: 0,
          background: '#fff',
          gap: 12,
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <IconSearch size={13} style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: '#ccc', pointerEvents: 'none',
            }} />
            <input
              placeholder="Search anything…"
              style={{
                width: '100%',
                height: 32,
                padding: '0 12px 0 30px',
                border: '1px solid #efefef',
                borderRadius: 4,
                fontSize: 12,
                color: '#111',
                background: '#fafafa',
                outline: 'none',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.background = '#fff';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#efefef';
                e.currentTarget.style.background = '#fafafa';
              }}
            />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Profile */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '4px 6px', borderRadius: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#dc2626', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111', lineHeight: 1.2 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.2 }}>
                  {roleLabel[user?.role ?? ''] ?? user?.role}
                </div>
              </div>
              <IconChevronDown size={12} style={{ color: '#ccc', marginLeft: 2 }} />
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 38,
                background: '#fff', border: '1px solid #f0f0f0',
                borderRadius: 4, minWidth: 140, zIndex: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}>
                <button
                  onClick={() => { setProfileOpen(false); logout(); navigate('/login'); }}
                  style={{
                    width: '100%', padding: '9px 14px',
                    border: 'none', background: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 12, color: '#dc2626',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <IconLogout size={13} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
