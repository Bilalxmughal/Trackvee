const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { GeofencesService } = require('../dist/geofences/geofences.service.js');
const { PoisService } = require('../dist/pois/poi.service.js');

function mockRepository(rows = []) {
  return {
    rows,
    find: async options => rows.filter(row => !options?.where || Object.entries(options.where).every(([key, value]) => row[key] === value)),
    findOne: async options => rows.find(row => Object.entries(options.where).every(([key, value]) => row[key] === value)) ?? null,
    create: values => ({ id: values.id ?? `new-${rows.length + 1}`, createdAt: new Date(), ...values }),
    save: async row => { const index = rows.findIndex(current => current.id === row.id); if (index < 0) rows.push(row); else rows[index] = row; return row; },
    remove: async row => { const index = rows.findIndex(current => current.id === row.id); if (index >= 0) rows.splice(index, 1); },
  };
}

function dependencies(perms = null) {
  return {
    orgPermissions: { findByUser: async () => perms },
    rolePermissions: { findAll: async () => ({}) },
  };
}

const client = { id: 'client-1', role: 'client_admin', organizationId: 'org-a' };

test('geofence list is scoped to the authenticated organization', async () => {
  const repo = mockRepository([{ id: 'g-a', orgId: 'org-a' }, { id: 'g-b', orgId: 'org-b' }]);
  const service = new GeofencesService(repo, dependencies().orgPermissions, dependencies().rolePermissions);
  assert.deepEqual((await service.findAll(client)).map(row => row.id), ['g-a']);
});

test('client geofence creation requires Add permission and derives org from auth', async () => {
  const repo = mockRepository();
  const denied = new GeofencesService(repo, dependencies().orgPermissions, dependencies().rolePermissions);
  await assert.rejects(() => denied.create(client, { id: 'spoofed', orgId: 'org-b', name: 'Zone' }), { status: 403 });
  const allowedPerms = { orgId: 'org-a', geofencesAdd: true };
  const allowed = new GeofencesService(repo, dependencies(allowedPerms).orgPermissions, dependencies(allowedPerms).rolePermissions);
  const created = await allowed.create(client, { id: 'spoofed', orgId: 'org-b', name: 'Zone', type: 'circle', coordinates: { center: [1, 2], radius: 300 }, triggerOnExit: true });
  assert.equal(created.orgId, 'org-a');
  assert.notEqual(created.id, 'spoofed');
  assert.equal(created.triggerOnExit, true);
});

test('client cannot edit a geofence in another organization or transfer its own record', async () => {
  const repo = mockRepository([{ id: 'g-a', orgId: 'org-a', name: 'Old', type: 'circle', coordinates: {}, color: '#dc2626' }, { id: 'g-b', orgId: 'org-b', name: 'Private' }]);
  const perms = { orgId: 'org-a', geofencesEdit: true };
  const service = new GeofencesService(repo, dependencies(perms).orgPermissions, dependencies(perms).rolePermissions);
  await assert.rejects(() => service.update('g-b', { name: 'Changed' }, client), { status: 404 });
  const updated = await service.update('g-a', { id: 'spoofed', orgId: 'org-b', name: 'New' }, client);
  assert.equal(updated.id, 'g-a');
  assert.equal(updated.orgId, 'org-a');
  assert.equal(updated.name, 'New');
});

test('POI delete is permission-checked and tenant-scoped', async () => {
  const repo = mockRepository([{ id: 'p-a', orgId: 'org-a' }, { id: 'p-b', orgId: 'org-b' }]);
  const denied = new PoisService(repo, dependencies().orgPermissions, dependencies().rolePermissions);
  await assert.rejects(() => denied.remove('p-a', client), { status: 403 });
  const perms = { orgId: 'org-a', poisDelete: true };
  const allowed = new PoisService(repo, dependencies(perms).orgPermissions, dependencies(perms).rolePermissions);
  await assert.rejects(() => allowed.remove('p-b', client), { status: 404 });
  await allowed.remove('p-a', client);
  assert.deepEqual(repo.rows.map(row => row.id), ['p-b']);
});
