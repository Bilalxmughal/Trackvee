const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AlertsService } = require('../dist/alerts/alerts.service.js');

function harness(initial, vehicleIds = ['a', 'b']) {
  const rows = initial.map(rule => ({ ...rule, vehicleImeis: [...rule.vehicleImeis], excludedVehicleImeis: [...(rule.excludedVehicleImeis ?? [])] }));
  let id = rows.length;
  const repo = {
    findOne: async ({ where }) => rows.find(row => row.id === where.id && (!where.orgId || row.orgId === where.orgId)) ?? null,
    findOneOrFail: async ({ where }) => {
      const row = rows.find(item => item.id === where.id && item.orgId === where.orgId);
      if (!row) throw new Error('Not found');
      return row;
    },
    find: async () => rows,
    create: value => ({ ...value }),
    save: async value => {
      if (!value.id) { value.id = `new-${++id}`; rows.push(value); }
      return value;
    },
    remove: async value => { rows.splice(rows.indexOf(value), 1); },
  };
  const source = { transaction: callback => callback({ getRepository: () => repo }) };
  const devices = { findAll: async () => vehicleIds.map((value, index) => ({ imei: value, vehicle: { id: `vehicle-${index}` } })) };
  const orgPerms = { findByUser: async () => null };
  const rolePerms = { findAll: async () => ({ client_owner: { alerts: ['view', 'add', 'edit', 'delete'] } }) };
  const service = new AlertsService(repo, {}, source, devices, orgPerms, rolePerms);
  const user = { id: 'user-1', role: 'client_owner', organizationId: 'org-1' };
  return { service, rows, user };
}
function rule(id, vehicleImeis, orgId = 'org-1') { return { id, orgId, name: 'Shared', type: 'over_speed', active: true, config: { speedLimit: 80 }, vehicleImeis, excludedVehicleImeis: [] }; }

test('editing vehicle A splits a shared rule without changing vehicle B', async () => {
  const { service, rows, user } = harness([rule('shared', ['a', 'b'])]);
  const edited = await service.updateForVehicle(user, 'shared', 'a', { name: 'A only', type: 'over_speed', config: { speedLimit: 90 } });
  assert.deepEqual(edited.vehicleImeis, ['a']);
  assert.deepEqual(rows.find(item => item.id === 'shared').vehicleImeis, ['b']);
  assert.equal(rows.find(item => item.id === 'shared').config.speedLimit, 80);
  assert.equal((await service.findActiveForImei('b', 'org-1')).length, 1);
});

test('deleting a fleet-wide rule for A excludes A while preserving B', async () => {
  const { service, rows, user } = harness([rule('fleet', [])]);
  await service.removeForVehicle(user, 'fleet', 'a');
  assert.deepEqual(rows[0].excludedVehicleImeis, ['a']);
  assert.equal((await service.findActiveForImei('a', 'org-1')).length, 0);
  assert.equal((await service.findActiveForImei('b', 'org-1')).length, 1);
});

test('cross-tenant and unrelated vehicle edits are rejected', async () => {
  const { service, user } = harness([rule('foreign', ['a'], 'org-2'), rule('local', ['b'])]);
  await assert.rejects(() => service.updateForVehicle(user, 'foreign', 'a', { name: 'X', type: 'idle' }));
  await assert.rejects(() => service.updateForVehicle(user, 'local', 'a', { name: 'X', type: 'idle' }));
});
