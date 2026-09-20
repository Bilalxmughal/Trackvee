import 'dotenv/config';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '@yotrack/utils';
import { createTcpServer } from './server.js';
import { connectionManager } from './connection-manager.js';

const logger = createLogger('Gateway');

const PORT = parseInt(process.env['GATEWAY_PORT'] ?? '5023', 10);
const HOST = process.env['GATEWAY_HOST'] ?? '0.0.0.0';
const CMD_PORT = parseInt(process.env['GATEWAY_CMD_PORT'] ?? '5024', 10);
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

logger.info('YoTrack TCP Gateway starting...');
logger.info(`Protocol: GT06 | TCP Port: ${PORT} | CMD Port: ${CMD_PORT}`);

createTcpServer(PORT, HOST);

// Internal HTTP command server — only for API/admin to call
const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
  const auth = req.headers['x-internal-key'];
  if (INTERNAL_KEY && auth !== INTERNAL_KEY) {
    res.writeHead(401).end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      if (req.method === 'GET' && req.url === '/connections') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ connections: connectionManager.list() }));
        return;
      }

      if (req.method === 'POST' && req.url === '/command') {
        const { imei, command } = JSON.parse(body) as { imei: string; command: string };
        if (!imei || !command) {
          res.writeHead(400).end(JSON.stringify({ error: 'imei and command required' }));
          return;
        }
        const sent = connectionManager.sendCommand(imei, command);
        res.writeHead(sent ? 200 : 404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sent, imei, command, connected: connectionManager.isConnected(imei) }));
        return;
      }

      res.writeHead(404).end(JSON.stringify({ error: 'not found' }));
    } catch (e) {
      res.writeHead(400).end(JSON.stringify({ error: String(e) }));
    }
  });
});

httpServer.listen(CMD_PORT, '127.0.0.1', () => {
  logger.info(`CMD HTTP server listening on 127.0.0.1:${CMD_PORT}`);
});

process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught exception: ${err.message}`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', reason);
  process.exit(1);
});
