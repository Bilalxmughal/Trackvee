import { IconCheck, IconX, IconShield } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { ROLE_PAGES, ROLE_TOPBAR, ROLE_LABEL } from '../config/roles';
import type { UserRole } from '@yotrack/types';

type InternalRole = 'super_admin' | 'admin' | 'ops' | 'live_ops' | 'agent' | 'chat_support' | 'viewer';

const INTERNAL_ROLES: InternalRole[] = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

interface PageRow { key: string; label: string; group: string; }
const PAGES: PageRow[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core' },
  { key: 'map', label: 'Live Map', group: 'Core' },
  { key: 'telemetry', label: 'Telemetry', group: 'Core' },
  { key: 'clients', label: 'Clients', group: 'Management' },
  { key: 'vehicles', label: 'Vehicles', group: 'Management' },
  { key: 'devices', label: 'Devices', group: 'Management' },
  { key: 'setup', label: 'Setup Guide', group: 'Management' },
  { key: 'users', label: 'User Management', group: 'Administration' },
  { key: 'roles', label: 'Role Access', group: 'Administration' },
  { key: 'settings', label: 'Settings', group: 'Administration' },
];

const TOPBAR_FEATURES = [
  { key: 'alerts', label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'pois', label: 'POIs' },
];

const GROUPS = ['Core', 'Management', 'Administration'];

function Cell({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 5, margin: '0 auto',
      background: on ? 'rgba(34,197,94,0.12)' : 'var(--bg3)',
      color: on ? '#16a34a' : '#ccc',
      display: 'grid', placeItems: 'center',
    }}>
      {on ? <IconCheck size={13} /> : <IconX size={13} />}
    </div>
  );
}

export default function RoleAccessPage() {
  return (
    <div>
      <PageHeader title="Role Access" />

      <div style={{ padding: '0 0 24px' }}>
        <div style={{ padding: '12px 20px 8px', fontSize: 12, color: 'var(--muted)' }}>
          Internal Trackvee staff role permissions. These roles have no organization — they see all data at the backend level.
        </div>

        {/* Page access matrix */}
        <div style={{ overflowX: 'auto', padding: '0 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>
                  Page
                </th>
                {INTERNAL_ROLES.map(r => (
                  <th key={r} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 80 }}>
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => {
                const groupPages = PAGES.filter(p => p.group === group);
                return (
                  <>
                    <tr key={group} style={{ background: 'var(--bg3)' }}>
                      <td colSpan={INTERNAL_ROLES.length + 1} style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>
                        {group}
                      </td>
                    </tr>
                    {groupPages.map(page => (
                      <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                        <td style={{ padding: '9px 16px', color: 'var(--text)', fontWeight: 400 }}>{page.label}</td>
                        {INTERNAL_ROLES.map(r => (
                          <td key={r} style={{ padding: '9px 8px', textAlign: 'center' }}>
                            <Cell on={(ROLE_PAGES[r as UserRole] ?? []).includes(page.key)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Topbar features */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, padding: '0 0 8px' }}>
            Topbar Features
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Feature</th>
                  {INTERNAL_ROLES.map(r => (
                    <th key={r} style={{ padding: '8px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 80 }}>
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOPBAR_FEATURES.map(feat => (
                  <tr key={feat.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                    <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{feat.label}</td>
                    {INTERNAL_ROLES.map(r => (
                      <td key={r} style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <Cell on={(ROLE_TOPBAR[r as UserRole] ?? []).includes(feat.key)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: 'var(--muted)' }}>
          <IconShield size={13} color="#dc2626" />
          <span>All internal roles have no organization assigned — they see all data globally across the platform.</span>
        </div>
      </div>
    </div>
  );
}
