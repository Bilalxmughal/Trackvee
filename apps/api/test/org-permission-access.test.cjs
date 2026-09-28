const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { OrgPermissionsController } = require('../dist/org-permissions/org-permissions.controller.js');

function fixture(target) {
  const saved = [];
  const svc = { findByUser: async () => null, upsert: async (...args) => { saved.push(args); return args; } };
  const roles = { findAll: async () => ({ client_admin: { users: ['view', 'add', 'edit'] } }) };
  const users = { findOne: async () => target };
  const vehicles = { find: async () => [] };
  return { controller: new OrgPermissionsController(svc, roles, users, vehicles), saved };
}

test('an org admin cannot grant permissions to itself', async () => {
  const target = { id: 'a', role: 'client_admin', organizationId: 'org-1' };
  const { controller } = fixture(target);
  await assert.rejects(() => controller.upsert(target, target.id, { alertsAdd: true }));
});

test('an org admin cannot read or write permissions from another tenant', async () => {
  const target = { id: 'b', role: 'client_user', organizationId: 'org-2' };
  const caller = { id: 'a', role: 'client_admin', organizationId: 'org-1' };
  const { controller } = fixture(target);
  await assert.rejects(() => controller.findOne(caller, target.id));
  await assert.rejects(() => controller.upsert(caller, target.id, { alertsAdd: true }));
});

test('a permitted edit uses the target org and only recognized permission fields', async () => {
  const target = { id: 'b', role: 'client_user', organizationId: 'org-1' };
  const caller = { id: 'a', role: 'client_admin', organizationId: 'org-1' };
  const { controller, saved } = fixture(target);
  await assert.rejects(() => controller.upsert(caller, target.id, { orgId: 'other-org', vehiclesView: true }));
  await controller.upsert(caller, target.id, { orgId: 'org-1', userId: 'attacker', vehiclesView: true, vehicleIds: [] });
  assert.deepEqual(saved[0], ['b', 'org-1', { vehiclesView: true, vehicleIds: [] }]);
});

test('a manager cannot grant an action they do not have themselves', async () => {
  const target = { id: 'b', role: 'client_user', organizationId: 'org-1' };
  const caller = { id: 'a', role: 'client_admin', organizationId: 'org-1' };
  const { controller, saved } = fixture(target);
  await assert.rejects(() => controller.upsert(caller, target.id, { vehiclesAdd: true }));
  assert.equal(saved.length, 0);
});
