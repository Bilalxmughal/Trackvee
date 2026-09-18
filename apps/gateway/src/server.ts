import { createServer, Socket } from 'net';
import { parseGt06Frame, buildGt06Response, PROTO_LOGIN, PROTO_HEARTBEAT } from '@yotrack/protocol';
import { createLogger } from '@yotrack/utils';
import { connectionManager } from './connection-manager.js';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000/api/v1';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

async function checkin(imei: string): Promise<void> {
  await fetch(`${API_URL}/devices/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
    body: JSON.stringify({ imei }),
  }).catch(() => {});
}

async function saveTelemetry(imei: string, packet: {
  latitude: number; longitude: number; speedKmh: number;
  heading: number; gpsValid: boolean; satellites: number;
  timestamp?: Date;
}): Promise<void> {
  const body = {
    imei,
    timestamp: (packet.timestamp ?? new Date()).toISOString(),
    latitude: packet.latitude,
    longitude: packet.longitude,
    speedKmh: packet.speedKmh,
    heading: packet.heading,
    gpsValid: packet.gpsValid,
    satellites: packet.satellites,
    raw: { protocol: 'gt06' },
  };
  const res = await fetch(`${API_URL}/telemetry/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const logger = createLogger('TcpServer');

function handleBuffer(socket: Socket, remote: string, buf: Buffer, imeiRef: { value: string | null }): Buffer {
  while (buf.length >= 10) {
    if (buf[0] !== 0x78 || buf[1] !== 0x78) {
      // Not a valid GT06 start — skip until we find one
      const idx = buf.indexOf(Buffer.from([0x78, 0x78]), 1);
      if (idx === -1) return Buffer.alloc(0);
      buf = buf.slice(idx);
      continue;
    }

    const length = buf[2]!;
    const totalLen = length + 5; // 2(start) + 1(len byte) + length bytes + 2(end \r\n) - but length includes proto..crc
    // Actual total: 2 + 1 + (length) + 2 = length + 5 — but length includes serial(2)+crc(2) already
    // GT06: total packet = 2(start) + 1(len) + [length bytes: proto + data + serial(2) + crc(2)] + 2(end)
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
      const resp = buildGt06Response(0x12, packet.serial);
      socket.write(resp);
      logger.info(`[${imei}] GPS | valid:${packet.gpsValid} | ${packet.latitude.toFixed(6)},${packet.longitude.toFixed(6)} | ${packet.speedKmh}km/h | hdg:${packet.heading}° | sats:${packet.satellites}`);
      if (imeiRef.value && packet.gpsValid) {
        saveTelemetry(imeiRef.value, packet).catch((err: unknown) =>
          logger.error(`[${imeiRef.value}] Failed to save telemetry: ${err}`)
        );
      }

    } else if (packet.type === 'heartbeat') {
      const imei = imeiRef.value ?? 'unknown';
      if (imeiRef.value) {
        connectionManager.heartbeat(imeiRef.value);
        checkin(imeiRef.value);
      }
      const resp = buildGt06Response(PROTO_HEARTBEAT, packet.serial);
      socket.write(resp);
      logger.info(`[${imei}] HEARTBEAT`);

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

    let buffer: Uint8Array = Buffer.alloc(0);
    const imeiRef: { value: string | null } = { value: null };

    socket.on('data', (chunk: Buffer) => {
      logger.info(`Raw data from ${remote}: hex=${chunk.toString('hex')} len=${chunk.length}`);
      buffer = Buffer.concat([buffer, chunk]);
      buffer = handleBuffer(socket, remote, Buffer.from(buffer), imeiRef);
    });

    socket.on('close', () => {
      if (imeiRef.value) {
        connectionManager.remove(imeiRef.value);
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
