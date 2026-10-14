import { useEffect, useState, useCallback } from 'react';
import { IconPlus, IconCash, IconX, IconFileInvoice, IconRefresh } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';
import api from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import DateRangePicker from '../components/DateRangePicker';
import type { DateRange } from '../components/DateRangePicker';

interface Org { id: string; name: string; companyName: string | null; type: string; }

interface LedgerEntry {
  date: string; refNo: string; description: string;
  debit: number; credit: number; balance: number;
  type: 'invoice' | 'payment'; status?: string;
  deviceId?: string; vehicleId?: string;
}

interface Statement {
  ledger: LedgerEntry[];
  summary: { totalBilled: number; totalPaid: number; outstanding: number; invoiceCount: number; paymentCount: number; };
}

interface ActivityType { id: string; name: string; charge: number; }

const INVOICE_TYPES = [
  { value: 'monthly_subscription', label: 'Monthly Subscription' },
  { value: 'device_sale', label: 'Device Sale' },
  { value: 'installation', label: 'Installation' },
  { value: 'removal', label: 'Removal' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'reactivation', label: 'Reactivation' },
  { value: 'activity', label: 'Activity Charge' },
  { value: 'manual', label: 'Manual Charge' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(INVOICE_TYPES.map(t => [t.value, t.label]));
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', online: 'Online', other: 'Other',
};

function fmt(n: number) {
  return 'Rs. ' + Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientStatementsPage() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const role = (user?.role ?? 'viewer') as UserRole;
  const canAdd = canPerformAction(role, 'financial-statements', 'add');

  const bg = dark ? '#141414' : '#f5f5f5';
  const card = dark ? '#1e1e1e' : '#fff';
  const border = dark ? '#2a2a2a' : '#e5e5e5';
  const text = dark ? '#e5e5e5' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const inputBg = dark ? '#252525' : '#fafafa';
  const rowHover = dark ? '#242424' : '#fafafa';

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [invForm, setInvForm] = useState({ type: 'manual', baseAmount: '', taxAmount: '0', description: '', dueDate: '', notes: '', status: 'draft' });
  const [pmtForm, setPmtForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: '', method: 'cash', referenceNo: '', description: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/organizations?limit=500').then(r => setOrgs(r.data.items ?? r.data));
    api.get('/billing/pricing/activities').then(r => setActivityTypes(r.data.filter((a: any) => a.isActive)));
  }, []);

  const loadStatement = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set('from', dateRange.from.toISOString().slice(0, 10));
      if (dateRange?.to) params.set('to', dateRange.to.toISOString().slice(0, 10));
      const r = await api.get(`/billing/statement/${selectedOrg.id}?${params}`);
      setStatement(r.data);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, dateRange]);

  useEffect(() => { loadStatement(); }, [loadStatement]);

  const handleCreateInvoice = async () => {
    if (!selectedOrg) return;
    setSubmitting(true);
    try {
      const base = parseFloat(invForm.baseAmount) || 0;
      const tax = parseFloat(invForm.taxAmount) || 0;
      await api.post('/billing/invoices', {
        orgId: selectedOrg.id,
        type: invForm.type,
        baseAmount: base, taxAmount: tax,
        description: invForm.description || undefined,
        dueDate: invForm.dueDate || undefined,
        notes: invForm.notes || undefined,
        status: invForm.status,
      });
      setShowInvoiceModal(false);
      setInvForm({ type: 'manual', baseAmount: '', taxAmount: '0', description: '', dueDate: '', notes: '', status: 'draft' });
      loadStatement();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedOrg) return;
    setSubmitting(true);
    try {
      await api.post('/billing/payments', {
        orgId: selectedOrg.id,
        paymentDate: pmtForm.paymentDate,
        amount: parseFloat(pmtForm.amount) || 0,
        method: pmtForm.method,
        referenceNo: pmtForm.referenceNo || undefined,
        description: pmtForm.description || undefined,
        notes: pmtForm.notes || undefined,
      });
      setShowPaymentModal(false);
      setPmtForm({ paymentDate: new Date().toISOString().slice(0, 10), amount: '', method: 'cash', referenceNo: '', description: '', notes: '' });
      loadStatement();
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: `1px solid ${border}`,
    borderRadius: 6, background: inputBg, color: text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const statusColor: Record<string, string> = {
    draft: '#888', sent: '#3b82f6', paid: '#16a34a', overdue: '#dc2626', cancelled: '#888',
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px 28px' }}>
      <PageHeader title="Client Statements" subtitle="Invoices, payments, and running balance per client">
        {canAdd && selectedOrg && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowInvoiceModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: `1px solid ${border}`, borderRadius: 7, color: text, fontSize: 13, cursor: 'pointer' }}>
              <IconPlus size={14} /> Add Invoice
            </button>
            <button onClick={() => setShowPaymentModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <IconCash size={14} /> Record Payment
            </button>
          </div>
        )}
      </PageHeader>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 260 }}>
          <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Client</div>
          <SearchableSelect
            value={selectedOrg?.id ?? ''}
            onChange={v => setSelectedOrg(orgs.find(o => o.id === v) ?? null)}
            options={orgs.map(o => ({ value: o.id, label: o.companyName ?? o.name }))}
            placeholder="Search client..."
            emptyLabel="— No client —"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Date Range</div>
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="All time" />
        </div>
        <button onClick={loadStatement} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${border}`, borderRadius: 6, color: text, cursor: 'pointer' }}>
          <IconRefresh size={15} />
        </button>
      </div>

      {!selectedOrg && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 40, textAlign: 'center', color: sub }}>
          <IconFileInvoice size={36} strokeWidth={1.25} style={{ marginBottom: 10, opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>Select a client to view their statement</div>
        </div>
      )}

      {selectedOrg && statement && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Billed', value: statement.summary.totalBilled, color: text },
              { label: 'Total Paid', value: statement.summary.totalPaid, color: '#16a34a' },
              { label: 'Outstanding', value: statement.summary.outstanding, color: statement.summary.outstanding > 0 ? '#dc2626' : '#16a34a' },
            ].map(c => (
              <div key={c.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: sub, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>

          {/* Ledger Table */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: sub, fontSize: 13 }}>Loading...</div>
            )}
            {!loading && statement.ledger.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: sub, fontSize: 13 }}>No transactions found</div>
            )}
            {!loading && statement.ledger.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: dark ? '#252525' : '#f9f9f9' }}>
                    {['Date', 'Ref No', 'Description', 'Debit', 'Credit', 'Balance', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: sub, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.ledger.map((entry, i) => (
                    <tr key={i}
                      style={{ borderBottom: `1px solid ${border}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '9px 14px', fontSize: 12, color: sub }}>{fmtDate(entry.date)}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: '#3b82f6', fontWeight: 500 }}>{entry.refNo}</td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: text }}>{entry.description}</td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: entry.debit > 0 ? '#dc2626' : sub, fontWeight: entry.debit > 0 ? 600 : 400 }}>
                        {entry.debit > 0 ? fmt(entry.debit) : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: entry.credit > 0 ? '#16a34a' : sub, fontWeight: entry.credit > 0 ? 600 : 400 }}>
                        {entry.credit > 0 ? fmt(entry.credit) : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: entry.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmt(entry.balance)}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {entry.status && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: statusColor[entry.status] + '22', color: statusColor[entry.status], fontWeight: 600 }}>
                            {entry.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add Invoice Modal */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, width: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: text }}>Add Invoice</div>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub }}><IconX size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Type</div>
                <select value={invForm.type} onChange={e => setInvForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                  {INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Description</div>
                <input value={invForm.description} onChange={e => setInvForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Monthly subscription — Oct 2026" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Amount (Rs.)</div>
                  <input type="number" min={0} value={invForm.baseAmount} onChange={e => setInvForm(p => ({ ...p, baseAmount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Tax (Rs.)</div>
                  <input type="number" min={0} value={invForm.taxAmount} onChange={e => setInvForm(p => ({ ...p, taxAmount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Due Date</div>
                  <input type="date" value={invForm.dueDate} onChange={e => setInvForm(p => ({ ...p, dueDate: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Status</div>
                  <select value={invForm.status} onChange={e => setInvForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>
                  {fmt((parseFloat(invForm.baseAmount) || 0) + (parseFloat(invForm.taxAmount) || 0))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowInvoiceModal(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${border}`, borderRadius: 7, color: text, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleCreateInvoice} disabled={submitting || !invForm.baseAmount} style={{ flex: 1, padding: '9px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Saving...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, width: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: text }}>Record Payment</div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub }}><IconX size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Date</div>
                  <input type="date" value={pmtForm.paymentDate} onChange={e => setPmtForm(p => ({ ...p, paymentDate: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Amount (Rs.)</div>
                  <input type="number" min={0} value={pmtForm.amount} onChange={e => setPmtForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Method</div>
                <select value={pmtForm.method} onChange={e => setPmtForm(p => ({ ...p, method: e.target.value }))} style={inputStyle}>
                  {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Reference No (Cheque / Transaction ID)</div>
                <input value={pmtForm.referenceNo} onChange={e => setPmtForm(p => ({ ...p, referenceNo: e.target.value }))} placeholder="Optional" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Description</div>
                <input value={pmtForm.description} onChange={e => setPmtForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${border}`, borderRadius: 7, color: text, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleCreatePayment} disabled={submitting || !pmtForm.amount} style={{ flex: 1, padding: '9px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
