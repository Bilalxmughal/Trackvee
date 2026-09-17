export { parseAt06Frame } from './at06/parser.js';
export { crc16Modbus, crc16ModbusHex } from './at06/crc.js';
export type {
  At06ParsedFrame,
  At06ParseResult,
  At06ParseError,
  At06Status,
  At06Voltage,
  At06Lacci,
  At06AlarmCode,
} from './at06/types.js';
export { AT06_ALARM_MAP } from './at06/types.js';

export { parseGt06Frame, buildResponse as buildGt06Response } from './gt06/parser.js';
export { crc16Gt06 } from './gt06/crc.js';
export type {
  Gt06Packet,
  Gt06ParseResult,
  Gt06LoginPacket,
  Gt06GpsPacket,
  Gt06HeartbeatPacket,
  Gt06UnknownPacket,
} from './gt06/types.js';
export { PROTO_LOGIN, PROTO_GPS, PROTO_HEARTBEAT, PROTO_ALARM } from './gt06/types.js';
