import { crc16ModbusHex } from './crc.js';
import {
  AT06_ALARM_MAP,
  At06Lacci,
  At06ParseResult,
  At06ParsedFrame,
  At06Status,
  At06Voltage,
} from './types.js';

function ddmmToDecimal(ddmm: string, hemisphere: string): number {
  const raw = parseFloat(ddmm);
  const degrees = Math.floor(raw / 100);
  const minutes = raw - degrees * 100;
  const decimal = degrees + minutes / 60;
  return hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal;
}

function parseTimestamp(utc: string): Date {
  const yy = parseInt(utc.slice(0, 2), 10);
  const mo = parseInt(utc.slice(2, 4), 10) - 1;
  const dd = parseInt(utc.slice(4, 6), 10);
  const hh = parseInt(utc.slice(6, 8), 10);
  const mm = parseInt(utc.slice(8, 10), 10);
  const ss = parseInt(utc.slice(10, 12), 10);
  return new Date(Date.UTC(2000 + yy, mo, dd, hh, mm, ss));
}

function parseStatus(raw: string): At06Status {
  const s = raw.padEnd(12, '0');
  return {
    gpsAntenna: s[0] === '1',
    externalPower: s[1] === '1',
    input1: s[2] === '1',
    input2: s[3] === '1',
    input3: s[4] === '1',
    input4: s[5] === '1',
    output1: s[8] === '1',
    output2: s[9] === '1',
  };
}

function parseVoltage(raw: string): At06Voltage {
  const clean = raw.replace(/\0/g, '').trim();
  if (clean.length >= 5) {
    const charging = clean[0] === '1';
    const batteryVolts = parseInt(clean.slice(1, 3), 10) / 10;
    const inputVolts = parseInt(clean.slice(3, 5), 10);
    return { charging, batteryVolts, inputVolts };
  }
  return { charging: false, batteryVolts: 0, inputVolts: 0 };
}

function parseLacci(raw: string): At06Lacci {
  const clean = raw.padStart(8, '0');
  return {
    locationAreaCode: clean.slice(0, 4),
    cellId: clean.slice(4, 8),
  };
}

export function parseAt06Frame(raw: string): At06ParseResult {
  const trimmed = raw.trim();

  if (!trimmed.startsWith('$$')) {
    return { ok: false, error: { reason: 'Missing $$ header', rawData: trimmed } };
  }

  const pipeIndex = trimmed.indexOf('|');
  if (pipeIndex === -1) {
    return { ok: false, error: { reason: 'No pipe separator found', rawData: trimmed } };
  }

  const header = trimmed.slice(0, pipeIndex);
  const imei = header.slice(4);

  if (imei.length < 10) {
    return { ok: false, error: { reason: 'IMEI too short', rawData: trimmed } };
  }

  const body = trimmed.slice(pipeIndex + 1);
  const parts = body.split('|');

  if (parts.length < 12) {
    return { ok: false, error: { reason: `Too few fields: ${parts.length}`, rawData: trimmed } };
  }

  const [
    alarmAndTime,
    gpsStatus,
    latRaw,
    ns,
    lngRaw,
    ew,
    speedRaw,
    headingRaw,
    hdopRaw,
    statusRaw,
    voltageRaw,
    adcRaw,
    lacciRaw,
    , // temp1+temp2
    , // mileage
    serialRaw,
    checksumRaw,
  ] = parts as (string | undefined)[];

  const alarmCode = (alarmAndTime ?? '').slice(0, 2);
  const utcTime = (alarmAndTime ?? '').slice(2);

  const latitude = ddmmToDecimal(latRaw ?? '0', ns ?? 'N');
  const longitude = ddmmToDecimal(lngRaw ?? '0', ew ?? 'E');
  const speedKnots = parseFloat(speedRaw ?? '0') || 0;
  const speedKmh = Math.round(speedKnots * 1.852 * 10) / 10;
  const heading = parseInt(headingRaw ?? '0', 10) || 0;
  const hdop = parseFloat(hdopRaw ?? '0') || 0;
  const serial = parseInt(serialRaw ?? '0', 16) || 0;

  const dataForCrc = trimmed.slice(0, trimmed.length - 4);
  const expectedCrc = crc16ModbusHex(dataForCrc);
  const checksumValid = checksumRaw?.toUpperCase() === expectedCrc;

  const frame: At06ParsedFrame = {
    imei,
    alarmCode,
    alarmLabel: AT06_ALARM_MAP[alarmCode] ?? 'unknown',
    timestamp: parseTimestamp(utcTime),
    gpsValid: (gpsStatus ?? '') === 'A',
    latitude,
    longitude,
    speedKnots,
    speedKmh,
    heading,
    hdop,
    status: parseStatus(statusRaw ?? ''),
    voltage: parseVoltage(voltageRaw ?? ''),
    lacci: parseLacci(lacciRaw ?? ''),
    serial,
    rawChecksum: checksumRaw ?? '',
    checksumValid,
    rawData: trimmed,
  };

  return { ok: true, frame };
}
