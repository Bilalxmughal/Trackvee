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
  const soundsRepo = { find: async () => [], findOne: async () => null };
  const service = new AlertsService(alertRepo, logRepo, {}, devices, orgPerms, rolePerms, tokenRepo, soundsRepo, { find: async () => [] });
  return { service, writes, deletes, user: { id: 'user-a', role, organizationId: orgId } };
}

test('push token registration derives user and organization from the authenticated client', async () => {
  const { service, writes, user } = harness();
  await service.registerPushToken(user, 'ExpoPushToken[abc_123]', 'ios');
  assert.deepEqual(writes[0], { userId: 'user-a', organizationId: 'org-a', token: 'ExpoPushToken[abc_123]', platform: 'ios', supportsCustomSounds: false, supportsDynamicSounds: false, dynamicSoundIds: [] });
});

test('push registration records custom channel support only when explicitly reported', async () => {
  const { service, writes, user } = harness();
  await service.registerPushToken(user, 'ExpoPushToken[abc_123]', 'android', true);
  assert.equal(writes[0].supportsCustomSounds, true);
});

async function capturePush({ platform = 'android', supportsCustomSounds, supportsDynamicSounds = false, dynamicSoundIds = [], dynamicSound = null, notifications }) {
  const { AlertsService } = require('../dist/alerts/alerts.service.js');
  let message;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    message = JSON.parse(options.body)[0];
    return { ok: true, json: async () => ({ data: [{ status: 'ok' }] }) };
  };
  try {
    const vehicle = { id: 'vehicle-a', organizationId: 'org-a', name: 'Car', licensePlate: 'LEH-1' };
    const recipient = { id: 'user-a', role: 'client_user', organizationId: 'org-a', isActive: true };
    const tokenRepo = { find: async () => [{ token: 'ExpoPushToken[abc_123]', platform, supportsCustomSounds, supportsDynamicSounds, dynamicSoundIds }] };
    const service = new AlertsService(
      {}, {}, {},
      { findByImei: async () => ({ vehicle }) },
      { findByUser: async () => null },
      { findAll: async () => ({ client_user: { alerts: ['view'] } }) },
      tokenRepo,
      { find: async () => [], findOne: async ({ where }) => dynamicSound?.isActive && where.id === dynamicSound.id && where.isActive ? dynamicSound : null },
      { find: async () => [recipient] },
    );
    await service.sendMobilePush(
      { id: 'alert-a', name: 'Speed alert', orgId: 'org-a', type: 'over_speed', notifications },
      { id: 'log-a', imei: 'imei-a' },
    );
    return message;
  } finally {
    global.fetch = originalFetch;
  }
}

test('custom-sound clients receive the selected per-alert sound channel', async () => {
  const message = await capturePush({ supportsCustomSounds: true, notifications: { appPush: true, appSound: true, appSoundId: 'bell' } });
  assert.equal(message.sound, 'trackvee_bell.wav');
  assert.equal(message.channelId, 'trackvee-alerts-tone-bell-v1');
});

test('custom-sound clients receive a silent channel when this alert sound is off', async () => {
  const message = await capturePush({ supportsCustomSounds: true, notifications: { appPush: true, appSound: false, appSoundId: 'bell' } });
  assert.equal(message.sound, null);
  assert.equal(message.channelId, 'trackvee-alerts-silent-v1');
});

test('older app registrations retain the legacy notification channel', async () => {
  const message = await capturePush({ supportsCustomSounds: false, notifications: { appPush: true, appSound: true, appSoundId: 'soft' } });
  assert.equal(message.sound, 'trackvee_alert.wav');
  assert.equal(message.channelId, 'trackvee-alerts-custom-v1');
});

test('registered dynamic-sound clients receive the uploaded tone channel', async () => {
  const dynamicSound = { id: '123e4567-e89b-42d3-a456-426614174000', fileName: 'tv_123e4567e89b42d3a456426614174000.wav', isActive: true };
  const message = await capturePush({ supportsCustomSounds: true, supportsDynamicSounds: true, dynamicSoundIds: [dynamicSound.id], dynamicSound, notifications: { appPush: true, appSound: true, appSoundId: dynamicSound.id } });
  assert.equal(message.sound, dynamicSound.fileName);
  assert.equal(message.channelId, `trackvee-alerts-dyn-${dynamicSound.id.replaceAll('-', '')}`);
});

test('dynamic tone falls back when the device has not installed that sound', async () => {
  const dynamicSound = { id: '123e4567-e89b-42d3-a456-426614174000', fileName: 'tv_123e4567e89b42d3a456426614174000.wav', isActive: true };
  const message = await capturePush({ supportsCustomSounds: true, supportsDynamicSounds: true, dynamicSoundIds: [], dynamicSound, notifications: { appPush: true, appSound: true, appSoundId: dynamicSound.id } });
  assert.equal(message.sound, 'trackvee_alert.wav');
  assert.equal(message.channelId, 'trackvee-alerts-tone-trackvee-v1');
});

test('dynamic tone falls back after an uploaded sound has been deactivated', async () => {
  const dynamicSound = { id: '123e4567-e89b-42d3-a456-426614174000', fileName: 'tv_123e4567e89b42d3a456426614174000.wav', isActive: false };
  const message = await capturePush({ supportsCustomSounds: true, supportsDynamicSounds: true, dynamicSoundIds: [dynamicSound.id], dynamicSound, notifications: { appPush: true, appSound: true, appSoundId: dynamicSound.id } });
  assert.equal(message.sound, 'trackvee_alert.wav');
  assert.equal(message.channelId, 'trackvee-alerts-tone-trackvee-v1');
});

test('iOS receives the installed uploaded notification filename', async () => {
  const dynamicSound = { id: '123e4567-e89b-42d3-a456-426614174000', fileName: 'tv_123e4567e89b42d3a456426614174000.wav', isActive: true };
  const message = await capturePush({ platform: 'ios', supportsCustomSounds: true, supportsDynamicSounds: true, dynamicSoundIds: [dynamicSound.id], dynamicSound, notifications: { appPush: true, appSound: true, appSoundId: dynamicSound.id } });
  assert.equal(message.sound, dynamicSound.fileName);
  assert.equal(message.channelId, undefined);
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
