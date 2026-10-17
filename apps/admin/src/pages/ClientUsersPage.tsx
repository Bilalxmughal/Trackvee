import { useEffect, useState, FormEvent, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconUserScan, IconBan, IconCheck, IconMinus, IconShieldCheck, IconDownload } from '@tabler/icons-react';
import CustomSelect from '../components/CustomSelect';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { fmtDate } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import SkeletonTable from '../components/SkeletonTable';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import TablePagination, { useTablePagination } from '../components/TablePagination';

interface OrgUser {
  id: string; displayId: number; email: string;
  firstName: string | null; lastName: string | null;
  role: string; organizationId: string | null;
  isActive: boolean; createdAt: string; lastLoginAt: string | null;
}
interface Org { id: string; name: string; type: string; }
interface Vehicle { id: string; licensePlate: string | null; make: string | null; model: string | null; displayId: number; organizationId: string | null; }

interface OrgPerm {
  userId?: string; orgId?: string; dashboardView: boolean | null; mapView: boolean | null;
  vehiclesView: boolean; vehiclesAdd: boolean; vehiclesEdit: boolean; vehiclesDelete: boolean;
  alertsView: boolean; alertsAdd: boolean; alertsEdit: boolean; alertsDelete: boolean;
  geofencesView: boolean; geofencesAdd: boolean; geofencesEdit: boolean; geofencesDelete: boolean;
  poisView: boolean; poisAdd: boolean; poisEdit: boolean; poisDelete: boolean;
  maintenanceView: boolean | null; maintenanceAdd: boolean | null; maintenanceEdit: boolean | null; maintenanceDelete: boolean | null;
  driverBehaviorView: boolean | null; driverBehaviorEdit: boolean | null; reportsView: boolean | null;
  usersView: boolean | null; usersAdd: boolean | null; usersEdit: boolean | null; usersDelete: boolean | null;
  vehicleIds: string[] | null;
}

const DEFAULT_PERM: OrgPerm = {
  dashboardView: null, mapView: null, driverBehaviorView: null, driverBehaviorEdit: null, reportsView: null, usersView: null, usersAdd: null, usersEdit: null, usersDelete: null,
  vehiclesView: true, vehiclesAdd: false, vehiclesEdit: false, vehiclesDelete: false,
  alertsView: true, alertsAdd: true, alertsEdit: true, alertsDelete: false,
  geofencesView: true, geofencesAdd: true, geofencesEdit: true, geofencesDelete: false,
  poisView: true, poisAdd: true, poisEdit: true, poisDelete: false,
  maintenanceView: true, maintenanceAdd: false, maintenanceEdit: false, maintenanceDelete: false,
  vehicleIds: null,
};

const TEMPLATES: Record<string, OrgPerm> = {
  'View Only': { dashboardView: null, mapView: null, driverBehaviorView: null, driverBehaviorEdit: null, reportsView: null, usersView: null, usersAdd: null, usersEdit: null, usersDelete: null, vehiclesView: true, vehiclesAdd: false, vehiclesEdit: false, vehiclesDelete: false, alertsView: true, alertsAdd: false, alertsEdit: false, alertsDelete: false, geofencesView: true, geofencesAdd: false, geofencesEdit: false, geofencesDelete: false, poisView: true, poisAdd: false, poisEdit: false, poisDelete: false, maintenanceView: true, maintenanceAdd: false, maintenanceEdit: false, maintenanceDelete: false, vehicleIds: null },
  'Field Staff': { dashboardView: null, mapView: null, driverBehaviorView: null, driverBehaviorEdit: null, reportsView: null, usersView: null, usersAdd: null, usersEdit: null, usersDelete: null, vehiclesView: true, vehiclesAdd: false, vehiclesEdit: false, vehiclesDelete: false, alertsView: true, alertsAdd: true, alertsEdit: true, alertsDelete: false, geofencesView: true, geofencesAdd: true, geofencesEdit: true, geofencesDelete: false, poisView: true, poisAdd: true, poisEdit: true, poisDelete: false, maintenanceView: true, maintenanceAdd: true, maintenanceEdit: true, maintenanceDelete: false, vehicleIds: null },
  'Manager': { dashboardView: null, mapView: null, driverBehaviorView: null, driverBehaviorEdit: null, reportsView: null, usersView: null, usersAdd: null, usersEdit: null, usersDelete: null, vehiclesView: true, vehiclesAdd: true, vehiclesEdit: true, vehiclesDelete: false, alertsView: true, alertsAdd: true, alertsEdit: true, alertsDelete: false, geofencesView: true, geofencesAdd: true, geofencesEdit: true, geofencesDelete: false, poisView: true, poisAdd: true, poisEdit: true, poisDelete: false, maintenanceView: true, maintenanceAdd: true, maintenanceEdit: true, maintenanceDelete: true, vehicleIds: null },
};

const MODULES: { key: string; label: string; actions: PermAction[] }[] = [
  { key: 'dashboard', label: 'Dashboard', actions: ['View'] }, { key: 'map', label: 'Live Map', actions: ['View'] },
  { key: 'vehicles', label: 'Vehicles', actions: ['View', 'Add', 'Edit', 'Delete'] }, { key: 'alerts', label: 'Alerts', actions: ['View', 'Add', 'Edit', 'Delete'] },
  { key: 'geofences', label: 'Geofences', actions: ['View', 'Add', 'Edit', 'Delete'] }, { key: 'pois', label: 'POIs', actions: ['View', 'Add', 'Edit', 'Delete'] },
  { key: 'driverBehavior', label: 'Driver Behavior', actions: ['View', 'Edit'] }, { key: 'maintenance', label: 'Maintenance', actions: ['View', 'Add', 'Edit', 'Delete'] },
  { key: 'reports', label: 'Reports', actions: ['View'] }, { key: 'users', label: 'Users', actions: ['View', 'Add', 'Edit', 'Delete'] },
];
type PermAction = 'View' | 'Add' | 'Edit' | 'Delete';
const ACTIONS: PermAction[] = ['View', 'Add', 'Edit', 'Delete'];
const ACTION_COLOR: Record<PermAction, string> = { View: '#3b82f6', Add: '#16a34a', Edit: '#f59e0b', Delete: '#dc2626' };
function permKey(mod: string, action: PermAction): keyof OrgPerm { return `${mod}${action}` as keyof OrgPerm; }

const ORG_ROLES_B2B = ['client_owner', 'client_super_admin', 'client_admin'];
const CLIENT_ROLE_LEVEL: Record<string, number> = { client_owner: 4, client_super_admin: 3, client_admin: 2, client_user: 1 };
const ROLE_LABEL: Record<string, string> = { client_owner: 'Client Owner', client_super_admin: 'Client Super Admin', client_admin: 'Client Admin', client_user: 'Client User' };

function portalStatus(lastLoginAt: string | null): { label: string; color: string } {
  if (!lastLoginAt) return { label: 'Never', color: '#9ca3af' };
  const days = differenceInDays(new Date(), new Date(lastLoginAt));
  if (days <= 7) return { label: 'Active', color: '#16a34a' };
  if (days <= 30) return { label: 'Inactive', color: '#f59e0b' };
  return { label: 'Dormant', color: '#dc2626' };
}

const sel: React.CSSProperties = { height: 34, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const emptyForm = { clientType: 'b2b' as 'b2b' | 'b2c', firstName: '', lastName: '', email: '', password: '', role: 'client_super_admin', isActive: true, organizationId: '' };

// Searchable org selector component
function OrgSelector({ orgs, value, onChange, placeholder }: {
  orgs: Org[]; value: string; onChange: (id: string) => void; placeholder: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = orgs.find(o => o.id === value);
  const filtered = orgs.filter(o => {
    const lq = q.toLowerCase();
    return o.name.toLowerCase().includes(lq);
  });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...inputStyle, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'text', height: 34 }}
        onClick={() => setOpen(true)}>
        {selected
          ? <span style={{ fontSize: 13, color: 'var(--text)' }}>{selected.name}</span>
          : <span style={{ fontSize: 13, color: '#bbb' }}>{placeholder}</span>}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2 }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12.5, background: 'transparent', color: 'var(--text)' }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', color: '#bbb', fontSize: 12 }}>No results</div>
              : filtered.map(o => (
                <div key={o.id} onClick={() => { onChange(o.id); setQ(''); setOpen(false); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: o.id === value ? 'rgba(220,38,38,0.06)' : 'transparent', color: o.id === value ? '#dc2626' : 'var(--text)', fontWeight: o.id === value ? 600 : 400 }}
                  onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = 'var(--bg2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = o.id === value ? 'rgba(220,38,38,0.06)' : 'transparent'; }}>
                  {o.name}
                </div>
              ))}
          </div>
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />}
    </div>
  );
}

function OrgFilterSelect({ orgs, value, onChange }: { orgs: Org[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const current = orgs.find(o => o.id === value);
  const filtered = orgs.filter(o => o.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ ...sel, minWidth: 140, textAlign: 'left', fontWeight: 400 }}>
        {current?.name ?? 'All Orgs'}
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 600, top: 'calc(100% + 3px)', left: 0, minWidth: 230, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.16)' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search orgs…"
            style={{ ...inp, width: '100%', paddingLeft: 10, borderRadius: '6px 6px 0 0' }} />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <button type="button" onClick={() => { onChange(''); setQ(''); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, background: value === '' ? 'rgba(220,38,38,.06)' : 'transparent', textAlign: 'left', cursor: 'pointer', color: value === '' ? '#dc2626' : 'var(--text)', fontSize: 12 }}>
              All Orgs
            </button>
            {filtered.map(o => (
              <button key={o.id} type="button" onClick={() => { onChange(o.id); setQ(''); setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, borderTop: '1px solid var(--border2)', background: o.id === value ? 'rgba(220,38,38,.06)' : 'transparent', textAlign: 'left', cursor: 'pointer', color: o.id === value ? '#dc2626' : 'var(--text)', fontSize: 12 }}>
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ORG_ROLES_SET = new Set(['client_owner', 'client_super_admin', 'client_admin', 'client_user']);

export default function ClientUsersPage() {
  const { toast } = useToast();
  const { user: me, loginAs } = useAuth();
  const [searchParams] = useSearchParams();

  const { canOrgDo, perms: rolePermissions } = useOrgRolePerms();
  const meRole = me?.role ?? '';
  const isOrgScoped = ORG_ROLES_SET.has(meRole);

  // If logged-in user is an org role, lock the page to their org
  const myOrgId = isOrgScoped ? (me?.organizationId ?? null) : null;
  const cuCanAdd    = isOrgScoped ? canOrgDo(meRole, 'users', 'add')    : true;
  const cuCanEdit   = isOrgScoped ? canOrgDo(meRole, 'users', 'edit')   : true;
  const cuCanDelete = isOrgScoped ? canOrgDo(meRole, 'users', 'delete') : true;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [permissionRows, setPermissionRows] = useState<OrgPerm[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState(() => searchParams.get('org') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions'>('profile');
  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [perm, setPerm] = useState<OrgPerm>(DEFAULT_PERM);
  const [orgVehicles, setOrgVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<OrgUser | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState<OrgUser | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => {
    const orgParam = myOrgId ? `?organizationId=${myOrgId}` : '';
    Promise.all([
      api.get<OrgUser[]>(`/users/org-users${orgParam}`),
      api.get<Org[]>('/organizations'),
      !['super_admin', 'admin', 'ops'].includes(meRole) ? Promise.resolve({ data: [] as OrgPerm[] }) : api.get<OrgPerm[]>('/org-permissions/summary'),
    ]).then(([u, o, p]) => { setUsers(u.data); setOrgs(o.data); setPermissionRows(p.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (form.role !== 'client_owner' && form.organizationId) {
      api.get<Vehicle[]>(`/vehicles?organizationId=${form.organizationId}`)
        .then(r => setOrgVehicles(r.data)).catch(() => setOrgVehicles([]));
    } else {
      setOrgVehicles([]);
    }
  }, [form.role, form.organizationId]);

  const filteredOrgsByType = orgs.filter(o => o.type === form.clientType);
  const roleOptions = form.clientType === 'b2c'
    ? [{ value: 'client_user', label: 'Client User' }]
    : ORG_ROLES_B2B.map(r => ({ value: r, label: ROLE_LABEL[r] }));

  const openAdd = () => {
    const myOrg = myOrgId ? orgs.find(o => o.id === myOrgId) : null;
    setEditing(null);
    setForm({
      ...emptyForm,
      organizationId: myOrgId ?? '',
      clientType: myOrg?.type === 'b2c' ? 'b2c' : 'b2b',
      role: myOrg?.type === 'b2c' ? 'client_user' : 'client_super_admin',
    });
    setPerm(DEFAULT_PERM); setActiveTab('profile'); setModal(true);
  };
  const openEdit = async (u: OrgUser) => {
    setEditing(u);
    const org = orgs.find(o => o.id === u.organizationId);
    setForm({ clientType: (org?.type as 'b2b' | 'b2c') ?? 'b2b', firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email, password: '', role: u.role, isActive: u.isActive, organizationId: u.organizationId ?? '' });
    setActiveTab('profile');
    if (u.role !== 'client_owner') {
      try { const r = await api.get<OrgPerm>(`/org-permissions/${u.id}`); setPerm(r.data ?? DEFAULT_PERM); }
      catch { setPerm(DEFAULT_PERM); }
    } else { setPerm(DEFAULT_PERM); }
    setModal(true);
  };

  const set = (k: string, v: unknown) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'clientType') {
        updated.organizationId = '';
        updated.role = v === 'b2c' ? 'client_user' : 'client_super_admin';
      }
      if (k === 'organizationId') {
        // role already driven by clientType, no change needed
      }
      return updated;
    });
  };

  const togglePerm = (key: keyof OrgPerm) => {
    setPerm(p => {
      const newVal = !p[key];
      const updated = { ...p, [key]: newVal };
      if (!newVal && key.endsWith('View')) {
        const prefix = String(key).replace(/View$/, '');
        for (const action of ['Add', 'Edit', 'Delete']) { const actionKey = `${prefix}${action}` as keyof OrgPerm; if (actionKey in updated) (updated as unknown as Record<string, unknown>)[actionKey] = false; }
      }
      if (newVal && (key.endsWith('Add') || key.endsWith('Edit') || key.endsWith('Delete'))) {
        const viewKey = `${key.replace(/(Add|Edit|Delete)$/, '')}View` as keyof OrgPerm;
        updated[viewKey] = true as never;
      }
      return updated;
    });
  };

  const toggleVehicle = (id: string) => {
    setPerm(p => {
      const cur = p.vehicleIds ?? [];
      return { ...p, vehicleIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const org = orgs.find(o => o.id === form.organizationId);
      const cityId = org ? (orgs.find(o => o.id === org.id) as any)?.cityId ?? null : null;
      const payload: Record<string, unknown> = { ...form, organizationId: form.organizationId || null, cityId };
      if (!payload.password) delete payload.password;
      let userId = editing?.id;
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else { const r = await api.post<{ id: string }>('/users', payload); userId = r.data.id; }
      if (form.role !== 'client_owner' && userId && form.organizationId) {
        await api.put(`/org-permissions/${userId}`, { ...perm, orgId: form.organizationId });
      }
      await load(); setModal(false); setEditing(null);
      toast(editing ? 'User updated' : 'User added');
    } catch { toast('Failed to save user', 'error'); } finally { setSaving(false); }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try { await api.post(`/users/${revokeTarget.id}/revoke`); setRevokeTarget(null); await load(); toast('Access revoked'); }
    catch { toast('Failed to revoke access', 'error'); } finally { setRevoking(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try { await api.delete(`/users/${deleting.id}`); setUsers(u => u.filter(x => x.id !== deleting.id)); setDeleting(null); toast('User deleted'); }
    catch { toast('Failed to delete user', 'error'); } finally { setDeletingId(false); }
  };

  const handleLoginAs = async (u: OrgUser) => {
    try { await loginAs(u.id); }
    catch { toast('Failed to impersonate user', 'error'); }
  };

  const filtered = users.filter(u => {
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    if (q && !u.email.toLowerCase().includes(q.toLowerCase()) && !name.toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (orgFilter && u.organizationId !== orgFilter) return false;
    if (statusFilter && String(u.isActive) !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(u.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });
  const pagination = useTablePagination(filtered, JSON.stringify([q, roleFilter, orgFilter, statusFilter, dateRange?.from?.getTime(), dateRange?.to?.getTime()]));

  const exportCSV = () => {
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Organization', 'Status', 'Joined'];
    const csvRows = filtered.map(u => [u.displayId, u.firstName ?? '', u.lastName ?? '', u.email, u.role, orgs.find(o => o.id === u.organizationId)?.name ?? '', u.isActive ? 'Active' : 'Inactive', fmtDate(u.createdAt)]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `client-users-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const canAssignPermissions = form.role !== 'client_owner' && !!form.organizationId;
  const tabs = [{ key: 'profile' as const, label: 'Profile' }, ...(canAssignPermissions ? [{ key: 'permissions' as const, label: 'Permissions' }] : [])];

  const myOrg = myOrgId ? orgs.find(o => o.id === myOrgId) : null;
  const selectedOrg = !isOrgScoped && orgFilter ? orgs.find(o => o.id === orgFilter) : null;
  const selectedOrgIsB2C = selectedOrg?.type === 'b2c' || (isOrgScoped && me?.organizationType === 'b2c');
  const canShowAddUser = cuCanAdd && !selectedOrgIsB2C;
  const editableUser = (target: OrgUser) => target.role !== 'client_owner' && (['super_admin', 'admin', 'ops'].includes(meRole) || (isOrgScoped && cuCanEdit && (CLIENT_ROLE_LEVEL[target.role] ?? 0) < (CLIENT_ROLE_LEVEL[meRole] ?? 0)));
  const permissionCount = (target: OrgUser) => { const row = permissionRows.find(item => item.userId === target.id); const org = orgs.find(item => item.id === target.organizationId); const roleKey = target.role === 'client_user' && org?.type === 'b2c' ? 'client_user_b2c' : target.role; let allowed = 0; for (const mod of MODULES) { const feature = mod.key === 'driverBehavior' ? 'driver-behavior' : mod.key; const override = row?.[permKey(mod.key, 'View')]; if (target.role === 'client_owner' || (typeof override === 'boolean' ? override : !!rolePermissions[roleKey]?.[feature]?.includes('view'))) allowed++; } return allowed; };
  const openPermissions = async (target: OrgUser) => { if (!editableUser(target)) return; await openEdit(target); setActiveTab('permissions'); };

  return (
    <div>
      <PageHeader
        title={isOrgScoped ? `${myOrg?.name ?? 'My Org'} — Users` : 'Client Users'}
        count={users.length}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 8, background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <IconDownload size={13} /> Export
            </button>
            {canShowAddUser ? (
              <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                <IconPlus size={13} /> Add User
              </button>
            ) : selectedOrgIsB2C ? (
              <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>Individual account</span>
            ) : null}
          </div>
        }
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <CustomSelect value={roleFilter} onChange={setRoleFilter} options={[
          { value: '', label: 'All Roles' }, { value: 'client_owner', label: 'Client Owner' },
          { value: 'client_super_admin', label: 'Client Super Admin' }, { value: 'client_admin', label: 'Client Admin' },
          { value: 'client_user', label: 'Client User' },
        ]} minWidth={150} />
        {!isOrgScoped && (
          <OrgFilterSelect orgs={orgs} value={orgFilter} onChange={setOrgFilter} />
        )}
        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'All Status' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
        ]} />
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Joined date" />
        {(q || roleFilter || orgFilter || statusFilter || dateRange) && (
          <button onClick={() => { setQ(''); setRoleFilter(''); setOrgFilter(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={9} /> : (
        <div className="tbl-wrap page-table">
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Name', 'Email', 'Role', 'Organization', 'Portal Status', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagination.pagedItems.map(u => {
                const ps = portalStatus(u.lastLoginAt);
                const org = orgs.find(o => o.id === u.organizationId);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${u.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                    <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{u.displayId}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{u.email}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: u.role === 'client_owner' ? 'rgba(139,92,246,0.1)' : u.role === 'client_super_admin' ? 'rgba(59,130,246,0.1)' : u.role === 'client_admin' ? 'rgba(22,163,74,0.1)' : 'rgba(156,163,175,0.15)', color: u.role === 'client_owner' ? '#7c3aed' : u.role === 'client_super_admin' ? '#2563eb' : u.role === 'client_admin' ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{org?.name ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${ps.color}18`, color: ps.color, fontWeight: 600 }}>
                        {ps.label}
                      </span>
                      {u.lastLoginAt && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{fmtDate(u.lastLoginAt)}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: u.isActive ? '#16a34a' : 'var(--muted)' }}>{u.isActive ? 'Active' : 'Inactive'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {editableUser(u) && <button onClick={() => void openPermissions(u)} title="Manage page permissions" aria-label="Manage page permissions" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconShieldCheck size={14} /><span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{permissionCount(u)}/10</span></button>}
                        {cuCanEdit && <button onClick={() => openEdit(u)} title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>}
                        {me?.role === 'super_admin' && !isOrgScoped && (
                          <button onClick={() => handleLoginAs(u)} title="Login as this user" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconUserScan size={14} /></button>
                        )}
                        <button onClick={() => setRevokeTarget(u)} title="Revoke access (force logout)" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconBan size={14} /></button>
                        {cuCanDelete && u.id !== me?.id && (
                          <button onClick={() => setDeleting(u)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No client users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && <TablePagination page={pagination.page} pageSize={pagination.pageSize} total={filtered.length} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}

      {/* Add/Edit Modal */}
      <Modal open={modal} title={editing ? 'Edit Client User' : 'Add Client User'} onClose={() => { setModal(false); setEditing(null); }} width='min(1200px, 97vw)' height='min(800px, 96vh)'>
        {canAssignPermissions && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? '#dc2626' : 'var(--muted)', borderBottom: `2px solid ${activeTab === t.key ? '#dc2626' : 'transparent'}`, transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {activeTab === 'profile' && (
            <>
              {/* Client Type + Org selector — hidden when org-scoped */}
              {!isOrgScoped && (
                <>
                  <FormField label="Client Type">
                    <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
                      {(['b2b', 'b2c'] as const).map(t => (
                        <button key={t} type="button" onClick={() => set('clientType', t)}
                          style={{ padding: '6px 20px', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: form.clientType === t ? '#dc2626' : 'var(--bg2)', color: form.clientType === t ? '#fff' : 'var(--text2)', transition: 'all 0.15s' }}>
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </FormField>
                  <FormField label={form.clientType === 'b2b' ? 'Company *' : 'Client *'}>
                    <OrgSelector
                      orgs={filteredOrgsByType}
                      value={form.organizationId}
                      onChange={id => set('organizationId', id)}
                      placeholder={form.clientType === 'b2b' ? 'Search company name…' : 'Search client name…'}
                    />
                  </FormField>
                </>
              )}

              {/* Role — B2B: dropdown, B2C: read-only */}
              <FormField label="Role">
                {form.clientType === 'b2c'
                  ? <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: 'var(--muted)', fontSize: 13, height: 34, padding: '0 8px' }}>Client User (B2C)</div>
                  : <select value={form.role} onChange={e => set('role', e.target.value)} style={selectStyle}>
                      {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                }
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="First Name">
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Ali" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
                </FormField>
                <FormField label="Last Name">
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Hassan" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
                </FormField>
              </div>
              <FormField label="Email *">
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@company.com" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
              </FormField>
              <FormField label={editing ? 'New Password (leave blank to keep)' : 'Password *'}>
                <input type="password" required={!editing} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
              </FormField>
              <FormField label="Status">
                <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </FormField>
            </>
          )}

          {activeTab === 'permissions' && (
            <div>
              {/* Templates */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Permission Templates</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {Object.keys(TEMPLATES).map(name => (
                  <button key={name} type="button" onClick={() => setPerm(TEMPLATES[name])}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 500 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}>
                    {name}
                  </button>
                ))}
              </div>

              {/* Module CRUD table */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Module Permissions</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '7px 0', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11 }}>Module</th>
                    {ACTIONS.map(a => <th key={a} style={{ padding: '7px 8px', textAlign: 'center', color: ACTION_COLOR[a], fontWeight: 700, fontSize: 11, textTransform: 'uppercase', width: 54 }}>{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '8px 0', fontWeight: 500 }}>{mod.label}</td>
                      {mod.actions.map(action => {
                        const k = permKey(mod.key, action);
                        const on = perm[k] as boolean;
                        return (
                          <td key={action} style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <button type="button" onClick={() => togglePerm(k)}
                              style={{ width: 26, height: 26, borderRadius: 5, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', margin: '0 auto', background: on ? `${ACTION_COLOR[action]}18` : 'var(--bg3)', color: on ? ACTION_COLOR[action] : '#ccc', transition: 'all 0.15s' }}>
                              {on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Vehicle access */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Vehicle Access</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="radio" name="vehicleAccess" checked={perm.vehicleIds === null} onChange={() => setPerm(p => ({ ...p, vehicleIds: null }))} style={{ accentColor: '#dc2626' }} />
                  All org vehicles
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="vehicleAccess" checked={perm.vehicleIds !== null} onChange={() => setPerm(p => ({ ...p, vehicleIds: [] }))} style={{ accentColor: '#dc2626' }} />
                  Specific vehicles only
                </label>
              </div>
              {perm.vehicleIds !== null && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                  {orgVehicles.length === 0
                    ? <div style={{ padding: '12px 8px', color: '#bbb', fontSize: 12 }}>No vehicles found — select an organization first</div>
                    : orgVehicles.map(v => {
                        const label = v.licensePlate ?? (`${v.make ?? ''} ${v.model ?? ''}`.trim() || `#${v.displayId}`);
                        const checked = (perm.vehicleIds ?? []).includes(v.id);
                        return (
                          <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 4, background: checked ? 'rgba(220,38,38,0.05)' : 'transparent' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleVehicle(v.id)} style={{ accentColor: '#dc2626' }} />
                            <span style={{ fontSize: 12.5, color: checked ? '#dc2626' : 'var(--text)', fontWeight: checked ? 600 : 400 }}>{label}</span>
                          </label>
                        );
                      })}
                </div>
              )}
            </div>
          )}

          <FormActions onClose={() => { setModal(false); setEditing(null); }} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Portal Access"
        message={`This will immediately log out "${revokeTarget?.email}" from all devices. Their account stays active but they must log in again. Continue?`}
        onConfirm={handleRevoke}
        onClose={() => setRevokeTarget(null)}
        loading={revoking}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete User"
        message={`Delete "${deleting?.email}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
        loading={deletingId}
      />
    </div>
  );
}
