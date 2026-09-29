import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { theme } from '../src/theme';

type Action = 'view' | 'add' | 'edit' | 'delete';
type Module = { feature: string; prefix: string; label: string; actions: Action[] };
type OrgPermission = Record<string, boolean | string[] | null> & { vehicleIds: string[] | null };
type UserRecord = { id: string; displayId?: number; email: string; firstName: string | null; lastName: string | null; role: string; isActive: boolean };
type VehicleOption = { id: string; displayId: number; licensePlate: string | null; name: string; make: string | null; model: string | null };
type VehicleGroup = { id: string; name: string; vehicleIds: string[] };
type VehicleOptions = { vehicles: VehicleOption[]; groups: VehicleGroup[]; allVehiclesAllowed: boolean };

const MODULES: Module[] = [
  { feature: 'maintenance', prefix: 'maintenance', label: 'Maintenance', actions: ['view', 'add', 'edit', 'delete'] },
  { feature: 'vehicles', prefix: 'vehicles', label: 'Vehicles', actions: ['view', 'add', 'edit', 'delete'] },
  { feature: 'alerts', prefix: 'alerts', label: 'Alerts', actions: ['view', 'add', 'edit', 'delete'] },
  { feature: 'geofences', prefix: 'geofences', label: 'Geofences', actions: ['view', 'add', 'edit', 'delete'] },
  { feature: 'pois', prefix: 'pois', label: 'Points of Interest', actions: ['view', 'add', 'edit', 'delete'] },
  { feature: 'driver-behavior', prefix: 'driverBehavior', label: 'Driver Behavior', actions: ['view', 'edit'] },
  { feature: 'reports', prefix: 'reports', label: 'Reports', actions: ['view'] },
  { feature: 'users', prefix: 'users', label: 'Users', actions: ['view', 'add', 'edit', 'delete'] },
];
const ACTION_COLORS: Record<Action, string> = { view: '#3b82f6', add: '#16a34a', edit: '#f59e0b', delete: theme.red };
const ROLE_LEVEL: Record<string, number> = { client_owner: 4, client_super_admin: 3, client_admin: 2, client_user: 1 };
const ROLE_LABEL: Record<string, string> = { client_owner: 'Owner', client_super_admin: 'Super Admin', client_admin: 'Admin', client_user: 'User' };
const EMPTY_PERMISSIONS: OrgPermission = {
  vehiclesView: false, vehiclesAdd: false, vehiclesEdit: false, vehiclesDelete: false,
  alertsView: false, alertsAdd: false, alertsEdit: false, alertsDelete: false,
  geofencesView: false, geofencesAdd: false, geofencesEdit: false, geofencesDelete: false,
  poisView: false, poisAdd: false, poisEdit: false, poisDelete: false,
  driverBehaviorView: false, driverBehaviorEdit: false, reportsView: false,
  usersView: false, usersAdd: false, usersEdit: false, usersDelete: false,
  maintenanceView: false, maintenanceAdd: false, maintenanceEdit: false, maintenanceDelete: false,
  vehicleIds: null,
};
const permissionKey = (module: Module, action: Action) => `${module.prefix}${action[0]!.toUpperCase()}${action.slice(1)}`;
const userLabel = (user: UserRecord) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
const vehicleLabel = (vehicle: VehicleOption) => vehicle.licensePlate || `#${vehicle.displayId}`;
const vehicleSubtitle = (vehicle: VehicleOption) => [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name;

function errorText(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}

export default function UsersScreen() {
  const { user } = useAuth();
  const { canDo, loading: permissionLoading } = usePortalPermissions();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOptions>({ vehicles: [], groups: [], allVehiclesAllowed: false });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!user?.organizationId) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [usersResponse, accessResponse] = await Promise.all([
        api.get<UserRecord[]>('/users/org-users'),
        api.get<VehicleOptions>('/users/vehicle-access-options'),
      ]);
      setUsers(usersResponse.data);
      setVehicleOptions(accessResponse.data);
    } catch (e) {
      setError(errorText(e, 'Users could not be loaded. Please try again.'));
    } finally { setLoading(false); setRefreshing(false); }
  }, [user?.organizationId]);

  useEffect(() => {
    if (permissionLoading) return;
    if (!canDo('users', 'view')) { router.replace('/map'); return; }
    void load();
  }, [permissionLoading, canDo, load]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return users;
    return users.filter(entry => `${userLabel(entry)} ${entry.email} ${entry.displayId ?? ''}`.toLowerCase().includes(search));
  }, [users, query]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (entry: UserRecord) => { setEditing(entry); setEditorOpen(true); };
  const deleteUser = (entry: UserRecord) => Alert.alert('Delete user', `Remove ${userLabel(entry)} from this organization?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      try { await api.delete(`/users/${entry.id}`); setUsers(current => current.filter(row => row.id !== entry.id)); }
      catch (e) { Alert.alert('Unable to delete user', errorText(e, 'Please try again.')); }
    })(); } },
  ]);

  if (permissionLoading || loading) return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.loading}><ActivityIndicator color={theme.red}/><Text style={styles.secondary}>Loading users…</Text></View></SafeAreaView>;
  if (editorOpen) return <UserEditor
    initial={editing}
    currentUserId={user?.id ?? ''}
    currentUserRole={user?.role ?? 'client_user'}
    vehicleOptions={vehicleOptions}
    canDo={canDo}
    onClose={() => { setEditorOpen(false); setEditing(null); }}
    onSaved={entry => {
      setUsers(current => editing ? current.map(row => row.id === entry.id ? entry : row) : [...current, entry].sort((a, b) => userLabel(a).localeCompare(userLabel(b))));
      setEditorOpen(false); setEditing(null);
    }}
  />;

  return <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={styles.back}><TablerIcon name="back" size={20} color={theme.ink}/></Pressable>
      <View style={styles.headerTitle}><Text style={styles.title}>Users</Text><Text style={styles.subtitle}>{users.length} organization users</Text></View>
      {canDo('users', 'add') ? <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="Add user" style={styles.addButton}><TablerIcon name="plus" size={23} color={theme.red}/></Pressable> : null}
    </View>
    <View style={styles.search}><TablerIcon name="search" size={17} color={theme.secondary}/><TextInput value={query} onChangeText={setQuery} placeholder="Search name or email" placeholderTextColor={theme.muted} style={styles.searchInput} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search users"/></View>
    {error ? <Pressable onPress={() => void load(true)} style={styles.error}><Text style={styles.errorText}>{error}  Retry</Text></Pressable> : null}
    <ScrollView contentContainerStyle={filteredUsers.length ? styles.list : styles.empty} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.red}/> }>
      {refreshing ? <ActivityIndicator color={theme.red} style={{ marginBottom: 12 }}/> : null}
      {filteredUsers.map(entry => {
        const self = entry.id === user?.id;
        const manageable = (ROLE_LEVEL[entry.role] ?? 0) < (ROLE_LEVEL[user?.role ?? ''] ?? 0);
        return <View key={entry.id} style={styles.userRow}>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{userLabel(entry)}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{entry.email}</Text>
            <View style={styles.metaRow}><Text style={styles.userMeta}>{ROLE_LABEL[entry.role] ?? entry.role}</Text><Text style={styles.metaDot}>·</Text><Text style={[styles.userMeta, { color: entry.isActive ? '#15803d' : theme.muted }]}>{entry.isActive ? 'Active' : 'Inactive'}</Text>{self ? <><Text style={styles.metaDot}>·</Text><Text style={styles.userMeta}>You</Text></> : null}</View>
          </View>
          {(self || (manageable && canDo('users', 'edit'))) ? <Pressable onPress={() => openEdit(entry)} hitSlop={8} style={styles.rowAction} accessibilityRole="button" accessibilityLabel={`Edit ${userLabel(entry)}`}><TablerIcon name="edit" size={18} color={theme.secondary}/></Pressable> : null}
          {!self && manageable && canDo('users', 'delete') ? <Pressable onPress={() => deleteUser(entry)} hitSlop={8} style={styles.rowAction} accessibilityRole="button" accessibilityLabel={`Delete ${userLabel(entry)}`}><TablerIcon name="trash" size={18} color={theme.red}/></Pressable> : null}
        </View>;
      })}
      {!filteredUsers.length ? <Text style={styles.emptyText}>{query ? 'No users match your search.' : 'No users found.'}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function UserEditor({ initial, currentUserId, currentUserRole, vehicleOptions, canDo, onClose, onSaved }: {
  initial: UserRecord | null;
  currentUserId: string;
  currentUserRole: string;
  vehicleOptions: VehicleOptions;
  canDo: (feature: string, action?: string) => boolean;
  onClose: () => void;
  onSaved: (user: UserRecord) => void;
}) {
  const self = initial?.id === currentUserId;
  const canManageUser = self || (initial ? canDo('users', 'edit') : canDo('users', 'add'));
  const availableRoles = Object.keys(ROLE_LEVEL).filter(role => role !== 'client_owner' && ROLE_LEVEL[role]! < (ROLE_LEVEL[currentUserRole] ?? 0));
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicles' | 'permissions'>('profile');
  const [role, setRole] = useState(initial?.role ?? availableRoles[availableRoles.length - 1] ?? 'client_user');
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [permissions, setPermissions] = useState<OrgPermission>({ ...EMPTY_PERMISSIONS, vehicleIds: vehicleOptions.allVehiclesAllowed ? null : [] });
  const [permissionsReady, setPermissionsReady] = useState(!initial || self || !canManageUser);
  const [permissionsError, setPermissionsError] = useState('');
  const [permissionsRetry, setPermissionsRetry] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canEditPermissions = canManageUser && !self && role !== 'client_owner';
  const visibleModules = MODULES.filter(module => module.actions.some(action => canDo(module.feature, action)));

  useEffect(() => {
    if (!initial || self || !canManageUser) { setPermissionsReady(true); return; }
    let activeEffect = true;
    api.get<OrgPermission | null>(`/org-permissions/${initial.id}`).then(response => {
      if (!activeEffect) return;
      const result = response.data;
      setPermissions({ ...EMPTY_PERMISSIONS, ...(result ?? {}), vehicleIds: result?.vehicleIds ?? null });
      setPermissionsError('');
    }).catch(() => {
      if (!activeEffect) return;
      setPermissionsError('Existing permissions could not be loaded. Retry before saving to avoid replacing them.');
    }).finally(() => { if (activeEffect) setPermissionsReady(true); });
    return () => { activeEffect = false; };
  }, [initial?.id, self, canManageUser, permissionsRetry]);

  const setPermission = (key: string, enabled: boolean) => setPermissions(current => {
    const next: OrgPermission = { ...current, [key]: enabled };
    if (enabled && /(?:Add|Edit|Delete)$/.test(key)) next[key.replace(/(?:Add|Edit|Delete)$/, 'View')] = true;
    if (!enabled && key.endsWith('View')) {
      for (const suffix of ['Add', 'Edit', 'Delete']) next[key.replace(/View$/, suffix)] = false;
    }
    return next;
  });

  const applyTemplate = (template: 'View Only' | 'Field Staff' | 'Manager') => {
    const next: OrgPermission = { ...EMPTY_PERMISSIONS, vehicleIds: permissions.vehicleIds };
    for (const module of MODULES) for (const action of module.actions) {
      const allowed = canDo(module.feature, action);
      const enabled = template === 'Manager' ? allowed
        : template === 'Field Staff' ? allowed && action !== 'delete'
        : allowed && action === 'view';
      next[permissionKey(module, action)] = enabled;
    }
    setPermissions(next);
  };

  const toggleVehicle = (id: string) => setPermissions(current => {
    const selected = current.vehicleIds ?? [];
    return { ...current, vehicleIds: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] };
  });
  const toggleVehicleSet = (ids: string[]) => setPermissions(current => {
    const selected = current.vehicleIds ?? [];
    const allSelected = ids.length > 0 && ids.every(id => selected.includes(id));
    return { ...current, vehicleIds: allSelected ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])] };
  });
  const setVehicleScope = (all: boolean) => setPermissions(current => ({ ...current, vehicleIds: all && vehicleOptions.allVehiclesAllowed ? null : [] }));
  const vehicleQuery = vehicleSearch.trim().toLowerCase();
  const filteredVehicles = vehicleOptions.vehicles.filter(vehicle => `${vehicleLabel(vehicle)} ${vehicleSubtitle(vehicle)}`.toLowerCase().includes(vehicleQuery));
  const groupedIds = new Set(vehicleOptions.groups.flatMap(group => group.vehicleIds));
  const vehicleGroups = [
    ...vehicleOptions.groups.map(group => ({ id: group.id, name: group.name, ids: group.vehicleIds.filter(id => filteredVehicles.some(vehicle => vehicle.id === id)) })),
    { id: 'ungrouped', name: 'Ungrouped', ids: filteredVehicles.filter(vehicle => !groupedIds.has(vehicle.id)).map(vehicle => vehicle.id) },
  ].filter(group => group.ids.length > 0);

  const save = async () => {
    if (!canManageUser) { setError('You do not have permission to manage users.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!initial && password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (password && password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (!self && !availableRoles.includes(role)) { setError('You cannot assign this role.'); return; }
    if (canEditPermissions && !permissionsReady) { setError('Wait for existing permissions to finish loading.'); return; }
    if (canEditPermissions && permissionsError) { setError('Retry loading existing permissions before saving.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      email: email.trim(), firstName: firstName.trim() || null, lastName: lastName.trim() || null,
    };
    if (!self) { payload.role = role; payload.isActive = active; }
    if (password) payload.password = password;
    if (canEditPermissions) payload.permissions = permissions;
    try {
      const response = initial
        ? await api.patch<UserRecord>(`/users/${initial.id}`, payload)
        : await api.post<UserRecord>('/users', { ...payload, role, isActive: active, organizationId: undefined, permissions });
      onSaved(response.data);
    } catch (e) { setError(errorText(e, 'The user could not be saved. Please try again.')); }
    finally { setSaving(false); }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    ...(canEditPermissions ? [{ id: 'vehicles' as const, label: 'Vehicles' }, { id: 'permissions' as const, label: 'Permissions' }] : []),
  ];

  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to users"><TablerIcon name="back" size={20} color={theme.ink}/></Pressable>
        <View style={styles.headerTitle}><Text style={styles.title}>{initial ? 'Edit User' : 'Add User'}</Text><Text style={styles.subtitle}>{initial ? userLabel(initial) : 'Create an organization user'}</Text></View>
      </View>
      {tabs.length > 1 ? <View style={styles.tabs}>{tabs.map(tab => <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</View> : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {activeTab === 'profile' ? <>
          {!self ? <Field label="Role"><View style={styles.selectBox}><Text style={styles.selectLabel}>{ROLE_LABEL[role] ?? role}</Text><View style={styles.roleChoices}>{availableRoles.map(option => <Pressable key={option} onPress={() => { setRole(option); setPermissions({ ...EMPTY_PERMISSIONS, vehicleIds: vehicleOptions.allVehiclesAllowed ? null : [] }); }} style={[styles.roleOption, role === option && styles.roleOptionActive]}><Text style={[styles.roleOptionText, role === option && styles.roleOptionTextActive]}>{ROLE_LABEL[option]}</Text></Pressable>)}</View></View></Field> : <Field label="Role"><Text style={styles.readOnlyValue}>{ROLE_LABEL[initial?.role ?? role] ?? role}</Text></Field>}
          <View style={styles.nameFields}><View style={{ flex: 1 }}><Field label="First Name"><TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={theme.muted} style={styles.input}/></Field></View><View style={{ flex: 1 }}><Field label="Last Name"><TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={theme.muted} style={styles.input}/></Field></View></View>
          <Field label="Email"><TextInput value={email} onChangeText={setEmail} placeholder="name@company.com" placeholderTextColor={theme.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/></Field>
          <Field label={initial ? 'New Password (optional)' : 'Password'}><View style={styles.passwordInput}><TextInput value={password} onChangeText={setPassword} placeholder={initial ? 'Leave blank to keep current password' : 'At least 8 characters'} placeholderTextColor={theme.muted} style={[styles.input, { flex: 1, borderWidth: 0 }]} secureTextEntry={!showPassword} autoComplete={initial ? 'new-password' : 'new-password'}/><Pressable onPress={() => setShowPassword(value => !value)} style={styles.showPassword}><Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View></Field>
          {!self ? <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Account status</Text><Text style={styles.helper}>Inactive users cannot sign in.</Text></View><Text style={[styles.statusText, active ? styles.activeText : styles.inactiveText]}>{active ? 'Active' : 'Inactive'}</Text><Switch value={active} onValueChange={setActive} trackColor={{ false: '#d1d5db', true: '#fca5a5' }} thumbColor={active ? theme.red : '#fff'} /></View> : null}
        </> : null}

        {activeTab === 'vehicles' ? <>
          <Text style={styles.sectionTitle}>Vehicle Access</Text>
          <Text style={styles.helper}>Choose which vehicles this user can access.</Text>
          {vehicleOptions.allVehiclesAllowed ? <Pressable onPress={() => setVehicleScope(true)} style={styles.radioRow}><View style={[styles.radio, permissions.vehicleIds === null && styles.radioActive]}>{permissions.vehicleIds === null ? <View style={styles.radioDot}/> : null}</View><Text style={styles.radioText}>All organization vehicles</Text></Pressable> : <Text style={styles.scopeNote}>You can assign vehicles available to your account only.</Text>}
          <Pressable onPress={() => setVehicleScope(false)} style={styles.radioRow}><View style={[styles.radio, permissions.vehicleIds !== null && styles.radioActive]}>{permissions.vehicleIds !== null ? <View style={styles.radioDot}/> : null}</View><Text style={styles.radioText}>Specific vehicles</Text><Text style={styles.countText}>{permissions.vehicleIds === null ? vehicleOptions.vehicles.length : permissions.vehicleIds?.length ?? 0} selected</Text></Pressable>
          {permissions.vehicleIds !== null ? <>
            <View style={styles.search}><TablerIcon name="search" size={16} color={theme.secondary}/><TextInput value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Search vehicles" placeholderTextColor={theme.muted} style={styles.searchInput}/></View>
            <View style={styles.selectionTools}><Text style={styles.helper}>{vehicleOptions.vehicles.length} vehicles available</Text><View style={{ flex: 1 }}/><Pressable onPress={() => setPermissions(p => ({ ...p, vehicleIds: vehicleOptions.vehicles.map(vehicle => vehicle.id) }))}><Text style={styles.toolText}>Select all</Text></Pressable><Pressable onPress={() => setPermissions(p => ({ ...p, vehicleIds: [] }))}><Text style={styles.toolText}>Deselect all</Text></Pressable></View>
            {vehicleGroups.map(group => {
              const collapsed = !!collapsedGroups[group.id];
              const selected = group.ids.filter(id => (permissions.vehicleIds ?? []).includes(id)).length;
              return <View key={group.id} style={styles.vehicleGroup}>
                <View style={styles.vehicleGroupHeader}>
                  <Pressable onPress={() => setCollapsedGroups(current => ({ ...current, [group.id]: !current[group.id] }))} style={styles.groupToggle}><TablerIcon name={collapsed ? 'forward' : 'down'} size={15} color={theme.secondary}/><Text style={styles.groupName}>{group.name}</Text><Text style={styles.countText}>{selected}/{group.ids.length}</Text></Pressable>
                  <Pressable onPress={() => toggleVehicleSet(group.ids)} style={styles.toolButton}><Text style={styles.toolText}>{selected === group.ids.length ? 'Clear' : 'Select'}</Text></Pressable>
                </View>
                {!collapsed ? group.ids.map(id => {
                  const vehicle = vehicleOptions.vehicles.find(row => row.id === id);
                  if (!vehicle) return null;
                  const checked = (permissions.vehicleIds ?? []).includes(id);
                  return <Pressable key={id} onPress={() => toggleVehicle(id)} style={styles.vehicleChoice}><CheckBox checked={checked}/><View style={{ flex: 1 }}><Text style={styles.vehiclePlate}>{vehicleLabel(vehicle)}</Text><Text style={styles.vehicleSubtitle}>{vehicleSubtitle(vehicle)}</Text></View></Pressable>;
                }) : null}
              </View>;
            })}
            {!vehicleOptions.vehicles.length ? <Text style={styles.emptyText}>No vehicles are available to assign.</Text> : null}
          </> : null}
        </> : null}

        {activeTab === 'permissions' ? <>
          {!permissionsReady ? <View style={styles.loading}><ActivityIndicator color={theme.red}/><Text style={styles.secondary}>Loading permissions…</Text></View> : <>
            {permissionsError ? <Pressable onPress={() => { setPermissionsReady(false); setPermissionsError(''); setPermissionsRetry(value => value + 1); }} style={styles.error}><Text style={styles.errorText}>{permissionsError}  Retry</Text></Pressable> : null}
            <Text style={styles.sectionTitle}>Permission Templates</Text>
            <View style={styles.templates}>{(['View Only', 'Field Staff', 'Manager'] as const).map(template => <Pressable key={template} onPress={() => applyTemplate(template)} style={styles.templateButton}><Text style={styles.templateText}>{template}</Text></Pressable>)}</View>
            <Text style={styles.sectionTitle}>Module Permissions</Text>
            <Text style={[styles.helper, { marginBottom: 12 }]}>You can grant only actions available to your account.</Text>
            <View style={styles.permissionHeader}><Text style={[styles.moduleLabel, { flex: 1 }]}>Module</Text>{(['view', 'add', 'edit', 'delete'] as Action[]).map(action => <Text key={action} style={[styles.actionHeader, { color: ACTION_COLORS[action] }]}>{action.toUpperCase()}</Text>)}</View>
            {visibleModules.map((module, index) => <View key={module.feature} style={[styles.permissionRow, index === visibleModules.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.moduleLabel} numberOfLines={1}>{module.label}</Text>
              {(['view', 'add', 'edit', 'delete'] as Action[]).map(action => {
                if (!module.actions.includes(action)) return <View key={action} style={styles.permissionCell}><Text style={styles.dash}>—</Text></View>;
                const allowed = canDo(module.feature, action);
                if (!allowed) return <View key={action} style={styles.permissionCell}><Text style={styles.dash}>—</Text></View>;
                const key = permissionKey(module, action);
                return <Pressable key={action} onPress={() => setPermission(key, !permissions[key])} style={styles.permissionCell} accessibilityRole="checkbox" accessibilityState={{ checked: !!permissions[key] }} accessibilityLabel={`${module.label} ${action}`}><CheckBox checked={!!permissions[key]} color={ACTION_COLORS[action]}/></Pressable>;
              })}
            </View>)}
          </>}
        </> : null}

        {error ? <Text style={styles.formError}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        <Pressable onPress={() => void save()} disabled={saving || !permissionsReady} style={[styles.saveButton, (saving || !permissionsReady) && styles.saveDisabled]}>{saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>{initial ? 'Save Changes' : 'Create User'}</Text>}</Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function CheckBox({ checked, color = theme.red }: { checked: boolean; color?: string }) {
  return <View style={[styles.checkbox, checked && { borderColor: color, backgroundColor: `${color}16` }]}>{checked ? <TablerIcon name="check" size={13} color={color} strokeWidth={2.4}/> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  header: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  back: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 }, title: { color: theme.ink, fontSize: 19, fontWeight: '700' }, subtitle: { color: theme.secondary, fontSize: 11, marginTop: 2 },
  addButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 42, marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, height: 40, paddingHorizontal: 2, color: theme.ink, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 },
  userRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10 },
  userInfo: { flex: 1, paddingVertical: 10 }, userName: { color: theme.ink, fontSize: 14, fontWeight: '600' }, userEmail: { color: theme.secondary, fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 }, userMeta: { color: theme.secondary, fontSize: 11, textTransform: 'capitalize' }, metaDot: { color: theme.muted, fontSize: 12 }, rowAction: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, emptyText: { color: theme.secondary, fontSize: 13, textAlign: 'center', padding: 20 },
  error: { marginHorizontal: 16, marginTop: 12, paddingVertical: 9 }, errorText: { color: theme.red, fontSize: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, secondary: { color: theme.secondary, fontSize: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border }, tab: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: theme.red }, tabText: { color: theme.secondary, fontSize: 13 }, tabTextActive: { color: theme.red, fontWeight: '600' },
  form: { paddingHorizontal: 16, paddingTop: 17, paddingBottom: 24 }, field: { marginBottom: 17 }, fieldLabel: { color: theme.ink, fontSize: 12, fontWeight: '600', marginBottom: 6 }, input: { minHeight: 43, borderWidth: 1, borderColor: theme.border, borderRadius: 7, paddingHorizontal: 11, color: theme.ink, fontSize: 13 },
  nameFields: { flexDirection: 'row', gap: 10 }, passwordInput: { minHeight: 43, borderWidth: 1, borderColor: theme.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center' }, showPassword: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' }, showPasswordText: { color: theme.red, fontSize: 12, fontWeight: '600' },
  selectBox: { borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 10 }, selectLabel: { color: theme.ink, fontSize: 13, fontWeight: '600', marginBottom: 9 }, roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, roleOption: { borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10 }, roleOptionActive: { borderColor: theme.red, backgroundColor: '#fff5f5' }, roleOptionText: { color: theme.secondary, fontSize: 11 }, roleOptionTextActive: { color: theme.red, fontWeight: '600' }, readOnlyValue: { color: theme.ink, fontSize: 13, paddingVertical: 8 },
  switchRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, gap: 12, marginTop: 2 }, helper: { color: theme.secondary, fontSize: 11, lineHeight: 16 }, statusText: { fontSize: 12, fontWeight: '600' }, activeText: { color: '#15803d' }, inactiveText: { color: theme.muted },
  sectionTitle: { color: theme.ink, fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 7 }, radioRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: theme.border }, radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#9ca3af', borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: theme.red }, radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.red }, radioText: { color: theme.ink, fontSize: 12, flex: 1 }, countText: { color: theme.secondary, fontSize: 11 }, scopeNote: { color: theme.secondary, fontSize: 11, marginVertical: 8 }, selectionTools: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 14 }, toolText: { color: theme.red, fontSize: 11, fontWeight: '600' },
  vehicleGroup: { borderTopWidth: 1, borderTopColor: theme.border }, vehicleGroupHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center' }, groupToggle: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 }, groupName: { color: theme.ink, fontSize: 12, fontWeight: '600', flex: 1 }, toolButton: { paddingHorizontal: 6, paddingVertical: 8 }, vehicleChoice: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 21, borderTopWidth: 1, borderTopColor: '#f1f2f4' }, vehiclePlate: { color: theme.ink, fontSize: 12, fontWeight: '600' }, vehicleSubtitle: { color: theme.secondary, fontSize: 10, marginTop: 2 }, checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  templates: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 15 }, templateButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 6 }, templateText: { color: theme.ink, fontSize: 11, fontWeight: '500' }, permissionHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border }, moduleLabel: { width: 108, color: theme.ink, fontSize: 11, fontWeight: '600' }, actionHeader: { width: 52, textAlign: 'center', fontSize: 9, fontWeight: '700' }, permissionRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f2f4' }, permissionCell: { width: 52, alignItems: 'center', justifyContent: 'center', minHeight: 42 }, dash: { color: '#d1d5db', fontSize: 13 },
  formError: { color: theme.red, fontSize: 12, marginTop: 8 }, footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: '#fff' }, cancelButton: { minHeight: 44, minWidth: 100, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 7 }, cancelText: { color: theme.secondary, fontSize: 13, fontWeight: '500' }, saveButton: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.red, borderRadius: 7 }, saveDisabled: { opacity: 0.55 }, saveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
