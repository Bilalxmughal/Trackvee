import { useEffect, useState } from 'react';
import {
  IconActivity, IconChevronLeft, IconSettings, IconX,
  IconAlertTriangle, IconGauge, IconArrowNarrowRight, IconRotateClockwise,
} from '@tabler/icons-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
import { ORG_ROLES } from '../config/roles';
import type { UserRole } from '@yotrack/types';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';

interface Vehicle { id: string; licensePlate: string | null; make: string | null; model: string | null; name: string; }
interface LeaderboardRow {
  vehicleId: string;
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

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

function scoreColor(s: number): string {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#f59e0b';
  return '#dc2626';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'rgba(22,163,74,0.1)';
  if (s >= 60) return 'rgba(245,158,11,0.1)';
  return 'rgba(220,38,38,0.1)';
}

const EVENT_LABELS: Record<string, string> = {
  harsh_brake: 'Harsh Brake',
  rapid_accel: 'Rapid Accel',
  sharp_turn:  'Sharp Turn',
  overspeed:   'Overspeeding',
};

const EVENT_ICONS: Record<string, typeof IconAlertTriangle> = {
  harsh_brake: IconAlertTriangle,
  rapid_accel: IconGauge,
  sharp_turn:  IconRotateClockwise,
  overspeed:   IconArrowNarrowRight,
};

const SEVERITY_COLOR: Record<string, string> = {
  low: '#6b7280', medium: '#f59e0b', high: '#dc2626',
};

function ScoreChart({ history }: { history: ScoreHistory[] }) {
  if (!history.length) return <div style={{ color: '#999', fontSize: 12, padding: '24px 0' }}>No score history yet.</div>;

  const w = 480, h = 120, pad = { t: 16, r: 16, b: 28, l: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const scores = history.map(r => r.score);
  const dates  = history.map(r => r.date);
  const minS = 0, maxS = 100;

  const px = (i: number) => pad.l + (i / Math.max(scores.length - 1, 1)) * iw;
  const py = (v: number) => pad.t + ih - ((v - minS) / (maxS - minS)) * ih;

  const path = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${path} L${px(scores.length-1).toFixed(1)},${(pad.t+ih).toFixed(1)} L${px(0).toFixed(1)},${(pad.t+ih).toFixed(1)} Z`;

  const yLines = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w, display: 'block' }}>
      {yLines.map(v => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={py(v)} y2={py(v)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3"/>
          <text x={pad.l - 4} y={py(v) + 3.5} textAnchor="end" fontSize="8" fill="var(--text-muted)">{v}</text>
        </g>
      ))}
      <path d={area} fill="rgba(220,38,38,0.08)"/>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round"/>
      {scores.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r="2.5" fill={scoreColor(v)}/>
      ))}
      {dates.filter((_, i) => i === 0 || i === dates.length - 1 || scores.length <= 7).map((d, i) => (
        <text key={i} x={px(i)} y={h - 6} textAnchor="middle" fontSize="7.5" fill="var(--text-muted)">{d.slice(5)}</text>
      ))}
    </svg>
  );
}

function SettingsForm({ orgId }: { orgId: string }) {
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Settings>('/driver-behavior/settings').then(r => setForm(r.data)).catch(() => {});
  }, [orgId]);

  const update = (k: keyof Settings, v: string) => {
    setForm(f => f ? { ...f, [k]: parseFloat(v) || 0 } : f);
    setSaved(false);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/driver-behavior/settings', form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner style={{ height: 120 }}/>;

  const inp: React.CSSProperties = {
    height: 30, padding: '0 8px', border: '1px solid var(--input-border)',
    borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)',
    outline: 'none', width: 90,
  };
  const label: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', minWidth: 220 };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };

  const fields: { key: keyof Settings; label: string; unit: string }[] = [
    { key: 'overspeedThreshold',    label: 'Overspeed Threshold',        unit: 'km/h' },
    { key: 'harshBrakeDeceleration',label: 'Harsh Brake Deceleration',   unit: 'km/h/s' },
    { key: 'rapidAccelThreshold',   label: 'Rapid Acceleration',         unit: 'km/h/s' },
    { key: 'sharpTurnAngle',        label: 'Sharp Turn Angle',           unit: 'degrees' },
    { key: 'sharpTurnMinSpeed',     label: 'Sharp Turn Min Speed',       unit: 'km/h' },
  ];
  const deductFields: { key: keyof Settings; label: string }[] = [
    { key: 'deductionHarshBrake', label: 'Harsh Brake Deduction' },
    { key: 'deductionRapidAccel', label: 'Rapid Accel Deduction' },
    { key: 'deductionSharpTurn',  label: 'Sharp Turn Deduction' },
    { key: 'deductionOverspeed',  label: 'Overspeed Deduction' },
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
        Configure detection thresholds and score deductions for this organization.
      </p>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Detection Thresholds</div>
        {fields.map(f => (
          <div key={f.key} style={row}>
            <span style={label}>{f.label}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Score Deductions (points per event)</div>
        {deductFields.map(f => (
          <div key={f.key} style={row}>
            <span style={label}>{f.label}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pts</span>
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        style={{
          height: 32, padding: '0 16px', background: '#dc2626', color: '#fff',
          border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

export default function DriverBehaviorPage() {
  const { user } = useAuth();
  const { canOrgDo } = useOrgRolePerms();
  const role = (user?.role ?? 'client_user') as UserRole;
  const isOrgUser = ORG_ROLES.includes(role as (typeof ORG_ROLES)[number]);
  const isAdmin = ADMIN_ROLES.includes(role);

  const [tab, setTab] = useState<'leaderboard' | 'settings'>('leaderboard');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [events, setEvents] = useState<DriverEventRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const canEditSettings = isAdmin || (isOrgUser && (role === 'client_owner' || role === 'client_super_admin'));

  // For org users, settings require canOrgDo edit on driver-behavior
  const showSettings = isAdmin || (isOrgUser && canOrgDo(role, 'driver-behavior', 'edit'));

  useEffect(() => {
    if (isAdmin) {
      api.get<{ id: string; name: string }[]>('/organizations').then(r => {
        setOrgs(r.data);
        if (r.data.length > 0) setSelectedOrgId(r.data[0].id);
      }).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    const orgId = isAdmin ? selectedOrgId : user?.organizationId;
    if (!orgId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api.get<Vehicle[]>('/vehicles', { signal: controller.signal }).then(r => r.data).catch(() => [] as Vehicle[]),
      api.get<LeaderboardRow[]>(`/driver-behavior/leaderboard${isAdmin ? `?orgId=${orgId}` : ''}`, { signal: controller.signal }).then(r => r.data).catch(() => [] as LeaderboardRow[]),
    ]).then(([v, lb]) => {
      setVehicles(v);
      setRows(lb);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [isAdmin, selectedOrgId, user?.organizationId]);

  const loadVehicleDetail = async (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setDetailLoading(true);
    try {
      const [h, e] = await Promise.all([
        api.get<ScoreHistory[]>(`/driver-behavior/vehicle/${vehicleId}/scores?days=30`).then(r => r.data).catch(() => [] as ScoreHistory[]),
        api.get<DriverEventRow[]>(`/driver-behavior/vehicle/${vehicleId}/events`).then(r => r.data).catch(() => [] as DriverEventRow[]),
      ]);
      setScoreHistory(h);
      setEvents(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  const sortedRows = [...rows].sort((a, b) => b.score - a.score);

  const tStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const thStyle: React.CSSProperties = { ...tStyle, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, background: 'var(--table-header-bg)' };

  const tabs: { key: 'leaderboard' | 'settings'; label: string }[] = [
    { key: 'leaderboard', label: 'Leaderboard' },
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
        {tab === 'settings' && showSettings && (
          <div style={{ maxWidth: 560 }}>
            <SettingsForm orgId={isAdmin ? selectedOrgId : (user?.organizationId ?? '')} />
          </div>
        )}

        {tab === 'leaderboard' && (
          <>
            {isAdmin && (
              <div style={{ marginBottom: 16 }}>
                <select
                  value={selectedOrgId}
                  onChange={e => { setSelectedOrgId(e.target.value); setSelectedVehicleId(null); }}
                  style={{ height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none' }}
                >
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}

            {loading ? <Spinner style={{ height: 200 }}/> : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Leaderboard table */}
                <div style={{ flex: selectedVehicleId ? '0 0 420px' : 1, overflow: 'hidden' }}>
                  {sortedRows.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                      No driver behavior data yet. Data will appear as vehicles drive.
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, width: 32 }}>#</th>
                            <th style={thStyle}>Vehicle</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>HB</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>RA</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>ST</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>OS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRows.map((row, i) => {
                            const v = vehicleMap[row.vehicleId];
                            const isSelected = selectedVehicleId === row.vehicleId;
                            return (
                              <tr
                                key={row.vehicleId}
                                onClick={() => loadVehicleDetail(row.vehicleId)}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? 'rgba(220,38,38,0.05)' : i % 2 === 1 ? 'var(--row-alt-bg, transparent)' : 'transparent',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--hover-bg, rgba(0,0,0,0.03))'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? 'rgba(220,38,38,0.05)' : i % 2 === 1 ? 'var(--row-alt-bg, transparent)' : 'transparent'; }}
                              >
                                <td style={{ ...tStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                                <td style={tStyle}>
                                  <div style={{ fontWeight: 500, fontSize: 12 }}>{v?.licensePlate ?? row.vehicleId.slice(0, 8)}</div>
                                  {v?.make && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.make}{v.model ? ` ${v.model}` : ''}</div>}
                                </td>
                                <td style={{ ...tStyle, textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-block', minWidth: 38, padding: '2px 6px',
                                    borderRadius: 4, fontWeight: 700, fontSize: 12,
                                    color: scoreColor(row.score), background: scoreBg(row.score),
                                  }}>
                                    {row.score.toFixed(0)}
                                  </span>
                                </td>
                                <td style={{ ...tStyle, textAlign: 'center', color: row.harshBrakeCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.harshBrakeCount}</td>
                                <td style={{ ...tStyle, textAlign: 'center', color: row.rapidAccelCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.rapidAccelCount}</td>
                                <td style={{ ...tStyle, textAlign: 'center', color: row.sharpTurnCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{row.sharpTurnCount}</td>
                                <td style={{ ...tStyle, textAlign: 'center', color: row.overspeedCount > 0 ? '#dc2626' : 'var(--text-muted)' }}>{row.overspeedCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                        HB = Harsh Brake &nbsp;·&nbsp; RA = Rapid Accel &nbsp;·&nbsp; ST = Sharp Turn &nbsp;·&nbsp; OS = Overspeed
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle detail panel */}
                {selectedVehicleId && (
                  <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 4, padding: 16, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {vehicleMap[selectedVehicleId]?.licensePlate ?? selectedVehicleId.slice(0, 8)}
                        </div>
                        {vehicleMap[selectedVehicleId]?.make && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {vehicleMap[selectedVehicleId]?.make} {vehicleMap[selectedVehicleId]?.model ?? ''}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setSelectedVehicleId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <IconX size={16}/>
                      </button>
                    </div>

                    {detailLoading ? <Spinner style={{ height: 120 }}/> : (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>30-Day Score Trend</div>
                          <ScoreChart history={scoreHistory}/>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                            Recent Events
                          </div>
                          {events.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No events recorded.</div>
                          ) : (
                            <div style={{ maxHeight: 280, overflow: 'auto' }}>
                              {events.map(ev => {
                                const Icon = EVENT_ICONS[ev.type] ?? IconAlertTriangle;
                                return (
                                  <div key={ev.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '7px 0', borderBottom: '1px solid var(--border)',
                                  }}>
                                    <Icon size={14} style={{ color: SEVERITY_COLOR[ev.severity], flexShrink: 0 }}/>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                                        {EVENT_LABELS[ev.type] ?? ev.type}
                                        <span style={{ marginLeft: 6, fontSize: 10, color: SEVERITY_COLOR[ev.severity], textTransform: 'capitalize' }}>{ev.severity}</span>
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {ev.speedKmh.toFixed(0)} km/h &nbsp;·&nbsp; {new Date(ev.timestamp).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
