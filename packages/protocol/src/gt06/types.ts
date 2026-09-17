export const GT06_START = 0x78;
export const GT06_END_1 = 0x0D;
export const GT06_END_2 = 0x0A;

export const PROTO_LOGIN     = 0x01;
export const PROTO_GPS       = 0x12;
export const PROTO_HEARTBEAT = 0x13;
export const PROTO_ALARM     = 0x16;
export const PROTO_GPS_LBS   = 0x17;

export interface Gt06LoginPacket {
  type: 'login';
  imei: string;
  serial: number;
}

export interface Gt06GpsPacket {
  type: 'gps';
  timestamp: Date;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  satellites: number;
  gpsValid: boolean;
  serial: number;
}

export interface Gt06HeartbeatPacket {
  type: 'heartbeat';
  serial: number;
}

export interface Gt06UnknownPacket {
  type: 'unknown';
  protocol: number;
  serial: number;
}

export type Gt06Packet = Gt06LoginPacket | Gt06GpsPacket | Gt06HeartbeatPacket | Gt06UnknownPacket;

export type Gt06ParseResult =
  | { ok: true; packet: Gt06Packet; raw: Buffer }
  | { ok: false; reason: string };
