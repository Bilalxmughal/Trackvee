import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

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
const ACTION_COLORS: Record<Action, string> = { view: '#3b82f6', add: '#16a34a', edit: '#f59e0b', delete: '#dc2626' };
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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

  if (permissionLoading || loading) return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.loading}><ActivityIndicator color={t.red}/><Text style={styles.secondary}>Loading users…</Text></View></SafeAreaView>;
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

  const AVATAR_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const avatarColor = (str: string) => AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;

  return <SafeAreaView style={styles.container} edges={['top']}>
    {/* Header */}
    <View style={[styles.header, { borderBottomColor: t.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={styles.back}><TablerIcon name="arrow-left" size={20} color={t.ink}/></Pressable>
      <View style={styles.headerTitle}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>{users.length} member{users.length !== 1 ? 's' : ''}</Text>
      </View>
      {canDo('users', 'add') ? <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="Add user" style={[styles.addButton, { backgroundColor: `${t.red}14` }]}><TablerIcon name="plus" size={20} color={t.red}/></Pressable> : null}
    </View>

    {/* Search */}
    <View style={[styles.searchWrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <TablerIcon name="search" size={16} color={t.muted}/>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search name or email" placeholderTextColor={t.muted} style={[styles.searchInput, { color: t.ink }]} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search users"/>
      {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><TablerIcon name="close" size={15} color={t.muted}/></Pressable> : null}
    </View>

    {error ? <Pressable onPress={() => void load(true)} style={[styles.errorBanner, { backgroundColor: `${t.red}10` }]}><TablerIcon name="alert-triangle" size={14} color={t.red}/><Text style={[styles.errorText, { color: t.red }]}>{error} · Tap to retry</Text></Pressable> : null}

    <ScrollView contentContainerStyle={filteredUsers.length ? styles.list : styles.emptyWrap} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={t.red}/>}>
      {filteredUsers.map((entry, index) => {
        const self = entry.id === user?.id;
        const manageable = (ROLE_LEVEL[entry.role] ?? 0) < (ROLE_LEVEL[user?.role ?? ''] ?? 0);
        const label = userLabel(entry);
        const color = avatarColor(label);
        const isLast = index === filteredUsers.length - 1;
        return <View key={entry.id} style={[styles.userCard, { backgroundColor: t.card }]}>
          <View style={[styles.userAvatar, { backgroundColor: color }]}>
            <Text style={styles.userAvatarText}>{label[0]?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: t.ink }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.userEmail, { color: t.secondary }]} numberOfLines={1}>{entry.email}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { backgroundColor: `${t.red}14` }]}>
                <Text style={[styles.badgeText, { color: t.red }]}>{ROLE_LABEL[entry.role] ?? entry.role}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: entry.isActive ? '#dcfce7' : t.bg2 }]}>
                <Text style={[styles.badgeText, { color: entry.isActive ? '#15803d' : t.muted }]}>{entry.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
              {self ? <View style={[styles.badge, { backgroundColor: t.bg2 }]}><Text style={[styles.badgeText, { color: t.secondary }]}>You</Text></View> : null}
            </View>
          </View>
          <View style={styles.actions}>
            {(self || (manageable && canDo('users', 'edit'))) ? <Pressable onPress={() => openEdit(entry)} hitSlop={8} style={[styles.actionBtn, { backgroundColor: t.bg2 }]} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}><TablerIcon name="edit" size={16} color={t.secondary}/></Pressable> : null}
            {!self && manageable && canDo('users', 'delete') ? <Pressable onPress={() => deleteUser(entry)} hitSlop={8} style={[styles.actionBtn, { backgroundColor: `${t.red}10` }]} accessibilityRole="button" accessibilityLabel={`Delete ${label}`}><TablerIcon name="trash" size={16} color={t.red}/></Pressable> : null}
          </View>
        </View>;
      })}
      {!filteredUsers.length ? <Text style={[styles.emptyText, { color: t.secondary }]}>{query ? 'No users match your search.' : 'No users found.'}</Text> : null}
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
        <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to users"><TablerIcon name="back" size={20} color={t.ink}/></Pressable>
        <View style={styles.headerTitle}><Text style={styles.title}>{initial ? 'Edit User' : 'Add User'}</Text><Text style={styles.subtitle}>{initial ? userLabel(initial) : 'Create an organization user'}</Text></View>
      </View>
      {tabs.length > 1 ? <View style={styles.tabs}>{tabs.map(tab => <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</View> : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {activeTab === 'profile' ? <>
          {!self ? <Field label="Role"><View style={styles.roleChoices}>{availableRoles.map(option => <Pressable key={option} onPress={() => { setRole(option); setPermissions({ ...EMPTY_PERMISSIONS, vehicleIds: vehicleOptions.allVehiclesAllowed ? null : [] }); }} style={[styles.roleOption, { backgroundColor: role === option ? t.red : t.bg2 }]}><Text style={[styles.roleOptionText, { color: role === option ? '#fff' : t.secondary, fontWeight: role === option ? '600' : '500' }]}>{ROLE_LABEL[option]}</Text></Pressable>)}</View></Field> : <Field label="Role"><Text style={styles.readOnlyValue}>{ROLE_LABEL[initial?.role ?? role] ?? role}</Text></Field>}
          <View style={styles.nameFields}><View style={{ flex: 1 }}><Field label="First Name"><TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={t.muted} style={styles.input}/></Field></View><View style={{ flex: 1 }}><Field label="Last Name"><TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={t.muted} style={styles.input}/></Field></View></View>
          <Field label="Email"><TextInput value={email} onChangeText={setEmail} placeholder="name@company.com" placeholderTextColor={t.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/></Field>
          <Field label={initial ? 'New Password (optional)' : 'Password'}><View style={styles.passwordInput}><TextInput value={password} onChangeText={setPassword} placeholder={initial ? 'Leave blank to keep current password' : 'At least 8 characters'} placeholderTextColor={t.muted} style={[styles.input, { flex: 1, borderWidth: 0 }]} secureTextEntry={!showPassword} autoComplete={initial ? 'new-password' : 'new-password'}/><Pressable onPress={() => setShowPassword(value => !value)} style={styles.showPassword}><Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View></Field>
          {!self ? <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Account status</Text><Text style={styles.helper}>Inactive users cannot sign in.</Text></View><Text style={[styles.statusText, active ? styles.activeText : styles.inactiveText]}>{active ? 'Active' : 'Inactive'}</Text><Switch value={active} onValueChange={setActive} trackColor={{ false: t.border, true: `${t.red}66` }} thumbColor="#fff" /></View> : null}
        </> : null}

        {activeTab === 'vehicles' ? <>
          <Text style={styles.sectionTitle}>Vehicle Access</Text>
          <Text style={styles.helper}>Choose which vehicles this user can access.</Text>
          {vehicleOptions.allVehiclesAllowed ? <Pressable onPress={() => setVehicleScope(true)} style={styles.radioRow}><View style={[styles.radio, permissions.vehicleIds === null && styles.radioActive]}>{permissions.vehicleIds === null ? <View style={styles.radioDot}/> : null}</View><Text style={styles.radioText}>All organization vehicles</Text></Pressable> : <Text style={styles.scopeNote}>You can assign vehicles available to your account only.</Text>}
          <Pressable onPress={() => setVehicleScope(false)} style={styles.radioRow}><View style={[styles.radio, permissions.vehicleIds !== null && styles.radioActive]}>{permissions.vehicleIds !== null ? <View style={styles.radioDot}/> : null}</View><Text style={styles.radioText}>Specific vehicles</Text><Text style={styles.countText}>{permissions.vehicleIds === null ? vehicleOptions.vehicles.length : permissions.vehicleIds?.length ?? 0} selected</Text></Pressable>
          {permissions.vehicleIds !== null ? <>
            <View style={styles.search}><TablerIcon name="search" size={16} color={t.secondary}/><TextInput value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Search vehicles" placeholderTextColor={t.muted} style={styles.searchInput}/></View>
            <View style={styles.selectionTools}><Text style={styles.helper}>{vehicleOptions.vehicles.length} vehicles available</Text><View style={{ flex: 1 }}/><Pressable onPress={() => setPermissions(p => ({ ...p, vehicleIds: vehicleOptions.vehicles.map(vehicle => vehicle.id) }))}><Text style={styles.toolText}>Select all</Text></Pressable><Pressable onPress={() => setPermissions(p => ({ ...p, vehicleIds: [] }))}><Text style={styles.toolText}>Deselect all</Text></Pressable></View>
            {vehicleGroups.map(group => {
              const collapsed = !!collapsedGroups[group.id];
              const selected = group.ids.filter(id => (permissions.vehicleIds ?? []).includes(id)).length;
              return <View key={group.id} style={styles.vehicleGroup}>
                <View style={styles.vehicleGroupHeader}>
                  <Pressable onPress={() => setCollapsedGroups(current => ({ ...current, [group.id]: !current[group.id] }))} style={styles.groupToggle}><TablerIcon name={collapsed ? 'forward' : 'down'} size={15} color={t.secondary}/><Text style={styles.groupName}>{group.name}</Text><Text style={styles.countText}>{selected}/{group.ids.length}</Text></Pressable>
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
          {!permissionsReady ? <View style={styles.loading}><ActivityIndicator color={t.red}/><Text style={styles.secondary}>Loading permissions…</Text></View> : <>
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
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
}

function CheckBox({ checked, color = '#dc2626' }: { checked: boolean; color?: string }) {
  return <View style={[checkboxStyle, checked && { borderColor: color, backgroundColor: `${color}16` }]}>{checked ? <TablerIcon name="check" size={13} color={color} strokeWidth={2.4}/> : null}</View>;
}

const checkboxStyle = StyleSheet.create({ box: { width: 20, height: 20, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, alignItems: 'center', justifyContent: 'center' } }).box;

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1 },
    title: { color: t.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
    subtitle: { color: t.secondary, fontSize: 11, marginTop: 2 },
    addButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 8 },
    userCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    userAvatarText: { fontSize: 17, fontWeight: '800', color: '#fff' },
    userInfo: { flex: 1 },
    userName: { fontSize: 14, fontWeight: '700' },
    userEmail: { fontSize: 12, marginTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' },
    badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    actions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
    actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyText: { fontSize: 13, textAlign: 'center' },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
    errorText: { flex: 1, fontSize: 12, fontWeight: '500' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, secondary: { color: t.secondary, fontSize: 12 },
    tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: t.border }, tab: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: t.red }, tabText: { color: t.secondary, fontSize: 13 }, tabTextActive: { color: t.red, fontWeight: '600' },
    form: { paddingHorizontal: 16, paddingTop: 17, paddingBottom: 24 }, field: { marginBottom: 17 }, fieldLabel: { color: t.ink, fontSize: 12, fontWeight: '600', marginBottom: 6 }, input: { minHeight: 43, borderWidth: 1, borderColor: t.border, borderRadius: 7, paddingHorizontal: 11, color: t.ink, fontSize: 13, backgroundColor: t.inputBg },
    nameFields: { flexDirection: 'row', gap: 10 }, passwordInput: { minHeight: 43, borderWidth: 1, borderColor: t.border, borderRadius: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: t.inputBg }, showPassword: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' }, showPasswordText: { color: t.red, fontSize: 12, fontWeight: '600' },
    roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, roleOption: { borderRadius: 7, paddingVertical: 9, paddingHorizontal: 14 }, roleOptionText: { fontSize: 12 }, readOnlyValue: { color: t.ink, fontSize: 13, paddingVertical: 8 },
    switchRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: t.border, gap: 12, paddingVertical: 8 }, helper: { color: t.secondary, fontSize: 11, lineHeight: 16 }, statusText: { fontSize: 12, fontWeight: '600' }, activeText: { color: '#15803d' }, inactiveText: { color: t.muted },
    sectionTitle: { color: t.ink, fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 7 }, radioRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: t.border }, radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#9ca3af', borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: t.red }, radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.red }, radioText: { color: t.ink, fontSize: 12, flex: 1 }, countText: { color: t.secondary, fontSize: 11 }, scopeNote: { color: t.secondary, fontSize: 11, marginVertical: 8 }, selectionTools: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 14 }, toolText: { color: t.red, fontSize: 11, fontWeight: '600' },
    vehicleGroup: { borderTopWidth: 1, borderTopColor: t.border }, vehicleGroupHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center' }, groupToggle: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 }, groupName: { color: t.ink, fontSize: 12, fontWeight: '600', flex: 1 }, toolButton: { paddingHorizontal: 6, paddingVertical: 8 }, vehicleChoice: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 21, borderTopWidth: 1, borderTopColor: t.border2 }, vehiclePlate: { color: t.ink, fontSize: 12, fontWeight: '600' }, vehicleSubtitle: { color: t.secondary, fontSize: 10, marginTop: 2 }, checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    templates: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 15 }, templateButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg2, borderRadius: 7 }, templateText: { color: t.ink, fontSize: 11, fontWeight: '600' }, permissionHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.border }, moduleLabel: { width: 108, color: t.ink, fontSize: 11, fontWeight: '600' }, actionHeader: { width: 52, textAlign: 'center', fontSize: 9, fontWeight: '700' }, permissionRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.border2 }, permissionCell: { width: 52, alignItems: 'center', justifyContent: 'center', minHeight: 42 }, dash: { color: '#d1d5db', fontSize: 13 },
    formError: { color: t.red, fontSize: 12, marginTop: 8 }, footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg }, cancelButton: { minHeight: 44, minWidth: 100, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 7 }, cancelText: { color: t.secondary, fontSize: 13, fontWeight: '500' }, saveButton: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: t.red, borderRadius: 7 }, saveDisabled: { opacity: 0.55 }, saveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  });
}
