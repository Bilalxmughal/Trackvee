import { useCallback, useEffect, useState } from 'react';
import {
  IconRefresh, IconBuildingBank, IconReceipt, IconCreditCard,
  IconAlertCircle, IconCircleCheck, IconClock, IconChevronDown, IconX,
} from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';

interface OrgSummary { id: string; name: string; }
interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  description: string | null;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  createdAt: string;
  org: { id: string; name: string } | null;
}
interface Payment {
  id: string;
  paymentNo: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  description: string | null;
  org: { id: string; name: string } | null;
}

const STATUS_COLOR: Record<Invoice['status'], string> = {
  draft: '#6b7280', sent: '#2563eb', paid: '#16a34a', overdue: '#dc2626', cancelled: '#9ca3af',
};
const STATUS_LABEL: Record<Invoice['status'], string> = {
  draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
};

function fmtDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function OrgBillingPage() {
  const { dark } = useTheme();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ items: OrgSummary[] }>('/organizations?limit=200').then(r => {
      setOrgs(Array.isArray(r.data) ? r.data : (r.data as any).items ?? []);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, payRes] = await Promise.all([
        api.get<{ items: Invoice[]; total: number }>(`/billing/invoices?${selectedOrg ? `orgId=${selectedOrg}&` : ''}limit=200${statusFilter ? `&status=${statusFilter}` : ''}`),
        api.get<{ items: Payment[]; total: number }>(`/billing/payments?${selectedOrg ? `orgId=${selectedOrg}&` : ''}limit=100`),
      ]);
      setInvoices((invRes.data as any).items ?? []);
      setPayments((payRes.data as any).items ?? []);
    } catch {
      setError('Could not load billing data.');
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft').reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const draftCount = invoices.filter(i => i.status === 'draft').length;

  const card = { background: dark ? '#1e1e2e' : '#fff', border: `1px solid ${dark ? '#2d2d3d' : '#e5e7eb'}`, borderRadius: 10 };
  const kpiVal = { fontSize: 22, fontWeight: 700, color: dark ? '#f3f4f6' : '#111827', marginTop: 4 };
  const kpiLabel = { fontSize: 11, color: dark ? '#9ca3af' : '#6b7280', fontWeight: 600 };
  const cell = { padding: '10px 14px', fontSize: 12.5, color: dark ? '#d1d5db' : '#374151', borderBottom: `1px solid ${dark ? '#2d2d3d' : '#f3f4f6'}`, whiteSpace: 'nowrap' as const };
  const th = { ...cell, fontWeight: 700, color: dark ? '#9ca3af' : '#6b7280', fontSize: 11, background: dark ? '#161622' : '#f9fafb', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title="Org Billing Dashboard"
        subtitle="Invoices and payment overview across all organizations"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
                style={{ appearance: 'none', padding: '6px 30px 6px 10px', borderRadius: 7, border: `1px solid ${dark ? '#3d3d4d' : '#d1d5db'}`, background: dark ? '#1e1e2e' : '#fff', color: dark ? '#f3f4f6' : '#111', fontSize: 13, cursor: 'pointer' }}>
                <option value="">All Organizations</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <IconChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: dark ? '#9ca3af' : '#6b7280' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ appearance: 'none', padding: '6px 30px 6px 10px', borderRadius: 7, border: `1px solid ${dark ? '#3d3d4d' : '#d1d5db'}`, background: dark ? '#1e1e2e' : '#fff', color: dark ? '#f3f4f6' : '#111', fontSize: 13, cursor: 'pointer' }}>
                <option value="">All Statuses</option>
                {(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as Invoice['status'][]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <IconChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: dark ? '#9ca3af' : '#6b7280' }} />
            </div>
            <button onClick={() => { void load(); }} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${dark ? '#3d3d4d' : '#d1d5db'}`, background: 'transparent', color: dark ? '#d1d5db' : '#374151', fontSize: 13, cursor: 'pointer' }}>
              <IconRefresh size={15} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          <IconAlertCircle size={16} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><IconX size={14} /></button>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Outstanding Balance', value: fmtCurrency(outstanding), icon: <IconBuildingBank size={18} color="#2563eb" />, bg: dark ? '#1e2a3a' : '#eff6ff' },
          { label: 'Total Collected', value: fmtCurrency(totalPaid), icon: <IconCircleCheck size={18} color="#16a34a" />, bg: dark ? '#1a2e1a' : '#f0fdf4' },
          { label: 'Overdue Invoices', value: String(overdueCount), icon: <IconAlertCircle size={18} color="#dc2626" />, bg: dark ? '#2e1a1a' : '#fef2f2' },
          { label: 'Draft Invoices', value: String(draftCount), icon: <IconClock size={18} color="#f59e0b" />, bg: dark ? '#2e261a' : '#fffbeb' },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: k.bg, padding: 8, borderRadius: 8, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={kpiLabel}>{k.label}</div>
              <div style={kpiVal}>{loading ? '—' : k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Invoices Table */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${dark ? '#2d2d3d' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconReceipt size={16} color={dark ? '#9ca3af' : '#6b7280'} />
          <span style={{ fontWeight: 700, fontSize: 14, color: dark ? '#f3f4f6' : '#111827' }}>Invoices</span>
          <span style={{ marginLeft: 6, background: dark ? '#2d2d3d' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{invoices.length}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Invoice #', 'Organization', 'Type', 'Description', 'Amount', 'Status', 'Due Date', 'Period'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', padding: 32, color: dark ? '#6b7280' : '#9ca3af' }}>Loading…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', padding: 32, color: dark ? '#6b7280' : '#9ca3af' }}>No invoices found</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...cell, fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNo}</td>
                  <td style={cell}>{inv.org?.name ?? '—'}</td>
                  <td style={{ ...cell, textTransform: 'capitalize' }}>{inv.type}</td>
                  <td style={{ ...cell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.description || '—'}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>{fmtCurrency(inv.totalAmount)}</td>
                  <td style={cell}>
                    <span style={{ background: `${STATUS_COLOR[inv.status]}20`, color: STATUS_COLOR[inv.status], padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </td>
                  <td style={{ ...cell, color: inv.status === 'overdue' ? '#dc2626' : undefined, fontWeight: inv.status === 'overdue' ? 600 : undefined }}>
                    {fmtDate(inv.dueDate)}
                  </td>
                  <td style={cell}>
                    {inv.periodFrom ? `${fmtDate(inv.periodFrom)} – ${fmtDate(inv.periodTo)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments Table */}
      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${dark ? '#2d2d3d' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCreditCard size={16} color={dark ? '#9ca3af' : '#6b7280'} />
          <span style={{ fontWeight: 700, fontSize: 14, color: dark ? '#f3f4f6' : '#111827' }}>Recent Payments</span>
          <span style={{ marginLeft: 6, background: dark ? '#2d2d3d' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{payments.length}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Payment #', 'Organization', 'Date', 'Amount', 'Method', 'Notes'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...cell, textAlign: 'center', padding: 32, color: dark ? '#6b7280' : '#9ca3af' }}>Loading…</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={6} style={{ ...cell, textAlign: 'center', padding: 32, color: dark ? '#6b7280' : '#9ca3af' }}>No payments found</td></tr>
              ) : payments.map(p => (
                <tr key={p.id}>
                  <td style={{ ...cell, fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{p.paymentNo}</td>
                  <td style={cell}>{p.org?.name ?? '—'}</td>
                  <td style={cell}>{fmtDate(p.paymentDate)}</td>
                  <td style={{ ...cell, fontWeight: 600, color: '#16a34a' }}>{fmtCurrency(p.amount)}</td>
                  <td style={{ ...cell, textTransform: 'capitalize' }}>{p.method ?? '—'}</td>
                  <td style={cell}>{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
