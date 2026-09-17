export interface ParsedPacket {
  imei: string;
  event: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  gpsValid: boolean;
  hdop: number;
  voltage: number | null;
  raw: string;
}

// Convert DDMM.MMMM to decimal degrees
function dmsToDecimal(val: number): number {
  const deg = Math.floor(val / 100);
  const min = val - deg * 100;
  return deg + min / 60;
}

// Parse YYMMDDHHMMSS or YYYYMMDDHHMMSS to Date (UTC)
function parseTimestamp(ts: string): Date {
  try {
    if (ts.length === 12) {
      return new Date(Date.UTC(
        2000 + parseInt(ts.slice(0, 2), 10),
        parseInt(ts.slice(2, 4), 10) - 1,
        parseInt(ts.slice(4, 6), 10),
        parseInt(ts.slice(6, 8), 10),
        parseInt(ts.slice(8, 10), 10),
        parseInt(ts.slice(10, 12), 10),
      ));
    }
    if (ts.length === 14) {
      return new Date(Date.UTC(
        parseInt(ts.slice(0, 4), 10),
        parseInt(ts.slice(4, 6), 10) - 1,
        parseInt(ts.slice(6, 8), 10),
        parseInt(ts.slice(8, 10), 10),
        parseInt(ts.slice(10, 12), 10),
        parseInt(ts.slice(12, 14), 10),
      ));
    }
  } catch {
    // fall through
  }
  return new Date();
}

/**
 * Parse one AT06/AOT06 ASCII packet line.
 * Format: $$Len|IMEI|Event|Time|GPSStatus|Lat|N/S|Lng|E/W|Speed|Angle|HDOP|...|Checksum##
 */
export function parseAt06Line(line: string): ParsedPacket | null {
  // Strip $$ prefix and ## suffix, trim whitespace
  const clean = line.trim().replace(/^\$\$/, '').replace(/##\s*$/, '').trim();
  const parts = clean.split('|');

  // Minimum fields needed: [len_or_imei, imei_or_event, event, time, gps, lat, NS, lng, EW, speed, angle]
  if (parts.length < 11) return null;

  // parts[0] = length field (digits only) — skip it, parts[1] = IMEI
  let imeiIdx = 1;
  // If parts[0] looks like an IMEI (10-16 digits, no $$), adjust
  if (/^\d{10,16}$/.test(parts[0])) imeiIdx = 0;

  const imei = parts[imeiIdx]?.trim();
  if (!imei || !/^\d{10,16}$/.test(imei)) return null;

  const event = parts[imeiIdx + 1]?.trim() || 'UNKNOWN';
  const timestamp = parseTimestamp(parts[imeiIdx + 2]?.trim() || '');
  const gpsStatus = parts[imeiIdx + 3]?.trim();
  const gpsValid = gpsStatus === 'A';

  const latRaw = parseFloat(parts[imeiIdx + 4] || '0');
  const latDir = parts[imeiIdx + 5]?.trim() || 'N';
  const lngRaw = parseFloat(parts[imeiIdx + 6] || '0');
  const lngDir = parts[imeiIdx + 7]?.trim() || 'E';

  // Auto-detect DDMM.MMMM vs decimal degrees
  const latitude = (latDir === 'S' ? -1 : 1) * (latRaw > 90 ? dmsToDecimal(latRaw) : latRaw);
  const longitude = (lngDir === 'W' ? -1 : 1) * (lngRaw > 180 ? dmsToDecimal(lngRaw) : lngRaw);

  const speedRaw = parseFloat(parts[imeiIdx + 8] || '0');
  // If speed looks like knots (reasonable range), convert; otherwise treat as km/h
  const speedKmh = Math.round(speedRaw);

  const heading = parseInt(parts[imeiIdx + 9] || '0', 10) || 0;
  const hdop = parseFloat(parts[imeiIdx + 10] || '0') || 0;

  // Voltage is usually at index imeiIdx+12 but varies
  const voltageRaw = parseFloat(parts[imeiIdx + 12] || '0') || null;
  const voltage = voltageRaw && voltageRaw > 0 ? voltageRaw : null;

  return { imei, event, timestamp, latitude, longitude, speedKmh, heading, gpsValid, hdop, voltage, raw: line };
}
