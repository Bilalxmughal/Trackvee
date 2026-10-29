import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconArrowLeft, IconPlus, IconPencil, IconTrash, IconPlane,
  IconUsers, IconCar, IconMapPin, IconNfc, IconRefresh,
  IconLayoutDashboard, IconDownload, IconUpload, IconCopy,
  IconEye, IconHistory, IconSearch,
} from '@tabler/icons-react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/client';
import CustomSelect from '../components/CustomSelect';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import Spinner from '../components/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Airline {
  id: string; displayId: number; name: string; iataCode: string | null;
  contactPerson: string | null; contactPhone: string | null;
  createdAt: string; crewCount: number; vehicleCount: number;
}
interface Crew {
  id: string; displayId: number; airlineId: string; airlineName?: string;
  name: string; designation: string | null;
  stopName: string | null; stopLat: number | null; stopLng: number | null;
  nfcCardUid: string | null; phone: string | null; createdAt: string;
}
interface VehicleRow {
  id: string; display_id: number; name: string;
  license_plate: string | null; type: string; lifecycle_status: string;
  airlineName?: string;
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
type CrewForm = { name: string; designation: string; stopName: string; stopLat: string; stopLng: string; nfcCardUid: string; phone: string; airlineId: string; };
type PageView = 'dashboard' | 'airlines' | 'crews' | 'vehicles' | 'trips';

interface GroupedTrip {
  group_id: string; crew_count: number;
  vehicle_id: string; vehicle_name: string; license_plate: string | null; vehicle_display_id: number;
  flight_number: string | null; airline_id: string; airline_name: string;
  origin: string | null; origin_lat: number | null; origin_lng: number | null;
  checkin_at: string; checkout_at: string | null;
  km_travelled: number; status: string; crew_names: string; trip_ids: string[];
}
interface TripDetailData {
  groupId: string;
  vehicle: { id: string; name: string; licensePlate: string | null; displayId: number };
  trips: Array<{
    id: string; status: string;
    checkin_at: string; checkin_stop: string | null; checkin_lat: number | null; checkin_lng: number | null;
    checkout_at: string | null; checkout_stop: string | null; checkout_lat: number | null; checkout_lng: number | null;
    km_travelled: string | null; flight_number: string | null;
    crew_name: string; crew_display_id: number; crew_designation: string | null; crew_phone: string | null;
  }>;
  route: Array<{ latitude: number; longitude: number; speed: number; heading: number; timestamp: string }>;
  checkin_at: string; checkout_at: string | null; checkin_stop: string | null; flight_number: string | null;
}

const blankAirline = (): AirlineForm => ({ name: '', iataCode: '', contactPerson: '', contactPhone: '' });
const blankCrew = (airlineId = ''): CrewForm => ({ name: '', designation: '', stopName: '', stopLat: '', stopLng: '', nfcCardUid: '', phone: '', airlineId });
const DESIGNATIONS = ['Captain', 'Co-Pilot', 'Senior Cabin Crew', 'Cabin Crew', 'Purser', 'Engineer', 'Ground Staff', 'Other'];

// ─── Mini Map ─────────────────────────────────────────────────────────────────

function MapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function CrewMiniMap({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void; }) {
  const center: [number, number] = (lat && lng) ? [lat, lng] : [30.3753, 69.3451];
  const zoom = (lat && lng) ? 14 : 5;
  const markerRef = useRef<L.Marker | null>(null);
  return (
    <div style={{ height: 180, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--input-border)', marginTop: 6 }}>
      <MapContainer key={`${lat}-${lng}-init`} center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler onMove={onChange} />
        {lat != null && lng != null && (
          <Marker position={[lat, lng]} draggable ref={markerRef}
            eventHandlers={{ dragend() { const pos = markerRef.current?.getLatLng(); if (pos) onChange(pos.lat, pos.lng); } }} />
        )}
      </MapContainer>
    </div>
  );
}

// ─── Sub-Sidebar ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: PageView; path: string; icon: React.ElementType; label: string }[] = [
  { key: 'dashboard', path: '/airlines/dashboard', icon: IconLayoutDashboard, label: 'Dashboard' },
  { key: 'airlines',  path: '/airlines/clients',   icon: IconPlane,           label: 'Clients' },
  { key: 'crews',     path: '/airlines/crew',      icon: IconUsers,            label: 'Crew' },
  { key: 'vehicles',  path: '/airlines/vehicles',  icon: IconCar,              label: 'Vehicle' },
  { key: 'trips',     path: '/airlines/trips',     icon: IconHistory,          label: 'Trips' },
];

function pathToView(pathname: string): PageView {
  if (pathname.includes('/airlines/dashboard')) return 'dashboard';
  if (pathname.includes('/airlines/clients'))   return 'airlines';
  if (pathname.includes('/airlines/crew'))      return 'crews';
  if (pathname.includes('/airlines/vehicles'))  return 'vehicles';
  if (pathname.includes('/airlines/trips'))     return 'trips';
  return 'airlines';
}

function SubSidebar({ view, onNavigate, dark }: { view: PageView; onNavigate: (path: string) => void; dark: boolean; }) {
  return (
    <div style={{
      width: 180, flexShrink: 0, borderRight: `1px solid ${dark ? '#222' : '#f0f0f0'}`,
      paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ padding: '0 12px 10px', fontSize: 10, fontWeight: 700, color: dark ? '#444' : '#ccc', textTransform: 'uppercase', letterSpacing: 1 }}>
        Airlines Module
      </div>
      {NAV_ITEMS.map(({ key, path, icon: Icon, label }) => {
        const active = view === key;
        return (
          <button key={key} onClick={() => onNavigate(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? '#dc2626' : (dark ? '#888' : '#666'),
              background: active ? (dark ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.06)') : 'transparent',
              borderLeft: `3px solid ${active ? '#dc2626' : 'transparent'}`,
              fontSize: 13, fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
            } as React.CSSProperties}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'; e.currentTarget.style.color = dark ? '#e5e5e5' : '#333'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = dark ? '#888' : '#666'; } }}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Trip Replay Map ──────────────────────────────────────────────────────────

function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.panTo([lat, lng], { animate: true }); }, [lat, lng, map]);
  return null;
}

function TripReplayMap({ route, dark }: {
  route: Array<{ latitude: number; longitude: number; speed: number; heading: number; timestamp: string }>;
  dark: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing || route.length === 0) return;
    intervalRef.current = setInterval(() => {
      setIdx(prev => {
        if (prev >= route.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, route.length]);

  const routePoints: [number, number][] = route.map(p => [p.latitude, p.longitude]);
  const center: [number, number] = routePoints[0] ?? [30.3753, 69.3451];
  const current = route[idx];

  return (
    <div>
      <div style={{ height: 360, borderRadius: 10, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#e0e0e0'}` }}>
        {route.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: dark ? '#161616' : '#f5f5f5', color: 'var(--muted)', fontSize: 13 }}>
            No GPS data available for this trip
          </div>
        ) : (
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {routePoints.length > 1 && <Polyline positions={routePoints} color="#dc2626" weight={3} opacity={0.7} />}
            {routePoints[0] && <Marker position={routePoints[0]} icon={L.divIcon({ className: '', html: '<div style="background:#059669;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })} />}
            {routePoints[routePoints.length - 1] && <Marker position={routePoints[routePoints.length - 1]} icon={L.divIcon({ className: '', html: '<div style="background:#7c3aed;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })} />}
            {current && (
              <>
                <Marker position={[current.latitude, current.longitude]} icon={L.divIcon({ className: 'leaflet-interactive', html: '<div style="background:#1d4ed8;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.5)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })} />
                <MapFlyTo lat={current.latitude} lng={current.longitude} />
              </>
            )}
          </MapContainer>
        )}
      </div>
      {route.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button onClick={() => setPlaying(p => !p)} style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={() => { setPlaying(false); setIdx(0); }} style={{ padding: '6px 12px', border: `1px solid ${dark ? '#333' : '#e0e0e0'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
              ↺ Reset
            </button>
            <input type="range" min={0} max={route.length - 1} value={idx}
              onChange={e => { setPlaying(false); setIdx(Number(e.target.value)); }}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{idx + 1}/{route.length}</span>
          </div>
          {current && (
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              <span>{new Date(current.timestamp).toLocaleTimeString()}</span>
              <span>{Number(current.speed ?? 0).toFixed(1)} km/h</span>
              <span style={{ fontFamily: 'monospace' }}>{Number(current.latitude).toFixed(5)}, {Number(current.longitude).toFixed(5)}</span>
            </div>
          )}
        </>
      )}
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
  const navigate = useNavigate();
  const location = useLocation();

  const view = pathToView(location.pathname);
  const setView = (v: PageView) => {
    const item = NAV_ITEMS.find(n => n.key === v);
    if (item) navigate(item.path);
  };

  // Redirect bare /airlines to /airlines/clients
  useEffect(() => {
    if (location.pathname === '/airlines' || location.pathname === '/airlines/') {
      navigate('/airlines/clients', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Airlines
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Airline | null>(null);
  const [airlineModal, setAirlineModal] = useState(false);
  const [airlineForm, setAirlineForm] = useState<AirlineForm>(blankAirline());
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [airlineSaving, setAirlineSaving] = useState(false);
  const [airlineError, setAirlineError] = useState('');

  // Airline detail tabs
  const [tab, setTab] = useState<'crews' | 'vehicles' | 'trips'>('crews');

  // Crews (detail)
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewModal, setCrewModal] = useState(false);
  const [crewForm, setCrewForm] = useState<CrewForm>(blankCrew());
  const [editingCrew, setEditingCrew] = useState<string | null>(null);
  const [crewSaving, setCrewSaving] = useState(false);
  const [crewError, setCrewError] = useState('');

  // Vehicles (detail)
  const [assignedVehicles, setAssignedVehicles] = useState<VehicleRow[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleRow[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [assigningVehicle, setAssigningVehicle] = useState('');

  // Trips (detail)
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  // All Crews view
  const [allCrews, setAllCrews] = useState<Crew[]>([]);
  const [allCrewsLoading, setAllCrewsLoading] = useState(false);

  // All Vehicles view
  const [allVehiclesView, setAllVehiclesView] = useState<(VehicleRow & { airlineName: string })[]>([]);
  const [allVehiclesLoading, setAllVehiclesLoading] = useState(false);

  // Dashboard stats
  const [stats, setStats] = useState({ airlines: 0, crews: 0, vehicles: 0, activeTrips: 0 });
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Trips page
  const [groupedTrips, setGroupedTrips] = useState<GroupedTrip[]>([]);
  const [tripsListLoading, setTripsListLoading] = useState(false);
  const [tripSearch, setTripSearch] = useState('');
  const [tripStop, setTripStop] = useState('');
  const [tripStatus, setTripStatus] = useState('');
  const [tripDateRange, setTripDateRange] = useState<DateRange | undefined>(undefined);
  const [tripDetail, setTripDetail] = useState<TripDetailData | null>(null);
  const [tripDetailLoading, setTripDetailLoading] = useState(false);

  // ── Styles ────────────────────────────────────────────────────────────────
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, borderBottom: `1px solid ${dark ? '#222' : '#f3f3f3'}`, verticalAlign: 'middle', color: 'var(--text)', textAlign: 'left' };
  const th: React.CSSProperties = { ...td, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, background: dark ? '#161616' : '#fafafa' };
  const badge = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, color, background: bg });
  const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '8px 18px', border: 'none', borderBottom: active ? '2px solid #dc2626' : '2px solid transparent', background: 'none', color: active ? '#dc2626' : 'var(--muted)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer' });
  const fmtDt = (s: string | null) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadAirlines = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<Airline[]>('/airlines'); setAirlines(r.data); }
    catch { toast('Could not load airlines', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void loadAirlines(); }, [loadAirlines]);

  const loadCrews = useCallback(async (airlineId: string) => {
    setCrewLoading(true);
    try { const r = await api.get<Crew[]>(`/airlines/${airlineId}/crews`); setCrews(r.data); }
    catch { toast('Could not load crews', 'error'); }
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
    } catch {}
    finally { setVehiclesLoading(false); }
  }, []);

  const loadTrips = useCallback(async (airlineId: string) => {
    setTripsLoading(true);
    try { const r = await api.get<{ rows: Trip[] }>(`/airlines/trips/list?airlineId=${airlineId}&limit=50`); setTrips(r.data.rows); }
    catch {}
    finally { setTripsLoading(false); }
  }, []);

  const openDetail = (a: Airline) => { setSelected(a); setTab('crews'); void loadCrews(a.id); };

  useEffect(() => {
    if (!selected) return;
    if (tab === 'crews')    void loadCrews(selected.id);
    if (tab === 'vehicles') void loadVehicles(selected.id);
    if (tab === 'trips')    void loadTrips(selected.id);
  }, [tab, selected, loadCrews, loadVehicles, loadTrips]);

  // All Crews view loader
  const loadAllCrews = useCallback(async () => {
    setAllCrewsLoading(true);
    try {
      const airlineList = airlines.length ? airlines : (await api.get<Airline[]>('/airlines')).data;
      const results = await Promise.allSettled(airlineList.map(a => api.get<Crew[]>(`/airlines/${a.id}/crews`).then(r => r.data.map(c => ({ ...c, airlineName: a.name })))));
      const flat: Crew[] = [];
      results.forEach(r => { if (r.status === 'fulfilled') flat.push(...r.value); });
      setAllCrews(flat);
    } catch {}
    finally { setAllCrewsLoading(false); }
  }, [airlines]);

  // All Vehicles view loader
  const loadAllVehicles = useCallback(async () => {
    setAllVehiclesLoading(true);
    try {
      const airlineList = airlines.length ? airlines : (await api.get<Airline[]>('/airlines')).data;
      const results = await Promise.allSettled(airlineList.map(a => api.get<VehicleRow[]>(`/airlines/${a.id}/vehicles`).then(r => r.data.map(v => ({ ...v, airlineName: a.name })))));
      const flat: (VehicleRow & { airlineName: string })[] = [];
      results.forEach(r => { if (r.status === 'fulfilled') flat.push(...r.value); });
      setAllVehiclesView(flat);
    } catch {}
    finally { setAllVehiclesLoading(false); }
  }, [airlines]);

  // Dashboard loader
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [airlinesRes, tripsRes] = await Promise.allSettled([
        api.get<Airline[]>('/airlines'),
        api.get<{ rows: Trip[] }>('/airlines/trips/list?limit=10'),
      ]);
      const airlineList = airlinesRes.status === 'fulfilled' ? airlinesRes.value.data : [];
      const totalCrew = airlineList.reduce((s, a) => s + a.crewCount, 0);
      const totalVehicles = airlineList.reduce((s, a) => s + a.vehicleCount, 0);
      const tripRows = tripsRes.status === 'fulfilled' ? tripsRes.value.data.rows : [];
      const activeTrips = tripRows.filter(t => t.t_status === 'in_progress').length;
      setStats({ airlines: airlineList.length, crews: totalCrew, vehicles: totalVehicles, activeTrips });
      setRecentTrips(tripRows);
    } catch {}
    finally { setDashLoading(false); }
  }, []);

  const loadGroupedTrips = useCallback(async (opts?: { search?: string; stop?: string; status?: string; dateRange?: DateRange }) => {
    setTripsListLoading(true);
    try {
      const search    = opts?.search    ?? tripSearch;
      const stop      = opts?.stop      ?? tripStop;
      const status    = opts?.status    ?? tripStatus;
      const dateRange = opts?.dateRange !== undefined ? opts.dateRange : tripDateRange;
      const params = new URLSearchParams();
      if (search)            params.set('crewName', search);
      if (stop)              params.set('stop', stop);
      if (status)            params.set('status', status);
      if (dateRange?.from)   params.set('from', dateRange.from.toISOString());
      if (dateRange?.to)     params.set('to', new Date(dateRange.to!.setHours(23, 59, 59)).toISOString());
      params.set('limit', '100');
      const r = await api.get<{ rows: GroupedTrip[] }>(`/airlines/trips/grouped?${params}`);
      setGroupedTrips(r.data.rows ?? []);
    } catch { toast('Could not load trips', 'error'); }
    finally { setTripsListLoading(false); }
  }, [tripSearch, tripStop, tripStatus, tripDateRange, toast]);

  const openTripDetail = async (groupId: string) => {
    setTripDetail(null); setTripDetailLoading(true);
    try {
      const r = await api.get<TripDetailData>(`/airlines/trips/grouped/${groupId}/detail`);
      setTripDetail(r.data);
    } catch { toast('Could not load trip detail', 'error'); }
    finally { setTripDetailLoading(false); }
  };

  const deleteTrip = async (tripIds: string[]) => {
    if (!window.confirm(`Delete this trip (${tripIds.length} crew record${tripIds.length > 1 ? 's' : ''})?`)) return;
    try {
      await api.delete('/airlines/trips/bulk', { data: { tripIds } });
      toast('Trip deleted');
      void loadGroupedTrips();
    } catch { toast('Could not delete trip', 'error'); }
  };

  useEffect(() => {
    if (view === 'dashboard') void loadDashboard();
    if (view === 'crews')     void loadAllCrews();
    if (view === 'vehicles')  void loadAllVehicles();
    if (view === 'airlines')  { setSelected(null); }
    if (view === 'trips')     void loadGroupedTrips();
  }, [view]);

  // ── Airline CRUD ──────────────────────────────────────────────────────────

  const openAirlineAdd = () => { setEditingAirline(null); setAirlineForm(blankAirline()); setAirlineError(''); setAirlineModal(true); };
  const openAirlineEdit = (a: Airline) => {
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
    } catch (err: any) { setAirlineError(err?.response?.data?.message ?? 'Could not save airline.'); }
    finally { setAirlineSaving(false); }
  };
  const deleteAirline = async (a: Airline) => {
    if (!window.confirm(`Delete "${a.name}"? All crews and trips will be deleted.`)) return;
    try { await api.delete(`/airlines/${a.id}`); toast('Airline deleted'); void loadAirlines(); if (selected?.id === a.id) setSelected(null); }
    catch { toast('Could not delete airline', 'error'); }
  };

  // ── Crew CRUD ─────────────────────────────────────────────────────────────

  const crewLat = crewForm.stopLat ? parseFloat(crewForm.stopLat) : null;
  const crewLng = crewForm.stopLng ? parseFloat(crewForm.stopLng) : null;
  const setCrewCoords = (lat: number, lng: number) => setCrewForm(f => ({ ...f, stopLat: lat.toFixed(6), stopLng: lng.toFixed(6) }));

  const openCrewAdd = (airlineId?: string) => { setEditingCrew(null); setCrewForm(blankCrew(airlineId ?? selected?.id ?? '')); setCrewError(''); setCrewModal(true); };
  const openCrewEdit = (c: Crew) => {
    setEditingCrew(c.id);
    setCrewForm({ name: c.name, designation: c.designation ?? '', stopName: c.stopName ?? '', stopLat: c.stopLat != null ? String(c.stopLat) : '', stopLng: c.stopLng != null ? String(c.stopLng) : '', nfcCardUid: c.nfcCardUid ?? '', phone: c.phone ?? '', airlineId: c.airlineId });
    setCrewError(''); setCrewModal(true);
  };
  const saveCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewForm.name.trim()) { setCrewError('Crew name is required.'); return; }
    const targetAirlineId = crewForm.airlineId || selected?.id;
    if (!targetAirlineId) { setCrewError('Please select an airline.'); return; }
    setCrewSaving(true); setCrewError('');
    try {
      const payload = { name: crewForm.name.trim(), designation: crewForm.designation.trim() || null, stopName: crewForm.stopName.trim() || null, stopLat: crewForm.stopLat ? parseFloat(crewForm.stopLat) : null, stopLng: crewForm.stopLng ? parseFloat(crewForm.stopLng) : null, nfcCardUid: crewForm.nfcCardUid.trim() || null, phone: crewForm.phone.trim() || null };
      if (editingCrew) { await api.put(`/airlines/${targetAirlineId}/crews/${editingCrew}`, payload); toast('Crew member updated'); }
      else { await api.post(`/airlines/${targetAirlineId}/crews`, payload); toast('Crew member added'); }
      setCrewModal(false);
      if (selected) void loadCrews(selected.id);
      if (view === 'crews') void loadAllCrews();
    } catch (err: any) { setCrewError(err?.response?.data?.message ?? 'Could not save crew member.'); }
    finally { setCrewSaving(false); }
  };
  const deleteCrew = async (c: Crew) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await api.delete(`/airlines/${c.airlineId}/crews/${c.id}`); toast('Crew member deleted');
      if (selected) void loadCrews(selected.id);
      if (view === 'crews') void loadAllCrews();
    } catch { toast('Could not delete crew member', 'error'); }
  };

  // ── Vehicle Assignment ────────────────────────────────────────────────────

  const assignVehicle = async () => {
    if (!assigningVehicle || !selected) return;
    try { await api.post(`/airlines/${selected.id}/vehicles`, { vehicleId: assigningVehicle }); toast('Vehicle assigned'); setAssigningVehicle(''); void loadVehicles(selected.id); }
    catch { toast('Could not assign vehicle', 'error'); }
  };
  const unassignVehicle = async (vehicleId: string, airlineId?: string) => {
    const aid = airlineId ?? selected?.id;
    if (!aid) return;
    if (!window.confirm('Remove this vehicle from the airline?')) return;
    try { await api.delete(`/airlines/${aid}/vehicles/${vehicleId}`); toast('Vehicle unassigned'); void loadVehicles(aid); if (view === 'vehicles') void loadAllVehicles(); }
    catch { toast('Could not unassign vehicle', 'error'); }
  };

  // ── Import / Export ───────────────────────────────────────────────────────

  const exportAirlines = () => {
    const rows = [['ID', 'Name', 'IATA Code', 'Contact Person', 'Contact Phone', 'Crew Count', 'Vehicle Count', 'Created At']];
    airlines.forEach(a => rows.push([a.id, a.name, a.iataCode ?? '', a.contactPerson ?? '', a.contactPhone ?? '', String(a.crewCount), String(a.vehicleCount), a.createdAt]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'airlines.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportCrews = () => {
    const rows = [['ID', 'Name', 'Designation', 'Airline', 'Stop Name', 'Latitude', 'Longitude', 'NFC Card UID', 'Phone', 'Created At']];
    allCrews.forEach(c => rows.push([c.id, c.name, c.designation ?? '', c.airlineName ?? '', c.stopName ?? '', c.stopLat != null ? String(c.stopLat) : '', c.stopLng != null ? String(c.stopLng) : '', c.nfcCardUid ?? '', c.phone ?? '', c.createdAt]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'crews.csv'; a.click(); URL.revokeObjectURL(url);
  };

  // ── Import modals state ───────────────────────────────────────────────────
  const [importModal, setImportModal] = useState<'airlines' | 'crews' | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const downloadSampleAirlines = () => downloadCsv(
    `"Name","IATA Code","Contact Person","Contact Phone"\n"PIA Ground Transport","PK","Ali Khan","+92 300 0000000"\n"Emirates Crew Logistics","EK","Sara Ahmed","+971 50 0000000"`,
    'sample_airlines.csv',
  );

  const downloadSampleCrews = () => downloadCsv(
    `"Name","Designation","Airline","Stop Name","Latitude","Longitude","NFC Card UID","Phone"\n"Ahmed Raza","Cabin Crew","${airlines[0]?.name ?? 'PIA Ground Transport'}","Allama Iqbal Airport","31.52190","74.40361","04:AB:12:CD","0300-0000000"\n"Sara Malik","Captain","${airlines[0]?.name ?? 'PIA Ground Transport'}","Terminal 2","31.52500","74.40900","","0321-0000000"`,
    'sample_crews.csv',
  );

  const handleImportFile = async () => {
    if (!importFile || !importModal) return;
    setImporting(true);
    const text = await importFile.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast('CSV file is empty or has no data rows', 'error'); setImporting(false); return; }
    const parseRow = (line: string) => line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    const header = parseRow(lines[0]).map(h => h.toLowerCase());
    let added = 0; let failed = 0;

    if (importModal === 'crews') {
      const nameIdx = header.indexOf('name'); const airlineIdx = header.indexOf('airline');
      const desigIdx = header.indexOf('designation'); const stopIdx = header.indexOf('stop name');
      const latIdx = header.indexOf('latitude'); const lngIdx = header.indexOf('longitude');
      const nfcIdx = header.indexOf('nfc card uid'); const phoneIdx = header.indexOf('phone');
      if (nameIdx === -1 || airlineIdx === -1) { toast('CSV must have "Name" and "Airline" columns', 'error'); setImporting(false); return; }
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const airlineName = cols[airlineIdx];
        const airline = airlines.find(a => a.name.toLowerCase() === airlineName.toLowerCase() || (a.iataCode ?? '').toLowerCase() === airlineName.toLowerCase());
        if (!airline) { failed++; continue; }
        try {
          await api.post(`/airlines/${airline.id}/crews`, {
            name: cols[nameIdx], designation: desigIdx >= 0 ? cols[desigIdx] || null : null,
            stopName: stopIdx >= 0 ? cols[stopIdx] || null : null,
            stopLat: latIdx >= 0 && cols[latIdx] ? parseFloat(cols[latIdx]) : null,
            stopLng: lngIdx >= 0 && cols[lngIdx] ? parseFloat(cols[lngIdx]) : null,
            nfcCardUid: nfcIdx >= 0 ? cols[nfcIdx] || null : null,
            phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
          }); added++;
        } catch { failed++; }
      }
      void loadAllCrews();
    }

    toast(`Imported ${added} row${added !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`, failed ? 'error' : 'success');
    setImporting(false); setImportModal(null); setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const crewModal$ = (
    <Modal open={crewModal} title={editingCrew ? 'Edit Crew Member' : 'Add Crew Member'} onClose={() => setCrewModal(false)} width={560}>
      <form onSubmit={saveCrew}>
        <FormField label="Airline *">
          <select style={selectStyle} value={crewForm.airlineId} onChange={e => setCrewForm(f => ({ ...f, airlineId: e.target.value }))} disabled={!!editingCrew && view !== 'crews'}>
            <option value="">Select airline</option>
            {airlines.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </FormField>

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
          <FormField label="Coordinates">
            <input style={inputStyle}
              value={crewLat && crewLng ? `${crewForm.stopLat}, ${crewForm.stopLng}` : ''}
              onChange={e => {
                const val = e.target.value;
                const match = val.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
                if (match) setCrewCoords(parseFloat(match[1]), parseFloat(match[2]));
                else if (!val.trim()) setCrewForm(f => ({ ...f, stopLat: '', stopLng: '' }));
              }}
              placeholder="e.g. 31.521993, 74.356665"
            />
          </FormField>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Map pe click karein ya pin drag karein:</div>
          <CrewMiniMap lat={crewLat} lng={crewLng} onChange={setCrewCoords} />
        </div>

        <div style={{ borderTop: `1px solid ${dark ? '#222' : '#f0f0f0'}`, margin: '16px 0', paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>NFC Card</div>
          <FormField label="NFC Card UID">
            <input style={inputStyle} value={crewForm.nfcCardUid} onChange={e => setCrewForm(f => ({ ...f, nfcCardUid: e.target.value }))} placeholder="e.g. 04A32FB1095C80" />
          </FormField>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -8 }}>Enter manually, or scan from the tablet app and copy the UID here.</div>
        </div>

        {crewError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{crewError}</div>}
        <FormActions onClose={() => setCrewModal(false)} loading={crewSaving} />
      </form>
    </Modal>
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sub-sidebar */}
      <SubSidebar view={view} onNavigate={path => navigate(path)} dark={dark} />

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>

        {/* ── DASHBOARD ──────────────────────────────────────────────────── */}
        {view === 'dashboard' && (
          <div>
            <PageHeader title="Airlines Dashboard" subtitle="Overview of the crew transport module" />
            <div style={{ padding: '0 24px 24px' }}>
              {dashLoading ? <Spinner style={{ height: 200 }} /> : (
                <>
                  {/* Stat cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                    {[
                      { label: 'Airlines',     value: stats.airlines,    color: '#dc2626', icon: IconPlane },
                      { label: 'Total Crew',   value: stats.crews,       color: '#059669', icon: IconUsers },
                      { label: 'Vehicles',     value: stats.vehicles,    color: '#7c3aed', icon: IconCar },
                      { label: 'Active Trips', value: stats.activeTrips, color: '#f59e0b', icon: IconPlane },
                    ].map(({ label, value, color, icon: Icon }) => (
                      <div key={label} style={{ background: 'var(--card)', borderRadius: 12, padding: '18px 20px', border: `1px solid ${dark ? '#222' : '#f0f0f0'}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Icon size={20} color={color} />
                        </div>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent trips */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 } as React.CSSProperties}>
                    Recent Trips
                  </div>
                  {recentTrips.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No trips recorded yet.</div>
                  ) : (
                    <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={th}>Crew</th>
                            <th style={th}>Flight</th>
                            <th style={th}>Check-in</th>
                            <th style={th}>Check-out</th>
                            <th style={th}>KM</th>
                            <th style={th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentTrips.map(t => (
                            <tr key={t.t_id}>
                              <td style={td}><div style={{ fontWeight: 500 }}>{t.crew_name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.crew_display_id}</div></td>
                              <td style={td}>{t.t_flight_number || '—'}</td>
                              <td style={td}><div style={{ fontSize: 12 }}>{fmtDt(t.t_checkin_at)}</div></td>
                              <td style={td}><div style={{ fontSize: 12 }}>{fmtDt(t.t_checkout_at)}</div></td>
                              <td style={td}>{t.t_km_travelled ? <strong style={{ color: '#059669' }}>{Number(t.t_km_travelled).toFixed(1)} km</strong> : '—'}</td>
                              <td style={td}>{t.t_status === 'in_progress' ? 'In Progress' : 'Completed'}</td>
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
        )}

        {/* ── AIRLINES VIEW ──────────────────────────────────────────────── */}
        {view === 'airlines' && !selected && (
          <div>
            <PageHeader title="Airline Clients" subtitle="Manage airline clients and their crew transport">
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportAirlines} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                  <IconDownload size={14} /> Export
                </button>
                {can('add') && (
                  <button onClick={openAirlineAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    <IconPlus size={15} /> Add Airline
                  </button>
                )}
              </div>
            </PageHeader>
            <div style={{ padding: '0 24px 24px' }}>
              {loading ? <Spinner style={{ height: 300 }} /> : airlines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>No airlines yet. Click "Add Airline" to get started.</div>
              ) : (
                <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>ID</th><th style={th}>Airline Name</th><th style={th}>IATA Code</th><th style={th}>Contact Person</th>
                        <th style={th}>Contact Phone</th><th style={th}>Crew</th><th style={th}>Vehicles</th>
                        <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {airlines.map(a => (
                        <tr key={a.id}
                          onMouseEnter={e => (e.currentTarget.style.background = dark ? '#1a1a1a' : '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={td}><span style={{ color: 'var(--muted)', fontSize: 12 }}>{a.displayId}</span></td>
                          <td style={td}><span style={{ fontWeight: 600 }}>{a.name}</span></td>
                          <td style={td}>{a.iataCode || '—'}</td>
                          <td style={td}>{a.contactPerson || '—'}</td>
                          <td style={td}>{a.contactPhone || '—'}</td>
                          <td style={td}>{a.crewCount}</td>
                          <td style={td}>{a.vehicleCount}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              {can('edit') && <button onClick={() => openAirlineEdit(a)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconPencil size={14} color="var(--muted)" /></button>}
                              {can('delete') && <button onClick={() => deleteAirline(a)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Modal open={airlineModal} title={editingAirline ? 'Edit Airline' : 'Add Airline'} onClose={() => setAirlineModal(false)}>
              <form onSubmit={saveAirline}>
                <FormField label="Airline Name *"><input style={inputStyle} value={airlineForm.name} onChange={e => setAirlineForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PIA Ground Transport" autoFocus /></FormField>
                <FormField label="IATA Code"><input style={inputStyle} value={airlineForm.iataCode} onChange={e => setAirlineForm(f => ({ ...f, iataCode: e.target.value.toUpperCase() }))} placeholder="e.g. PK" maxLength={10} /></FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Contact Person"><input style={inputStyle} value={airlineForm.contactPerson} onChange={e => setAirlineForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name" /></FormField>
                  <FormField label="Contact Phone"><input style={inputStyle} value={airlineForm.contactPhone} onChange={e => setAirlineForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+92 300 0000000" /></FormField>
                </div>
                {airlineError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{airlineError}</div>}
                <FormActions onClose={() => setAirlineModal(false)} loading={airlineSaving} />
              </form>
            </Modal>
          </div>
        )}

        {/* ── AIRLINE DETAIL ─────────────────────────────────────────────── */}
        {view === 'airlines' && selected && (
          <div>
            <PageHeader title={selected.name} subtitle={[selected.iataCode, selected.contactPerson].filter(Boolean).join(' · ') || 'Airline Detail'}>
              <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
                <IconArrowLeft size={15} /> All Airlines
              </button>
            </PageHeader>
            <div style={{ borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`, paddingLeft: 24, display: 'flex', gap: 4 }}>
              <button style={tabBtn(tab === 'crews')} onClick={() => setTab('crews')}><IconUsers size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Crews ({crews.length})</button>
              <button style={tabBtn(tab === 'vehicles')} onClick={() => setTab('vehicles')}><IconCar size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Vehicles</button>
              <button style={tabBtn(tab === 'trips')} onClick={() => setTab('trips')}><IconPlane size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Trips</button>
            </div>
            <div style={{ padding: 24 }}>
              {/* Crews tab */}
              {tab === 'crews' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {can('add') && <button onClick={() => openCrewAdd(selected.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}><IconPlus size={15} /> Add Crew</button>}
                  </div>
                  {crewLoading ? <Spinner style={{ height: 200 }} /> : crews.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No crew members yet.</div> : (
                    <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>ID</th><th style={th}>Name</th><th style={th}>Designation</th><th style={th}>Stop Location</th><th style={th}>Coordinates</th><th style={th}>NFC Card</th><th style={{ ...th, textAlign: 'right' }}>Actions</th></tr></thead>
                        <tbody>
                          {crews.map(c => (
                            <tr key={c.id}>
                              <td style={td}><span style={{ color: 'var(--muted)', fontSize: 12 }}>{c.displayId}</span></td>
                              <td style={td}><div style={{ fontWeight: 500 }}>{c.name}</div>{c.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone}</div>}</td>
                              <td style={td}>{c.designation || '—'}</td>
                              <td style={td}>{c.stopName ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconMapPin size={13} color="#dc2626" /><span style={{ fontSize: 12 }}>{c.stopName}</span></div> : '—'}</td>
                              <td style={td}>{c.stopLat && c.stopLng ? <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{Number(c.stopLat).toFixed(5)}, {Number(c.stopLng).toFixed(5)}</span> : '—'}</td>
                              <td style={td}>{c.nfcCardUid ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconNfc size={13} color="#059669" /><code style={{ fontSize: 11 }}>{c.nfcCardUid}</code></span> : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Not assigned</span>}</td>
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
                </>
              )}
              {/* Vehicles tab */}
              {tab === 'vehicles' && (
                <>
                  {can('add') && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
                      <select style={{ ...selectStyle, maxWidth: 320 }} value={assigningVehicle} onChange={e => setAssigningVehicle(e.target.value)}>
                        <option value="">Select vehicle to assign…</option>
                        {allVehicles.filter(v => !assignedVehicles.some(av => av.id === v.id)).map(v => <option key={v.id} value={v.id}>{v.license_plate || `#${v.display_id}`} · {v.name}</option>)}
                      </select>
                      <button onClick={assignVehicle} disabled={!assigningVehicle} style={{ padding: '8px 16px', background: assigningVehicle ? '#dc2626' : '#fca5a5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: assigningVehicle ? 'pointer' : 'default' }}>Assign</button>
                    </div>
                  )}
                  {vehiclesLoading ? <Spinner style={{ height: 200 }} /> : assignedVehicles.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No vehicles assigned yet.</div> : (
                    <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Vehicle</th><th style={th}>Type</th><th style={th}>Status</th>{can('delete') && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}</tr></thead>
                        <tbody>
                          {assignedVehicles.map(v => (
                            <tr key={v.id}>
                              <td style={td}><div style={{ fontWeight: 600 }}>{v.license_plate || `#${v.display_id}`}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{v.name}</div></td>
                              <td style={td}>{v.type}</td>
                              <td style={td}>{v.lifecycle_status}</td>
                              {can('delete') && <td style={{ ...td, textAlign: 'right' }}><button onClick={() => unassignVehicle(v.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
              {/* Trips tab */}
              {tab === 'trips' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <button onClick={() => loadTrips(selected.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}><IconRefresh size={14} /> Refresh</button>
                  </div>
                  {tripsLoading ? <Spinner style={{ height: 200 }} /> : trips.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>No trips recorded yet.</div> : (
                    <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Crew</th><th style={th}>Flight</th><th style={th}>Vehicle</th><th style={th}>Check-in</th><th style={th}>Check-out</th><th style={th}>KM</th><th style={th}>Status</th></tr></thead>
                        <tbody>
                          {trips.map(t => (
                            <tr key={t.t_id}>
                              <td style={td}><div style={{ fontWeight: 500 }}>{t.crew_name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.crew_designation || ''} · {t.crew_display_id}</div></td>
                              <td style={td}>{t.t_flight_number || '—'}</td>
                              <td style={td}>{t.vehicle_name}<br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.license_plate || ''}</span></td>
                              <td style={td}><div style={{ fontSize: 12 }}>{fmtDt(t.t_checkin_at)}</div>{t.t_checkin_stop && <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={11} />{t.t_checkin_stop}</div>}</td>
                              <td style={td}><div style={{ fontSize: 12 }}>{fmtDt(t.t_checkout_at)}</div>{t.t_checkout_stop && <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={11} />{t.t_checkout_stop}</div>}</td>
                              <td style={td}>{t.t_km_travelled ? <strong style={{ color: '#059669' }}>{Number(t.t_km_travelled).toFixed(1)} km</strong> : '—'}</td>
                              <td style={td}>{t.t_status === 'in_progress' ? 'In Progress' : 'Completed'}</td>
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
        )}

        {/* ── ALL CREWS VIEW ─────────────────────────────────────────────── */}
        {view === 'crews' && (
          <div>
            <PageHeader title="All Crew Members" subtitle="All crew across all airlines">
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportCrews} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                  <IconDownload size={14} /> Export
                </button>
                {can('add') && (
                  <>
                    <button onClick={() => { setImportFile(null); setImportModal('crews'); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                      <IconUpload size={14} /> Import
                    </button>
                    <button onClick={() => openCrewAdd()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}><IconPlus size={15} /> Add Crew</button>
                  </>
                )}
              </div>
            </PageHeader>
            <div style={{ padding: '0 24px 24px' }}>
              {allCrewsLoading ? <Spinner style={{ height: 300 }} /> : allCrews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>No crew members found.</div>
              ) : (
                <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>ID</th><th style={th}>Name</th><th style={th}>Airline</th><th style={th}>Designation</th><th style={th}>Stop</th><th style={th}>Coordinates</th><th style={th}>NFC Card</th><th style={{ ...th, textAlign: 'right' }}>Actions</th></tr></thead>
                    <tbody>
                      {allCrews.map(c => (
                        <tr key={c.id}>
                          <td style={td}><span style={{ color: 'var(--muted)', fontSize: 12 }}>{c.displayId}</span></td>
                          <td style={td}><div style={{ fontWeight: 500 }}>{c.name}</div>{c.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone}</div>}</td>
                          <td style={td}>{c.airlineName}</td>
                          <td style={td}>{c.designation || '—'}</td>
                          <td style={td}>{c.stopName ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconMapPin size={13} color="#dc2626" /><span style={{ fontSize: 12 }}>{c.stopName}</span></div> : '—'}</td>
                          <td style={td}>
                            {c.stopLat && c.stopLng ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                                  {Number(c.stopLat).toFixed(5)}, {Number(c.stopLng).toFixed(5)}
                                </span>
                                <button
                                  onClick={() => {
                                    const coords = `${Number(c.stopLat).toFixed(5)}, ${Number(c.stopLng).toFixed(5)}`;
                                    navigator.clipboard.writeText(coords).catch(() => {
                                      const el = document.createElement('textarea');
                                      el.value = coords; document.body.appendChild(el); el.select();
                                      document.execCommand('copy'); document.body.removeChild(el);
                                    });
                                    toast('Coordinates copied', 'success');
                                  }}
                                  style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                                  title="Copy coordinates"
                                >
                                  <IconCopy size={12} color="var(--muted)" />
                                </button>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={td}>{c.nfcCardUid ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconNfc size={13} color="#059669" /><code style={{ fontSize: 11 }}>{c.nfcCardUid}</code></span> : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Not assigned</span>}</td>
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
            </div>
          </div>
        )}

        {/* ── TRIPS VIEW ─────────────────────────────────────────────────── */}
        {view === 'trips' && (
          <div>
            <PageHeader title="Trips" subtitle="All crew transport trips grouped by vehicle run">
              <button onClick={() => void loadGroupedTrips()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                <IconRefresh size={14} /> Refresh
              </button>
            </PageHeader>
            <div style={{ padding: '0 24px 24px' }}>
              {/* Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 0 16px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    style={{ height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', width: 190 }}
                    placeholder="Search crew name…"
                    value={tripSearch}
                    onChange={e => setTripSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void loadGroupedTrips()}
                  />
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    style={{ height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', width: 190 }}
                    placeholder="Route / stop name…"
                    value={tripStop}
                    onChange={e => setTripStop(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void loadGroupedTrips()}
                  />
                </div>
                <CustomSelect value={tripStatus} onChange={v => setTripStatus(v)} options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                ]} />
                <DateRangePicker value={tripDateRange} onChange={setTripDateRange} placeholder="Date range" />
                <button onClick={() => void loadGroupedTrips()} style={{ height: 34, padding: '0 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Search</button>
                <button onClick={() => { setTripSearch(''); setTripStop(''); setTripStatus(''); setTripDateRange(undefined); void loadGroupedTrips({ search: '', stop: '', status: '', dateRange: undefined }); }} style={{ height: 34, padding: '0 12px', border: '1px solid var(--input-border)', borderRadius: 6, background: 'var(--input-bg)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Clear</button>
              </div>
              {/* Table */}
              {tripsListLoading ? <Spinner style={{ height: 300 }} /> : groupedTrips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>No trips found. Crew check-ins will appear here.</div>
              ) : (
                <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Origin</th>
                        <th style={th}>Block Type</th>
                        <th style={th}>Vehicle</th>
                        <th style={th}>Crew</th>
                        <th style={th}>Crew Count</th>
                        <th style={th}>KM</th>
                        <th style={th}>Date / Time</th>
                        <th style={th}>Status</th>
                        <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTrips.map(t => (
                        <tr key={t.group_id}
                          onMouseEnter={e => (e.currentTarget.style.background = dark ? '#1a1a1a' : '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <IconMapPin size={13} color="#dc2626" />
                              <span style={{ fontWeight: 500 }}>{t.origin || '—'}</span>
                            </div>
                            {t.flight_number && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Flight: {t.flight_number}</div>}
                          </td>
                          <td style={td}>Drop Off</td>
                          <td style={td}>
                            <div style={{ fontWeight: 500 }}>{t.license_plate || `#${t.vehicle_display_id}`}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.vehicle_name}</div>
                          </td>
                          <td style={td}><div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.crew_names}>{t.crew_names || '—'}</div></td>
                          <td style={td}>{t.crew_count}</td>
                          <td style={td}>{t.km_travelled > 0 ? `${Number(t.km_travelled).toFixed(1)} km` : '—'}</td>
                          <td style={td}><div style={{ fontSize: 12 }}>{fmtDt(t.checkin_at)}</div></td>
                          <td style={td}><span style={{ color: t.status === 'in_progress' ? '#f59e0b' : '#059669', fontWeight: 500, fontSize: 12 }}>{t.status === 'in_progress' ? 'In Progress' : 'Completed'}</span></td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button onClick={() => void openTripDetail(t.group_id)} title="View detail" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconEye size={14} color="var(--muted)" /></button>
                              {can('delete') && <button onClick={() => deleteTrip(t.trip_ids)} title="Delete trip" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALL VEHICLES VIEW ──────────────────────────────────────────── */}
        {view === 'vehicles' && (
          <div>
            <PageHeader title="Assigned Vehicles" subtitle="All vehicles assigned across airlines" />
            <div style={{ padding: '0 24px 24px' }}>
              {allVehiclesLoading ? <Spinner style={{ height: 300 }} /> : allVehiclesView.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>No vehicles assigned to any airline.</div>
              ) : (
                <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#222' : '#f0f0f0'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Vehicle</th><th style={th}>Airline</th><th style={th}>Type</th><th style={th}>Status</th>{can('delete') && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}</tr></thead>
                    <tbody>
                      {allVehiclesView.map(v => (
                        <tr key={`${v.id}-${v.airlineName}`}>
                          <td style={td}><div style={{ fontWeight: 600 }}>{v.license_plate || `#${v.display_id}`}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{v.name}</div></td>
                          <td style={td}>{v.airlineName}</td>
                          <td style={td}>{v.type}</td>
                          <td style={td}>{v.lifecycle_status}</td>
                          {can('delete') && <td style={{ ...td, textAlign: 'right' }}>
                            <button onClick={() => { const a = airlines.find(al => al.name === v.airlineName); if (a) unassignVehicle(v.id, a.id); }} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, background: dark ? '#1e1e1e' : '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><IconTrash size={14} color="#dc2626" /></button>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Shared crew modal */}
      {crewModal$}

      {/* Import modal */}
      <Modal open={!!importModal} title={importModal === 'airlines' ? 'Import Airlines' : 'Import Crew'} onClose={() => { setImportModal(null); setImportFile(null); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1: Sample */}
          <div style={{ background: dark ? '#161616' : '#fafafa', border: `1px solid ${dark ? '#222' : '#eee'}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Step 1 — Download Sample</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {importModal === 'airlines'
                ? 'CSV columns: Name, IATA Code, Contact Person, Contact Phone'
                : 'CSV columns: Name, Designation, Airline, Stop Name, Latitude, Longitude, NFC Card UID, Phone'}
            </div>
            <button
              type="button"
              onClick={importModal === 'airlines' ? downloadSampleAirlines : downloadSampleCrews}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: dark ? '#1e1e1e' : '#fff', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              <IconDownload size={14} /> Download Sample CSV
            </button>
          </div>

          {/* Step 2: Upload */}
          <div style={{ background: dark ? '#161616' : '#fafafa', border: `1px solid ${dark ? '#222' : '#eee'}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Step 2 — Upload CSV File</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Fill the sample and upload it here.</div>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '24px 16px', border: `2px dashed ${importFile ? '#dc2626' : (dark ? '#333' : '#ddd')}`,
              borderRadius: 10, cursor: 'pointer', color: importFile ? '#dc2626' : 'var(--muted)', fontSize: 13,
              background: importFile ? (dark ? 'rgba(220,38,38,0.05)' : '#fff5f5') : 'transparent',
            }}>
              <IconUpload size={16} />
              {importFile ? importFile.name : 'Click to choose CSV file'}
              <input ref={importFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => { setImportModal(null); setImportFile(null); }} style={{ padding: '8px 16px', border: `1px solid ${dark ? '#333' : '#e8e8e8'}`, borderRadius: 8, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={() => void handleImportFile()} disabled={!importFile || importing}
              style={{ padding: '8px 18px', background: !importFile || importing ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !importFile || importing ? 'default' : 'pointer' }}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Trip Detail Modal */}
      <Modal open={!!tripDetail || tripDetailLoading} title="Trip Detail" onClose={() => setTripDetail(null)} width={960}>
        {tripDetailLoading ? <Spinner style={{ height: 300 }} /> : tripDetail && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, maxHeight: '75vh', overflow: 'hidden' }}>
            {/* Left panel */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Vehicle */}
              <div style={{ background: dark ? '#161616' : '#fafafa', borderRadius: 10, padding: 14, border: `1px solid ${dark ? '#222' : '#eee'}` }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Vehicle</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tripDetail.vehicle.licensePlate || `#${tripDetail.vehicle.displayId}`}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{tripDetail.vehicle.name}</div>
              </div>
              {/* Trip info */}
              <div style={{ background: dark ? '#161616' : '#fafafa', borderRadius: 10, padding: 14, border: `1px solid ${dark ? '#222' : '#eee'}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Origin</div><div style={{ fontSize: 13, fontWeight: 500 }}>{tripDetail.checkin_stop || '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Block Type</div><div style={{ fontSize: 13 }}>Drop Off</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Check-in</div><div style={{ fontSize: 12 }}>{fmtDt(tripDetail.checkin_at)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Check-out</div><div style={{ fontSize: 12 }}>{fmtDt(tripDetail.checkout_at)}</div></div>
                  {tripDetail.flight_number && <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Flight</div><div style={{ fontSize: 13 }}>{tripDetail.flight_number}</div></div>}
                </div>
              </div>
              {/* Crew members */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Crew Members ({tripDetail.trips.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tripDetail.trips.map(t => (
                    <div key={t.id} style={{ background: dark ? '#161616' : '#fafafa', borderRadius: 8, padding: 12, border: `1px solid ${dark ? '#222' : '#eee'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{t.crew_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.crew_designation || ''}{t.crew_designation ? ' · ' : ''}{t.crew_display_id}</div>
                          {t.crew_phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.crew_phone}</div>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: t.status === 'in_progress' ? '#f59e0b' : '#059669' }}>{t.status === 'in_progress' ? 'Active' : 'Done'}</span>
                      </div>
                      {t.checkout_stop && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                          <IconMapPin size={11} color="#dc2626" /> {t.checkout_stop}
                        </div>
                      )}
                      {t.km_travelled && <div style={{ fontSize: 11, color: '#059669', marginTop: 3, fontWeight: 500 }}>{Number(t.km_travelled).toFixed(1)} km</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right panel: map + replay */}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Route Replay — {tripDetail.route.length} GPS Points
              </div>
              <TripReplayMap route={tripDetail.route} dark={dark} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
