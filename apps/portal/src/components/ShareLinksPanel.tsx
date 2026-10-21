import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

interface ScheduleSlot { start: string; end: string; }
interface ShareLink {
  id: string;
  token: string;
  name: string;
  imei: string;
  expiresAt: string | null;
  viewCount: number;
  isActive: boolean;
  createdAt: string;
  schedules?: ScheduleSlot[] | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}

interface Props {
  onClose: () => void;
  vehicles: Array<{ imei: string; plate: string }>;
  preselectedImei?: string;
}

const BASE_URL = (import.meta.env.VITE_SHARE_BASE_URL as string | undefined) ?? 'https://trackvee.com';

function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

type FormState = { name: string; imei: string; expiresAt: string; schedules: ScheduleSlot[] };

export default function ShareLinksPanel({ onClose, vehicles, preselectedImei }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!preselectedImei);
  const [editLink, setEditLink] = useState<ShareLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', imei: preselectedImei ?? '', expiresAt: '', schedules: [] });
  const [err, setErr] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleDropOpen, setVehicleDropOpen] = useState<boolean>(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.get<ShareLink[]>('/share-links').then(r => setLinks(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Sync vehicle search label once vehicles list loads (for prefill from 3-dot menu)
  useEffect(() => {
    if (preselectedImei && vehicles.length > 0 && !vehicleSearch) {
      const plate = vehicles.find(v => v.imei === preselectedImei)?.plate ?? '';
      if (plate) setVehicleSearch(plate);
    }
  }, [vehicles, preselectedImei]);

  const plateName = (imei: string) => vehicles.find(v => v.imei === imei)?.plate ?? 'Vehicle';

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const openCreate = () => {
    setEditLink(null);
    setForm({ name: '', imei: '', expiresAt: '', schedules: [] });
    setVehicleSearch('');
    setVehicleDropOpen(false);
    setErr('');
    setShowForm(true);
  };

  const openEdit = (lnk: ShareLink) => {
    setEditLink(lnk);
    const exp = lnk.expiresAt ? new Date(lnk.expiresAt).toISOString().slice(0, 10) : '';
    const slots: ScheduleSlot[] = lnk.schedules?.length
      ? lnk.schedules
      : (lnk.scheduleStart && lnk.scheduleEnd ? [{ start: lnk.scheduleStart, end: lnk.scheduleEnd }] : []);
    setForm({ name: lnk.name, imei: lnk.imei, expiresAt: exp, schedules: slots });
    setVehicleSearch(plateName(lnk.imei));
    setVehicleDropOpen(false);
    setErr('');
    setShowForm(true);
  };

  const setSlot = (i: number, field: 'start' | 'end', val: string) =>
    setForm(f => { const s = [...f.schedules]; s[i] = { ...s[i], [field]: val }; return { ...f, schedules: s }; });
  const addSlot = () => setForm(f => ({ ...f, schedules: [...f.schedules, { start: '', end: '' }] }));
  const removeSlot = (i: number) => setForm(f => ({ ...f, schedules: f.schedules.filter((_, j) => j !== i) }));

  const save = async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (!form.imei) { setErr('Vehicle is required'); return; }
    for (const s of form.schedules) {
      if (!s.start.trim() || !s.end.trim()) { setErr('Fill both start and end for every schedule slot'); return; }
    }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name.trim(),
        imei: form.imei,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        schedules: form.schedules.length ? form.schedules : null,
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

  const selectVehicle = (imei: string, plate: string) => {
    setForm(f => ({ ...f, imei }));
    setVehicleSearch(plate);
    setVehicleDropOpen(false);
  };

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid #e5e7eb',
    background: '#fff', color: '#111', fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };
  const btnOutline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 11.5, cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div
        style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 97vw)', maxHeight: 'min(700px, 96vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Share Live Location</span>
          {!showForm && (
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Link
            </button>
          )}
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex', marginLeft: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', marginBottom: 12 }}>{editLink ? 'Edit Link' : 'Create Share Link'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <div>
                <span style={lbl}>Link Name</span>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Client Tracking Link"
                  style={inpStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>

              <div style={{ position: 'relative' }}>
                <span style={lbl}>Vehicle</span>
                <input
                  ref={searchRef}
                  value={vehicleSearch}
                  onChange={e => { setVehicleSearch(e.target.value); setForm(f => ({ ...f, imei: '' })); setVehicleDropOpen(true); }}
                  onFocus={e => { setVehicleDropOpen(true); e.currentTarget.style.borderColor = '#dc2626'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                  placeholder="Search vehicle…"
                  style={{ ...inpStyle, borderRadius: vehicleDropOpen && filteredVehicles.length > 0 ? '5px 5px 0 0' : 5 }}
                />
                {vehicleDropOpen && filteredVehicles.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 5px 5px', background: '#fff', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {filteredVehicles.map(v => (
                      <div
                        key={v.imei}
                        onMouseDown={() => selectVehicle(v.imei, v.plate)}
                        style={{ padding: '7px 10px', fontSize: 12.5, color: form.imei === v.imei ? '#dc2626' : '#111', background: form.imei === v.imei ? '#fff0f0' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = form.imei === v.imei ? '#fff0f0' : '#f3f4f6'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = form.imei === v.imei ? '#fff0f0' : 'transparent'; }}
                      >
                        {v.plate}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span style={lbl}>Expires On (optional)</span>
                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} min={new Date().toISOString().slice(0, 10)}
                  style={inpStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={lbl}>Schedule — active hours (optional)</span>
                  <button onClick={addSlot} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add slot
                  </button>
                </div>
                {form.schedules.length === 0 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 0' }}>No schedule — link is always active</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.schedules.map((slot, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="time" value={slot.start} onChange={e => setSlot(i, 'start', e.target.value)}
                        style={{ ...inpStyle, flex: 1 }}
                        onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>to</span>
                      <input type="time" value={slot.end} onChange={e => setSlot(i, 'end', e.target.value)}
                        style={{ ...inpStyle, flex: 1 }}
                        onFocus={e => e.currentTarget.style.borderColor = '#dc2626'} onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
                      <button onClick={() => removeSlot(i)} style={{ padding: '5px 6px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {err && <div style={{ fontSize: 11.5, color: '#dc2626' }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 2 }}>
                <button onClick={() => setShowForm(false)} style={{ ...btnOutline, color: '#6b7280' }}>Cancel</button>
                <button onClick={save} disabled={saving}
                  style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : editLink ? 'Save Changes' : 'Create Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteId && (
          <div style={{ padding: '10px 16px', background: '#fff5f5', borderBottom: '1px solid #fecaca', flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 600, marginBottom: 6 }}>Delete this share link?</div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginBottom: 8 }}>Anyone with the link will lose access immediately.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={btnOutline}>Cancel</button>
              <button onClick={() => confirmDelete(deleteId)}
                style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}

        {/* Links list */}
        <div style={{ flex: 1, overflowY: 'auto' }} onClick={() => setVehicleDropOpen(false)}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>Loading…</div>
          ) : links.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }}>
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
                <div key={lnk.id} style={{ padding: '11px 16px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lnk.name}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {plateName(lnk.imei)}
                        {lnk.expiresAt && <span style={{ marginLeft: 6, color: expired ? '#f59e0b' : '#6b7280' }}>· Expires {fmt(lnk.expiresAt)}</span>}
                        {(lnk.schedules?.length
                          ? lnk.schedules.map((s, i) => <span key={i} style={{ marginLeft: i === 0 ? 6 : 4 }}>{i === 0 ? '·' : '/'} {s.start}–{s.end}</span>)
                          : (lnk.scheduleStart && lnk.scheduleEnd ? <span style={{ marginLeft: 6 }}>· {lnk.scheduleStart}–{lnk.scheduleEnd}</span> : null)
                        )}
                        <span style={{ marginLeft: 6 }}>· {lnk.viewCount} open{lnk.viewCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                      <button onClick={() => copyLink(lnk.token)} title="Copy link"
                        style={{ padding: '4px 7px', borderRadius: 5, border: '1px solid #e5e7eb', background: copied === lnk.token ? '#dcfce7' : '#fff', color: copied === lnk.token ? '#16a34a' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        {copied === lnk.token
                          ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                          : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>}
                      </button>
                      <button onClick={() => openEdit(lnk)} title="Edit" style={btnOutline}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setDeleteId(lnk.id)} title="Delete" style={{ ...btnOutline, color: '#dc2626' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', fontSize: 10.5, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
          Share live vehicle location · Views = times link was opened
        </div>
      </div>
    </div>
  );
}
