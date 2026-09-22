import { useEffect, useState, useCallback, useRef } from 'react';
import {
  IconActivity, IconX, IconEye, IconTrash,
  IconAlertTriangle, IconGauge, IconArrowNarrowRight, IconRotateClockwise,
  IconChevronDown, IconChevronRight, IconMapPin,
} from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import { ORG_ROLES } from '../config/roles';
import type { UserRole } from '@yotrack/types';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import SearchableSelect from '../components/SearchableSelect';

interface Vehicle { id: string; licensePlate: string | null; make: string | null; model: string | null; name: string; }

interface LeaderboardRow {
  scoreId: string;
  vehicleId: string;
  organizationId: string | null;
  orgName: string | null;
  vehicleLicensePlate: string | null;
  vehicleName: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  score: number;
  date: string;
  harshBrakeCount: number;
  rapidAccelCount: number;
  sharpTurnCount: number;
  overspeedCount: number;
}

interface ScoreHistory {
  id: string; vehicleId: string; date: string; score: number;
  harshBrakeCount: number; rapidAccelCount: number; sharpTurnCount: number; overspeedCount: number;
}
interface DriverEventRow {
  id: string; vehicleId: string; type: string; severity: string;
  speedKmh: number; latitude: number | null; longitude: number | null; timestamp: string;
}
interface Settings {
  overspeedThreshold: number;
  harshBrakeDeceleration: number;
  rapidAccelThreshold: number;
  sharpTurnAngle: number;
  sharpTurnMinSpeed: number;
  deductionHarshBrake: number;
  deductionRapidAccel: number;
  deductionSharpTurn: number;
  deductionOverspeed: number;
}
interface VehicleGroup { id: string; name: string; vehicleIds: string[]; }

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

function scoreColor(s: number) { return s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626'; }
function scoreBg(s: number) { return s >= 80 ? 'rgba(22,163,74,0.1)' : s >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)'; }

const EVENT_LABELS: Record<string, string> = {
  harsh_brake: 'Harsh Brake', rapid_accel: 'Rapid Accel',
  sharp_turn: 'Sharp Turn', overspeed: 'Overspeeding',
};
const EVENT_ICONS: Record<string, typeof IconAlertTriangle> = {
  harsh_brake: IconAlertTriangle, rapid_accel: IconGauge,
  sharp_turn: IconRotateClockwise, overspeed: IconArrowNarrowRight,
};
const SEVERITY_COLOR: Record<string, string> = { low: '#6b7280', medium: '#f59e0b', high: '#dc2626' };

function ScoreChart({ history }: { history: ScoreHistory[] }) {
  if (!history.length) return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>No score history yet.</div>;
  const w = 480, h = 120, pad = { t: 16, r: 16, b: 28, l: 36 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const scores = history.map(r => r.score);
  const dates = history.map(r => r.date);
  const px = (i: number) => pad.l + (i / Math.max(scores.length - 1, 1)) * iw;
  const py = (v: number) => pad.t + ih - (v / 100) * ih;
  const path = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${path} L${px(scores.length-1).toFixed(1)},${(pad.t+ih).toFixed(1)} L${px(0).toFixed(1)},${(pad.t+ih).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w, display: 'block' }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={py(v)} y2={py(v)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3"/>
          <text x={pad.l - 4} y={py(v) + 3.5} textAnchor="end" fontSize="8" fill="var(--text-muted)">{v}</text>
        </g>
      ))}
      <path d={area} fill="rgba(220,38,38,0.08)"/>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round"/>
      {scores.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r="2.5" fill={scoreColor(v)}/>)}
      {dates.filter((_, i) => i === 0 || i === dates.length - 1 || scores.length <= 7).map((d, i) => (
        <text key={i} x={px(i)} y={h - 6} textAnchor="middle" fontSize="7.5" fill="var(--text-muted)">{d.slice(5)}</text>
      ))}
    </svg>
  );
}

function LocationBadge({ lat, lng }: { lat: number; lng: number }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShow(v => !v)}
        title="View location"
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#6b7280', display: 'flex', alignItems: 'center', borderRadius: 3 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'none'; }}
      >
        <IconMapPin size={13}/>
      </button>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', fontSize: 11, borderRadius: 5, padding: '6px 10px',
          whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          minWidth: 160,
        }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Location</div>
          <div style={{ color: '#ccc' }}>Lat: {lat.toFixed(6)}</div>
          <div style={{ color: '#ccc' }}>Lng: {lng.toFixed(6)}</div>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 5, color: '#dc2626', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            Open in Maps →
          </a>
        </div>
      )}
    </div>
  );
}

function VehicleDetailModal({ row, onClose, orgId }: { row: LeaderboardRow; onClose: () => void; orgId: string | null }) {
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [events, setEvents] = useState<DriverEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<ScoreHistory[]>(`/driver-behavior/vehicle/${row.vehicleId}/scores?days=30`).then(r => r.data).catch(() => [] as ScoreHistory[]),
      api.get<DriverEventRow[]>(`/driver-behavior/vehicle/${row.vehicleId}/events`).then(r => r.data).catch(() => [] as DriverEventRow[]),
    ]).then(([h, e]) => { setScoreHistory(h); setEvents(e); }).finally(() => setLoading(false));
  }, [row.vehicleId]);

  const vehicleLabel = row.vehicleLicensePlate ?? row.vehicleName ?? row.vehicleId.slice(0, 8);
  const vehicleSub = [row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ');

  const tStyle: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' };
  const thStyle: React.CSSProperties = { ...tStyle, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, background: 'var(--table-header-bg)', textAlign: 'left' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #fff)', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          width: '100%', maxWidth: 700, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconActivity size={16} color="#dc2626" strokeWidth={1.5}/>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{vehicleLabel}</div>
              {vehicleSub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{vehicleSub}{row.orgName ? ` · ${row.orgName}` : ''}</div>}
            </div>
            <span style={{
              marginLeft: 8, display: 'inline-block', minWidth: 42, padding: '3px 8px',
              borderRadius: 4, fontWeight: 700, fontSize: 14,
              color: scoreColor(row.score), background: scoreBg(row.score),
            }}>
              {row.score.toFixed(0)}
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}>
            <IconX size={16}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading ? <Spinner style={{ height: 200 }}/> : (
            <>
              {/* Summary row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Harsh Brake', val: row.harshBrakeCount, color: '#f59e0b' },
                  { label: 'Rapid Accel', val: row.rapidAccelCount, color: '#f59e0b' },
                  { label: 'Sharp Turn', val: row.sharpTurnCount, color: '#f59e0b' },
                  { label: 'Overspeed', val: row.overspeedCount, color: '#dc2626' },
                ].map(item => (
                  <div key={item.label} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.val > 0 ? item.color : 'var(--text-muted)' }}>{item.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Score chart */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>30-Day Score Trend</div>
                <ScoreChart history={scoreHistory}/>
              </div>

              {/* Recent events */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Recent Events ({events.length})
                </div>
                {events.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No events recorded.</div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Event</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Severity</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Speed</th>
                          <th style={thStyle}>Time</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => {
                          const Icon = EVENT_ICONS[ev.type] ?? IconAlertTriangle;
                          return (
                            <tr key={ev.id} style={{ background: i % 2 === 1 ? 'var(--row-alt-bg, transparent)' : 'transparent' }}>
                              <td style={tStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Icon size={13} style={{ color: SEVERITY_COLOR[ev.severity], flexShrink: 0 }}/>
                                  <span style={{ fontWeight: 500 }}>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                                </div>
                              </td>
                              <td style={{ ...tStyle, textAlign: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: SEVERITY_COLOR[ev.severity], textTransform: 'uppercase' }}>{ev.severity}</span>
                              </td>
                              <td style={{ ...tStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{ev.speedKmh.toFixed(0)} km/h</td>
                              <td style={{ ...tStyle, color: 'var(--text-muted)', fontSize: 11 }}>{new Date(ev.timestamp).toLocaleString()}</td>
                              <td style={{ ...tStyle, textAlign: 'center' }}>
                                {ev.latitude != null && ev.longitude != null
                                  ? <LocationBadge lat={ev.latitude} lng={ev.longitude}/>
                                  : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic settings form
function SettingsForm({ getUrl, putUrl, clearUrl, label, onCleared }: {
  getUrl: string; putUrl: string; clearUrl?: string; label?: string; onCleared?: () => void;
}) {
  const [form, setForm] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setForm(null); setLoadError(false);
    api.get<Settings>(getUrl)
      .then(r => { if (r.data) setForm(r.data); else setLoadError(true); })
      .catch(() => setLoadError(true));
  }, [getUrl]);

  const update = (k: keyof Settings, v: string) => { setForm(f => f ? { ...f, [k]: parseFloat(v) || 0 } : f); setSaved(false); };
  const save = async () => { if (!form) return; setSaving(true); try { await api.put(putUrl, form); setSaved(true); } finally { setSaving(false); } };
  const clear = async () => { if (!clearUrl || !onCleared) return; setClearing(true); try { await api.delete(clearUrl); onCleared(); } finally { setClearing(false); } };

  if (loadError) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Failed to load settings.</div>;
  if (!form) return <Spinner style={{ height: 120 }}/>;

  const inp: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', width: 90 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', minWidth: 220 };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };

  const fields: { key: keyof Settings; title: string; unit: string }[] = [
    { key: 'overspeedThreshold',    title: 'Overspeed Threshold',      unit: 'km/h' },
    { key: 'harshBrakeDeceleration',title: 'Harsh Brake Deceleration', unit: 'km/h/s' },
    { key: 'rapidAccelThreshold',   title: 'Rapid Acceleration',       unit: 'km/h/s' },
    { key: 'sharpTurnAngle',        title: 'Sharp Turn Angle',         unit: 'degrees' },
    { key: 'sharpTurnMinSpeed',     title: 'Sharp Turn Min Speed',     unit: 'km/h' },
  ];
  const deductFields: { key: keyof Settings; title: string }[] = [
    { key: 'deductionHarshBrake', title: 'Harsh Brake Deduction' },
    { key: 'deductionRapidAccel', title: 'Rapid Accel Deduction' },
    { key: 'deductionSharpTurn',  title: 'Sharp Turn Deduction' },
    { key: 'deductionOverspeed',  title: 'Overspeed Deduction' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Detection Thresholds</div>
        {fields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Score Deductions (points per event)</div>
        {deductFields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pts</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={{ height: 32, padding: '0 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : saved ? 'Saved' : `Save${label ? ` ${label}` : ''}`}
        </button>
        {clearUrl && onCleared && (
          <button onClick={clear} disabled={clearing} style={{ height: 32, padding: '0 12px', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: clearing ? 'not-allowed' : 'pointer', opacity: clearing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconTrash size={13}/>{clearing ? 'Removing...' : 'Remove Override'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DriverBehaviorPage() {
  const { user } = useAuth();
  const { canOrgDo } = useOrgRolePerms();
  const role = (user?.role ?? 'client_user') as UserRole;
  const isOrgUser = ORG_ROLES.includes(role as (typeof ORG_ROLES)[number]);
  const isAdmin = ADMIN_ROLES.includes(role);

  const [tab, setTab] = useState<'scores' | 'settings'>('scores');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [viewRow, setViewRow] = useState<LeaderboardRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LeaderboardRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showSettings = isAdmin || (isOrgUser && canOrgDo(role, 'driver-behavior', 'edit'));

  useEffect(() => {
    if (isAdmin) {
      api.get<{ id: string; name: string }[]>('/organizations').then(r => {
        setOrgs(r.data);
      }).catch(() => {});
    }
  }, [isAdmin]);

  const loadLeaderboard = useCallback(() => {
    const orgId = isAdmin ? selectedOrgId : user?.organizationId;
    const qs = orgId ? `?orgId=${orgId}` : '';
    setLoading(true);
    Promise.all([
      api.get<Vehicle[]>('/vehicles').then(r => r.data).catch(() => [] as Vehicle[]),
      api.get<LeaderboardRow[]>(`/driver-behavior/leaderboard${qs}`).then(r => r.data).catch(() => [] as LeaderboardRow[]),
    ]).then(([v, lb]) => {
      setVehicles(v);
      setRows(lb);
    }).finally(() => setLoading(false));
  }, [isAdmin, selectedOrgId, user?.organizationId]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  // Groups and vehicle-override state for settings tab
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [vehicleOverrides, setVehicleOverrides] = useState<Set<string>>(new Set());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<'org' | 'groups' | 'vehicles'>('org');

  const currentOrgId = isAdmin ? selectedOrgId : (user?.organizationId ?? '');

  const loadGroupsAndOverrides = useCallback(async () => {
    if (!currentOrgId) return;
    const qs = isAdmin ? `?orgId=${currentOrgId}` : '';
    try {
      const [gr, vList] = await Promise.all([
        api.get<VehicleGroup[]>(`/vehicle-groups${qs}`).then(r => r.data).catch(() => [] as VehicleGroup[]),
        Promise.all(vehicles.map(v =>
          api.get(`/driver-behavior/settings/vehicle/${v.id}`)
            .then(r => r.data ? v.id : null).catch(() => null)
        )),
      ]);
      setGroups(gr);
      setVehicleOverrides(new Set(vList.filter(Boolean) as string[]));
    } catch {}
  }, [currentOrgId, isAdmin, vehicles]);

  useEffect(() => { if (tab === 'settings') loadGroupsAndOverrides(); }, [tab, loadGroupsAndOverrides]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/driver-behavior/scores/${deleteConfirm.scoreId}`);
      setRows(r => r.filter(row => row.scoreId !== deleteConfirm.scoreId));
      setDeleteConfirm(null);
    } catch {} finally {
      setDeleting(false);
    }
  };

  const sortedRows = [...rows].sort((a, b) => b.score - a.score);

  const tStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const thStyle: React.CSSProperties = { ...tStyle, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, background: 'var(--table-header-bg)' };

  const tabs: { key: 'scores' | 'settings'; label: string }[] = [
    { key: 'scores', label: 'Driver Scores' },
    ...(showSettings ? [{ key: 'settings' as const, label: 'Settings' }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Driver Behavior"/>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', gap: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? '#dc2626' : 'var(--text-muted)',
            background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? '#dc2626' : 'transparent'}`,
            cursor: 'pointer', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>

        {/* ── Settings tab ─────────────────────────────────────────────────── */}
        {tab === 'settings' && showSettings && (
          <div style={{ maxWidth: 600 }}>
            {isAdmin && (
              <div style={{ marginBottom: 20, maxWidth: 280 }}>
                <SearchableSelect
                  value={selectedOrgId}
                  onChange={v => setSelectedOrgId(v)}
                  options={orgs.map(o => ({ value: o.id, label: o.name }))}
                  placeholder="Select client…"
                  emptyLabel="None"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              {(['org', 'groups', 'vehicles'] as const).map(s => (
                <button key={s} onClick={() => setSettingsSection(s)} style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: settingsSection === s ? 600 : 400,
                  color: settingsSection === s ? '#dc2626' : 'var(--text-muted)',
                  background: 'none', border: 'none', borderBottom: `2px solid ${settingsSection === s ? '#dc2626' : 'transparent'}`,
                  cursor: 'pointer', marginBottom: -1, textTransform: 'capitalize',
                }}>{s === 'org' ? 'Organization Defaults' : s === 'groups' ? `Groups (${groups.length})` : 'Vehicles'}</button>
              ))}
            </div>

            {settingsSection === 'org' && currentOrgId && (
              <SettingsForm
                getUrl={`/driver-behavior/settings${isAdmin ? `?orgId=${currentOrgId}` : ''}`}
                putUrl={`/driver-behavior/settings${isAdmin ? `?orgId=${currentOrgId}` : ''}`}
              />
            )}
            {settingsSection === 'org' && !currentOrgId && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select a client to view settings.</div>
            )}

            {settingsSection === 'groups' && (
              <div>
                {!currentOrgId && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select a client.</div>}
                {currentOrgId && groups.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>No groups yet.</div>}
                {groups.map(g => {
                  const isOpen = expandedGroup === g.id;
                  const qs = isAdmin ? `?orgId=${currentOrgId}` : '';
                  return (
                    <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
                      <div onClick={() => setExpandedGroup(isOpen ? null : g.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: 'var(--table-header-bg)' }}>
                        {isOpen ? <IconChevronDown size={13}/> : <IconChevronRight size={13}/>}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{g.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.vehicleIds.length} vehicle{g.vehicleIds.length !== 1 ? 's' : ''}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '14px 16px' }}>
                          <SettingsForm getUrl={`/driver-behavior/settings/group/${g.id}`} putUrl={`/driver-behavior/settings/group/${g.id}${qs}`} clearUrl={`/driver-behavior/settings/group/${g.id}`} label="Group" onCleared={() => setExpandedGroup(null)}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {settingsSection === 'vehicles' && (
              <div>
                {vehicles.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No vehicles.</div>}
                {vehicles.map(v => {
                  const hasOverride = vehicleOverrides.has(v.id);
                  const isOpen = expandedVehicle === v.id;
                  const qs = isAdmin ? `?orgId=${currentOrgId}` : '';
                  return (
                    <div key={v.id} style={{ border: `1px solid ${hasOverride ? '#fca5a5' : 'var(--border)'}`, borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
                      <div onClick={() => setExpandedVehicle(isOpen ? null : v.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', background: hasOverride ? 'rgba(220,38,38,0.04)' : 'var(--table-header-bg)' }}>
                        {isOpen ? <IconChevronDown size={13}/> : <IconChevronRight size={13}/>}
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{v.licensePlate ?? v.name}</span>
                        {v.make && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.make}{v.model ? ` ${v.model}` : ''}</span>}
                        {hasOverride && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginLeft: 4 }}>OVERRIDE</span>}
                      </div>
                      {isOpen && (
                        <div style={{ padding: '14px 16px' }}>
                          <SettingsForm
                            getUrl={`/driver-behavior/settings/vehicle/${v.id}`}
                            putUrl={`/driver-behavior/settings/vehicle/${v.id}${qs}`}
                            clearUrl={`/driver-behavior/settings/vehicle/${v.id}`}
                            label="Vehicle"
                            onCleared={() => { setVehicleOverrides(s => { const n = new Set(s); n.delete(v.id); return n; }); setExpandedVehicle(null); }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Driver Scores tab ────────────────────────────────────────────── */}
        {tab === 'scores' && (
          <>
            {/* Filters */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 240 }}>
                  <SearchableSelect
                    value={selectedOrgId}
                    onChange={v => { setSelectedOrgId(v); }}
                    options={orgs.map(o => ({ value: o.id, label: o.name }))}
                    placeholder="All Clients"
                    emptyLabel="All Clients"
                    style={{ height: 32, fontSize: 12, padding: '0 10px' }}
                  />
                </div>
              </div>
            )}

            {loading ? <Spinner style={{ height: 200 }}/> : sortedRows.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                No driver behavior data yet. Data will appear as vehicles drive.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 32 }}>#</th>
                      <th style={thStyle}>Vehicle No</th>
                      <th style={thStyle}>Vehicle Name</th>
                      {isAdmin && <th style={thStyle}>Client</th>}
                      <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>HB</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>RA</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>ST</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>OS</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr
                        key={row.scoreId}
                        style={{ background: i % 2 === 1 ? 'var(--row-alt-bg, transparent)' : 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--hover-bg, rgba(0,0,0,0.03))'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 1 ? 'var(--row-alt-bg, transparent)' : 'transparent'; }}
                      >
                        <td style={{ ...tStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ ...tStyle, fontWeight: 500 }}>
                          {row.vehicleLicensePlate ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={tStyle}>
                          <div>{row.vehicleName ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                          {(row.vehicleMake || row.vehicleModel) && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {[row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </td>
                        {isAdmin && <td style={{ ...tStyle, color: 'var(--text-muted)' }}>{row.orgName ?? '—'}</td>}
                        <td style={{ ...tStyle, textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', minWidth: 38, padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 12, color: scoreColor(row.score), background: scoreBg(row.score) }}>
                            {row.score.toFixed(0)}
                          </span>
                        </td>
                        <td style={{ ...tStyle, textAlign: 'center', color: row.harshBrakeCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.harshBrakeCount}</td>
                        <td style={{ ...tStyle, textAlign: 'center', color: row.rapidAccelCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.rapidAccelCount}</td>
                        <td style={{ ...tStyle, textAlign: 'center', color: row.sharpTurnCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.sharpTurnCount}</td>
                        <td style={{ ...tStyle, textAlign: 'center', color: row.overspeedCount > 0 ? '#dc2626' : 'var(--text-muted)' }}>{row.overspeedCount}</td>
                        <td style={{ ...tStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              onClick={() => setViewRow(row)}
                              title="View details"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                              <IconEye size={12}/>View
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(row)}
                              title="Delete score"
                              style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 3, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.05)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                            >
                              <IconTrash size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  HB = Harsh Brake &nbsp;·&nbsp; RA = Rapid Accel &nbsp;·&nbsp; ST = Sharp Turn &nbsp;·&nbsp; OS = Overspeed &nbsp;·&nbsp; Showing latest score per vehicle (last 7 days)
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View modal */}
      {viewRow && (
        <VehicleDetailModal
          row={viewRow}
          onClose={() => setViewRow(null)}
          orgId={isAdmin ? (selectedOrgId || null) : (user?.organizationId ?? null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: '100%', maxWidth: 380, padding: 24, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Delete Score Record</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Delete the score record for <strong>{deleteConfirm.vehicleLicensePlate ?? deleteConfirm.vehicleName ?? 'this vehicle'}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 4, background: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ height: 32, padding: '0 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
