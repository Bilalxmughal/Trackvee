const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { DevicesService } = require('../dist/devices/devices.service.js');

test('an org user cannot command an IMEI outside their visible fleet', async () => {
  const repo = { find: async () => [] };
  const rolePerms = { findAll: async () => ({ client_owner: { engine_cut: ['view'] } }) };
  const service = new DevicesService(repo, { findByUser: async () => null }, rolePerms);
  await assert.rejects(() => service.sendCommandByImei({ id: 'u', organizationId: 'org-1', role: 'client_owner' }, 'other-org-imei', 'immobilize'));
});

test('a user without engine-cut permission cannot send the command', async () => {
  const repo = { find: async () => [{ imei: 'owned-imei', vehicle: { id: 'v', organizationId: 'org-1' } }] };
  const rolePerms = { findAll: async () => ({ client_user: { engine_cut: [] } }) };
  const service = new DevicesService(repo, { findByUser: async () => null }, rolePerms);
  await assert.rejects(() => service.sendCommandByImei({ id: 'u', organizationId: 'org-1', role: 'client_user' }, 'owned-imei', 'immobilize'));
});

test('an explicitly empty vehicle access list grants no devices', async () => {
  const repo = { find: async () => { throw new Error('The broad device query must not execute'); } };
  const service = new DevicesService(repo, { findByUser: async () => ({ vehicleIds: [] }) }, { findAll: async () => ({}) });
  assert.deepEqual(await service.findAll({ id: 'u', organizationId: 'org-1', role: 'client_admin' }), []);
});

test('an owner can command only a device in their organization', async () => {
  const repo = { find: async ({ where }) => where?.vehicle?.organizationId === 'org-1' ? [{ imei: 'owned-imei', vehicle: { id: 'v', organizationId: 'org-1' } }] : [] };
  const service = new DevicesService(repo, { findByUser: async () => null }, { findAll: async () => ({ client_owner: { engine_cut: ['view'] } }) });
  const previousFetch = global.fetch;
  let sentTo = '';
  global.fetch = async (_url, options) => { sentTo = JSON.parse(options.body).imei; return { json: async () => ({ sent: true, connected: true }) }; };
  try {
    const result = await service.sendCommandByImei({ id: 'owner', organizationId: 'org-1', role: 'client_owner' }, 'owned-imei', 'immobilize');
    assert.equal(result.sent, true);
    assert.equal(sentTo, 'owned-imei');
  } finally { global.fetch = previousFetch; }
});
