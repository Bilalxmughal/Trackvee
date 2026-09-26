import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  IconBell, IconMap2, IconMapPin, IconChartBar, IconLogout, IconChevronDown, IconActivity, IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalPanel } from '../contexts/PortalPanelContext';

function PanelButton({
  label, icon: Icon, panelKey, badge,
}: {
  label: string; icon: React.ElementType;
  panelKey: 'alerts' | 'geofences' | 'pois' | 'reports' | 'behavior';
  badge?: number;
}) {
  const { activePanel, openPanel } = usePortalPanel();
  const active = activePanel === panelKey;
  const open = () => openPanel(panelKey);
  return (
    <button
      onClick={open}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 9px', borderRadius: 6, border: 'none',
        background: active ? 'rgba(220,38,38,0.08)' : 'transparent',
        color: active ? '#dc2626' : '#777',
        fontWeight: active ? 600 : 400,
        fontSize: 12.5, whiteSpace: 'nowrap', cursor: 'pointer',
        transition: 'color 0.13s, background 0.13s', position: 'relative',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = ''; e.currentTarget.style.background = ''; } }}
    >
      <Icon size={14} strokeWidth={1.9} style={{ flexShrink: 0 }} />
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: 1, right: 1,
          background: '#dc2626', color: '#fff', fontSize: 8.5, fontWeight: 700,
          padding: '1px 4px', borderRadius: 6, lineHeight: 1.4,
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { alertCount } = usePortalPanel();
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
        flexShrink: 0, zIndex: 1000, position: 'relative', gap: 0,
      }}>
        {/* Logo */}
        <img src="/logo.png" alt="Trackvee" style={{ height: 22, width: 'auto', marginRight: 14, flexShrink: 0 }} />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: '#ebebeb', marginRight: 12, flexShrink: 0 }} />

        {/* Panel trigger buttons */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PanelButton panelKey="alerts"    icon={IconBell}           label="Alerts"    badge={alertCount} />
          <PanelButton panelKey="geofences" icon={IconMap2}           label="Geofences" />
          <PanelButton panelKey="pois"      icon={IconMapPin}         label="POIs" />
          <PanelButton panelKey="behavior"  icon={IconActivity}       label="Behavior" />
          <PanelButton panelKey="reports"   icon={IconChartBar}       label="Reports" />
          <div style={{ width: 1, height: 16, background: '#ebebeb', margin: '0 6px', flexShrink: 0 }} />
          <button onClick={() => navigate('/users')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 6, border: 'none', background: 'transparent', color: '#777', fontSize: 12.5, whiteSpace: 'nowrap', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#777'; e.currentTarget.style.background = 'transparent'; }}>
            <IconUsers size={14} strokeWidth={1.9} /> Users
          </button>
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
