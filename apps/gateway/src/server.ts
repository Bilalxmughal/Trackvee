import { createServer, Socket } from 'net';
import { parseGt06Frame, buildGt06Response, PROTO_LOGIN, PROTO_HEARTBEAT } from '@yotrack/protocol';
import { createLogger } from '@yotrack/utils';
import { connectionManager } from './connection-manager.js';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000/api/v1';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';
const TELEMETRY_SAVE_ATTEMPTS = 3;
const TELEMETRY_REQUEST_TIMEOUT_MS = 5_000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface HeartbeatStatus {
  ignition: boolean;
  externalPower: boolean;
  immobilizer: boolean;
  voltageLevel: number;
  gsmSignal: number;
}
const heartbeatCache = new Map<string, HeartbeatStatus>();

async function checkin(imei: string, heartbeat?: HeartbeatStatus): Promise<void> {
  await fetch(`${API_URL}/devices/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
    body: JSON.stringify(heartbeat ? { imei, ...heartbeat } : { imei }),
  }).catch(() => {});
}

async function saveTelemetry(imei: string, packet: {
  latitude: number; longitude: number; speedKmh: number;
  heading: number; gpsValid: boolean; satellites: number;
  timestamp?: Date;
}): Promise<void> {
  const hb = heartbeatCache.get(imei);
  const body = {
    imei,
    timestamp: (packet.timestamp ?? new Date()).toISOString(),
    latitude: packet.latitude,
    longitude: packet.longitude,
    speedKmh: packet.speedKmh,
    heading: packet.heading,
    gpsValid: packet.gpsValid,
    satellites: packet.satellites,
    ...(hb ? {
      ignition: hb.ignition,
      externalPower: hb.externalPower,
      immobilizer: hb.immobilizer,
      voltageLevel: hb.voltageLevel,
      gsmSignal: hb.gsmSignal,
    } : {}),
    raw: { protocol: 'gt06' },
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= TELEMETRY_SAVE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEMETRY_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/telemetry/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const status = res.status;
        await res.body?.cancel().catch(() => {});
        throw new Error(`HTTP ${status}`);
      }
      await res.arrayBuffer();
      return;
    } catch (err) {
      lastError = err;
      if (attempt < TELEMETRY_SAVE_ATTEMPTS) await delay(250 * (2 ** (attempt - 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const logger = createLogger('TcpServer');

async function handleBuffer(socket: Socket, remote: string, buf: Buffer, imeiRef: { value: string | null }): Promise<Buffer> {
  while (buf.length >= 10) {
    // Extended GT06 packet (7979): 2-byte length field — skip cleanly to avoid
    // mis-parsing 7878 bytes that appear inside the payload as a new frame.
    if (buf[0] === 0x79 && buf[1] === 0x79) {
      if (buf.length < 6) break; // need start(2)+len(2)+at least proto+end to know total
      const extLength = buf.readUInt16BE(2);
      const extTotal = extLength + 6; // 2(start) + 2(len) + extLength(proto+data+serial+crc) + 2(end)
      if (buf.length < extTotal) break;
      logger.debug(`[${imeiRef.value ?? remote}] Extended GT06 (7979) proto=0x${buf[4]?.toString(16)} len=${extLength} — skipped`);
      buf = buf.slice(extTotal);
      continue;
    }

    if (buf[0] !== 0x78 || buf[1] !== 0x78) {
      // Not a valid GT06 start — skip until we find one
      const idx = buf.indexOf(Buffer.from([0x78, 0x78]), 1);
      if (idx === -1) return Buffer.alloc(0);
      buf = buf.slice(idx);
      continue;
    }

    const length = buf[2]!;
    // GT06: total packet = 2(start) + 1(len) + [length bytes: proto + data + serial(2) + crc(2)] + 2(end)
    const totalLen = length + 5;
    if (buf.length < totalLen) break; // wait for more data

    const result = parseGt06Frame(buf);

    if (!result.ok) {
      logger.warn(`Parse error (${remote}): ${result.reason} | hex: ${buf.slice(0, 20).toString('hex')}`);
      buf = buf.slice(1); // skip one byte and retry
      continue;
    }

    const { packet } = result;
    const packetLen = result.raw.length;

    if (packet.type === 'login') {
      imeiRef.value = packet.imei;
      connectionManager.register(packet.imei, socket);
      connectionManager.heartbeat(packet.imei);
      const resp = buildGt06Response(PROTO_LOGIN, packet.serial);
      socket.write(resp);
      logger.info(`[${packet.imei}] LOGIN — responded with ACK`);
      checkin(packet.imei);

    } else if (packet.type === 'gps') {
      const imei = imeiRef.value ?? 'unknown';
      if (imeiRef.value) connectionManager.heartbeat(imeiRef.value);
      logger.info(`[${imei}] GPS | valid:${packet.gpsValid} | ${packet.latitude.toFixed(6)},${packet.longitude.toFixed(6)} | ${packet.speedKmh}km/h | hdg:${packet.heading}° | sats:${packet.satellites}`);
      if (imeiRef.value && packet.gpsValid) {
        try {
          await saveTelemetry(imeiRef.value, packet);
          logger.info(`[${imeiRef.value}] GPS persisted | ${packet.timestamp?.toISOString() ?? 'timestamp unavailable'}`);
        } catch (err) {
          logger.error(`[${imeiRef.value}] GPS persistence failed; closing without ACK so the tracker can reconnect: ${err}`);
          throw err;
        }
      }
      // Valid GPS packets are ACKed only after the API has confirmed the database save.
      // Invalid GPS packets still receive an ACK because they are intentionally not ingested.
      socket.write(buildGt06Response(0x12, packet.serial));

    } else if (packet.type === 'heartbeat') {
      const imei = imeiRef.value ?? 'unknown';
      if (imeiRef.value) {
        connectionManager.heartbeat(imeiRef.value);
        if (packet.terminalInfo !== undefined) {
          const ti = packet.terminalInfo;
          const hb: HeartbeatStatus = {
            ignition:      !!(ti & 0x10), // bit 4 = ACC (ignition)
            externalPower: !!(ti & 0x08), // bit 3 = charging/external power
            immobilizer:   !!(ti & 0x01), // bit 0 = oil/electricity cut
            voltageLevel:  packet.voltageLevel ?? 0,
            gsmSignal:     packet.gsmSignal ?? 0,
          };
          heartbeatCache.set(imeiRef.value, hb);
          checkin(imeiRef.value, hb); // persist to DB
        } else {
          checkin(imeiRef.value);
        }
      }
      const resp = buildGt06Response(PROTO_HEARTBEAT, packet.serial);
      socket.write(resp);
      logger.info(`[${imei}] HEARTBEAT ti=0x${(packet.terminalInfo ?? 0).toString(16)} v=${packet.voltageLevel ?? '?'} gsm=${packet.gsmSignal ?? '?'}`);

    } else {
      logger.debug(`[${imeiRef.value ?? 'unknown'}] Unknown protocol 0x${packet.protocol.toString(16)}`);
    }

    buf = buf.slice(packetLen);
  }

  return buf;
}

export function createTcpServer(port: number, host: string): void {
  const server = createServer((socket: Socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info(`New connection from ${remote}`);

    let buffer: Buffer = Buffer.alloc(0);
    let processing = Promise.resolve();
    const imeiRef: { value: string | null } = { value: null };

    socket.on('data', (chunk: Buffer) => {
      logger.info(`Raw data from ${remote}: hex=${chunk.toString('hex')} len=${chunk.length}`);
      buffer = Buffer.concat([buffer, chunk]);
      socket.pause();
      processing = processing.then(async () => {
        if (socket.destroyed) return;
        try {
          buffer = await handleBuffer(socket, remote, buffer, imeiRef);
        } catch {
          // Do not acknowledge or retain a failed GPS frame on this connection.
          // Destroying the socket lets the tracker reconnect and report again.
          socket.destroy();
        } finally {
          if (!socket.destroyed) socket.resume();
        }
      });
    });

    socket.on('close', () => {
      if (imeiRef.value) {
        connectionManager.remove(imeiRef.value, socket);
        logger.info(`[${imeiRef.value}] disconnected`);
      } else {
        logger.info(`Unknown connection closed: ${remote}`);
      }
    });

    socket.on('error', (err: Error) => {
      logger.warn(`Socket error (${remote}): ${err.message}`);
    });

    socket.setKeepAlive(true, 60_000);
    socket.setTimeout(300_000);
    socket.on('timeout', () => {
      logger.warn(`Socket timeout: ${remote}`);
      socket.destroy();
    });
  });

  server.on('error', (err: Error) => {
    logger.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    logger.info(`TCP Gateway listening on ${host}:${port}`);
    logger.info('Waiting for device connections...');
  });
}
