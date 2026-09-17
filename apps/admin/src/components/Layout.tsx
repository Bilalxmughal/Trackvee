import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard, IconBuilding, IconUsers,
  IconCar, IconCpu, IconMap, IconLogout,
  IconSearch, IconChevronDown, IconShield,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

const MAIN_NAV = [
  { to: '/dashboard', icon: IconLayoutDashboard, label: 'Dashboard' },
  { to: '/organizations', icon: IconBuilding, label: 'Organizations' },
  { to: '/vehicles', icon: IconCar, label: 'Vehicles' },
  { to: '/devices', icon: IconCpu, label: 'Devices' },
  { to: '/telemetry', icon: IconMap, label: 'Telemetry' },
];

const ADMIN_NAV = [
  { to: '/users', icon: IconUsers, label: 'User Management' },
  { to: '/roles', icon: IconShield, label: 'Role Access' },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', org_admin: 'Org Admin',
  dispatcher: 'Dispatcher', viewer: 'Viewer',
};

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px 7px 16px',
        borderRadius: 0, textDecoration: 'none',
        color: isActive ? '#dc2626' : '#666',
        background: isActive ? 'rgba(220,38,38,0.06)' : 'transparent',
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? '3px solid #dc2626' : '3px solid transparent',
        transition: 'color 0.15s, background 0.15s',
      })}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        if (!el.classList.contains('active')) {
          el.style.background = '#f8f8f8';
          el.style.color = '#333';
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        if (!el.classList.contains('active')) {
          el.style.background = 'transparent';
          el.style.color = '#666';
        }
      }}
    >
      <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email.split('@')[0] ?? '';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid #eeeeee',
        display: 'flex', flexDirection: 'column',
        background: '#fff',
        boxShadow: '1px 0 0 #f0f0f0',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f5f5f5' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#dc2626', letterSpacing: -0.5 }}>YoTrack</span>
          <span style={{ fontSize: 10, color: '#ccc', display: 'block', letterSpacing: 0.3, marginTop: 1 }}>Admin Portal</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {/* Main */}
          <div style={{ paddingTop: 4 }}>
            {MAIN_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </div>

          {/* Administration section */}
          <div style={{ marginTop: 18 }}>
            <div style={{ padding: '4px 18px 8px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Administration
            </div>
            {ADMIN_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </div>
        </nav>

        {/* Profile / Logout */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #f5f5f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#dc2626', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.3 }}>
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              title="Sign out"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4, borderRadius: 4, display: 'flex', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
            >
              <IconLogout size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 50, borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center',
          paddingLeft: 20, paddingRight: 20,
          flexShrink: 0, background: '#fff', gap: 12,
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
            <IconSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#ccc', pointerEvents: 'none' }} />
            <input
              placeholder="Search anything…"
              style={{ width: '100%', height: 34, padding: '0 12px 0 30px', border: '1px solid #efefef', borderRadius: 5, fontSize: 12.5, color: '#111', background: '#fafafa', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#efefef'; e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Profile dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 5 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111', lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: '#aaa', lineHeight: 1.2 }}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</div>
              </div>
              <IconChevronDown size={12} style={{ color: '#ccc', marginLeft: 2 }} />
            </button>

            {profileOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', border: '1px solid #ebebeb', borderRadius: 8, minWidth: 150, zIndex: 200, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <button
                  onClick={() => { setProfileOpen(false); logout(); navigate('/login'); }}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <IconLogout size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#fafafa' }}>
          <div style={{ background: '#fff', minHeight: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
