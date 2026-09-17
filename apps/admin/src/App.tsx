import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import OrganizationsPage from './pages/OrganizationsPage';
import VehiclesPage from './pages/VehiclesPage';
import DevicesPage from './pages/DevicesPage';
import TelemetryPage from './pages/TelemetryPage';
import RoleAccessPage from './pages/RoleAccessPage';

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
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
        <Route path="/roles" element={<RoleAccessPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
