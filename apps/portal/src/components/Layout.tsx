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

  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const initials = (firstName[0] || user?.email?.[0] || 'U').toUpperCase();
  const orgName = user?.organizationName || 'Trackvee Portal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        height: 46, background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        flexShrink: 0, zIndex: 500, position: 'relative',
      }}>
        {/* Logo */}
        <img src="/logo.png" alt="Trackvee" style={{ height: 24, width: 'auto' }} />

        {/* Divider + org name */}
        <div style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 12px' }} />
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{orgName}</span>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, background: '#dc2626', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{displayName}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              width: 28, height: 28, background: 'none', border: '1px solid #e5e7eb',
              borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconLogout size={14} color="#888" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
