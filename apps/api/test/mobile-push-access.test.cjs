const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AlertsService } = require('../dist/alerts/alerts.service.js');

function harness({ role = 'client_user', orgId = 'org-a', roleActions = ['view'], orgPerm = null, deviceVisible = true } = {}) {
  const writes = [];
  const deletes = [];
  const alert = { id: 'alert-a', orgId: 'org-a', name: 'Speed alert', type: 'over_speed', notifications: { appPush: true } };
  const alertRepo = { findOne: async ({ where }) => where.id === alert.id && (!where.orgId || where.orgId === alert.orgId) ? alert : null };
  const log = { id: 'log-a', alertId: 'alert-a', imei: 'imei-a', triggeredAt: new Date('2026-09-28T10:00:00Z'), payload: { speed: 92, lat: 31.5, lng: 74.3 } };
  const logRepo = { findOne: async ({ where }) => where.id === log.id ? log : null, create: value => value, save: async value => value };
  const tokenRepo = {
    findOne: async () => null,
    create: value => value,
    save: async value => { writes.push(value); return value; },
    delete: async value => { deletes.push(value); },
    find: async () => [],
  };
  const vehicle = { id: 'vehicle-a', organizationId: 'org-a', name: 'Car', licensePlate: 'LEH-1', make: 'Test', model: 'Car' };
  const devices = {
    findAll: async () => deviceVisible ? [{ imei: 'imei-a', vehicle }] : [],
    findByImei: async () => ({ imei: 'imei-a', vehicle }),
  };
  const orgPerms = { findByUser: async () => orgPerm };
  const rolePerms = { findAll: async () => ({ [role]: { alerts: roleActions } }) };
  const service = new AlertsService(alertRepo, logRepo, {}, devices, orgPerms, rolePerms, tokenRepo, { find: async () => [] });
  return { service, writes, deletes, user: { id: 'user-a', role, organizationId: orgId } };
}

test('push token registration derives user and organization from the authenticated client', async () => {
  const { service, writes, user } = harness();
  await service.registerPushToken(user, 'ExpoPushToken[abc_123]', 'ios');
  assert.deepEqual(writes[0], { userId: 'user-a', organizationId: 'org-a', token: 'ExpoPushToken[abc_123]', platform: 'ios' });
});

test('push token registration rejects clients without alerts view', async () => {
  const { service, writes, user } = harness({ roleActions: [] });
  await assert.rejects(() => service.registerPushToken(user, 'ExpoPushToken[abc_123]', 'ios'));
  assert.equal(writes.length, 0);
});

test('a client cannot open an alert log outside its organization', async () => {
  const { service, user } = harness({ orgId: 'org-b' });
  await assert.rejects(() => service.getLogDetail(user, 'log-a'));
});

test('a client with no vehicle grant cannot open a log for that vehicle', async () => {
  const { service, user } = harness({ orgPerm: { alertsView: true, vehicleIds: [] }, deviceVisible: false });
  await assert.rejects(() => service.getLogDetail(user, 'log-a'));
});

test('push token removal is restricted to the authenticated user', async () => {
  const { service, deletes, user } = harness();
  await service.removePushToken(user, 'ExponentPushToken[abc_123]');
  assert.deepEqual(deletes[0], { userId: 'user-a', token: 'ExponentPushToken[abc_123]' });
});
