import { useEffect, useState } from 'react';
import api from '../api/client';

interface ShareLink {
  id: string;
  token: string;
  name: string;
  imei: string;
  expiresAt: string | null;
  viewCount: number;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  onClose: () => void;
  vehicles: Array<{ imei: string; plate: string }>;
  preselectedImei?: string;
}

const BASE_URL = (import.meta.env.VITE_SHARE_BASE_URL as string | undefined) ?? 'https://admin.trackvee.com';

function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function ShareLinksPanel({ onClose, vehicles, preselectedImei }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLink, setEditLink] = useState<ShareLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', imei: preselectedImei ?? '', expiresAt: '' });
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get<ShareLink[]>('/share-links').then(r => setLinks(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = (imei?: string) => {
    setEditLink(null);
    setForm({ name: '', imei: imei ?? preselectedImei ?? '', expiresAt: '' });
    setErr('');
    setShowForm(true);
  };

  const openEdit = (lnk: ShareLink) => {
    setEditLink(lnk);
    const exp = lnk.expiresAt ? new Date(lnk.expiresAt).toISOString().slice(0, 10) : '';
    setForm({ name: lnk.name, imei: lnk.imei, expiresAt: exp });
    setErr('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (!form.imei) { setErr('Vehicle is required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name.trim(),
        imei: form.imei,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      if (editLink) {
        await api.patch(`/share-links/${editLink.id}`, payload);
      } else {
        await api.post('/share-links', payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${BASE_URL}/live/${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(token);
    setTimeout(() => setCopied(c => c === token ? null : c), 2000);
  };

  const confirmDelete = async (id: string) => {
    try {
      await api.delete(`/share-links/${id}`);
      setDeleteId(null);
      load();
    } catch {}
  };

  const plateName = (imei: string) => vehicles.find(v => v.imei === imei)?.plate ?? imei;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9200, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'all' }}/>
      <div style={{ position: 'relative', width: 420, maxWidth: '100vw', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', pointerEvents: 'all', boxShadow: '-8px 0 32px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111', flex: 1 }}>Share Live Location</span>
          <button onClick={() => openCreate()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Link
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {showForm && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', marginBottom: 12 }}>{editLink ? 'Edit Link' : 'Create Share Link'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Link Name</div>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Client Tracking Link"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Vehicle</div>
                <select value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} disabled={!!editLink}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', cursor: editLink ? 'not-allowed' : 'pointer' }}>
                  <option value="">— Select vehicle —</option>
                  {vehicles.map(v => <option key={v.imei} value={v.imei}>{v.plate} ({v.imei})</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Expires On (optional)</div>
                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} min={new Date().toISOString().slice(0, 10)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              {err && <div style={{ fontSize: 11.5, color: '#dc2626' }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : editLink ? 'Save Changes' : 'Create Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteId && (
          <div style={{ padding: '12px 16px', background: '#fff5f5', borderBottom: '1px solid #fecaca' }}>
            <div style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>Delete this share link?</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Anyone with the link will lose access immediately.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmDelete(deleteId)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>Loading…</div>
          ) : links.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <div style={{ color: '#9ca3af', fontSize: 12.5 }}>No share links yet</div>
              <div style={{ color: '#d1d5db', fontSize: 11.5, marginTop: 4 }}>Create a link to share live vehicle location</div>
            </div>
          ) : (
            links.map(lnk => {
              const expired = isExpired(lnk.expiresAt);
              const statusColor = !lnk.isActive ? '#9ca3af' : expired ? '#f59e0b' : '#16a34a';
              const statusLabel = !lnk.isActive ? 'Inactive' : expired ? 'Expired' : 'Active';
              return (
                <div key={lnk.id} style={{ padding: '11px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lnk.name}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {plateName(lnk.imei)}
                        {lnk.expiresAt && <span style={{ marginLeft: 6, color: expired ? '#f59e0b' : '#6b7280' }}>· Expires {fmt(lnk.expiresAt)}</span>}
                        <span style={{ marginLeft: 6 }}>· {lnk.viewCount} view{lnk.viewCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                      <button onClick={() => copyLink(lnk.token)} title="Copy link"
                        style={{ padding: '4px 7px', borderRadius: 5, border: '1px solid #e5e7eb', background: copied === lnk.token ? '#dcfce7' : '#fff', color: copied === lnk.token ? '#16a34a' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        {copied === lnk.token
                          ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                          : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>}
                      </button>
                      <button onClick={() => openEdit(lnk)} title="Edit"
                        style={{ padding: '4px 6px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setDeleteId(lnk.id)} title="Delete"
                        style={{ padding: '4px 6px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid #e5e7eb', fontSize: 10.5, color: '#9ca3af', textAlign: 'center' }}>
          Links auto-update every 10s · Trackable view counts
        </div>
      </div>
    </div>
  );
}
