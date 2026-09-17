import { createLogger } from '@yotrack/utils';
import { createTcpServer } from './server.js';

const logger = createLogger('Gateway');

const PORT = parseInt(process.env['GATEWAY_PORT'] ?? '5023', 10);
const HOST = process.env['GATEWAY_HOST'] ?? '0.0.0.0';

logger.info('YoTrack TCP Gateway starting...');
logger.info(`Protocol: AT06 | Port: ${PORT}`);

createTcpServer(PORT, HOST);

process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught exception: ${err.message}`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', reason);
  process.exit(1);
});
