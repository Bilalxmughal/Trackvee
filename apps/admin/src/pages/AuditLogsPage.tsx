import { useEffect, useState, useCallback } from 'react';
import { IconSearch, IconDownload, IconRefresh } from '@tabler/icons-react';
import { endOfDay } from 'date-fns';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import PageHeader from '../components/PageHeader';
import TablePagination from '../components/TablePagination';
import SkeletonTable from '../components/SkeletonTable';
import DateRangePicker from '../components/DateRangePicker';
import type { DateRange } from '../components/DateRangePicker';
import CustomSelect from '../components/CustomSelect';

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

const inp: React.CSSProperties = {
  height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)',
  borderRadius: 6, fontSize: 12, color: 'var(--input-color)', outline: 'none',
  background: 'var(--input-bg)',
};
const flat = (color: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, color,
});

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [actors, setActors] = useState<Actor[]>([]);
  const [orgs, setOrgs]   = useState<Org[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<Actor[]>('/audit-logs/actors').then(r => setActors(r.data)).catch(() => {});
    api.get<Org[]>('/organizations').then(r => setOrgs(r.data)).catch(() => {});
  }, []);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const p: Record<string, string> = {};
    if (q)                p.search     = q;
    if (actionFilter)     p.action     = actionFilter;
    if (entityFilter)     p.entityType = entityFilter;
    if (actorFilter)      p.userId     = actorFilter;
    if (clientFilter)     p.orgId      = clientFilter;
    if (statusFilter)     p.status     = statusFilter;
    if (dateRange?.from)  p.from       = dateRange.from.toISOString();
    if (dateRange?.to)    p.to         = endOfDay(dateRange.to).toISOString();
    return { ...p, ...extra };
  }, [q, actionFilter, entityFilter, actorFilter, clientFilter, statusFilter, dateRange]);

  const load = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const params = buildParams({ limit: String(pageSize), offset: String(pg * pageSize) });
      const qs = '?' + new URLSearchParams(params).toString();
      const r = await api.get<{ data: AuditLog[]; total: number }>(`/audit-logs${qs}`);
      setLogs(r.data.data);
      setTotal(r.data.total);
      setPage(pg);
    } finally {
      setLoading(false);
    }
  }, [buildParams, pageSize]);

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

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader title="Audit Logs" count={total} />

      {/* Filters row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px 14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input style={{ ...inp, width: 200 }} placeholder="Search name, user, ID..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <CustomSelect value={actionFilter} onChange={setActionFilter} options={[
          { value: '', label: 'All Actions' },
          ...Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v })),
        ]} />

        <CustomSelect value={entityFilter} onChange={setEntityFilter} options={[
          { value: '', label: 'All Entity Types' },
          ...Object.entries(ENTITY_LABELS).map(([k, v]) => ({ value: k, label: v })),
        ]} minWidth={140} />

        <CustomSelect value={actorFilter} onChange={setActorFilter} options={[
          { value: '', label: 'All Users' },
          ...actors.map(a => ({ value: a.id, label: a.name || a.email })),
        ]} minWidth={140} />

        <CustomSelect value={clientFilter} onChange={setClientFilter} options={[
          { value: '', label: 'All Clients' },
          ...orgs.map(o => ({ value: o.id, label: o.name })),
        ]} minWidth={140} />

        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'All Statuses' }, { value: 'success', label: 'Success' }, { value: 'failed', label: 'Failed' },
        ]} />

        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Date range" />

        <button onClick={() => load(0)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, background: 'var(--input-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
          <IconRefresh size={13} />
        </button>

        <button onClick={handleExport} disabled={exporting} style={{ height: 34, padding: '0 12px', border: '1px solid #dc2626', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', fontWeight: 500, marginLeft: 'auto' }}>
          <IconDownload size={13} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', padding: '0 20px', maxHeight: 'calc(100vh - 310px)' }}>
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

      <TablePagination page={page + 1} pageSize={pageSize} total={total}
        onPageChange={nextPage => { void load(nextPage - 1); }} onPageSizeChange={setPageSize} />
    </div>
  );
}
