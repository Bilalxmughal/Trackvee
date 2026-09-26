import { useState, useEffect } from 'react';
import { IconPlus, IconPencil, IconTrash, IconSearch, IconUsers } from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface OrgUser {
  id: string; email: string; firstName: string | null; lastName: string | null;
  role: string; isActive: boolean;
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

// ── Form Modal ─────────────────────────────────────────────────────────────────

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
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

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function UsersModal({ onClose }: { onClose: () => void }) {
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(860px, 98vw)', height: 'min(640px, 95vh)', background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 8 }}>
          <IconUsers size={16} color="#dc2626" strokeWidth={1.8} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>
            Users <span style={{ fontSize: 12, fontWeight: 400, color: '#bbb' }}>{users.length}</span>
          </span>
          <button onClick={() => { setEditing(null); setFormOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <IconPlus size={12} strokeWidth={2.5} /> New User
          </button>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '6px 7px', borderRadius: 6, display: 'flex', marginLeft: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f5f5f5', borderRadius: 7, padding: '6px 11px' }}>
            <IconSearch size={12} color="#bbb" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12.5, color: '#111', outline: 'none' }} />
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fafafa', zIndex: 1 }}>
              <tr>
                {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#bbb', fontSize: 13 }}>{q ? 'No results' : 'No users found'}</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f7f7f7' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '11px 16px', fontWeight: 600, color: '#111' }}>{displayName(u)}</td>
                  <td style={{ padding: '11px 16px', color: '#555' }}>{u.email}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: ROLE_COLOR[u.role] ?? '#6b7280', padding: '2px 8px', borderRadius: 4 }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontSize: 11, color: u.isActive ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditing(u); setFormOpen(true); }}
                        style={{ padding: 5, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#555', borderRadius: 5, display: 'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; }}>
                        <IconPencil size={13} />
                      </button>
                      <button onClick={() => setDeleting(u)}
                        style={{ padding: 5, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#dc2626', borderRadius: 5, display: 'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; }}>
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <UserFormModal initial={editing} organizationId={orgId} onSave={onSave}
          onClose={() => { setFormOpen(false); setEditing(null); }} />
      )}

      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
