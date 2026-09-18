import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconEdit, IconTrash, IconMapPin } from '@tabler/icons-react';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import { useTheme } from '../contexts/ThemeContext';

interface City { id: string; displayId: number; name: string; province: string | null; isActive: boolean; createdAt: string; }

type Tab = 'cities';

const empty = { name: '', province: '', isActive: true };

export default function SettingsPage() {
  const { dark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('cities');

  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);
  const [form, setForm] = useState<{ name: string; province: string; isActive: boolean }>(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<City | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => api.get<City[]>('/cities').then(r => setCities(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: City) => { setEditing(c); setForm({ name: c.name, province: c.province ?? '', isActive: c.isActive }); setModal(true); };
  const closeModal = () => { setModal(false); setEditing(null); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, province: form.province || null };
      if (editing) await api.patch(`/cities/${editing.id}`, payload);
      else await api.post('/cities', payload);
      await load(); closeModal();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/cities/${deleting.id}`);
      setCities(c => c.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch {} finally { setDeletingId(false); }
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'cities', label: 'Cities', icon: IconMapPin },
  ];

  return (
    <div>
      <PageHeader title="Settings" count={activeTab === 'cities' ? cities.length : undefined} action={
        activeTab === 'cities' ? (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add City
          </button>
        ) : undefined
      } />

      <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
        {/* Left panel */}
        <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${dark ? '#2a2a2a' : 'var(--border)'}`, overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>
            Configuration
          </div>
          {TABS.map(tab => {
            const on = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', border: 0, textAlign: 'left', cursor: 'pointer',
                  background: on ? 'rgba(220,38,38,0.06)' : 'transparent',
                  borderLeft: `3px solid ${on ? '#dc2626' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'var(--bg2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}
              >
                <Icon size={15} color={on ? '#dc2626' : '#bbb'} />
                <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#dc2626' : 'var(--text)' }}>{tab.label}</div>
              </button>
            );
          })}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'cities' && (
            loading ? <Spinner /> : (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['ID', 'City Name', 'Province', 'Status', 'Created', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{c.displayId}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--text2)' }}>{c.province ?? '—'}</td>
                        <td style={{ padding: '11px 16px', color: c.isActive ? '#16a34a' : 'var(--muted)' }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{fmtDate(c.createdAt)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                            <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!cities.length && <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No cities added yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      <Modal open={modal} title={editing ? 'Edit City' : 'Add City'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="City Name *">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Lahore" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <FormField label="Province">
            <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
              placeholder="e.g. Punjab" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <FormField label="Status">
            <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} style={selectStyle}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete City"
        message={`Delete city "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}
