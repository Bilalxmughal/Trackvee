const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { TelemetryService } = require('../dist/telemetry/telemetry.service.js');
const { TelemetryController } = require('../dist/telemetry/telemetry.controller.js');

const client = { id: 'user-1', role: 'client_user', organizationId: 'org-1' };

test('device health only queries devices returned by the caller-scoped device service', async () => {
  const now = Date.now();
  const allowedDevice = {
    id: 'device-1', imei: 'allowed-imei', name: 'Tracker', status: 'active',
    lastSeenAt: new Date(now - 60_000), lastGsmSignal: null, lastVoltageLevel: null,
    lastExternalPower: null, lastIgnition: null,
    vehicle: { id: 'vehicle-1', displayId: 12, licensePlate: 'LEH-1234', name: 'Sedan' },
  };
  let queriedImeis;
  const repo = { query: async (_sql, params) => {
    queriedImeis = params[0];
    return [{
      imei: 'allowed-imei', timestamp: new Date(now - 90_000), created_at: new Date(now - 30_000),
      gps_valid: true, satellites: 9, gsm_signal: 4, voltage_level: 4,
      external_power: true, ignition: true,
    }];
  } };
  const service = new TelemetryService(repo, { findAll: async () => [allowedDevice] }, {}, {}, {}, {}, {});

  const rows = await service.getDeviceHealth(client);
  assert.deepEqual(queriedImeis, ['allowed-imei']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].connection, 'online');
  assert.equal(rows[0].gps, 'good');
  assert.equal(rows[0].gsm, 'good');
  assert.equal(rows[0].externalPower, 'connected');
  assert.equal(rows[0].trackerLagSeconds, 60);
  assert.deepEqual(rows[0].issues, []);
});

test('device health does not query telemetry when the caller has no visible devices', async () => {
  const repo = { query: async () => { throw new Error('must not query without scoped devices'); } };
  const service = new TelemetryService(repo, { findAll: async () => [] }, {}, {}, {}, {}, {});
  assert.deepEqual(await service.getDeviceHealth(client), []);
});

test('client device health requires effective vehicles.view permission', async () => {
  const result = [{ imei: 'scoped' }];
  const controller = new TelemetryController(
    { getDeviceHealth: async () => result },
    {},
    { findByUser: async () => null },
    { findAll: async () => ({ client_user: { vehicles: [] } }) },
  );
  await assert.rejects(() => controller.getDeviceHealth(client), { status: 403 });
});

test('client with vehicles.view receives the scoped health result', async () => {
  const result = [{ imei: 'scoped' }];
  const controller = new TelemetryController(
    { getDeviceHealth: async () => result },
    {},
    { findByUser: async () => null },
    { findAll: async () => ({ client_user: { vehicles: ['view'] } }) },
  );
  assert.deepEqual(await controller.getDeviceHealth(client), result);
});
