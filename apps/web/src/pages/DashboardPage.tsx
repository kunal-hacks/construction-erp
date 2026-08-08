import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, projectsApi } from '../api/services';
import { StatCard, LoadingSpinner, Badge } from '../components/common';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  HiOutlineFolderOpen, HiOutlineCurrencyRupee, HiOutlineChartPie, 
  HiOutlineArrowRight,
} from 'react-icons/hi2';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.getDashboard(),
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.list({ pageSize: 5, status: 'ACTIVE' }),
  });

  const dashboard = dashData?.data?.data || {};
  const projects = projectsData?.data?.data || [];

  const monthlyChartData = React.useMemo(() => {
    const currentMonth = new Date().getMonth();
    const dataMap = new Map();

    if (dashboard.monthlyExpenses && Array.isArray(dashboard.monthlyExpenses)) {
      dashboard.monthlyExpenses.forEach((m: any) => {
        const monthIndex = Number(m.month) - 1;
        dataMap.set(monthIndex, Number(m.total) || 0);
      });
    }

    const result = [];
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      result.push({
        month: MONTHS[monthIndex],
        amount: dataMap.get(monthIndex) || 0,
      });
    }

    return result;
  }, [dashboard.monthlyExpenses]);

  const projectStatusData = (dashboard.projectsByStatus || []).map((s: any) => ({
    name: s.status?.replace(/_/g, ' ') || 'Unknown',
    value: Number(s._count?.status || s.count || 0),
  }));

  if (dashLoading || projectsLoading) {
    return <LoadingSpinner size="lg" className="h-64" />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Good morning, {user?.firstName || 'Admin'}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {user?.role === 'PROJECT_MANAGER'
            ? "Here's what's happening with your assigned projects today."
            : "Here's what's happening with all projects today."}
        </p>
        {user?.role === 'PROJECT_MANAGER' && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Viewing your assigned projects only
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {dashboard.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            title="Total Projects"
            value={dashboard.overview.totalProjects || 0}
            subtitle={`${dashboard.overview.activeProjects || 0} active`}
            icon={<HiOutlineFolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400" />}
            iconBg="bg-primary-100 dark:bg-primary-900/30"
          />
          <StatCard
            title="Total Expenses"
            value={`₹${(Number(dashboard.overview.totalExpenses || 0) / 100000).toFixed(1)}L`}
            subtitle={`${dashboard.overview.budgetUtilization || 0}% budget used`}
            icon={<HiOutlineCurrencyRupee className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />}
            iconBg="bg-green-100 dark:bg-green-900/30"
          />
          <StatCard
            title="Total Budget"
            value={`₹${(Number(dashboard.overview.totalBudget || 0) / 10000000).toFixed(1)}Cr`}
            subtitle="Across all projects"
            icon={<HiOutlineChartPie className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Monthly Expenses (Last 6 Months)</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">2026</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyChartData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} width={45} />
              <Tooltip formatter={(v: number) => [`₹${(v/100000).toFixed(2)}L`, 'Expenses']} />
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm sm:text-base">Project Status</h2>
          {projectStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value">
                    {projectStatusData.map((_: unknown, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {projectStatusData.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize truncate">{item.name}</span>
                    </div>
                    <span className="font-medium flex-shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">No status data available</div>
          )}
        </div>
      </div>

      {/* Active Projects */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 px-4 sm:px-6 pt-4 sm:pt-6">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Active Projects</h2>
          <Link to="/projects" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
            View all <HiOutlineArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto px-4 sm:px-6 pb-4 sm:pb-6">
          <table className="table min-w-[600px]">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Location</th>
                <th>Budget</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 5).map((project: any) => (
                <tr key={project.id}>
                  <td className="whitespace-nowrap">
                    <Link to={`/projects/${project.id}`} className="hover:text-primary-600 dark:hover:text-primary-400">
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-gray-400">{project.projectCode}</div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{project.clientName || '-'}</td>
                  <td className="text-gray-500 whitespace-nowrap">{project.location}</td>
                  <td className="font-medium whitespace-nowrap">₹{(Number(project.budget || 0) / 10000000).toFixed(1)}Cr</td>
                  <td>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                      </div>
                      <span className="text-xs font-medium flex-shrink-0">{project.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap"><Badge>{project.status}</Badge></td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No active projects</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;