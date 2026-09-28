const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AlertsService } = require('../dist/alerts/alerts.service.js');

function harness({ role = 'client_user', roleActions = ['view'], orgPerm = null, rules = [], devices = [] } = {}) {
  const repo = {
    find: async () => rules,
  };
  const service = new AlertsService(
    repo,
    {},
    {},
    { findAll: async () => devices },
    { findByUser: async () => orgPerm },
    { findAll: async () => ({ [role]: { alerts: roleActions } }) },
    {},
    {},
  );
  return { service, user: { id: 'user-a', role, organizationId: 'org-a' } };
}

const makeRule = (id, vehicleImeis, excludedVehicleImeis = []) => ({
  id, orgId: 'org-a', name: id, active: true, type: 'over_speed', config: { speedLimit: 80 },
  vehicleImeis, excludedVehicleImeis,
});
const makeDevice = (imei, vehicleId) => ({ imei, vehicle: { id: vehicleId } });

test('client alert listing requires the effective alerts view permission', async () => {
  const { service, user } = harness({ roleActions: [] });
  await assert.rejects(() => service.findAll(user), error => error.status === 403);
});

test('client alert listing hides inaccessible vehicle targets and disables partial-scope mutations', async () => {
  const { service, user } = harness({
    orgPerm: { alertsView: true, alertsEdit: true, alertsDelete: true, vehicleIds: ['vehicle-a'] },
    rules: [makeRule('shared', ['imei-a', 'imei-b'])],
    devices: [makeDevice('imei-a', 'vehicle-a')],
  });
  const [rule] = await service.findAll(user);
  assert.deepEqual(rule.vehicleImeis, ['imei-a']);
  assert.deepEqual(rule.excludedVehicleImeis, []);
  assert.equal(rule.canEdit, false);
  assert.equal(rule.canDelete, false);
});

test('fleet-wide rules remain visible to restricted users but are not reported as manageable', async () => {
  const { service, user } = harness({
    orgPerm: { alertsView: true, alertsEdit: true, alertsDelete: true, vehicleIds: ['vehicle-a'] },
    rules: [makeRule('fleet', [], ['imei-b'])],
    devices: [makeDevice('imei-a', 'vehicle-a')],
  });
  const [rule] = await service.findAll(user);
  assert.equal(rule.fleetWide, true);
  assert.deepEqual(rule.vehicleImeis, []);
  assert.deepEqual(rule.excludedVehicleImeis, []);
  assert.equal(rule.canEdit, false);
  assert.equal(rule.canDelete, false);
});

test('client alert listing strips vehicle IDs outside the caller scope', async () => {
  const { service, user } = harness({
    orgPerm: { alertsView: true, alertsEdit: true, alertsDelete: true, vehicleIds: ['vehicle-a'] },
    rules: [makeRule('local', ['imei-a'])],
    devices: [makeDevice('imei-a', 'vehicle-a')],
  });
  const [rule] = await service.findAll(user);
  assert.deepEqual(rule.vehicleImeis, ['imei-a']);
  assert.equal(rule.canEdit, true);
  assert.equal(rule.canDelete, true);
});
