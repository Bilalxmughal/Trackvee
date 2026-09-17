import { Socket } from 'net';
import { createLogger } from '@yotrack/utils';

const logger = createLogger('ConnectionManager');

interface DeviceConnection {
  imei: string;
  socket: Socket;
  connectedAt: Date;
  lastSeen: Date;
}

class ConnectionManager {
  private readonly connections = new Map<string, DeviceConnection>();

  register(imei: string, socket: Socket): void {
    const existing = this.connections.get(imei);
    if (existing && existing.socket !== socket) {
      logger.warn(`Duplicate connection for IMEI ${imei}, closing old socket`);
      existing.socket.destroy();
    }
    this.connections.set(imei, {
      imei,
      socket,
      connectedAt: new Date(),
      lastSeen: new Date(),
    });
    logger.info(`Device registered: ${imei} (total: ${this.connections.size})`);
  }

  heartbeat(imei: string): void {
    const conn = this.connections.get(imei);
    if (conn) conn.lastSeen = new Date();
  }

  remove(imei: string): void {
    this.connections.delete(imei);
    logger.info(`Device disconnected: ${imei} (total: ${this.connections.size})`);
  }

  getBySocket(socket: Socket): DeviceConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.socket === socket) return conn;
    }
    return undefined;
  }

  count(): number {
    return this.connections.size;
  }
}

export const connectionManager = new ConnectionManager();
