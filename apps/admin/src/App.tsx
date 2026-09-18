import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CustomersPage from './pages/CustomersPage';
import VehiclesPage from './pages/VehiclesPage';
import DevicesPage from './pages/DevicesPage';
import TelemetryPage from './pages/TelemetryPage';
import RoleAccessPage from './pages/RoleAccessPage';
import SetupGuidePage from './pages/SetupGuidePage';
import MapPage from './pages/MapPage';
import SettingsPage from './pages/SettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner style={{ height: '100vh' }} />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner style={{ height: '100vh' }} />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        {/* backward compat redirect */}
        <Route path="/organizations" element={<Navigate to="/clients" replace />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RoleAccessPage />} />
        <Route path="/setup" element={<SetupGuidePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
