// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'ops'
  | 'live_ops'
  | 'agent'
  | 'chat_support'
  | 'viewer'
  | 'org_owner'
  | 'org_admin'
  | 'org_user'
  | 'customer';

export type ResourceStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  organizationId?: string;
  status: ResourceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Organization (B2B) ──────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  status: ResourceStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';

export interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  type: VehicleType;
  organizationId?: string;
  ownerUserId?: string;
  deviceId?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Device ───────────────────────────────────────────────────────────────────

export type DeviceStatus = 'active' | 'inactive' | 'unassigned';

export interface Device {
  id: string;
  imei: string;
  manufacturer: string;
  model: string;
  protocol: string;
  simNumber?: string;
  simOperator?: string;
  apn?: string;
  status: DeviceStatus;
  vehicleId?: string;
  lastSeen?: Date;
  firmwareVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export type AlarmType =
  | 'interval'
  | 'heartbeat'
  | 'sos'
  | 'overspeed'
  | 'overspeed_recover'
  | 'geofence_enter'
  | 'geofence_exit'
  | 'ignition_on'
  | 'ignition_off'
  | 'gps_antenna_cut'
  | 'gps_antenna_recover'
  | 'low_battery'
  | 'sleep'
  | 'wake'
  | 'gsm_jamming'
  | 'unknown';

export interface Telemetry {
  id: string;
  deviceId: string;
  vehicleId?: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude?: number;
  gpsValid: boolean;
  satellites?: number;
  hdop?: number;
  ignition: boolean;
  voltage?: number;
  batteryVoltage?: number;
  gsmSignal?: number;
  alarmType?: AlarmType;
  rawData?: string;
  createdAt: Date;
}

// ─── Current Vehicle State (live) ────────────────────────────────────────────

export type VehicleMotionStatus = 'moving' | 'parked' | 'offline';

export interface VehicleState {
  vehicleId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  ignition: boolean;
  voltage?: number;
  online: boolean;
  motionStatus: VehicleMotionStatus;
  lastSeen: Date;
  updatedAt: Date;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  vehicleId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  distanceKm: number;
  durationSeconds?: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  createdAt: Date;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  vehicleId: string;
  deviceId?: string;
  userId?: string;
  organizationId?: string;
  type: AlarmType;
  severity: AlertSeverity;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// ─── Geofence ─────────────────────────────────────────────────────────────────

export type GeofenceType = 'circle' | 'polygon';

export interface Geofence {
  id: string;
  organizationId?: string;
  userId?: string;
  name: string;
  type: GeofenceType;
  coordinates: GeoJsonGeometry;
  radiusMeters?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoJsonGeometry {
  type: 'Point' | 'Polygon';
  coordinates: number[] | number[][];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WsEventType =
  | 'vehicle.state.update'
  | 'vehicle.alert'
  | 'device.online'
  | 'device.offline';

export interface WsEvent<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: Date;
}
