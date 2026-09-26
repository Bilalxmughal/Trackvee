import { Outlet, useNavigate } from 'react-router-dom';
import { IconLogout } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean).map(s => s![0]).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const orgName = user?.organizationName || 'Portal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        height: 46, background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        flexShrink: 0, zIndex: 500, position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, background: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="4"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '-0.2px' }}>Trackvee</span>
        </div>

        {/* Org name */}
        <div style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 4px' }} />
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{orgName}</span>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 26, height: 26, background: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600, flexShrink: 0 }}>
              {initials}
            </div>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ width: 28, height: 28, background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconLogout size={14} color="#888" />
          </button>
        </div>
      </div>

      {/* Page content — fills remaining height */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
