const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { NotificationSoundsService } = require('../dist/alerts/notification-sounds.service.js');

function makeWav(durationMs = 250) {
  const sampleRate = 8000;
  const dataBytes = Math.round(sampleRate * 2 * durationMs / 1000);
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}

function serviceFor(role = 'admin', roleActions = ['view']) {
  const stored = [];
  const findCalls = [];
  const repo = {
    create: value => value,
    save: async value => { stored.push(value); return value; },
    find: async ({ where }) => { findCalls.push(where); return where?.isActive ? stored.filter(sound => sound.isActive) : stored; },
  };
  const orgPerms = { findByUser: async () => null };
  const rolePerms = { findAll: async () => ({ [role]: { alerts: roleActions } }) };
  return { service: new NotificationSoundsService(repo, orgPerms, rolePerms), stored, repo, findCalls };
}

test('internal manager can upload a valid short PCM WAV into the shared catalogue', async () => {
  const { service, stored } = serviceFor();
  const user = { id: 'admin-a', role: 'admin' };
  const result = await service.create(user, 'Door chime', { buffer: makeWav() });
  assert.equal(result.name, 'Door chime');
  assert.equal(result.mimeType, 'audio/wav');
  assert.equal(result.durationMs, 250);
  assert.match(result.fileName, /^tv_[0-9a-f]{32}\.wav$/);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].createdBy, user.id);
});

test('client roles cannot upload or change the shared sound library', async () => {
  const { service, stored } = serviceFor('client_admin');
  const user = { id: 'client-a', role: 'client_admin', organizationId: 'org-a' };
  await assert.rejects(() => service.create(user, 'Tone', { buffer: makeWav() }), error => error.status === 403);
  assert.equal(stored.length, 0);
});

test('clients only see active sounds and require effective alerts view access', async () => {
  const { service, stored, findCalls } = serviceFor('client_user');
  stored.push({ id: 'active', isActive: true }, { id: 'inactive', isActive: false });
  const client = { id: 'client-a', role: 'client_user', organizationId: 'org-a' };
  await service.list(client, true);
  assert.deepEqual(findCalls[0], { isActive: true });
  const denied = serviceFor('client_user', []).service;
  await assert.rejects(() => denied.list(client), error => error.status === 403);
});

test('internal sound managers can list inactive catalogue entries', async () => {
  const { service, stored, findCalls } = serviceFor('admin');
  stored.push({ id: 'inactive', isActive: false });
  await service.list({ id: 'admin-a', role: 'admin' }, true);
  assert.deepEqual(findCalls[0], {});
});

test('sound upload rejects malformed audio and files above the server limit', async () => {
  const { service } = serviceFor();
  const user = { id: 'admin-a', role: 'admin' };
  await assert.rejects(() => service.create(user, 'Broken', { buffer: Buffer.from('not audio') }), error => error.status === 400);
  await assert.rejects(() => service.create(user, 'Large', { buffer: Buffer.alloc(900 * 1024 + 1) }), error => error.status === 400);
});
