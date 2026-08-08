import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, projectsApi } from '../api/services';
import { PageHeader, LoadingSpinner, StatCard } from '../components/common';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { HiOutlineChartBar, HiOutlineCurrencyRupee, HiOutlineCube, HiOutlineFolderOpen, HiOutlineExclamationTriangle } from 'react-icons/hi2';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const AnalyticsPage: React.FC = () => {
  const [year] = useState(new Date().getFullYear());
  const [projectFilter, setProjectFilter] = useState('');

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.getDashboard(),
  });
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['analytics-expenses', projectFilter, year],
    queryFn: () => analyticsApi.getExpenses({ projectId: projectFilter || undefined, year }),
  });
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['analytics-budget'],
    queryFn: () => analyticsApi.getBudget(),
  });
  const { data: machData } = useQuery({
    queryKey: ['analytics-machinery'],
    queryFn: () => analyticsApi.getMachinery(),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects-select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const dash = dashData?.data?.data;
  const exp = expData?.data?.data;
  const budget = budgetData?.data?.data;
  const mach = machData?.data?.data;
  const projects = projectsData?.data?.data || [];

  const monthlyData = (dash?.monthlyExpenses || []).map((m: { month: number; total: number }) => ({
    month: MONTHS[m.month - 1],
    amount: Number(m.total),
  }));

  const categoryData = (exp?.byCategory || []).map((c: { category: string; _sum: { amount: number }; _count: { id: number } }) => ({
    name: c.category,
    value: Number(c._sum?.amount || 0),
    count: c._count?.id,
  }));

  const budgetChartData = Array.isArray(budget) ? budget.slice(0, 8).map((p: {
    name: string; budget: number; spent: number; utilizationPct: string;
  }) => ({
    name: p.name.substring(0, 15) + (p.name.length > 15 ? '..' : ''),
    budget: Number(p.budget),
    spent: Number(p.spent),
  })) : [];

  const topVendors = (exp?.topVendors || []).map((v: { vendorName?: string; _sum: { amount: number } }) => ({
    name: v.vendorName || 'Unknown',
    value: Number(v._sum?.amount || 0),
  }));

  if (dashLoading) return <LoadingSpinner size="lg" className="h-64" />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Comprehensive project performance insights"
        action={
          <select className="select w-full sm:w-52" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

      {/* KPI Cards */}
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Projects" value={dash.overview?.totalProjects || 0}
            subtitle={`${dash.overview?.activeProjects || 0} active`}
            icon={<HiOutlineFolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
          <StatCard title="Total Budget" value={`₹${(Number(dash.overview?.totalBudget || 0)/10000000).toFixed(1)}Cr`}
            subtitle="Across all projects"
            icon={<HiOutlineCurrencyRupee className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
          <StatCard title="Total Spent" value={`₹${(Number(dash.overview?.totalExpenses || 0)/100000).toFixed(1)}L`}
            subtitle={`${dash.overview?.budgetUtilization || 0}% utilized`}
            icon={<HiOutlineChartBar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" />
          <StatCard title="Pending Approvals" value={dash.overview?.pendingApprovals || 0}
            subtitle="Needs attention"
            icon={<HiOutlineExclamationTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
        </div>
      )}

      {/* Monthly Trend + Category Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm sm:text-base">Monthly Expense Trend ({year})</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} width={45} />
                <Tooltip formatter={(v: number) => [`₹${(v/100000).toFixed(2)}L`, 'Expenses']} />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="url(#areaGrad)" strokeWidth={2.5} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>

        <div className="card p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm sm:text-base">Expenses by Category</h3>
          {expLoading ? <LoadingSpinner className="h-[240px]" /> : categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                    {categoryData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${(v/100000).toFixed(1)}L`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.slice(0, 5).map((c: { name: string; value: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 dark:text-gray-400 truncate">{c.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">₹{(c.value/100000).toFixed(1)}L</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm sm:text-base">Budget vs Actual Spend by Project</h3>
        {budgetLoading ? <LoadingSpinner className="h-[260px]" /> : budgetChartData.length > 0 ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(budgetChartData.length * 80, 320) }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={budgetChartData} barCategoryGap="30%" margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v/10000000).toFixed(1)}Cr`} width={45} />
                  <Tooltip formatter={(v: number) => `₹${(v/10000000).toFixed(2)}Cr`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budget" name="Budget" fill="#dbeafe" stroke="#3b82f6" strokeWidth={1} radius={[3,3,0,0]} />
                  <Bar dataKey="spent" name="Spent" fill="#3b82f6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">No project data</div>}
      </div>

      {/* Budget Table */}
      {Array.isArray(budget) && budget.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header"><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Budget Utilization by Project</h3></div>
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead><tr><th>Project</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Utilization</th><th>Status</th></tr></thead>
              <tbody>
                {(budget as { id: string; name: string; budget: number; spent: number; remaining: number; utilizationPct: string; isOverBudget: boolean; status: string }[]).map(p => (
                  <tr key={p.id}>
                    <td className="font-medium text-sm whitespace-nowrap">{p.name}</td>
                    <td className="text-sm whitespace-nowrap">₹{(Number(p.budget)/10000000).toFixed(2)}Cr</td>
                    <td className="text-sm font-medium whitespace-nowrap">₹{(Number(p.spent)/100000).toFixed(1)}L</td>
                    <td className={`text-sm font-medium whitespace-nowrap ${Number(p.remaining) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      ₹{(Math.abs(Number(p.remaining))/100000).toFixed(1)}L {Number(p.remaining) < 0 ? '(Over)' : ''}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 sm:w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
                          <div className={`h-full rounded-full ${p.isOverBudget ? 'bg-red-500' : Number(p.utilizationPct) > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(Number(p.utilizationPct), 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">{p.utilizationPct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge whitespace-nowrap ${p.isOverBudget ? 'badge-danger' : Number(p.utilizationPct) > 80 ? 'badge-warning' : 'badge-success'}`}>
                        {p.isOverBudget ? 'Over Budget' : Number(p.utilizationPct) > 80 ? 'Near Limit' : 'On Track'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Vendors */}
      {topVendors.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm sm:text-base">Top Vendors by Spend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topVendors} layout="vertical" margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
              <Tooltip formatter={(v: number) => `₹${(v/100000).toFixed(1)}L`} />
              <Bar dataKey="value" name="Spend" fill="#3b82f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Machinery Utilization */}
      {mach?.utilization && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-primary-600">{Number(mach.utilization._sum?.hoursUsed || 0).toFixed(0)}h</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Total Running Hours</div>
          </div>
          <div className="card p-4 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-orange-500">{Number(mach.utilization._sum?.fuelUsed || 0).toFixed(0)}L</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Total Fuel Consumed</div>
          </div>
          <div className="card p-4 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{mach.utilization._count?.id || 0}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Total Log Entries</div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AnalyticsPage;