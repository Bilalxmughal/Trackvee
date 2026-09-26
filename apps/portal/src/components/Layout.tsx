import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconMap, IconCar, IconChartBar, IconBell, IconLogout, IconChevronDown,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/map',      icon: IconMap,      label: 'Live Map' },
  { to: '/vehicles', icon: IconCar,      label: 'Vehicles' },
  { to: '/reports',  icon: IconChartBar, label: 'Reports'  },
  { to: '/alerts',   icon: IconBell,     label: 'Alerts'   },
];

function TopNavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 9px', borderRadius: 6, textDecoration: 'none',
        color: isActive ? '#dc2626' : '#777',
        background: isActive ? 'rgba(220,38,38,0.08)' : 'transparent',
        fontWeight: isActive ? 600 : 400,
        fontSize: 12.5, whiteSpace: 'nowrap',
        transition: 'color 0.13s, background 0.13s',
      })}
      onMouseEnter={e => {
        const a = e.currentTarget as HTMLElement;
        if (!a.getAttribute('aria-current')) { a.style.color = '#dc2626'; a.style.background = 'rgba(220,38,38,0.06)'; }
      }}
      onMouseLeave={e => {
        const a = e.currentTarget as HTMLElement;
        if (!a.getAttribute('aria-current')) { a.style.color = ''; a.style.background = ''; }
      }}
    >
      <Icon size={14} strokeWidth={1.9} style={{ flexShrink: 0 }} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const initials = (firstName[0] || user?.email?.[0] || 'U').toUpperCase();
  const orgName = user?.organizationName || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Topbar */}
      <header style={{
        height: 46, background: '#fff', borderBottom: '1px solid #e8e8e8',
        display: 'flex', alignItems: 'center', padding: '0 14px',
        flexShrink: 0, zIndex: 500, position: 'relative', gap: 0,
      }}>
        {/* Logo */}
        <img src="/logo.png" alt="Trackvee" style={{ height: 22, width: 'auto', marginRight: 14, flexShrink: 0 }} />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: '#ebebeb', marginRight: 12, flexShrink: 0 }} />

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <TopNavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right side: org name + user profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {orgName && (
            <span style={{ fontSize: 11.5, color: '#aaa', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {orgName}
            </span>
          )}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 7 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <div style={{
                width: 26, height: 26, background: '#dc2626', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>{displayName}</div>
              </div>
              <IconChevronDown size={11} color="#ccc" />
            </button>
            {profileOpen && (
              <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid #ebebeb', borderRadius: 9, minWidth: 140, zIndex: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <IconLogout size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
