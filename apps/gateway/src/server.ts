import { createServer, Socket } from 'net';
import { parseAt06Frame } from '@yotrack/protocol';
import { createLogger } from '@yotrack/utils';
import { connectionManager } from './connection-manager.js';

const logger = createLogger('TcpServer');

function handleData(socket: Socket, rawData: string): void {
  const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!line.startsWith('$$')) continue;

    const result = parseAt06Frame(line);

    if (!result.ok) {
      logger.warn(`Parse error: ${result.error.reason}`, { raw: line.slice(0, 80) });
      continue;
    }

    const { frame } = result;
    connectionManager.register(frame.imei, socket);
    connectionManager.heartbeat(frame.imei);

    logger.info(`[${frame.imei}] ${frame.alarmLabel} | GPS:${frame.gpsValid} | ${frame.latitude.toFixed(6)},${frame.longitude.toFixed(6)} | ${frame.speedKmh}km/h | IGN:${frame.status.input1}`);

    // TODO Phase 3: publish to Redis, store telemetry in PostgreSQL
  }
}

export function createTcpServer(port: number, host: string): void {
  const server = createServer((socket: Socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info(`New connection from ${remote}`);

    let buffer = '';

    socket.on('data', (chunk: Buffer) => {
      const raw = chunk.toString('ascii');
      logger.debug(`Raw data (${remote}): ${JSON.stringify(raw)}`);
      buffer += raw;
      // AT06 frames may use \r\n, \r, or \n as terminator
      const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const nlIndex = normalized.lastIndexOf('\n');
      if (nlIndex !== -1) {
        const complete = normalized.slice(0, nlIndex + 1);
        buffer = normalized.slice(nlIndex + 1);
        handleData(socket, complete);
      } else {
        buffer = normalized;
        // If buffer has $$ and is long enough, try parsing without terminator
        if (buffer.includes('$$') && buffer.length > 50) {
          handleData(socket, buffer + '\n');
          buffer = '';
        }
      }
    });

    socket.on('close', () => {
      const conn = connectionManager.getBySocket(socket);
      if (conn) connectionManager.remove(conn.imei);
      else logger.info(`Unknown connection closed: ${remote}`);
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
