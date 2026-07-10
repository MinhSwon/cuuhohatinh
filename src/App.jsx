import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './contexts/ToastContext';

// Layouts
import { AdminLayout, RescueLayout, CitizenLayout } from './components/layout/Layouts';

// Public pages
import HomePage from './pages/public/HomePage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import SOSPage from './pages/public/SOSPage';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AlertsManager from './pages/admin/AlertsManager';
import RescueRequests from './pages/admin/RescueRequests';
import RescueMissions from './pages/admin/RescueMissions';
import DispatchCenter from './pages/admin/DispatchCenter';
import RescueTeams from './pages/admin/RescueTeams';
import SafeZones from './pages/admin/SafeZones';
import RescueRoutes from './pages/admin/RescueRoutes';
import AlertsAndSMS from './pages/admin/AlertsAndSMS';
import Subscribers from './pages/admin/Subscribers';
import VulnerableHouseholds from './pages/admin/VulnerableHouseholds';
import Dams from './pages/admin/Dams';
import DamageReports from './pages/admin/DamageReports';
import Reports from './pages/admin/Reports';
import ActivityLogs from './pages/admin/ActivityLogs';
import AIAssistant from './pages/admin/AIAssistant';
import AdminSettings from './pages/admin/Settings';
import CoastalWarnings from './pages/admin/Coastal';

// Rescue pages
import RescueDashboard from './pages/rescue/RescueDashboard';
import MissionDetail from './pages/rescue/MissionDetail';

// Citizen pages
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import RescueRequest from './pages/citizen/RescueRequest';
import CitizenWarnings from './pages/citizen/CitizenWarnings';
import CitizenSafeZones from './pages/citizen/CitizenSafeZones';

function RoleRedirect() {
  const { currentUser, authReady } = useAuth();
  if (!authReady) return <div className="page-loading">Đang xác thực phiên đăng nhập…</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  const role = currentUser.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'RESCUE_LEADER' || role === 'RESCUE_MEMBER') return <Navigate to="/rescue" replace />;
  return <Navigate to="/citizen" replace />;
}

function RequireAuth({ children, roles }) {
  const { currentUser, authReady } = useAuth();
  if (!authReady) return <div className="page-loading">Đang xác thực phiên đăng nhập…</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/sos" element={<SOSPage />} />
      <Route path="/app" element={<RoleRedirect />} />

      {/* Admin routes */}
      <Route path="/admin" element={
        <RequireAuth roles={['ADMIN', 'SUPER_ADMIN']}>
          <AdminLayout />
        </RequireAuth>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="alerts" element={<AlertsManager />} />
        <Route path="rescue-requests" element={<RescueRequests />} />
        <Route path="rescue-missions" element={<RescueMissions />} />
        <Route path="dispatch" element={<DispatchCenter />} />
        <Route path="rescue-teams" element={<RescueTeams />} />
        <Route path="safe-zones" element={<SafeZones />} />
        <Route path="rescue-routes" element={<RescueRoutes />} />
        <Route path="sms" element={<AlertsAndSMS />} />
        <Route path="subscribers" element={<Subscribers />} />
        <Route path="vulnerable" element={<VulnerableHouseholds />} />
        <Route path="dams" element={<Dams />} />
        <Route path="damage-reports" element={<DamageReports />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="ai-assistant" element={<AIAssistant />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="coastal" element={<CoastalWarnings />} />
      </Route>

      {/* Rescue team routes */}
      <Route path="/rescue" element={
        <RequireAuth roles={['RESCUE_LEADER', 'RESCUE_MEMBER']}>
          <RescueLayout />
        </RequireAuth>
      }>
        <Route index element={<RescueDashboard />} />
        <Route path="missions" element={<MissionDetail />} />
        <Route path="warnings" element={<CitizenWarnings />} />
      </Route>

      {/* Citizen routes */}
      <Route path="/citizen" element={
        <RequireAuth roles={['CITIZEN']}>
          <CitizenLayout />
        </RequireAuth>
      }>
        <Route index element={<CitizenDashboard />} />
        <Route path="request" element={<RescueRequest />} />
        <Route path="warnings" element={<CitizenWarnings />} />
        <Route path="safezones" element={<CitizenSafeZones />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </DataProvider>
    </BrowserRouter>
  );
}
