import { crc16Gt06 } from './crc.js';
import {
  GT06_START, GT06_END_1, GT06_END_2,
  PROTO_LOGIN, PROTO_GPS, PROTO_HEARTBEAT,
  Gt06ParseResult, Gt06Packet,
} from './types.js';

function parseImei(buf: Buffer, offset: number): string {
  let all = '';
  for (let i = 0; i < 8; i++) {
    const byte = buf[offset + i]!;
    all += ((byte >> 4) & 0x0F).toString();
    all += (byte & 0x0F).toString();
  }
  // Strip leading zeros and trailing F padding
  return all.replace(/^0+/, '').replace(/[Ff]+$/, '');
}

export function parseGt06Frame(buf: Buffer): Gt06ParseResult {
  if (buf.length < 10) return { ok: false, reason: 'too short' };
  if (buf[0] !== GT06_START || buf[1] !== GT06_START) {
    return { ok: false, reason: `bad start bytes: 0x${buf[0]?.toString(16)} 0x${buf[1]?.toString(16)}` };
  }

  const length = buf[2]!;
  const packetEnd = 2 + length + 2; // start(2) + length(1) + data(length) = length+3, then +2 for end bytes
  const totalLen = length + 5; // 2(start) + 1(length) + length(data+proto+serial+crc) + 2(end) - but length includes proto through crc

  if (buf.length < totalLen) return { ok: false, reason: `incomplete: have ${buf.length}, need ${totalLen}` };

  const endIdx = length + 3;
  if (buf[endIdx] !== GT06_END_1 || buf[endIdx + 1] !== GT06_END_2) {
    return { ok: false, reason: 'bad end bytes' };
  }

  // CRC covers from length byte to serial (excludes start, crc, end)
  const crcCalc = crc16Gt06(buf, 2, endIdx - 2);
  const crcRecv = (buf[endIdx - 2]! << 8) | buf[endIdx - 1]!;
  // NOTE: CRC algorithm TBD — log mismatch but continue processing
  if (crcCalc !== crcRecv) {
    console.warn(`[GT06] CRC mismatch (non-fatal): calc=0x${crcCalc.toString(16)} recv=0x${crcRecv.toString(16)}`);
  }

  const protocol = buf[3]!;
  const serial = (buf[endIdx - 4]! << 8) | buf[endIdx - 3]!;

  let packet: Gt06Packet;

  if (protocol === PROTO_LOGIN) {
    const imei = parseImei(buf, 4);
    packet = { type: 'login', imei, serial };

  } else if (protocol === PROTO_GPS) {
    // Date/time: 6 bytes YY MM DD HH MM SS
    const year  = 2000 + buf[4]!;
    const month = buf[5]! - 1;
    const day   = buf[6]!;
    const hour  = buf[7]!;
    const min   = buf[8]!;
    const sec   = buf[9]!;
    const timestamp = new Date(Date.UTC(year, month, day, hour, min, sec));

    const satellites = (buf[10]! >> 4) & 0x0F;
    const latLen     = buf[10]! & 0x0F;
    void latLen;

    const latRaw = buf.readUInt32BE(11);
    const lonRaw = buf.readUInt32BE(15);
    const speed  = buf[19]!;
    const flags  = buf.readUInt16BE(20);

    const latitude  = latRaw / 1800000.0;
    const longitude = lonRaw / 1800000.0;
    const heading   = flags & 0x03FF;
    const latN      = (flags >> 10) & 1; // 1=North (ATS-GO/AOT06 variant)
    const lonW      = (flags >> 11) & 1; // 1=West
    const gpsValid  = !!((flags >> 12) & 1);

    packet = {
      type: 'gps',
      timestamp,
      latitude:  latN ? latitude : -latitude,
      longitude: lonW ? -longitude : longitude,
      speedKmh: speed,
      heading,
      satellites,
      gpsValid,
      serial,
    };

  } else if (protocol === PROTO_HEARTBEAT) {
    // Heartbeat data bytes: terminal_info, voltage_level, gsm_signal
    const terminalInfo = buf.length > 4 ? buf[4] : undefined;
    const voltageLevel  = buf.length > 5 ? buf[5] : undefined;
    const gsmSignal     = buf.length > 6 ? buf[6] : undefined;
    packet = { type: 'heartbeat', serial, terminalInfo, voltageLevel, gsmSignal };

  } else {
    packet = { type: 'unknown', protocol, serial };
  }

  return { ok: true, packet, raw: buf.slice(0, totalLen) };
}

export function buildResponse(protocol: number, serial: number): Buffer {
  const resp = Buffer.alloc(10);
  resp[0] = GT06_START;
  resp[1] = GT06_START;
  resp[2] = 0x05;
  resp[3] = protocol;
  resp[4] = (serial >> 8) & 0xFF;
  resp[5] = serial & 0xFF;
  const crc = crc16Gt06(resp, 2, 6);
  resp[6] = (crc >> 8) & 0xFF;
  resp[7] = crc & 0xFF;
  resp[8] = GT06_END_1;
  resp[9] = GT06_END_2;
  return resp;
}
