import { useEffect, useState, useCallback } from 'react';
import { IconSearch, IconDownload, IconRefresh } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import PageHeader from '../components/PageHeader';
import SkeletonTable from '../components/SkeletonTable';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  orgId: string | null;
  orgName: string | null;
  ip: string | null;
  status: 'success' | 'failed';
  details: Record<string, unknown> | null;
}

interface Actor { id: string; email: string; name: string; }
interface Org   { id: string; name: string; }

const ACTION_LABELS: Record<string, string> = {
  create: 'Create', update: 'Update', delete: 'Delete',
  login: 'Login', command: 'Command', export: 'Export',
};
const ENTITY_LABELS: Record<string, string> = {
  alert: 'Alert', geofence: 'Geofence', vehicle: 'Vehicle', device: 'Device',
  user: 'User', organization: 'Organization', poi: 'POI',
  speed_zone: 'Speed Zone', session: 'Session',
};
const ACTION_COLOR: Record<string, string> = {
  create: '#16a34a', update: '#f59e0b', delete: '#dc2626',
  login: '#3b82f6', command: '#7c3aed', export: '#0891b2',
};
const STATUS_COLOR: Record<string, string> = {
  success: '#16a34a', failed: '#dc2626',
};

const sel: React.CSSProperties = {
  height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
  borderRadius: 3, fontSize: 12, color: 'var(--input-color)',
  background: 'var(--input-bg)', outline: 'none', cursor: 'pointer',
};
const inp: React.CSSProperties = {
  height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)',
  borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none',
  background: 'var(--input-bg)',
};
const dateInp: React.CSSProperties = {
  height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
  borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none',
  background: 'var(--input-bg)',
};
const flat = (color: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, color,
});

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]   = useState('');

  const [actors, setActors] = useState<Actor[]>([]);
  const [orgs, setOrgs]   = useState<Org[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<Actor[]>('/audit-logs/actors').then(r => setActors(r.data)).catch(() => {});
    api.get<Org[]>('/organizations').then(r => setOrgs(r.data)).catch(() => {});
  }, []);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const p: Record<string, string> = {};
    if (q)            p.search     = q;
    if (actionFilter) p.action     = actionFilter;
    if (entityFilter) p.entityType = entityFilter;
    if (actorFilter)  p.userId     = actorFilter;
    if (clientFilter) p.orgId      = clientFilter;
    if (statusFilter) p.status     = statusFilter;
    if (fromDate)     p.from       = new Date(fromDate).toISOString();
    if (toDate)       p.to         = new Date(toDate + 'T23:59:59').toISOString();
    return { ...p, ...extra };
  }, [q, actionFilter, entityFilter, actorFilter, clientFilter, statusFilter, fromDate, toDate]);

  const load = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const params = buildParams({ limit: String(PAGE_SIZE), offset: String(pg * PAGE_SIZE) });
      const qs = '?' + new URLSearchParams(params).toString();
      const r = await api.get<{ data: AuditLog[]; total: number }>(`/audit-logs${qs}`);
      setLogs(r.data.data);
      setTotal(r.data.total);
      setPage(pg);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(0); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      const qs = '?' + new URLSearchParams(params).toString();
      const r = await api.get(`/audit-logs/export${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader title="Audit Logs" count={total} />

      {/* Filters row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px 14px', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input style={{ ...inp, width: 200 }} placeholder="Search name, user, ID..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {/* Action */}
        <select style={sel} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Entity Type */}
        <select style={sel} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="">All Entity Types</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Actor */}
        <select style={sel} value={actorFilter} onChange={e => setActorFilter(e.target.value)}>
          <option value="">All Users</option>
          {actors.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
        </select>

        {/* Client */}
        <select style={sel} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        {/* Status */}
        <select style={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>

        {/* Date range */}
        <input type="date" style={dateInp} value={fromDate} onChange={e => setFromDate(e.target.value)} title="From date" />
        <input type="date" style={dateInp} value={toDate}   onChange={e => setToDate(e.target.value)}   title="To date" />

        {/* Refresh */}
        <button onClick={() => load(0)} style={{ height: 30, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 3, background: 'var(--input-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
          <IconRefresh size={13} />
        </button>

        {/* Export */}
        <button onClick={handleExport} disabled={exporting} style={{ height: 30, padding: '0 12px', border: '1px solid #dc2626', borderRadius: 3, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', fontWeight: 500, marginLeft: 'auto' }}>
          <IconDownload size={13} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', padding: '0 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--table-border)' }}>
              {['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'User', 'Role', 'Client', 'IP', 'Status'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}><SkeletonTable rows={10} cols={9} /></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--table-border)' }}>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(log.timestamp)}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={flat(ACTION_COLOR[log.action] ?? '#888')}>{ACTION_LABELS[log.action] ?? log.action}</span>
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                <td style={{ padding: '7px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.entityName ?? log.entityId ?? ''}>
                  {log.entityName ?? log.entityId ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 500 }}>{log.userName || log.userEmail || '—'}</div>
                  {log.userName && log.userEmail && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.userEmail}</div>}
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.userRole ?? '—'}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.orgName ?? '—'}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.ip ?? '—'}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={flat(STATUS_COLOR[log.status] ?? '#888')}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          <button disabled={page === 0} onClick={() => load(page - 1)} style={{ height: 26, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 3, background: 'var(--input-bg)', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, color: 'var(--input-color)', opacity: page === 0 ? 0.4 : 1 }}>Prev</button>
          <span>Page {page + 1} of {totalPages} ({total.toLocaleString()} total)</span>
          <button disabled={page + 1 >= totalPages} onClick={() => load(page + 1)} style={{ height: 26, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 3, background: 'var(--input-bg)', cursor: page + 1 >= totalPages ? 'default' : 'pointer', fontSize: 12, color: 'var(--input-color)', opacity: page + 1 >= totalPages ? 0.4 : 1 }}>Next</button>
        </div>
      )}
    </div>
  );
}
