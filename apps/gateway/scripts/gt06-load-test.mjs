#!/usr/bin/env node
import net from 'node:net';

const DEFAULTS = { host: '127.0.0.1', port: 5023, devices: 10, intervalSec: 30, durationSec: 120, imeiPrefix: '9999900000' };
const MAX_DEVICES = 300;
const MAX_DURATION_SEC = 900;
const MIN_INTERVAL_SEC = 5;

function optionsFrom(argv) {
  const options = { ...DEFAULTS, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') { options.dryRun = true; continue; }
    if (!token.startsWith('--') || i + 1 >= argv.length) throw new Error(`Invalid option: ${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    const map = { host: 'host', port: 'port', devices: 'devices', 'interval-sec': 'intervalSec', 'duration-sec': 'durationSec', 'imei-prefix': 'imeiPrefix' };
    if (!map[key]) throw new Error(`Unknown option: ${token}`);
    options[map[key]] = ['port', 'devices', 'interval-sec', 'duration-sec'].includes(key) ? Number(value) : value;
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('--port must be between 1 and 65535');
  if (!Number.isInteger(options.devices) || options.devices < 1 || options.devices > MAX_DEVICES) throw new Error(`--devices must be between 1 and ${MAX_DEVICES}`);
  if (!Number.isInteger(options.intervalSec) || options.intervalSec < MIN_INTERVAL_SEC || options.intervalSec > 300) throw new Error(`--interval-sec must be between ${MIN_INTERVAL_SEC} and 300`);
  if (!Number.isInteger(options.durationSec) || options.durationSec < 30 || options.durationSec > MAX_DURATION_SEC) throw new Error(`--duration-sec must be between 30 and ${MAX_DURATION_SEC}`);
  if (!/^\d{10}$/.test(options.imeiPrefix)) throw new Error('--imei-prefix must contain exactly 10 digits and match the prefix used in seed-load-test.sql');
  if (!['127.0.0.1', 'localhost', '::1'].includes(options.host)) throw new Error('For safety, run this simulator on the Oracle host and target localhost only.');
  return options;
}

function crc16Gt06(buffer, start, end) {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return (crc ^ 0xffff) & 0xffff;
}

function frame(protocol, payload, serial) {
  const length = 1 + payload.length + 2 + 2;
  const packet = Buffer.alloc(length + 5);
  packet[0] = 0x78; packet[1] = 0x78; packet[2] = length; packet[3] = protocol;
  payload.copy(packet, 4);
  const serialOffset = 4 + payload.length;
  packet.writeUInt16BE(serial & 0xffff, serialOffset);
  const crcOffset = serialOffset + 2;
  packet.writeUInt16BE(crc16Gt06(packet, 2, crcOffset), crcOffset);
  packet[crcOffset + 2] = 0x0d; packet[crcOffset + 3] = 0x0a;
  return packet;
}

function loginFrame(imei, serial) {
  const bcd = Buffer.from(`0${imei}`, 'hex');
  if (bcd.length !== 8) throw new Error(`IMEI ${imei} cannot be encoded as GT06 BCD`);
  return frame(0x01, bcd, serial);
}

function heartbeatFrame(ignition, serial) {
  const payload = Buffer.from([ignition ? 0x10 : 0x00, 5, 4]);
  return frame(0x13, payload, serial);
}

function gpsFrame(point, serial) {
  const payload = Buffer.alloc(18);
  const date = point.at;
  payload[0] = date.getUTCFullYear() - 2000;
  payload[1] = date.getUTCMonth() + 1;
  payload[2] = date.getUTCDate();
  payload[3] = date.getUTCHours();
  payload[4] = date.getUTCMinutes();
  payload[5] = date.getUTCSeconds();
  payload[6] = (8 << 4) | 8;
  payload.writeUInt32BE(Math.round(Math.abs(point.lat) * 1_800_000), 7);
  payload.writeUInt32BE(Math.round(Math.abs(point.lon) * 1_800_000), 11);
  payload[15] = point.speed;
  const flags = (point.heading & 0x03ff) | (point.lat >= 0 ? 1 << 10 : 0) | (point.lon < 0 ? 1 << 11 : 0) | (1 << 12);
  payload.writeUInt16BE(flags, 16);
  return frame(0x12, payload, serial);
}

function scenario(index, count) {
  const moving = Math.ceil(count * 0.4);
  const idle = Math.ceil(count * 0.3);
  return index < moving ? 'moving' : index < moving + idle ? 'idle' : 'parked';
}

function parseArgsHelp() {
  console.log('GT06 synthetic telemetry load test (connects to localhost only)');
  console.log('Options: --devices 10..300 --interval-sec 5..300 --duration-sec 30..900 --imei-prefix 10-digits --host 127.0.0.1 --port 5023 --dry-run');
}

async function run(options) {
  const modes = { moving: 0, idle: 0, parked: 0 };
  for (let i = 0; i < options.devices; i++) modes[scenario(i, options.devices)]++;
  const gpsAcks = { count: 0 };
  const failures = { count: 0 };
  const sockets = new Set();
  let serial = 1;
  let stopped = false;
  let progressTimer;
  let resolveStop;
  const stoppedPromise = new Promise(resolve => { resolveStop = resolve; });
  const endAt = Date.now() + options.durationSec * 1000;

  console.log(`Opening ${options.devices} synthetic GT06 sessions on ${options.host}:${options.port}`);
  console.log(`Scenario split: ${modes.moving} moving, ${modes.idle} idle (ignition on), ${modes.parked} parked (ignition off)`);
  console.log(`GPS interval ${options.intervalSec}s; duration ${options.durationSec}s; expected steady GPS writes about ${(options.devices / options.intervalSec).toFixed(1)}/s.`);
  if (options.dryRun) { console.log('Dry run only; no network connections opened.'); return { gpsAcks: 0, failures: 0 }; }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(progressTimer);
    for (const socket of sockets) socket.destroy();
    resolveStop();
  };
  process.once('SIGINT', () => { console.log('\nStopping on Ctrl+C…'); stop(); });

  const clients = Array.from({ length: options.devices }, (_, index) => new Promise(resolve => {
    const imei = `${options.imeiPrefix}${String(index + 1).padStart(5, '0')}`;
    const mode = scenario(index, options.devices);
    const ignition = mode !== 'parked';
    const speed = mode === 'moving' ? 25 + (index % 3) * 5 : 0;
    const row = Math.floor(index / 30), col = index % 30;
    const point = { lat: 24.8607 + row * 0.0008, lon: 67.0011 + col * 0.0008, speed, heading: 0, at: new Date() };
    let receiveBuffer = Buffer.alloc(0), loggedIn = false, heartbeatSent = false, done = false;
    let gpsTimer, heartbeatTimer, timeout;
    const socket = net.createConnection({ host: options.host, port: options.port });
    sockets.add(socket);
    const finish = failed => {
      if (done) return;
      done = true;
      clearTimeout(timeout); clearInterval(gpsTimer); clearInterval(heartbeatTimer);
      if (failed) failures.count++;
      sockets.delete(socket);
      socket.destroy();
      resolve();
    };
    const sendHeartbeat = () => {
      if (socket.destroyed) return;
      socket.write(heartbeatFrame(ignition, serial++));
    };
    const sendGps = () => {
      if (socket.destroyed || Date.now() >= endAt) return;
      const interval = options.intervalSec;
      point.at = new Date();
      if (mode === 'moving') {
        const northDegrees = (speed * interval / 3600) / 111.32;
        point.lat += northDegrees;
        point.lon += (speed * interval / 3600) / (111.32 * Math.cos(point.lat * Math.PI / 180)) * 0.35;
        point.heading = 20;
      }
      socket.write(gpsFrame(point, serial++));
    };
    socket.on('connect', () => {
      socket.write(loginFrame(imei, serial++));
    });
    socket.on('data', chunk => {
      receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
      while (receiveBuffer.length >= 5 && receiveBuffer[0] === 0x78 && receiveBuffer[1] === 0x78) {
        const packetLength = receiveBuffer[2] + 5;
        if (receiveBuffer.length < packetLength) break;
        const response = receiveBuffer.subarray(0, packetLength);
        receiveBuffer = receiveBuffer.subarray(packetLength);
        const protocol = response[3];
        if (protocol === 0x01 && !loggedIn) {
          loggedIn = true; clearTimeout(timeout); sendHeartbeat();
          heartbeatTimer = setInterval(sendHeartbeat, 60_000);
        } else if (protocol === 0x13 && loggedIn && !heartbeatSent) {
          heartbeatSent = true; sendGps();
          gpsTimer = setInterval(sendGps, options.intervalSec * 1000);
        } else if (protocol === 0x12) {
          gpsAcks.count++;
        }
      }
    });
    socket.on('error', () => finish(true));
    socket.on('close', () => { if (!done) finish(!stopped && Date.now() < endAt); });
    timeout = setTimeout(() => finish(true), 10_000);
  }));

  const progress = setInterval(() => console.log(`Progress: ${gpsAcks.count} GPS ACKs; ${failures.count} session failures; ${sockets.size} sessions open.`), 10_000);
  progressTimer = progress;
  const duration = new Promise(resolve => setTimeout(resolve, options.durationSec * 1000));
  await Promise.race([duration, stoppedPromise]);
  stop();
  await Promise.all(clients);
  console.log(`Finished: ${gpsAcks.count} GPS ACKs, ${failures.count} session failures, ${(gpsAcks.count / options.durationSec).toFixed(2)} ACKed GPS packets/s.`);
  if (failures.count > 0) process.exitCode = 1;
  return { gpsAcks: gpsAcks.count, failures: failures.count };
}

async function selfTest() {
  const { parseGt06Frame, buildResponse } = await import('../../../packages/protocol/dist/gt06/parser.js');
  const login = parseGt06Frame(loginFrame('999990000000001', 1));
  const heartbeat = parseGt06Frame(heartbeatFrame(true, 2));
  const gps = parseGt06Frame(gpsFrame({ lat: 24.8607, lon: 67.0011, speed: 25, heading: 20, at: new Date('2026-09-30T12:00:00Z') }, 3));
  if (!login.ok || login.packet.type !== 'login' || login.packet.imei !== '999990000000001') throw new Error('Synthetic login frame did not parse');
  if (!heartbeat.ok || heartbeat.packet.type !== 'heartbeat' || !(heartbeat.packet.terminalInfo & 0x10)) throw new Error('Synthetic ignition heartbeat did not parse');
  if (!gps.ok || gps.packet.type !== 'gps' || !gps.packet.gpsValid || Math.abs(gps.packet.latitude - 24.8607) > 0.00001 || Math.abs(gps.packet.longitude - 67.0011) > 0.00001) throw new Error('Synthetic GPS frame did not parse');

  const seen = { login: 0, heartbeat: 0, gps: 0 };
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5 && buffer[0] === 0x78 && buffer[1] === 0x78) {
        const size = buffer[2] + 5;
        if (buffer.length < size) break;
        const parsed = parseGt06Frame(buffer.subarray(0, size));
        buffer = buffer.subarray(size);
        if (!parsed.ok) throw new Error(`Mock gateway could not parse simulator frame: ${parsed.reason}`);
        const type = parsed.packet.type;
        if (type === 'login') seen.login++;
        else if (type === 'heartbeat') seen.heartbeat++;
        else if (type === 'gps') seen.gps++;
        socket.write(buildResponse(type === 'login' ? 0x01 : type === 'heartbeat' ? 0x13 : 0x12, parsed.packet.serial));
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const port = server.address().port;
    const result = await run({ host: '127.0.0.1', port, devices: 10, intervalSec: 1, durationSec: 3, imeiPrefix: '9999900000', dryRun: false });
    if (result.failures || seen.login !== 10 || seen.heartbeat !== 10 || seen.gps < 20 || result.gpsAcks < 20) {
      throw new Error(`Mock gateway integration check failed: ${JSON.stringify({ seen, result })}`);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log(`GT06 frame and localhost session self-test passed (${seen.login} logins, ${seen.heartbeat} ignition heartbeats, ${seen.gps} GPS frames).`);
}

try {
  if (process.argv.includes('--help')) { parseArgsHelp(); process.exit(0); }
  if (process.argv.includes('--self-test')) {
    await selfTest();
    process.exit(0);
  }
  const options = optionsFrom(process.argv.slice(2));
  await run(options);
} catch (error) {
  console.error(`Load test not started: ${error.message}`);
  parseArgsHelp();
  process.exitCode = 2;
}
