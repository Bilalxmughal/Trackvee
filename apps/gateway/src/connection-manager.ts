import { Socket } from 'net';
import { createLogger } from '@yotrack/utils';
import { crc16Gt06 } from '@yotrack/protocol';

const logger = createLogger('ConnectionManager');

const GT06_START = 0x78;
const GT06_END_1 = 0x0D;
const GT06_END_2 = 0x0A;
const PROTO_SERVER_CMD = 0x80;

let cmdSerial = 1;

function buildGt06Command(cmd: string): Buffer {
  const cmdBytes = Buffer.from(cmd, 'ascii');
  // Protocol(1) + ServerFlag(4) + cmd + Serial(2) + CRC(2) = 9 + cmdLen
  const length = 1 + 4 + cmdBytes.length + 2 + 2;
  const buf = Buffer.alloc(length + 5); // start(2) + len(1) + length + end(2)
  let i = 0;
  buf[i++] = GT06_START;
  buf[i++] = GT06_START;
  buf[i++] = length;
  buf[i++] = PROTO_SERVER_CMD;
  // Server flag (4 bytes: 0x00000001)
  buf[i++] = 0x00; buf[i++] = 0x00; buf[i++] = 0x00; buf[i++] = 0x01;
  cmdBytes.copy(buf, i); i += cmdBytes.length;
  const serial = cmdSerial++ & 0xFFFF;
  buf[i++] = (serial >> 8) & 0xFF;
  buf[i++] = serial & 0xFF;
  const crc = crc16Gt06(buf, 2, i);
  buf[i++] = (crc >> 8) & 0xFF;
  buf[i++] = crc & 0xFF;
  buf[i++] = GT06_END_1;
  buf[i++] = GT06_END_2;
  return buf;
}

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

  remove(imei: string, socket?: Socket): void {
    const existing = this.connections.get(imei);
    if (socket && existing?.socket !== socket) return;
    this.connections.delete(imei);
    logger.info(`Device disconnected: ${imei} (total: ${this.connections.size})`);
  }

  sendCommand(imei: string, cmd: string): boolean {
    const conn = this.connections.get(imei);
    if (!conn) {
      logger.warn(`sendCommand: device ${imei} not connected`);
      return false;
    }
    const packet = buildGt06Command(cmd);
    logger.info(`[${imei}] Sending command "${cmd}" hex=${packet.toString('hex')}`);
    conn.socket.write(packet);
    return true;
  }

  isConnected(imei: string): boolean {
    return this.connections.has(imei);
  }

  getBySocket(socket: Socket): DeviceConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.socket === socket) return conn;
    }
    return undefined;
  }

  list(): { imei: string; connectedAt: Date; lastSeen: Date }[] {
    return Array.from(this.connections.values()).map(c => ({
      imei: c.imei,
      connectedAt: c.connectedAt,
      lastSeen: c.lastSeen,
    }));
  }

  count(): number {
    return this.connections.size;
  }
}

export const connectionManager = new ConnectionManager();
