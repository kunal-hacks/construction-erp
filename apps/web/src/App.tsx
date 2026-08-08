import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PMDashboardPage from './pages/PMDashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ExpensesPage from './pages/ExpensesPage';
import DailyReportsPage from './pages/DailyReportsPage';
import InventoryPage from './pages/InventoryPage';
import TruckEntriesPage from './pages/TruckEntriesPage';
import MachineryPage from './pages/MachineryPage';
import VendorsPage from './pages/VendorsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DocumentsPage from './pages/DocumentsPage';
import UsersPage from './pages/UsersPage';
import TaskTypesPage from './pages/TaskTypesPage';
import LabourPage from './pages/LabourPage';
import SalaryPage from './pages/SalaryPage';
import AuditLogsPage from './pages/AuditLogsPage';
import QuotationsPage from './pages/QuotationsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Admin-only route — redirects PM away
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!ADMIN_ROLES.includes(user?.role || '')) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) document.documentElement.classList.add('dark');
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Home — admin sees admin dashboard, PM sees PM dashboard */}
        <Route
          index
          element={
            ADMIN_ROLES.includes(user?.role || '')
              ? <DashboardPage />
              : <PMDashboardPage />
          }
        />

        {/* Pages accessible to all authenticated users */}
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="daily-reports" element={<DailyReportsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="truck-entries" element={<TruckEntriesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="pmdashboard" element={<PMDashboardPage/>} />

        {/* Every authenticated user reaches these — backend scopes the DATA to
            the caller's assigned projects (admins get everything, PMs get their own).
            No route-level admin gate here anymore; the API is the enforcement point. */}
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="machinery" element={<MachineryPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="labour" element={<LabourPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />

        {/* System-administration pages — these concern managing the software itself
            (who has accounts, security trail), not project data, so they stay admin-only */}
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
        <Route path="task-types" element={<AdminRoute><TaskTypesPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;