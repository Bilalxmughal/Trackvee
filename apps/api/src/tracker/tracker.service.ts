import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import * as net from 'net';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { parseAt06Line } from './at06.parser.js';

@Injectable()
export class TrackerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrackerService.name);
  private server: net.Server;

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly devicesService: DevicesService,
  ) {}

  onApplicationBootstrap() {
    const port = parseInt(process.env.GATEWAY_PORT ?? '5023', 10);
    this.server = net.createServer(socket => this.handleConnection(socket));

    this.server.listen(port, '0.0.0.0', () => {
      this.logger.log(`GPS tracker TCP server listening on port ${port}`);
    });

    this.server.on('error', (err: Error) => {
      this.logger.error(`TCP server error: ${err.message}`);
    });
  }

  private handleConnection(socket: net.Socket) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.log(`Device connected from ${remote}`);

    let buffer = '';

    socket.setTimeout(120_000); // 2-minute idle timeout
    socket.on('timeout', () => {
      this.logger.warn(`Socket timeout: ${remote}`);
      socket.destroy();
    });

    socket.on('data', async (chunk: Buffer) => {
      buffer += chunk.toString('ascii');

      // Packets end with ## — split on ## or newline
      const lines = buffer.split(/##|\r?\n/);
      // Last element may be an incomplete packet — keep it in buffer
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Add ## back so parser sees complete packet
        await this.processLine(line + '##', socket, remote);
      }
    });

    socket.on('close', () => this.logger.log(`Device disconnected: ${remote}`));
    socket.on('error', (err: Error) => {
      if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
        this.logger.error(`Socket error [${remote}]: ${err.message}`);
      }
    });
  }

  private async processLine(line: string, socket: net.Socket, remote: string) {
    const parsed = parseAt06Line(line);

    if (!parsed) {
      this.logger.debug(`Unrecognised packet from ${remote}: ${line.slice(0, 100)}`);
      return;
    }

    // Always update device last-seen timestamp
    await this.devicesService.updateLastSeen(parsed.imei).catch(() => {});

    // Heartbeat or invalid GPS — no coordinates to save
    if (parsed.event === 'GTHBP' || !parsed.gpsValid) {
      this.logger.debug(`Heartbeat/invalid-GPS from IMEI=${parsed.imei} event=${parsed.event}`);
      return;
    }

    // Sanity-check coordinates
    if (parsed.latitude === 0 && parsed.longitude === 0) {
      this.logger.debug(`Zero coordinates from IMEI=${parsed.imei} — skipping`);
      return;
    }

    try {
      // Look up device UUID to populate deviceId foreign key
      const device = await this.devicesService.findByImei(parsed.imei);

      await this.telemetryService.save({
        imei: parsed.imei,
        deviceId: device?.id ?? null,
        timestamp: parsed.timestamp,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        speedKmh: parsed.speedKmh,
        heading: parsed.heading,
        gpsValid: parsed.gpsValid,
        satellites: 0,
        raw: { event: parsed.event, hdop: parsed.hdop, voltage: parsed.voltage, line },
      });

      this.logger.log(
        `Telemetry saved — IMEI=${parsed.imei} event=${parsed.event} ` +
        `lat=${parsed.latitude.toFixed(5)} lng=${parsed.longitude.toFixed(5)} speed=${parsed.speedKmh}km/h`,
      );
    } catch (err) {
      this.logger.error(`Failed to save telemetry for IMEI=${parsed.imei}: ${err}`);
    }
  }
}
