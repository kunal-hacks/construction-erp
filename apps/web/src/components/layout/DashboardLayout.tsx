import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/services';
import NotificationBell from '../common/NotificationBell';
import UserMenu from '../common/UserMenu';
import {
  HiOutlineHome, HiOutlineFolderOpen, HiOutlineCurrencyRupee,
  HiOutlineClipboardDocumentList, HiOutlineCube, HiOutlineTruck,
  HiOutlineCog6Tooth, HiOutlineUsers, HiOutlineChartBar,
  HiOutlineDocumentText, HiOutlineClipboard, HiOutlineCalculator,
  HiOutlineShoppingCart, HiOutlineWrenchScrewdriver, HiOutlineUserGroup,
  HiOutlineBuildingOffice, HiOutlineDocumentDuplicate, HiOutlineShieldCheck,
  HiOutlineXMark, HiOutlineMoon, HiOutlineSun,
  HiOutlineBanknotes, HiOutlineReceiptPercent, HiOutlineBars3,
  HiOutlineBookOpen,
} from 'react-icons/hi2';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard',       href: '/',               icon: <HiOutlineHome className="w-5 h-5" /> },
  { label: 'Projects',        href: '/projects',        icon: <HiOutlineFolderOpen className="w-5 h-5" /> },
  { label: 'Daily Reports',   href: '/daily-reports',   icon: <HiOutlineClipboardDocumentList className="w-5 h-5" /> },
  { label: 'Expenses',        href: '/expenses',        icon: <HiOutlineCurrencyRupee className="w-5 h-5" /> },
  { label: 'Inventory',       href: '/inventory',       icon: <HiOutlineCube className="w-5 h-5" /> },
  { label: 'Truck Entries',   href: '/truck-entries',   icon: <HiOutlineTruck className="w-5 h-5" /> },
  { label: 'Machinery',       href: '/machinery',       icon: <HiOutlineWrenchScrewdriver className="w-5 h-5" /> },
  { label: 'Vendors',         href: '/vendors',         icon: <HiOutlineBuildingOffice className="w-5 h-5" /> },
  // { label: 'Purchase Orders', href: '/purchase-orders', icon: <HiOutlineShoppingCart className="w-5 h-5" /> },
  { label: 'Quotations',      href: '/quotations',      icon: <HiOutlineReceiptPercent className="w-5 h-5" /> },
  { label: 'Tasks',           href: '/tasks',            icon: <HiOutlineClipboard className="w-5 h-5" /> },
  { label: 'Labour',          href: '/labour',           icon: <HiOutlineUserGroup className="w-5 h-5" /> },
  { label: 'Salary',          href: '/salary',           icon: <HiOutlineBanknotes className="w-5 h-5" /> },
  { label: 'Documents',       href: '/documents',        icon: <HiOutlineDocumentDuplicate className="w-5 h-5" /> },
  { label: 'Analytics',       href: '/analytics',        icon: <HiOutlineChartBar className="w-5 h-5" /> },
  { label: 'Users',           href: '/users',            icon: <HiOutlineUsers className="w-5 h-5" />,   roles: ['SUPER_ADMIN','ADMIN'] },
  { label: 'Task Types',      href: '/task-types',       icon: <HiOutlineBookOpen className="w-5 h-5" />, roles: ['SUPER_ADMIN','ADMIN'] },
  { label: 'Audit Logs',      href: '/audit-logs',       icon: <HiOutlineShieldCheck className="w-5 h-5" />, roles: ['SUPER_ADMIN','ADMIN'] },
];

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);
    localStorage.setItem('darkMode', String(isDark));
    document.documentElement.classList.toggle('dark', isDark);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">ERP</span>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Construction</div>
          <div className="text-xs text-primary-600 dark:text-primary-400 font-semibold">ERP System</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 no-scrollbar">
        <div className="mb-2 px-2">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Main Menu</span>
        </div>
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[80vw] max-w-72 bg-white dark:bg-gray-900 flex flex-col z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 z-10">
              <HiOutlineXMark className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 sm:h-16 flex items-center px-3 sm:px-4 gap-2 sm:gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 flex-shrink-0">
            <HiOutlineBars3 className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Toggle dark mode">
              {darkMode ? <HiOutlineSun className="w-5 h-5" /> : <HiOutlineMoon className="w-5 h-5" />}
            </button>

            <NotificationBell />
            <UserMenu user={user!} onLogout={handleLogout} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-2xl mx-auto p-3 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;