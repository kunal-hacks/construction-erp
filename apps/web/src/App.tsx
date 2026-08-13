import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

const DashboardLayout = React.lazy(() => import('./components/layout/DashboardLayout'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));

const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const PMDashboardPage = React.lazy(() => import('./pages/PMDashboardPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage'));
const ExpensesPage = React.lazy(() => import('./pages/ExpensesPage'));
const DailyReportsPage = React.lazy(() => import('./pages/DailyReportsPage'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const TruckEntriesPage = React.lazy(() => import('./pages/TruckEntriesPage'));
const MachineryPage = React.lazy(() => import('./pages/MachineryPage'));
const VendorsPage = React.lazy(() => import('./pages/VendorsPage'));
const PurchaseOrdersPage = React.lazy(() => import('./pages/PurchaseOrdersPage'));
const TasksPage = React.lazy(() => import('./pages/TasksPage'));
const TaskDetailPage = React.lazy(() => import('./pages/TaskDetailPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage'));
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const TaskTypesPage = React.lazy(() => import('./pages/TaskTypesPage'));
const LabourPage = React.lazy(() => import('./pages/LabourPage'));
const SalaryPage = React.lazy(() => import('./pages/SalaryPage'));
const AuditLogsPage = React.lazy(() => import('./pages/AuditLogsPage'));
const QuotationsPage = React.lazy(() => import('./pages/QuotationsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
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
  <React.Suspense fallback={<div>Loading...</div>}>
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        }
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
        <Route path="pmdashboard" element={<PMDashboardPage />} />

        {/* Authenticated users — backend scopes the data */}
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="machinery" element={<MachineryPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="labour" element={<LabourPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />

        {/* System administration — admin only */}
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />

        <Route
          path="audit-logs"
          element={
            <AdminRoute>
              <AuditLogsPage />
            </AdminRoute>
          }
        />

        <Route
          path="task-types"
          element={
            <AdminRoute>
              <TaskTypesPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </React.Suspense>
);
};

export default App;