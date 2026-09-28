const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { DriverBehaviorController } = require('../dist/driver-behavior/driver-behavior.controller.js');

function fixture({ permissions = {}, orgPermission = null, vehicle = { id: 'v-1', organizationId: 'org-a' }, group = { id: 'g-1', organizationId: 'org-a' }, memberships = [] } = {}) {
  const calls = [];
  const svc = {
    getSettings: async (...args) => { calls.push(['getSettings', ...args]); return {}; },
    updateSettings: async (...args) => { calls.push(['updateSettings', ...args]); return args; },
    getLeaderboard: async (...args) => { calls.push(['getLeaderboard', ...args]); return []; },
    getVehicleScoreHistory: async (...args) => { calls.push(['scores', ...args]); return []; },
    getVehicleEvents: async (...args) => { calls.push(['events', ...args]); return []; },
    getGroupSettings: async (...args) => args,
    getVehicleSettings: async (...args) => args,
    setGroupSettings: async (...args) => args,
    setVehicleSettings: async (...args) => args,
    clearGroupSettings: async (...args) => args,
    clearVehicleSettings: async (...args) => args,
    deleteScore: async (...args) => args,
  };
  const roles = { findAll: async () => permissions };
  const orgPermissions = { findByUser: async () => orgPermission };
  const vehicles = { findOne: async ({ where }) => vehicle?.id === where.id && vehicle.organizationId === where.organizationId ? vehicle : null };
  const groups = { findOne: async ({ where }) => group?.id === where.id && group.organizationId === where.organizationId ? group : null };
  const memberRepo = { find: async () => memberships };
  return { controller: new DriverBehaviorController(svc, roles, orgPermissions, vehicles, groups, memberRepo), calls };
}

const orgAdmin = { id: 'u-1', role: 'client_admin', organizationId: 'org-a' };

test('client leaderboard access requires the role page permission and stays within the caller org', async () => {
  const denied = fixture({ permissions: { client_admin: { 'driver-behavior': [] } } });
  await assert.rejects(() => denied.controller.getLeaderboard(orgAdmin), error => error.getStatus() === 403);

  const allowed = fixture({ permissions: { client_admin: { 'driver-behavior': ['view'] } } });
  await allowed.controller.getLeaderboard(orgAdmin, 'org-b');
  assert.deepEqual(allowed.calls[0], ['getLeaderboard', 'org-a', null]);
});

test('client vehicle detail endpoints reject cross-organization IDs and scope the score query', async () => {
  const { controller, calls } = fixture({ permissions: { client_admin: { 'driver-behavior': ['view'] } } });
  await assert.rejects(() => controller.getVehicleScores('v-other', '30', orgAdmin), error => error.getStatus() === 404);
  await controller.getVehicleScores('v-1', '30', orgAdmin);
  assert.deepEqual(calls[0], ['scores', 'v-1', 30, 'org-a']);
});

test('custom vehicle access is enforced for leaderboard and vehicle details', async () => {
  const denied = fixture({
    permissions: { client_admin: { 'driver-behavior': ['view'] } },
    orgPermission: { orgId: 'org-a', vehicleIds: [] },
  });
  assert.deepEqual(await denied.controller.getLeaderboard(orgAdmin), []);
  await assert.rejects(() => denied.controller.getVehicleScores('v-1', '30', orgAdmin), error => error.getStatus() === 404);

  const allowed = fixture({
    permissions: { client_admin: { 'driver-behavior': ['view'] } },
    orgPermission: { orgId: 'org-a', vehicleIds: ['v-1'] },
  });
  await allowed.controller.getLeaderboard(orgAdmin);
  assert.deepEqual(allowed.calls[0], ['getLeaderboard', 'org-a', ['v-1']]);
  await allowed.controller.getVehicleScores('v-1', '30', orgAdmin);
  assert.deepEqual(allowed.calls[1], ['scores', 'v-1', 30, 'org-a']);
});

test('client org settings edits require edit access and ignore ownership fields', async () => {
  const denied = fixture({ permissions: { client_admin: { 'driver-behavior': ['view'] } } });
  await assert.rejects(() => denied.controller.updateSettings(orgAdmin, 'org-b', { overspeedThreshold: 90 }), error => error.getStatus() === 403);

  const allowed = fixture({ permissions: { client_admin: { 'driver-behavior': ['view', 'edit'] } } });
  await allowed.controller.updateSettings(orgAdmin, 'org-b', { organizationId: 'org-b', id: 'spoof', overspeedThreshold: 90 });
  assert.deepEqual(allowed.calls[0], ['updateSettings', 'org-a', { overspeedThreshold: 90 }]);
});

test('driver score deletion remains internal-admin-only', async () => {
  const { controller } = fixture();
  assert.throws(() => controller.deleteScore('score-1', orgAdmin), error => error.getStatus() === 403);
});
