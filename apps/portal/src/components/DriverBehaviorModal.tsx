import { useState, useEffect } from 'react';
import {
  IconActivity, IconAlertTriangle, IconGauge,
  IconArrowNarrowRight, IconRotateClockwise, IconMapPin, IconArrowLeft,
} from '@tabler/icons-react';
import api from '../api/client';

interface LeaderboardRow {
  scoreId: string;
  vehicleId: string;
  vehicleLicensePlate: string | null;
  vehicleName: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  score: number;
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

interface BehaviorSettings {
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

const DEFAULT_SETTINGS: BehaviorSettings = {
  overspeedThreshold: 100, harshBrakeDeceleration: 0.4, rapidAccelThreshold: 0.3,
  sharpTurnAngle: 45, sharpTurnMinSpeed: 30,
  deductionHarshBrake: 5, deductionRapidAccel: 5, deductionSharpTurn: 3, deductionOverspeed: 2,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  const day  = String(d.getDate()).padStart(2, '0');
  const mon  = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let   h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${day}-${mon}-${year} ${h}:${min} ${ampm}`;
}

const EVENT_LABELS: Record<string, string> = {
  harsh_brake: 'Harsh Brake', rapid_accel: 'Rapid Accel',
  sharp_turn: 'Sharp Turn',   overspeed: 'Overspeeding',
};
const EVENT_ICONS: Record<string, typeof IconAlertTriangle> = {
  harsh_brake: IconAlertTriangle, rapid_accel: IconGauge,
  sharp_turn:  IconRotateClockwise, overspeed: IconArrowNarrowRight,
};
const SEVERITY_COLOR: Record<string, string> = { low: '#6b7280', medium: '#f59e0b', high: '#dc2626' };

function scoreColor(s: number) { return s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626'; }
function scoreBg(s: number)    { return s >= 80 ? '#f0fdf4' : s >= 60 ? '#fffbeb' : '#fef2f2'; }

function ScoreChart({ history }: { history: ScoreHistory[] }) {
  if (!history.length) return <div style={{ color: '#9ca3af', fontSize: 12, padding: '24px 0' }}>No score history yet.</div>;
  const w = 480, h = 120, pad = { t: 16, r: 16, b: 28, l: 36 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const scores = history.map(r => r.score);
  const dates  = history.map(r => r.date);
  const px = (i: number) => pad.l + (i / Math.max(scores.length - 1, 1)) * iw;
  const py = (v: number) => pad.t + ih - (v / 100) * ih;
  const path = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${path} L${px(scores.length-1).toFixed(1)},${(pad.t+ih).toFixed(1)} L${px(0).toFixed(1)},${(pad.t+ih).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: w, display: 'block' }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={py(v)} y2={py(v)} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3"/>
          <text x={pad.l - 4} y={py(v) + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">{v}</text>
        </g>
      ))}
      <path d={area} fill="rgba(220,38,38,0.08)"/>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round"/>
      {scores.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r="2.5" fill={scoreColor(v)}/>)}
      {dates.filter((_, i) => i === 0 || i === dates.length - 1 || scores.length <= 7).map((d, i) => (
        <text key={i} x={px(i)} y={h - 6} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{d.slice(5)}</text>
      ))}
    </svg>
  );
}

function LocationMapView({ lat, lng, onBack }: { lat: number; lng: number; onBack: () => void }) {
  const delta = 0.008;
  const bbox = `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)}`;
  const src  = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 500, padding: '4px 0' }}>
          <IconArrowLeft size={14}/> Back to Events
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px 4px 0 0', fontSize: 12 }}>
        <IconMapPin size={14} color="#dc2626" style={{ flexShrink: 0 }}/>
        <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>{lat.toFixed(6)}, {lng.toFixed(6)}</span>
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Open in Google Maps →
        </a>
      </div>
      <div style={{ flex: 1, minHeight: 260, border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        <iframe src={src} style={{ width: '100%', height: '100%', border: 'none', minHeight: 260 }} title="Event location" loading="lazy"/>
      </div>
    </div>
  );
}

function VehicleDetailView({ row, onBack }: { row: LeaderboardRow; onBack: () => void }) {
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [events, setEvents]             = useState<DriverEventRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [locationView, setLocationView] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setLocationView(null);
    Promise.all([
      api.get<ScoreHistory[]>(`/driver-behavior/vehicle/${row.vehicleId}/scores?days=30`).then(r => r.data).catch(() => [] as ScoreHistory[]),
      api.get<DriverEventRow[]>(`/driver-behavior/vehicle/${row.vehicleId}/events`).then(r => r.data).catch(() => [] as DriverEventRow[]),
    ]).then(([h, e]) => { setScoreHistory(h); setEvents(e); }).finally(() => setLoading(false));
  }, [row.vehicleId]);

  const vehicleLabel = row.vehicleLicensePlate ?? ([row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ') || row.vehicleName) ?? row.vehicleId.slice(0, 8);

  const tStyle: React.CSSProperties  = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #f0f0f0' };
  const thStyle: React.CSSProperties = { ...tStyle, fontWeight: 600, color: '#9ca3af', fontSize: 11, background: '#fafafa', textAlign: 'left' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Detail header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 500, padding: '4px 0' }}>
          <IconArrowLeft size={14}/> Back
        </button>
        <div style={{ width: 1, height: 16, background: '#e5e7eb' }}/>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{vehicleLabel}</span>
        {row.vehicleMake && <span style={{ fontSize: 11, color: '#9ca3af' }}>{[row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ')}</span>}
        <span style={{ marginLeft: 4, display: 'inline-block', minWidth: 38, padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 13, color: scoreColor(row.score), background: scoreBg(row.score) }}>
          {row.score.toFixed(0)}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Loading…</div>
        ) : locationView ? (
          <LocationMapView lat={locationView.lat} lng={locationView.lng} onBack={() => setLocationView(null)}/>
        ) : (
          <>
            {/* Summary tiles */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Harsh Brake', val: row.harshBrakeCount, color: '#f59e0b' },
                { label: 'Rapid Accel', val: row.rapidAccelCount, color: '#f59e0b' },
                { label: 'Sharp Turn',  val: row.sharpTurnCount,  color: '#f59e0b' },
                { label: 'Overspeed',   val: row.overspeedCount,  color: '#dc2626' },
              ].map(item => (
                <div key={item.label} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '8px 16px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: item.val > 0 ? item.color : '#d1d5db' }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* 30-day score chart */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>30-Day Score Trend</div>
              <ScoreChart history={scoreHistory}/>
            </div>

            {/* Recent events */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Recent Events ({events.length})
              </div>
              {events.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>No events recorded.</div>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
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
                      {events.map(ev => {
                        const Icon = EVENT_ICONS[ev.type] ?? IconAlertTriangle;
                        return (
                          <tr key={ev.id}>
                            <td style={tStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Icon size={13} style={{ color: SEVERITY_COLOR[ev.severity] ?? '#6b7280', flexShrink: 0 }}/>
                                <span style={{ fontWeight: 500 }}>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                              </div>
                            </td>
                            <td style={{ ...tStyle, textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: SEVERITY_COLOR[ev.severity] ?? '#6b7280', textTransform: 'uppercase' }}>{ev.severity}</span>
                            </td>
                            <td style={{ ...tStyle, textAlign: 'right', color: '#6b7280' }}>{ev.speedKmh.toFixed(0)} km/h</td>
                            <td style={{ ...tStyle, color: '#6b7280', fontSize: 11 }}>{fmtDateTime(ev.timestamp)}</td>
                            <td style={{ ...tStyle, textAlign: 'center' }}>
                              {ev.latitude != null && ev.longitude != null ? (
                                <button
                                  onClick={() => setLocationView({ lat: ev.latitude!, lng: ev.longitude! })}
                                  title="View on map"
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#6b7280', display: 'inline-flex', alignItems: 'center', borderRadius: 3 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'none'; }}
                                >
                                  <IconMapPin size={14}/>
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
                              )}
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
  );
}

function SettingsForm() {
  const [form, setForm] = useState<BehaviorSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<BehaviorSettings>('/driver-behavior/settings')
      .then(r => { if (r.data) setForm(r.data); })
      .catch(() => {});
  }, []);

  const update = (k: keyof BehaviorSettings, v: string) => { setForm(f => ({ ...f, [k]: parseFloat(v) || 0 })); setSaved(false); };
  const save = async () => { setSaving(true); try { await api.put('/driver-behavior/settings', form); setSaved(true); } catch {} finally { setSaving(false); } };

  const inp: React.CSSProperties    = { height: 30, padding: '0 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 12, color: '#111', background: '#fff', outline: 'none', width: 90 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', minWidth: 220 };
  const row: React.CSSProperties    = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };

  const threshFields: { key: keyof BehaviorSettings; title: string; unit: string }[] = [
    { key: 'overspeedThreshold',     title: 'Overspeed Threshold',      unit: 'km/h' },
    { key: 'harshBrakeDeceleration', title: 'Harsh Brake Deceleration', unit: 'km/h/s' },
    { key: 'rapidAccelThreshold',    title: 'Rapid Acceleration',       unit: 'km/h/s' },
    { key: 'sharpTurnAngle',         title: 'Sharp Turn Angle',         unit: 'degrees' },
    { key: 'sharpTurnMinSpeed',      title: 'Sharp Turn Min Speed',     unit: 'km/h' },
  ];
  const deductFields: { key: keyof BehaviorSettings; title: string }[] = [
    { key: 'deductionHarshBrake', title: 'Harsh Brake Deduction' },
    { key: 'deductionRapidAccel', title: 'Rapid Accel Deduction' },
    { key: 'deductionSharpTurn',  title: 'Sharp Turn Deduction' },
    { key: 'deductionOverspeed',  title: 'Overspeed Deduction' },
  ];

  return (
    <div style={{ maxWidth: 520, padding: '20px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Detection Thresholds</div>
        {threshFields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Score Deductions (points per event)</div>
        {deductFields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>pts</span>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ height: 32, padding: '0 16px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

export default function DriverBehaviorModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab]       = useState<'scores' | 'settings'>('scores');
  const [rows, setRows]     = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardRow[]>('/driver-behavior/leaderboard')
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rows].sort((a, b) => b.score - a.score);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(1200px, 97vw)', height: 'min(800px, 96vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <IconActivity size={16} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Driver Behavior</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs — hidden when viewing vehicle detail */}
        {!viewRow && (
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0 16px', gap: 0, flexShrink: 0 }}>
            {(['scores', 'settings'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#dc2626' : '#9ca3af',
                background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#dc2626' : 'transparent'}`,
                cursor: 'pointer', marginBottom: -1,
              }}>
                {t === 'scores' ? 'Driver Scores' : 'Settings'}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Vehicle detail view */}
          {viewRow && (
            <VehicleDetailView row={viewRow} onBack={() => setViewRow(null)}/>
          )}

          {/* Leaderboard */}
          {!viewRow && tab === 'scores' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Loading…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                      {['#', 'Vehicle No', 'Vehicle Name', 'Score', 'Harsh Brake', 'Rapid Accel', 'Sharp Turn', 'Overspeed'].map((h, i) => (
                        <th key={i} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: ['Score','Harsh Brake','Rapid Accel','Sharp Turn','Overspeed'].includes(h) ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>No driver behavior data yet.</td></tr>
                    ) : sorted.map((row, i) => (
                      <tr key={row.scoreId}
                        onClick={() => setViewRow(row)}
                        style={{ borderBottom: '1px solid #f7f7f7', borderLeft: `3px solid ${scoreColor(row.score)}`, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{row.vehicleLicensePlate ?? <span style={{ color: '#ccc' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{[row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ') || row.vehicleName || <span style={{ color: '#ccc' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', minWidth: 38, padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 12, color: scoreColor(row.score), background: scoreBg(row.score) }}>
                            {row.score.toFixed(0)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.harshBrakeCount > 0 ? '#f59e0b' : '#ccc' }}>{row.harshBrakeCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.rapidAccelCount > 0 ? '#f59e0b' : '#ccc' }}>{row.rapidAccelCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.sharpTurnCount > 0 ? '#f59e0b' : '#ccc' }}>{row.sharpTurnCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.overspeedCount > 0 ? '#dc2626' : '#ccc' }}>{row.overspeedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Settings tab */}
          {!viewRow && tab === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SettingsForm/>
            </div>
          )}
        </div>

        {!viewRow && tab === 'scores' && sorted.length > 0 && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{sorted.length} vehicles</span>
          </div>
        )}
      </div>
    </div>
  );
}
