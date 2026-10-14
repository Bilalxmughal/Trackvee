import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { canAccessPage } from './config/roles';
import type { UserRole } from '@yotrack/types';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import VehiclesPage from './pages/VehiclesPage';
import DevicesPage from './pages/DevicesPage';
import DeviceHealthPage from './pages/DeviceHealthPage';
import TelemetryPage from './pages/TelemetryPage';
import RoleAccessPage from './pages/RoleAccessPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ReportsPage from './pages/ReportsPage';
import SetupGuidePage from './pages/SetupGuidePage';
import MapPage from './pages/MapPage';
import SettingsPage from './pages/SettingsPage';
import ClientUsersPage from './pages/ClientUsersPage';
import DriverBehaviorPage from './pages/DriverBehaviorPage';
import MaintenancePage from './pages/MaintenancePage';
import PricingPage from './pages/PricingPage';
import ClientStatementsPage from './pages/ClientStatementsPage';
import { OrgRolePermsProvider } from './contexts/OrgRolePermsContext';;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner style={{ height: '100vh' }} />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ page, children }: { page: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role ?? 'client_user') as UserRole;
  if (!canAccessPage(role, page)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SettingsRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role ?? 'client_user') as UserRole;
  if (!canAccessPage(role, 'settings') && !canAccessPage(role, 'notification-sounds')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner style={{ height: '100vh' }} />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<RequireAuth><OrgRolePermsProvider><Layout /></OrgRolePermsProvider></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RoleRoute page="dashboard"><DashboardPage /></RoleRoute>} />
        <Route path="/clients" element={<RoleRoute page="clients"><ClientsPage /></RoleRoute>} />
        <Route path="/clients/:id" element={<RoleRoute page="clients"><ClientDetailPage /></RoleRoute>} />
        <Route path="/customers" element={<Navigate to="/clients" replace />} />
        <Route path="/customers/:id" element={<Navigate to="/clients" replace />} />
        <Route path="/organizations" element={<Navigate to="/clients" replace />} />
        <Route path="/vehicles" element={<RoleRoute page="vehicles"><VehiclesPage /></RoleRoute>} />
        <Route path="/maintenance" element={<RoleRoute page="maintenance"><MaintenancePage /></RoleRoute>} />
        <Route path="/devices" element={<RoleRoute page="devices"><DevicesPage /></RoleRoute>} />
        <Route path="/device-health" element={<RoleRoute page="device-health"><DeviceHealthPage /></RoleRoute>} />
        <Route path="/telemetry" element={<RoleRoute page="telemetry"><TelemetryPage /></RoleRoute>} />
        <Route path="/map" element={<RoleRoute page="map"><MapPage /></RoleRoute>} />
        <Route path="/client-users" element={<RoleRoute page="client-users"><ClientUsersPage /></RoleRoute>} />
        <Route path="/driver-behavior" element={<RoleRoute page="driver-behavior"><DriverBehaviorPage /></RoleRoute>} />
        <Route path="/users" element={<RoleRoute page="users"><UsersPage /></RoleRoute>} />
        <Route path="/roles" element={<RoleRoute page="roles"><RoleAccessPage /></RoleRoute>} />
        <Route path="/audit-logs" element={<RoleRoute page="audit-logs"><AuditLogsPage /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute page="reports"><ReportsPage /></RoleRoute>} />
        <Route path="/setup" element={<RoleRoute page="setup"><SetupGuidePage /></RoleRoute>} />
        <Route path="/financial/pricing" element={<RoleRoute page="financial-pricing"><PricingPage /></RoleRoute>} />
        <Route path="/financial/statements" element={<RoleRoute page="financial-statements"><ClientStatementsPage /></RoleRoute>} />
        <Route path="/settings" element={<SettingsRoute><SettingsPage /></SettingsRoute>} />
        <Route path="/settings/notifications" element={<SettingsRoute><RoleRoute page="notification-sounds"><SettingsPage /></RoleRoute></SettingsRoute>} />
        <Route path="/notification-sounds" element={<RoleRoute page="notification-sounds"><Navigate to="/settings/notifications" replace /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
