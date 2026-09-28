import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import api from '../lib/api';

export interface LivePoint {
  id: string;
  imei: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  satellites: number;
  gpsValid: boolean;
  timestamp: string;
  ignition?: boolean | null;
  immobilizer?: boolean | null;
  voltageLevel?: number | null;
  gsmSignal?: number | null;
  vehicleStatus?: 'moving' | 'idle' | 'parked' | 'offline';
}
export interface FleetDevice {
  id: string;
  imei: string;
  displayId: number;
  status: string;
  vehicle: { id: string; displayId: number; name: string; licensePlate: string | null; make: string | null; model: string | null } | null;
}
export interface FleetVehicle {
  id: string;
  displayId: number;
  name: string;
  licensePlate: string | null;
  make: string | null;
  model: string | null;
}
export interface FleetItem { vehicle: FleetVehicle | null; device: FleetDevice; point: LivePoint | null; }

export function displayVehicleName(vehicle: FleetVehicle | null | undefined) {
  return [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || vehicle?.name || 'Vehicle';
}

export function getFleetStatus(point: LivePoint | null): 'moving' | 'idle' | 'parked' | 'offline' {
  if (!point || Date.now() - new Date(point.timestamp).getTime() > 10 * 60_000) return 'offline';
  if (point.vehicleStatus) return point.vehicleStatus;
  if (point.speedKmh >= 5) return 'moving';
  return point.ignition === true ? 'idle' : 'parked';
}

export function useFleet() {
  const [items, setItems] = useState<FleetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const [deviceResponse, pointResponse, vehicleResponse] = await Promise.all([
        api.get<FleetDevice[]>('/devices'),
        api.get<LivePoint[]>('/telemetry/live'),
        api.get<FleetVehicle[]>('/vehicles'),
      ]);
      const points = new Map(pointResponse.data.map(point => [point.imei, point]));
      const vehicles = new Map(vehicleResponse.data.map(vehicle => [vehicle.id, vehicle]));
      const allowedVehicleIds = new Set(vehicles.keys());
      const next = deviceResponse.data
        .filter(device => device.vehicle && allowedVehicleIds.has(device.vehicle.id))
        .map(device => {
          const vehicle = vehicles.get(device.vehicle!.id) ?? device.vehicle;
          const point = points.get(device.imei) ?? null;
          return { vehicle, device, point };
        });
      if (sequence === requestSequence.current) {
        setItems(next);
        setError('');
      }
    } catch {
      if (sequence === requestSequence.current) setError('Fleet data could not be loaded. Check your connection and try again.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try { await load(); } finally { inFlight = false; }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 5_000);
    return () => { active = false; clearInterval(timer); requestSequence.current++; };
  }, [load]));

  return { items, loading, error, reload: load };
}
