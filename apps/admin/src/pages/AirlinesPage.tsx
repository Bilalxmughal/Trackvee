import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowLeft, IconPlus, IconPencil, IconTrash, IconPlane,
  IconUsers, IconCar, IconMapPin, IconNfc, IconRefresh,
} from '@tabler/icons-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import Spinner from '../components/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Airline {
  id: string; name: string; iataCode: string | null;
  contactPerson: string | null; contactPhone: string | null;
  createdAt: string; crewCount: number; vehicleCount: number;
}

interface Crew {
  id: string; displayId: number; airlineId: string;
  name: string; designation: string | null;
  stopName: string | null; stopLat: number | null; stopLng: number | null;
  nfcCardUid: string | null; phone: string | null;
  createdAt: string;
}

interface VehicleRow {
  id: string; display_id: number; name: string;
  license_plate: string | null; type: string; lifecycle_status: string;
}

interface Trip {
  t_id: string; t_flight_number: string | null; t_status: string;
  t_checkin_at: string | null; t_checkin_stop: string | null;
  t_checkout_at: string | null; t_checkout_stop: string | null;
  t_km_travelled: string | null;
  crew_name: string; crew_designation: string | null; crew_display_id: number;
  vehicle_name: string; license_plate: string | null;
}

type AirlineForm = { name: string; iataCode: string; contactPerson: string; contactPhone: string; };
type CrewForm = { name: string; designation: string; stopName: string; stopLat: string; stopLng: string; nfcCardUid: string; phone: string; };

const blankAirline = (): AirlineForm => ({ name: '', iataCode: '', contactPerson: '', contactPhone: '' });
const blankCrew = (): CrewForm => ({ name: '', designation: '', stopName: '', stopLat: '', stopLng: '', nfcCardUid: '', phone: '' });

const DESIGNATIONS = ['Captain', 'Co-Pilot', 'Senior Cabin Crew', 'Cabin Crew', 'Purser', 'Engineer', 'Ground Staff', 'Other'];

// ─── Mini Map ─────────────────────────────────────────────────────────────────

function MapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function CrewMiniMap({ lat, lng, onChange }: {
  lat: number | null; lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = (lat && lng) ? [lat, lng] : [30.3753, 69.3451];
  const zoom = (lat && lng) ? 14 : 5;
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <div style={{ height: 180, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--input-border)', marginTop: 6 }}>
      <MapContainer key={`${lat}-${lng}-init`} center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler onMove={onChange} />
        {lat != null && lng != null && (
          <Marker
            position={[lat, lng]}
            draggable
            ref={markerRef}
            eventHandlers={{ dragend() { const pos = markerRef.current?.getLatLng(); if (pos) onChange(pos.lat, pos.lng); } }}
          />
        )}
      </MapContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AirlinesPage() {
  const { toast } = useToast();
  const { dark } = useTheme();
  const { user } = useAuth();
  const role = (user?.role ?? 'viewer') as UserRole;
  const can = (action: 'view' | 'add' | 'edit' | 'delete') => canPerformAction(role, 'airlines', action);

  // List state
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Airline | null>(null);

  // Airline form modal
  const [airlineModal, setAirlineModal] = useState(false);
  const [airlineForm, setAirlineForm] = useState<AirlineForm>(blankAirline());
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [airlineSaving, setAirlineSaving] = useState(false);
  const [airlineError, setAirlineError] = useState('');

  // Detail tabs
  const [tab, setTab] = useState<'crews' | 'vehicles' | 'trips'>('crews');

  // Crews
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewModal, setCrewModal] = useState(false);
  const [crewForm, setCrewForm] = useState<CrewForm>(blankCrew());
  const [editingCrew, setEditingCrew] = useState<string | null>(null);
  const [crewSaving, setCrewSaving] = useState(false);
  const [crewError, setCrewError] = useState('');

  // Vehicles
  const [assignedVehicles, setAssignedVehicles] = useState<VehicleRow[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleRow[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [assigningVehicle, setAssigningVehicle] = useState('');

  // Trips
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAirlines = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Airline[]>('/airlines');
      setAirlines(r.data);
    } catch { toast('Could not load airlines', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void loadAirlines(); }, [loadAirlines]);

  const loadCrews = useCallback(async (airlineId: string) => {
    setCrewLoading(true);
    try {
      const r = await api.get<Crew[]>(`/airlines/${airlineId}/crews`);
      setCrews(r.data);
    } catch { toast('Could not load crews', 'error'); }
    finally { setCrewLoading(false); }
  }, [toast]);

  const loadVehicles = useCallback(async (airlineId: string) => {
    setVehiclesLoading(true);
    try {
      const [assignedRes, allRes] = await Promise.allSettled([
        api.get<VehicleRow[]>(`/airlines/${airlineId}/vehicles`),
        api.get<VehicleRow[]>('/vehicles'),
      ]);
      if (assignedRes.status === 'fulfilled') setAssignedVehicles(assignedRes.value.data);
      if (allRes.status === 'fulfilled') setAllVehicles(allRes.value.data);
    } catch { /* ignore */ }
    finally { setVehiclesLoading(false); }
  }, []);

  const loadTrips = useCallback(async (airlineId: string) => {
    setTripsLoading(true);
    try {
      const r = await api.get<{ rows: Trip[] }>(`/airlines/trips/list?airlineId=${airlineId}&limit=50`);
      setTrips(r.data.rows);
    } catch { /* ignore */ }
    finally { setTripsLoading(false); }
  }, []);

  const openDetail = (a: Airline) => {
    setSelected(a);
    setTab('crews');
    void loadCrews(a.id);
  };

  useEffect(() => {
    if (!selected) return;
    if (tab === 'crews')    void loadCrews(selected.id);
    if (tab === 'vehicles') void loadVehicles(selected.id);
    if (tab === 'trips')    void loadTrips(selected.id);
  }, [tab, selected, loadCrews, loadVehicles, loadTrips]);

  // ── Airline CRUD ───────────────────────────────────────────────────────────

  const openAirlineAdd = () => {
    setEditingAirline(null); setAirlineForm(blankAirline()); setAirlineError(''); setAirlineModal(true);
  };
  const openAirlineEdit = (a: Airline, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAirline(a.id);
    setAirlineForm({ name: a.name, iataCode: a.iataCode ?? '', contactPerson: a.contactPerson ?? '', contactPhone: a.contactPhone ?? '' });
    setAirlineError(''); setAirlineModal(true);
  };
  const saveAirline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airlineForm.name.trim()) { setAirlineError('Airline name is required.'); return; }
    setAirlineSaving(true); setAirlineError('');
    try {
      const payload = { name: airlineForm.name.trim(), iataCode: airlineForm.iataCode.trim() || null, contactPerson: airlineForm.contactPerson.trim() || null, contactPhone: airlineForm.contactPhone.trim() || null };
      if (editingAirline) { await api.put(`/airlines/${editingAirline}`, payload); toast('Airline updated'); }
      else { await api.post('/airlines', payload); toast('Airline added'); }
      setAirlineModal(false); await loadAirlines();
    } catch (err: any) {
      setAirlineError(err?.response?.data?.message ?? 'Could not save airline.');
    } finally { setAirlineSaving(false); }
  };
  const deleteAirline = async (a: Airline, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${a.name}"? All crews and trips will be deleted.`)) return;
    try { await api.delete(`/airlines/${a.id}`); toast('Airline deleted'); void loadAirlines(); if (selected?.id === a.id) setSelected(null); }
    catch { toast('Could not delete airline', 'error'); }
  };

  // ── Crew CRUD ──────────────────────────────────────────────────────────────

  const openCrewAdd = () => {
    setEditingCrew(null); setCrewForm(blankCrew()); setCrewError(''); setCrewModal(true);
  };
  const openCrewEdit = (c: Crew) => {
    setEditingCrew(c.id);
    setCrewForm({ name: c.name, designation: c.designation ?? '', stopName: c.stopName ?? '', stopLat: c.stopLat != null ? String(c.stopLat) : '', stopLng: c.stopLng != null ? String(c.stopLng) : '', nfcCardUid: c.nfcCardUid ?? '', phone: c.phone ?? '' });
    setCrewError(''); setCrewModal(true);
  };
  const saveCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewForm.name.trim()) { setCrewError('Crew name is required.'); return; }
    setCrewSaving(true); setCrewError('');
    try {
      const payload = {
        name: crewForm.name.trim(),
        designation: crewForm.designation.trim() || null,
        stopName: crewForm.stopName.trim() || null,
        stopLat: crewForm.stopLat ? parseFloat(crewForm.stopLat) : null,
        stopLng: crewForm.stopLng ? parseFloat(crewForm.stopLng) : null,
        nfcCardUid: crewForm.nfcCardUid.trim() || null,
        phone: crewForm.phone.trim() || null,
      };
      if (editingCrew) { await api.put(`/airlines/${selected!.id}/crews/${editingCrew}`, payload); toast('Crew member updated'); }
      else { await api.post(`/airlines/${selected!.id}/crews`, payload); toast('Crew member added'); }
      setCrewModal(false); void loadCrews(selected!.id);
    } catch (err: any) {
      setCrewError(err?.response?.data?.message ?? 'Could not save crew member.');
    } finally { setCrewSaving(false); }
  };
  const deleteCrew = async (c: Crew) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try { await api.delete(`/airlines/${selected!.id}/crews/${c.id}`); toast('Crew member deleted'); void loadCrews(selected!.id); }
    catch { toast('Could not delete crew member', 'error'); }
  };

  // ── Vehicle Assignment ─────────────────────────────────────────────────────

  const assignVehicle = async () => {
    if (!assigningVehicle || !selected) return;
    try { await api.post(`/airlines/${selected.id}/vehicles`, { vehicleId: assigningVehicle }); toast('Vehicle assigned'); setAssigningVehicle(''); void loadVehicles(selected.id); }
    catch { toast('Could not assign vehicle', 'error'); }
  };
  const unassignVehicle = async (vehicleId: string) => {
    if (!selected) return;
    if (!window.confirm('Remove this vehicle from the airline?')) return;
    try { await api.delete(`/airlines/${selected.id}/vehicles/${vehicleId}`); toast('Vehicle unassigned'); void loadVehicles(selected.id); }
    catch { toast('Could not unassign vehicle', 'error'); }
  };

  // ─── Crew map lat/lng helpers ──────────────────────────────────────────────

  const crewLat = crewForm.stopLat ? parseFloat(crewForm.stopLat) : null;
  const crewLng = crewForm.stopLng ? parseFloat(crewForm.stopLng) : null;
  const setCrewCoords = (lat: number, lng: number) => {
    setCrewForm(f => ({ ...f, stopLat: lat.toFixed(6), stopLng: lng.toFixed(6) }));
  };

  // ─── Styles ───────────────────────────────────────────────────────────────

  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, borderBottom: `1px solid ${dark ? '#222' : '#f3f3f3'}`, verticalAlign: 'middle', color: 'var(--text)' };
  const th: React.CSSProperties = { ...td, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, background: dark ? '#161616' : '#fafafa' };
  const badge = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, color, background: bg });
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', border: 'none', borderBottom: active ? '2px solid #dc2626' : '2px solid transparent',
    background: 'none', color: active ? '#dc2626' : 'var(--muted)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
  });
  const fmtDt = (s: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Render: Airline List ─────────────────────────────────────────────────

  if (!selected) {
    return (
      <div>
        <PageHeader title="Airlines" subtitle="Manage airline clients and their crew transport">
          {can('add') && (
            <button onClick={openAirlineAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <IconPlus size={15} /> Add Airline
            </button>
          )}
        </PageHeader>

        <div style={{ padding: '0 24px 24px' }}>
          {loading ? <Spinner style={{ height: 300 }} /> : airlines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>
              No airlines yet. Click "Add Airline" to get started.
            </div>
          ) : (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Airline</th>
                    <th style={th}>IATA</th>
                    <th style={th}>Contact</th>
                    <th style={th}>Crews</th>
                    <th style={th}>Vehicles</th>
                    <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {airlines.map(a => (
                    <tr key={a.id} onClick={() => openDetail(a)} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = dark ? '#1a1a1a' : '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: dark ? '#1e1e1e' : '#fff0f0', display: 'grid', placeItems: 'center' }}>
                            <IconPlane size={18} color="#dc2626" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>{a.iataCode ? <span style={badge('#1d4ed8', dark ? '#1e2a3a' : '#eff6ff')}>{a.iataCode}</span> : '—'}</td>
                      <td style={td}>
                        <div style={{ fontSize: 13 }}>{a.contactPerson || '—'}</div>
                        {a.contactPhone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.contactPhone}</div>}
                      </td>
                      <td style={td}><span style={badge('#059669', dark ? '#052e16' : '#f0fdf4')}>{a.crewCount} crew</span></td>
                      <td style={td}><span style={badge('#7c3aed', dark ? '#1e1a3a' : '#f5f3ff')}>{a.vehicleCount} vehicles</span></td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }} onClick={e => e.stopPropagation()}>
                          {can('edit') && <button onClick={e => openAirlineEdit(a, e)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconPencil size={14} color="var(--muted)" /></button>}
                          {can('delete') && <button onClick={e => deleteAirline(a, e)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Airline Modal */}
        <Modal open={airlineModal} title={editingAirline ? 'Edit Airline' : 'Add Airline'} onClose={() => setAirlineModal(false)}>
            <form onSubmit={saveAirline}>
              <FormField label="Airline Name *">
                <input style={inputStyle} value={airlineForm.name} onChange={e => setAirlineForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PIA Ground Transport" autoFocus />
              </FormField>
              <FormField label="IATA Code">
                <input style={inputStyle} value={airlineForm.iataCode} onChange={e => setAirlineForm(f => ({ ...f, iataCode: e.target.value.toUpperCase() }))} placeholder="e.g. PK" maxLength={10} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Contact Person">
                  <input style={inputStyle} value={airlineForm.contactPerson} onChange={e => setAirlineForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name" />
                </FormField>
                <FormField label="Contact Phone">
                  <input style={inputStyle} value={airlineForm.contactPhone} onChange={e => setAirlineForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+92 300 0000000" />
                </FormField>
              </div>
              {airlineError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{airlineError}</div>}
              <FormActions onClose={() => setAirlineModal(false)} loading={airlineSaving} />
            </form>
        </Modal>
      </div>
    );
  }

  // ─── Render: Airline Detail ───────────────────────────────────────────────

  const unassignedVehicles = allVehicles.filter(v => !assignedVehicles.some(av => av.id === v.id));

  return (
    <div>
      <PageHeader
        title={selected.name}
        subtitle={[selected.iataCode, selected.contactPerson].filter(Boolean).join(' · ') || 'Airline Detail'}
      >
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
          <IconArrowLeft size={15} /> All Airlines
        </button>
      </PageHeader>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, paddingLeft: 24, display: 'flex', gap: 4 }}>
        <button style={tabBtn(tab === 'crews')} onClick={() => setTab('crews')}><IconUsers size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Crews ({crews.length})</button>
        <button style={tabBtn(tab === 'vehicles')} onClick={() => setTab('vehicles')}><IconCar size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Vehicles</button>
        <button style={tabBtn(tab === 'trips')} onClick={() => setTab('trips')}><IconPlane size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Trips</button>
      </div>

      <div style={{ padding: 24 }}>

        {/* ── CREWS TAB ──────────────────────────────────────────────────── */}
        {tab === 'crews' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              {can('add') && (
                <button onClick={openCrewAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  <IconPlus size={15} /> Add Crew
                </button>
              )}
            </div>

            {crewLoading ? <Spinner style={{ height: 200 }} /> : crews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No crew members yet.</div>
            ) : (
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>ID</th>
                      <th style={th}>Name</th>
                      <th style={th}>Designation</th>
                      <th style={th}>Stop Location</th>
                      <th style={th}>Coordinates</th>
                      <th style={th}>NFC Card</th>
                      <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crews.map(c => (
                      <tr key={c.id}>
                        <td style={td}><span style={badge('#dc2626', dark ? '#2a1010' : '#fff0f0')}>#{c.displayId}</span></td>
                        <td style={td}><div style={{ fontWeight: 500 }}>{c.name}</div>{c.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone}</div>}</td>
                        <td style={td}>{c.designation || '—'}</td>
                        <td style={td}>
                          {c.stopName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <IconMapPin size={13} color="#dc2626" />
                              <span style={{ fontSize: 12 }}>{c.stopName}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={td}>
                          {c.stopLat && c.stopLng
                            ? <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{Number(c.stopLat).toFixed(5)}, {Number(c.stopLng).toFixed(5)}</span>
                            : '—'}
                        </td>
                        <td style={td}>
                          {c.nfcCardUid
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconNfc size={13} color="#059669" /><code style={{ fontSize: 11 }}>{c.nfcCardUid}</code></span>
                            : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Not assigned</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            {can('edit') && <button onClick={() => openCrewEdit(c)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconPencil size={14} color="var(--muted)" /></button>}
                            {can('delete') && <button onClick={() => deleteCrew(c)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Crew Modal */}
            <Modal open={crewModal} title={editingCrew ? 'Edit Crew Member' : 'Add Crew Member'} onClose={() => setCrewModal(false)} width={560}>
                <form onSubmit={saveCrew}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Full Name *">
                      <input style={inputStyle} value={crewForm.name} onChange={e => setCrewForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ali Ahmed" autoFocus />
                    </FormField>
                    <FormField label="Designation">
                      <select style={selectStyle} value={crewForm.designation} onChange={e => setCrewForm(f => ({ ...f, designation: e.target.value }))}>
                        <option value="">Select designation</option>
                        {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Phone">
                    <input style={inputStyle} value={crewForm.phone} onChange={e => setCrewForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92 300 0000000" />
                  </FormField>

                  <div style={{ borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}`, margin: '16px 0', paddingTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>Drop-off Location</div>

                    <FormField label="Stop Name">
                      <input style={inputStyle} value={crewForm.stopName} onChange={e => setCrewForm(f => ({ ...f, stopName: e.target.value }))} placeholder="e.g. DHA Phase 5" />
                    </FormField>

                    {crewLat && crewLng && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: 6 }}>
                        📍 {crewLat.toFixed(5)}, {crewLng.toFixed(5)}
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                      Map pe click karein ya pin drag karein location set karne ke liye:
                    </div>
                    <CrewMiniMap lat={crewLat} lng={crewLng} onChange={setCrewCoords} />
                  </div>

                  <div style={{ borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}`, margin: '16px 0', paddingTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>NFC Card</div>
                    <FormField label="NFC Card UID">
                      <input style={inputStyle} value={crewForm.nfcCardUid} onChange={e => setCrewForm(f => ({ ...f, nfcCardUid: e.target.value }))} placeholder="e.g. 04A32FB1095C80" />
                    </FormField>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -8 }}>
                      Enter manually, or scan from the tablet app and copy the UID here.
                    </div>
                  </div>

                  {crewError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{crewError}</div>}
                  <FormActions onClose={() => setCrewModal(false)} loading={crewSaving} />
                </form>
            </Modal>
          </>
        )}

        {/* ── VEHICLES TAB ───────────────────────────────────────────────── */}
        {tab === 'vehicles' && (
          <>
            {can('add') && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
                <select style={{ ...selectStyle, maxWidth: 320 }} value={assigningVehicle} onChange={e => setAssigningVehicle(e.target.value)}>
                  <option value="">Select vehicle to assign…</option>
                  {unassignedVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.license_plate || `#${v.display_id}`} · {v.name}</option>
                  ))}
                </select>
                <button onClick={assignVehicle} disabled={!assigningVehicle} style={{ padding: '8px 16px', background: assigningVehicle ? '#dc2626' : '#fca5a5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: assigningVehicle ? 'pointer' : 'default' }}>
                  Assign
                </button>
              </div>
            )}

            {vehiclesLoading ? <Spinner style={{ height: 200 }} /> : assignedVehicles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No vehicles assigned yet.</div>
            ) : (
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Vehicle</th>
                      <th style={th}>Plate</th>
                      <th style={th}>Type</th>
                      <th style={th}>Status</th>
                      {can('delete') && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {assignedVehicles.map(v => (
                      <tr key={v.id}>
                        <td style={td}><span style={{ fontWeight: 500 }}>{v.name}</span></td>
                        <td style={td}>{v.license_plate || '—'}</td>
                        <td style={td}>{v.type}</td>
                        <td style={td}><span style={badge(v.lifecycle_status === 'active' ? '#059669' : '#6b7280', dark ? '#1a1a1a' : '#f9f9f9')}>{v.lifecycle_status}</span></td>
                        {can('delete') && <td style={{ ...td, textAlign: 'right' }}><button onClick={() => unassignVehicle(v.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── TRIPS TAB ──────────────────────────────────────────────────── */}
        {tab === 'trips' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => loadTrips(selected.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                <IconRefresh size={14} /> Refresh
              </button>
            </div>

            {tripsLoading ? <Spinner style={{ height: 200 }} /> : trips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No trips recorded yet.</div>
            ) : (
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Crew</th>
                      <th style={th}>Flight</th>
                      <th style={th}>Vehicle</th>
                      <th style={th}>Check-in</th>
                      <th style={th}>Check-out</th>
                      <th style={th}>KM</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map(t => (
                      <tr key={t.t_id}>
                        <td style={td}>
                          <div style={{ fontWeight: 500 }}>{t.crew_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.crew_designation || ''} · #{t.crew_display_id}</div>
                        </td>
                        <td style={td}>{t.t_flight_number ? <span style={badge('#1d4ed8', dark ? '#1e2a3a' : '#eff6ff')}>{t.t_flight_number}</span> : '—'}</td>
                        <td style={td}>{t.vehicle_name}<br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.license_plate || ''}</span></td>
                        <td style={td}>
                          <div style={{ fontSize: 12 }}>{fmtDt(t.t_checkin_at)}</div>
                          {t.t_checkin_stop && <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={11} />{t.t_checkin_stop}</div>}
                        </td>
                        <td style={td}>
                          <div style={{ fontSize: 12 }}>{fmtDt(t.t_checkout_at)}</div>
                          {t.t_checkout_stop && <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={11} />{t.t_checkout_stop}</div>}
                        </td>
                        <td style={td}>{t.t_km_travelled ? <strong style={{ color: '#059669' }}>{Number(t.t_km_travelled).toFixed(1)} km</strong> : '—'}</td>
                        <td style={td}>
                          <span style={badge(t.t_status === 'completed' ? '#059669' : '#f59e0b', dark ? '#1a1a1a' : '#f9f9f9')}>
                            {t.t_status === 'in_progress' ? 'In Progress' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
