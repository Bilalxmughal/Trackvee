import { useState, useEffect } from 'react';
import { IconPlus, IconPencil, IconTrash, IconSearch } from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface OrgUser {
  id: string; email: string; firstName: string | null; lastName: string | null;
  role: string; isActive: boolean; createdAt?: string;
}

const inpSt: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };

const ROLE_LABEL: Record<string, string> = {
  client_owner: 'Owner', client_super_admin: 'Super Admin',
  client_admin: 'Admin', client_user: 'User',
};
const ROLE_COLOR: Record<string, string> = {
  client_owner: '#7c3aed', client_super_admin: '#0891b2',
  client_admin: '#16a34a', client_user: '#6b7280',
};

// ── User Form Modal ────────────────────────────────────────────────────────────

function UserFormModal({ initial, organizationId, onSave, onClose }: {
  initial?: OrgUser | null; organizationId: string;
  onSave: (u: OrgUser) => void; onClose: () => void;
}) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [role, setRole] = useState(initial?.role ?? 'client_user');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim()) { setErr('Email is required'); return; }
    if (!initial?.id && !password.trim()) { setErr('Password is required for new users'); return; }
    setSaving(true); setErr('');
    const payload: Record<string, unknown> = { email: email.trim(), firstName: firstName.trim() || null, lastName: lastName.trim() || null, role, organizationId };
    if (password.trim()) payload.password = password;
    try {
      let u: OrgUser;
      if (initial?.id) { u = (await api.put<OrgUser>(`/users/${initial.id}`, payload)).data; }
      else { u = (await api.post<OrgUser>('/users', payload)).data; }
      onSave(u);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(typeof msg === 'string' ? msg : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(420px, 97vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>{initial?.id ? 'Edit User' : 'New User'}</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={LBL}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" style={inpSt}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={LBL}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First" style={inpSt}
                onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
                onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={LBL}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last" style={inpSt}
                onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
                onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
          </div>
          <div>
            <label style={LBL}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inpSt, cursor: 'pointer' }}>
              <option value="client_user">User</option>
              <option value="client_admin">Admin</option>
              <option value="client_super_admin">Super Admin</option>
              <option value="client_owner">Owner</option>
            </select>
          </div>
          <div>
            <label style={LBL}>{initial?.id ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={initial?.id ? 'Leave blank to keep' : 'Set password'} style={inpSt}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: saving ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [deleting, setDeleting] = useState<OrgUser | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId ?? '';

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    api.get<OrgUser[]>(`/users/org-users?organizationId=${orgId}`)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const filtered = q.trim() ? users.filter(u => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
    return name.includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase());
  }) : users;

  const onSave = (u: OrgUser) => {
    setUsers(prev => editing?.id ? prev.map(x => x.id === u.id ? u : x) : [...prev, u]);
    setFormOpen(false); setEditing(null);
  };

  const confirmDelete = async (id: string) => {
    try { await api.delete(`/users/${id}`); setUsers(prev => prev.filter(u => u.id !== id)); } catch {}
    setDeleting(null);
  };

  const displayName = (u: OrgUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Users</div>
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{users.length} user{users.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <IconPlus size={13} strokeWidth={2.5} /> New User
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 7, padding: '5px 10px' }}>
            <IconSearch size={12} color="#bbb" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#111', outline: 'none' }} />
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#bbb' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#bbb' }}>{q ? 'No results' : 'No users found'}</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f7f7f7' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111' }}>{displayName(u)}</td>
                <td style={{ padding: '10px 14px', color: '#555' }}>{u.email}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: ROLE_COLOR[u.role] ?? '#6b7280', padding: '2px 8px', borderRadius: 4 }}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, color: u.isActive ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditing(u); setFormOpen(true); }}
                      style={{ padding: 5, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#555', borderRadius: 5, display: 'flex' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; }}>
                      <IconPencil size={12} />
                    </button>
                    <button onClick={() => setDeleting(u)}
                      style={{ padding: 5, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#dc2626', borderRadius: 5, display: 'flex' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; }}>
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <UserFormModal
          initial={editing}
          organizationId={orgId}
          onSave={onSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 290, boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Delete User</div>
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 20 }}>
              Remove <strong>{displayName(deleting)}</strong> from this organization? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleting(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmDelete(deleting.id)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
