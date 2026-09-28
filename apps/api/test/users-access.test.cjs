const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { UsersController } = require('../dist/users/users.controller.js');

function fixture(orgUsers = []) {
  const calls = { listedOrgId: null, created: [], updated: [], removed: [], permissions: [] };
  const usersService = {
    findAll: async () => [],
    findOrgUsers: async orgId => { calls.listedOrgId = orgId; return orgUsers; },
    findById: async id => orgUsers.find(user => user.id === id) ?? null,
    create: async data => { calls.created.push(data); return { id: 'new-user', ...data, displayId: 7, isActive: true }; },
    update: async (id, data) => { calls.updated.push([id, data]); return { ...(orgUsers.find(user => user.id === id) ?? {}), ...data, id }; },
    remove: async id => { calls.removed.push(id); },
    revoke: async () => {},
  };
  const audit = { log: async () => {} };
  const orgPermissions = {
    findByUser: async () => null,
    upsert: async (...args) => { calls.permissions.push(args); return args; },
  };
  const rolePermissions = { findAll: async () => ({
    client_owner: { users: ['view', 'add', 'edit', 'delete'], vehicles: ['view', 'add', 'edit', 'delete'], alerts: ['view', 'add', 'edit', 'delete'] },
    client_super_admin: { users: ['view', 'add', 'edit'], vehicles: ['view', 'add', 'edit', 'delete'], alerts: ['view', 'add', 'edit', 'delete'] },
    client_admin: { users: ['view', 'add', 'edit'], vehicles: ['view'], alerts: ['view'] },
  }) };
  const vehicles = { find: async () => [] };
  const groups = { find: async () => [] };
  const memberships = { find: async () => [] };
  const controller = new UsersController(usersService, audit, orgPermissions, rolePermissions, vehicles, groups, memberships);
  return { controller, calls };
}

const req = { headers: {}, ip: '127.0.0.1' };

test('organization user list derives tenant from caller and only includes self and lower roles', async () => {
  const rows = [
    { id: 'owner', role: 'client_owner', organizationId: 'org-a' },
    { id: 'admin', role: 'client_admin', organizationId: 'org-a' },
    { id: 'user', role: 'client_user', organizationId: 'org-a' },
  ];
  const { controller, calls } = fixture(rows);
  const result = await controller.findOrgUsers('org-a', { id: 'admin', role: 'client_admin', organizationId: 'org-a' });
  assert.equal(calls.listedOrgId, 'org-a');
  assert.deepEqual(result.map(row => row.id), ['admin', 'user']);
  await assert.rejects(() => controller.findOrgUsers('org-b', { id: 'admin', role: 'client_admin', organizationId: 'org-a' }));
});

test('client user creation uses caller organization and persists custom permissions', async () => {
  const { controller, calls } = fixture();
  const caller = { id: 'admin', role: 'client_admin', organizationId: 'org-a' };
  const result = await controller.create({
    email: 'NEW@EXAMPLE.COM', password: 'strong-password', role: 'client_user', organizationId: 'org-a',
    permissions: { alertsView: true, vehicleIds: [] },
  }, caller, req);
  assert.equal(result.id, 'new-user');
  assert.equal(calls.created[0].organizationId, 'org-a');
  assert.equal(calls.created[0].email, 'new@example.com');
  assert.deepEqual(calls.permissions[0], ['new-user', 'org-a', { alertsView: true, vehicleIds: [] }]);
});

test('client cannot create a user in another organization or grant unsupported module actions', async () => {
  const { controller, calls } = fixture();
  const caller = { id: 'admin', role: 'client_admin', organizationId: 'org-a' };
  await assert.rejects(() => controller.create({ email: 'x@example.com', password: 'strong-password', organizationId: 'org-b' }, caller, req));
  await assert.rejects(() => controller.create({
    email: 'x@example.com', password: 'strong-password', permissions: { vehiclesAdd: true, vehicleIds: [] },
  }, caller, req));
  assert.equal(calls.created.length, 0);
});

test('a signed-in user cannot delete themselves', async () => {
  const { controller, calls } = fixture();
  await assert.rejects(() => controller.remove('self', { id: 'self', role: 'client_user', organizationId: 'org-a' }, req));
  assert.deepEqual(calls.removed, []);
});
