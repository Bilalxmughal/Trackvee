import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard, IconBuilding, IconUsers, IconCar,
  IconCpu, IconMap, IconLogout, IconSearch, IconChevronDown,
  IconShield, IconChevronLeft, IconChevronRight, IconMenu2, IconX,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface NavItemDef { to: string; icon: React.ElementType; label: string; }
interface Section { label: string | null; items: NavItemDef[]; }

const NAV_SECTIONS: Section[] = [
  {
    label: null,
    items: [{ to: '/dashboard', icon: IconLayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Fleet Management',
    items: [
      { to: '/clients', icon: IconBuilding, label: 'Clients' },
      { to: '/vehicles', icon: IconCar, label: 'Vehicles' },
      { to: '/devices', icon: IconCpu, label: 'Devices' },
      { to: '/telemetry', icon: IconMap, label: 'Telemetry' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', icon: IconUsers, label: 'User Management' },
      { to: '/roles', icon: IconShield, label: 'Role Access' },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', org_admin: 'Org Admin',
  dispatcher: 'Dispatcher', viewer: 'Viewer',
};

interface SearchResult {
  type: string; id: string; label: string; sub: string; to: string;
}

function NavItem({ to, icon: Icon, label, collapsed }: NavItemDef & { collapsed: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <NavLink
        to={to}
        style={({ isActive }) => ({
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          padding: collapsed ? '8px 0' : '7px 14px 7px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none',
          color: isActive ? '#dc2626' : hovered ? '#333' : '#666',
          background: isActive ? 'rgba(220,38,38,0.07)' : hovered ? '#f5f5f5' : 'transparent',
          borderLeft: collapsed ? 'none' : `3px solid ${isActive ? '#dc2626' : 'transparent'}`,
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          transition: 'color 0.15s, background 0.15s',
          borderRadius: collapsed ? 8 : 0,
          margin: collapsed ? '1px 8px' : 0,
          width: collapsed ? 40 : 'auto',
          height: collapsed ? 40 : 'auto',
        })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      </NavLink>
      {collapsed && hovered && (
        <div style={{
          position: 'absolute', left: 52, top: '50%', transform: 'translateY(-50%)',
          background: '#1a1a1a', color: '#fff', fontSize: 11.5, fontWeight: 500,
          padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 500,
          pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('yt_sidebar') === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const sidebarW = collapsed ? 56 : 220;

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('yt_sidebar', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email?.split('@')[0] ?? '';

  // global search
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setSearchQ(''); setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    setTimeout(() => searchInput.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const q = searchQ.trim();
    setSearchLoading(true);
    const timerId = setTimeout(async () => {
      try {
        const [clients, users, vehicles, devices] = await Promise.allSettled([
          api.get<{ id: string; displayId: number; name: string }[]>(`/organizations?q=${encodeURIComponent(q)}`),
          api.get<{ id: string; displayId: number; email: string; firstName: string | null }[]>(`/users?q=${encodeURIComponent(q)}`),
          api.get<{ id: string; displayId: number; licensePlate: string | null; make: string | null }[]>(`/vehicles?q=${encodeURIComponent(q)}`),
          api.get<{ id: string; displayId: number; imei: string; name: string | null }[]>(`/devices?q=${encodeURIComponent(q)}`),
        ]);
        const results: SearchResult[] = [];
        if (clients.status === 'fulfilled') {
          clients.value.data.slice(0, 4).forEach(c => results.push({ type: 'Client', id: c.id, label: c.name, sub: `#${c.displayId}`, to: '/clients' }));
        }
        if (users.status === 'fulfilled') {
          users.value.data.slice(0, 4).forEach(u => results.push({ type: 'User', id: u.id, label: u.firstName ?? u.email, sub: u.email, to: '/users' }));
        }
        if (vehicles.status === 'fulfilled') {
          vehicles.value.data.slice(0, 4).forEach(v => results.push({ type: 'Vehicle', id: v.id, label: v.licensePlate ?? `#${v.displayId}`, sub: v.make ?? '', to: '/vehicles' }));
        }
        if (devices.status === 'fulfilled') {
          devices.value.data.slice(0, 4).forEach(d => results.push({ type: 'Device', id: d.id, label: d.imei, sub: d.name ?? '', to: '/devices' }));
        }
        setSearchResults(results);
      } catch {}
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchQ]);

  const typeColor: Record<string, string> = { Client: '#3b82f6', User: '#8b5cf6', Vehicle: '#16a34a', Device: '#f59e0b' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`yt-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        style={{
          width: sidebarW, flexShrink: 0,
          borderRight: '1px solid #eeeeee',
          display: 'flex', flexDirection: 'column',
          background: '#fff',
          transition: 'width 0.22s ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '14px 0' : '14px 14px 14px 18px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
          {!collapsed && (
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', letterSpacing: -0.5 }}>YoTrack</span>
              <span style={{ fontSize: 10, color: '#ccc', display: 'block', letterSpacing: 0.3, marginTop: 1 }}>Admin Portal</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4, borderRadius: 6, display: 'flex', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#555')}
            onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
          >
            {collapsed ? <IconChevronRight size={15} /> : <IconChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '8px 0' : '8px 0' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginTop: si === 0 ? 4 : 14 }}>
              {section.label && !collapsed && (
                <div style={{ padding: '0 18px 6px', fontSize: 10, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {section.label}
                </div>
              )}
              {section.label && collapsed && (
                <div style={{ height: 1, background: '#f0f0f0', margin: '6px 10px 8px' }} />
              )}
              {section.items.map(item => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        {/* Profile + logout */}
        <div style={{ padding: collapsed ? '10px 0' : '10px 12px', borderTop: '1px solid #f5f5f5', flexShrink: 0 }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                <IconLogout size={15} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: '#aaa', lineHeight: 1.3 }}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</div>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} title="Sign out"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                <IconLogout size={14} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 50, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, flexShrink: 0, background: '#fff', gap: 10 }}>
          {/* Mobile hamburger */}
          <button
            className="yt-topbar-hamburger"
            onClick={() => setMobileOpen(true)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666', padding: 4, borderRadius: 6, alignItems: 'center', display: 'none' }}
          >
            <IconMenu2 size={20} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Global search */}
          <div ref={searchRef} style={{ position: 'relative' }}>
            {searchOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <IconSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#ccc', pointerEvents: 'none' }} />
                  <input
                    ref={searchInput}
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search clients, users, vehicles…"
                    style={{ width: 280, height: 34, padding: '0 12px 0 30px', border: '1px solid #dc2626', borderRadius: 8, fontSize: 12.5, color: '#111', background: '#fff', outline: 'none', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' }}
                  />
                </div>
                <button onClick={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>
                  <IconX size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                title="Search"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', padding: 6, borderRadius: 8, display: 'flex', transition: 'color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'none'; }}
              >
                <IconSearch size={16} />
              </button>
            )}

            {/* Search results dropdown */}
            {searchOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, width: 340, background: '#fff', border: '1px solid #ebebeb', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.1)', zIndex: 300, overflow: 'hidden' }}>
                {searchQ.trim() === '' ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: '#bbb', textAlign: 'center' }}>Type to search across all pages</div>
                ) : searchLoading ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: '#bbb', textAlign: 'center' }}>Searching…</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: '#bbb', textAlign: 'center' }}>No results for "{searchQ}"</div>
                ) : (
                  searchResults.map((r, i) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => { navigate(r.to); setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < searchResults.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f8f8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: typeColor[r.type] ?? '#888', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 44, padding: '2px 6px', background: `${typeColor[r.type]}18`, borderRadius: 4, textAlign: 'center' }}>{r.type}</span>
                      <div>
                        <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>{r.label}</div>
                        {r.sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{r.sub}</div>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: '#aaa', lineHeight: 1.2 }}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</div>
              </div>
              <IconChevronDown size={12} style={{ color: '#ccc' }} />
            </button>
            {profileOpen && (
              <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #ebebeb', borderRadius: 10, minWidth: 150, zIndex: 200, boxShadow: '0 6px 20px rgba(0,0,0,0.09)', overflow: 'hidden' }}>
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
        <main style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          <div className="page-wrap">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
