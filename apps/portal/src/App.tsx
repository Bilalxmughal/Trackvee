import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PortalMapPage from './pages/MapPage';
import VehiclesPage from './pages/VehiclesPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 13, color: '#888' }}>
      Loading...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="/map"      element={<PortalMapPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/reports"  element={<ReportsPage />} />
        <Route path="/alerts"   element={<AlertsPage />} />
        <Route path="*"         element={<Navigate to="/map" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
