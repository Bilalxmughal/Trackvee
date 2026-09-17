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
      buffer += chunk.toString('ascii');
      const nlIndex = buffer.lastIndexOf('\n');
      if (nlIndex !== -1) {
        const complete = buffer.slice(0, nlIndex + 1);
        buffer = buffer.slice(nlIndex + 1);
        handleData(socket, complete);
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
