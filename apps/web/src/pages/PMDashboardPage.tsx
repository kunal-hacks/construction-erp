import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, expensesApi, dailyReportsApi, tasksApi, truckEntriesApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner, Badge, Modal, FormField } from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlineFolderOpen, HiOutlineCurrencyRupee, HiOutlineClipboardDocumentList,
  HiOutlineTruck, HiOutlineCheckCircle, HiOutlinePlus, HiOutlineChartBar,
  HiOutlineCalendarDays, HiOutlineUserGroup, HiOutlineArrowTrendingUp,
  HiOutlineExclamationTriangle, HiOutlineDocumentText,
} from 'react-icons/hi2';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const WEATHER_ICONS: Record<string, string> = {
  SUNNY: '☀️', CLOUDY: '⛅', RAINY: '🌧️', FOGGY: '🌫️', STORMY: '⛈️',
};
const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'neutral', ACTIVE: 'success', ON_HOLD: 'warning',
  COMPLETED: 'info', CANCELLED: 'danger',
};
const TASK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];

const PMDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showReport, setShowReport] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => projectsApi.list({ pageSize: 100, status: undefined }),
  });

  const projects = projectsData?.data?.data || [];

  React.useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['pm-project-dash', selectedProjectId],
    queryFn: () => projectsApi.getDashboard(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const { data: expensesData } = useQuery({
    queryKey: ['pm-expenses', selectedProjectId],
    queryFn: () => expensesApi.list({ projectId: selectedProjectId, pageSize: 5 }),
    enabled: !!selectedProjectId,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['pm-reports', selectedProjectId],
    queryFn: () => dailyReportsApi.list({ projectId: selectedProjectId, pageSize: 5 }),
    enabled: !!selectedProjectId,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['pm-tasks', selectedProjectId],
    queryFn: () => tasksApi.getByProject(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const { data: truckData } = useQuery({
    queryKey: ['pm-trucks', selectedProjectId],
    queryFn: () => truckEntriesApi.getSummary({ projectId: selectedProjectId }),
    enabled: !!selectedProjectId,
  });

  const dash = dashData?.data?.data;
  const recentExpenses = expensesData?.data?.data || [];
  const recentReports = reportsData?.data?.data || [];
  const taskGrouped = tasksData?.data?.data?.grouped || {};
  const truckSummary = truckData?.data?.data?.summary;

  const taskData = Object.entries(taskGrouped).map(([status, tasks]: [string, any]) => ({
    name: status.replace('_', ' '),
    value: tasks.length,
  })).filter(t => t.value > 0);

  const totalTasks = taskData.reduce((s, t) => s + t.value, 0);
  const doneTasks = (taskGrouped['DONE'] || []).length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const { register: regReport, handleSubmit: handleReport, reset: resetReport } = useForm();
  const { register: regExpense, handleSubmit: handleExpense, reset: resetExpense } = useForm();

  const reportMutation = useMutation({
    mutationFn: (d: object) => dailyReportsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-reports'] });
      qc.invalidateQueries({ queryKey: ['pm-project-dash'] });
      toast.success('Daily report submitted!');
      setShowReport(false); resetReport();
    },
    onError: (e: any) => toast.error(formatError(e)),
  });

  const expenseMutation = useMutation({
    mutationFn: (d: object) => expensesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-expenses'] });
      toast.success('Expense added!');
      setShowExpense(false); resetExpense();
    },
    onError: (e: any) => toast.error(formatError(e)),
  });

  if (projectsLoading) return <LoadingSpinner size="lg" className="h-64" />;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <HiOutlineFolderOpen className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-lg sm:text-xl font-bold text-gray-700 dark:text-white">No Projects Assigned</h2>
        <p className="text-gray-400 mt-2 text-sm">Contact your admin to get assigned to a project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Good morning, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            You have <span className="font-semibold text-primary-600">{projects.length}</span> project{projects.length > 1 ? 's' : ''} assigned to you.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button onClick={() => setShowReport(true)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
            <HiOutlineClipboardDocumentList className="w-4 h-4" /> <span className="hidden xs:inline">Daily </span>Report
          </button>
          <button onClick={() => setShowExpense(true)} className="btn-primary flex items-center justify-center gap-2 text-sm">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* ── Project Selector Tabs ───────────────────────────────── */}
      {projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {projects.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedProjectId === p.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary-400'
              }`}
            >
              <div className="font-semibold">{p.name}</div>
              <div className={`text-xs mt-0.5 ${selectedProjectId === p.id ? 'text-primary-100' : 'text-gray-400'}`}>
                {p.projectCode}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Selected Project Header Card ────────────────────────── */}
      {selectedProject && (
        <div className="card p-4 sm:p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold truncate">{selectedProject.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  selectedProject.status === 'ACTIVE' ? 'bg-green-400/20 text-green-100' : 'bg-white/20 text-white'
                }`}>
                  {selectedProject.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-primary-100">
                <span>📍 {selectedProject.location || '—'}</span>
                <span>👤 {selectedProject.clientName || '—'}</span>
                <span>📅 {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <div className="text-2xl sm:text-3xl font-bold">₹{(Number(selectedProject.budget || 0) / 10000000).toFixed(1)}Cr</div>
              <div className="text-primary-200 text-xs sm:text-sm">Total Budget</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs sm:text-sm text-primary-100 mb-1">
              <span>Overall Progress</span>
              <span className="font-bold">{selectedProject.progress || 0}%</span>
            </div>
            <div className="h-2 bg-primary-800/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min(selectedProject.progress || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {dashLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          {/* ── Stats Row ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                label: 'Total Expenses',
                value: `₹${(Number(dash?.stats?.totalExpenses || 0) / 100000).toFixed(1)}L`,
                sub: `${dash?.stats?.budgetUsed || 0}% of budget`,
                icon: <HiOutlineCurrencyRupee className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />,
                bg: 'bg-green-100 dark:bg-green-900/20',
              },
              {
                label: 'Tasks Done',
                value: `${doneTasks}/${totalTasks}`,
                sub: `${progressPct}% complete`,
                icon: <HiOutlineCheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />,
                bg: 'bg-blue-100 dark:bg-blue-900/20',
              },
              {
                label: 'Material Trips',
                value: truckSummary?._count?.id || 0,
                sub: `${Number(truckSummary?._sum?.netWeight || 0).toFixed(1)} MT net`,
                icon: <HiOutlineTruck className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />,
                bg: 'bg-orange-100 dark:bg-orange-900/20',
              },
              {
                label: 'Team Members',
                value: (selectedProject?.ProjectMember || []).length,
                sub: 'on this project',
                icon: <HiOutlineUserGroup className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />,
                bg: 'bg-purple-100 dark:bg-purple-900/20',
              },
            ].map((s, i) => (
              <div key={i} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    {s.icon}
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{s.label}</div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Middle Row: Tasks + Recent Reports ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

            {/* Task Status */}
            <div className="card p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm sm:text-base">
                <HiOutlineCheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0" /> Task Status
              </h3>
              {taskData.length > 0 ? (
                <div className="flex flex-col xs:flex-row items-center gap-4 sm:gap-6">
                  <ResponsiveContainer width={120} height={120} className="flex-shrink-0">
                    <PieChart>
                      <Pie data={taskData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value">
                        {taskData.map((_, i) => (
                          <Cell key={i} fill={TASK_COLORS[i % TASK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 w-full space-y-2">
                    {taskData.map((t, i) => (
                      <div key={t.name} className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TASK_COLORS[i % TASK_COLORS.length] }} />
                          <span className="text-gray-600 dark:text-gray-400 capitalize truncate">{t.name}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white flex-shrink-0">{t.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No tasks yet</div>
              )}
            </div>

            {/* Recent Daily Reports */}
            <div className="card p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm sm:text-base">
                <HiOutlineClipboardDocumentList className="w-5 h-5 text-primary-600 flex-shrink-0" /> Recent Reports
              </h3>
              <div className="space-y-3">
                {recentReports.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">No reports submitted yet</div>
                )}
                {recentReports.slice(0, 4).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(r.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        <span className="ml-2 text-lg">{WEATHER_ICONS[r.weather] || '🌤️'}</span>
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-1">{r.workDone}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-primary-600">{r.completionPct || 0}%</div>
                      <div className="text-xs text-gray-400">{r.labourCount || 0} workers</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowReport(true)}
                className="mt-3 w-full text-xs text-primary-600 hover:underline flex items-center justify-center gap-1 py-1">
                <HiOutlinePlus className="w-3.5 h-3.5" /> Submit Today's Report
              </button>
            </div>
          </div>

          {/* ── Recent Expenses ──────────────────────────────────── */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base truncate">
                <HiOutlineCurrencyRupee className="w-5 h-5 text-primary-600 flex-shrink-0" /> Recent Expenses
              </h3>
              <button onClick={() => setShowExpense(true)}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1 flex-shrink-0">
                <HiOutlinePlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table min-w-[520px]">
                <thead>
                  <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Vendor</th></tr>
                </thead>
                <tbody>
                  {recentExpenses.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(e.expenseDate || e.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-medium text-sm whitespace-nowrap">{e.title}</td>
                      <td className="whitespace-nowrap"><Badge>{e.category}</Badge></td>
                      <td className="font-bold whitespace-nowrap">₹{Number(e.amount).toLocaleString('en-IN')}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{e.vendorName || '—'}</td>
                    </tr>
                  ))}
                  {recentExpenses.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No expenses recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Quick Daily Report Modal ─────────────────────────────── */}
      <Modal isOpen={showReport} onClose={() => { setShowReport(false); resetReport(); }}
        title="Submit Daily Report" size="lg">
        <form onSubmit={handleReport(d => reportMutation.mutate({ ...d, projectId: selectedProjectId }))}
          className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.length > 1 && (
              <FormField label="Project" required className="sm:col-span-2">
                <select {...regReport('projectId')} defaultValue={selectedProjectId} className="select">
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Date" required>
              <input {...regReport('reportDate', { required: true })} type="date"
                defaultValue={new Date().toISOString().split('T')[0]} className="input" />
            </FormField>
            <FormField label="Weather" required>
              <select {...regReport('weather', { required: true })} className="select">
                {Object.entries(WEATHER_ICONS).map(([k, v]) => (
                  <option key={k} value={k}>{v} {k}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Completion %" required>
              <input {...regReport('completionPct', { required: true, min: 0, max: 100 })}
                type="number" step="0.5" className="input" placeholder="35" />
            </FormField>
            <FormField label="Workers Present">
              <input {...regReport('labourCount')} type="number" min="0" className="input" placeholder="0" />
            </FormField>
            <FormField label="Work Done Today" required className="sm:col-span-2">
              <textarea {...regReport('workDone', { required: true })} rows={3}
                className="input resize-none" placeholder="Describe work completed today..." />
            </FormField>
            <FormField label="Issues Found" className="sm:col-span-2">
              <textarea {...regReport('issuesFound')} rows={2}
                className="input resize-none" placeholder="Any issues or concerns..." />
            </FormField>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => { setShowReport(false); resetReport(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={reportMutation.isPending} className="btn-primary w-full sm:w-auto">
              {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Quick Expense Modal ─────────────────────────────────── */}
      <Modal isOpen={showExpense} onClose={() => { setShowExpense(false); resetExpense(); }}
        title="Add Expense" size="md">
        <form onSubmit={handleExpense(d => expenseMutation.mutate({ ...d, projectId: selectedProjectId }))}
          className="p-4 sm:p-6 space-y-4">
          {projects.length > 1 && (
            <FormField label="Project" required>
              <select {...regExpense('projectId')} defaultValue={selectedProjectId} className="select">
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Title" required>
            <input {...regExpense('title', { required: true })} className="input" placeholder="e.g. Cement Purchase" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date" required>
              <input {...regExpense('expenseDate', { required: true })} type="date"
                defaultValue={new Date().toISOString().split('T')[0]} className="input" />
            </FormField>
            <FormField label="Amount (₹)" required>
              <input {...regExpense('amount', { required: true })} type="number" step="0.01" className="input" />
            </FormField>
            <FormField label="Category" required>
              <select {...regExpense('category', { required: true })} className="select">
                <option value="">Select</option>
                {['Materials','Labour','Equipment','Safety','Utilities','Transportation','Miscellaneous'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Vendor (Optional)">
              <input {...regExpense('vendorName')} className="input" placeholder="Vendor name" />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea {...regExpense('description')} rows={2} className="input resize-none" placeholder="Additional details..." />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => { setShowExpense(false); resetExpense(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={expenseMutation.isPending} className="btn-primary w-full sm:w-auto">
              {expenseMutation.isPending ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PMDashboardPage;