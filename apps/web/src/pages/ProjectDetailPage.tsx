import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, usersApi } from '../api/services';
import { Modal, FormField, LoadingSpinner, Badge, statusBadge } from '../components/common';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowLeft, HiOutlinePencil, HiOutlineUserPlus, HiOutlineUserMinus,
  HiOutlineCurrencyRupee, HiOutlineClipboardDocumentList, HiOutlineCalendarDays,
} from 'react-icons/hi2';

const STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
// Only PROJECT_MANAGER is a real assignable role in this system — VIEWER kept
// as the only other option since createProject still defaults new members to
// it (see projects.controller.ts), so it needs to remain selectable here too.
const PROJECT_ROLES = ['PROJECT_MANAGER', 'VIEWER'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'reports' | 'expenses'>('overview');

  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const canEditProject = isAdmin || user?.role === 'PROJECT_MANAGER';
  const canManageMembers = isAdmin;

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  const { data: dashData } = useQuery({
    queryKey: ['project-dashboard', id],
    queryFn: () => projectsApi.getDashboard(id!),
    enabled: !!id,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => usersApi.list({ pageSize: 100 }),
    enabled: canManageMembers,
  });

  const project = projectData?.data?.data;
  const dash = dashData?.data?.data;
  const allUsers = usersData?.data?.data || [];

  const { register: regEdit, handleSubmit: handleEditSub, setValue } = useForm();
  const { register: regMember, handleSubmit: handleMemberSub, reset: resetMember } = useForm();

  React.useEffect(() => {
    if (project) {
      setValue('name', project.name);
      setValue('location', project.location);
      setValue('budget', project.budget);
      setValue('description', project.description);
      setValue('progress', project.progress);
      setValue('status', project.status);
      setValue('startDate', project.startDate?.split('T')[0]);
      if (project.endDate) setValue('endDate', project.endDate.split('T')[0]);
    }
  }, [project, setValue]);

  const updateMutation = useMutation({
    mutationFn: (d: object) => projectsApi.update(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Project updated!'); setShowEdit(false); },
    onError: (e) => toast.error(formatError(e)),
  });

  const addMemberMutation = useMutation({
    mutationFn: (d: object) => projectsApi.addMember(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Member added!'); setShowAddMember(false); resetMember(); },
    onError: (e) => toast.error(formatError(e)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Member removed'); },
    onError: (e) => toast.error(formatError(e)),
  });

  if (isLoading) return <LoadingSpinner size="lg" className="h-64" />;

  if (!project) return (
    <div className="text-center py-16 px-4">
      <p className="text-gray-500">Project not found.</p>
      <Link to="/projects" className="btn-primary mt-4 inline-flex">← Back to Projects</Link>
    </div>
  );

  const members = project.ProjectMember || [];
  const memberIds = members.map((m: { User: { id: string } }) => m.User.id);
  const availableUsers = Array.isArray(allUsers)
    ? allUsers.filter((u: { id: string }) => !memberIds.includes(u.id))
    : [];

  const budgetUsed = Number(project.budgetUtilization || 0);
  const totalExpenses = Number(dash?.stats?.totalExpenses || 0);

  const recentExpenses = (dash?.recentExpenses || []).slice(0, 5);
  const recentReports = (dash?.recentReports || []).slice(0, 5);

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: `Team (${members.length})` },
    { key: 'reports', label: 'Reports' },
    { key: 'expenses', label: 'Expenses' },
  ] as const;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3 transition-colors">
          <HiOutlineArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{project.name}</h1>
              {statusBadge(project.status)}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="font-mono text-primary-600 dark:text-primary-400">{project.projectCode}</span>
              <span className="hidden xs:inline">·</span>
              <span>📍 {project.location}</span>
              <span className="hidden xs:inline">·</span>
              <span>👤 {project.clientName}</span>
              <span className="hidden xs:inline">·</span>
              <span className="flex items-center gap-1">
                <HiOutlineCalendarDays className="w-3.5 h-3.5" />
                {new Date(project.startDate).toLocaleDateString('en-IN')}
                {project.endDate && ` — ${new Date(project.endDate).toLocaleDateString('en-IN')}`}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 flex-shrink-0">
            {canManageMembers && (
              <button onClick={() => setShowAddMember(true)} className="btn-secondary text-xs justify-center">
                <HiOutlineUserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            )}
            {canEditProject && (
              <button onClick={() => setShowEdit(true)} className="btn-primary text-sm justify-center">
                <HiOutlinePencil className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5">
          <div className="text-xs text-gray-500 mb-1">Budget</div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            ₹{(Number(project.budget) / 10000000).toFixed(2)}Cr
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Used</span><span>{budgetUsed.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetUsed > 90 ? 'bg-red-500' : budgetUsed > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-xs text-gray-500 mb-1">Total Spent</div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            ₹{(totalExpenses / 100000).toFixed(1)}L
          </div>
          <div className="text-xs text-gray-400 mt-1">{dash?.recentExpenses?.length || 0} recent expenses</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-xs text-gray-500 mb-1">Completion</div>
          <div className="text-lg sm:text-xl font-bold text-primary-600">{Number(project.progress).toFixed(1)}%</div>
          <div className="mt-2">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-xs text-gray-500 mb-1">Tasks</div>
          <div className="flex gap-2 flex-wrap mt-1">
            {dash?.stats?.taskSummary && Object.entries(dash.stats.taskSummary).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{count as number}</div>
                <div className="text-[9px] sm:text-[10px] text-gray-400">{status}</div>
              </div>
            ))}
            {!dash?.stats?.taskSummary && <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{project._count?.Task || 0}</div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Daily Reports</h3>
              <Link to={`/daily-reports?projectId=${id}`} className="text-xs text-primary-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentReports.length > 0 ? recentReports.map((r: {
                id: string; reportDate: string; weather: string;
                workDone: string; completionPct: number;
                submitter: { firstName: string; lastName: string };
              }) => (
                <div key={r.id} className="px-4 sm:px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {new Date(r.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-xs">{r.weather === 'SUNNY' ? '☀️' : r.weather === 'RAINY' ? '🌧️' : '⛅'}</span>
                        <span className="text-xs text-primary-600 font-medium">{Number(r.completionPct).toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{r.workDone}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{r.submitter?.firstName}</span>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No reports yet</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Expenses</h3>
              <Link to={`/expenses?projectId=${id}`} className="text-xs text-primary-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentExpenses.length > 0 ? recentExpenses.map((e: {
                id: string; expenseDate: string; description: string;
                amount: number; category: string; status: string;
              }) => (
                <div key={e.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{e.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{e.category}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">₹{Number(e.amount).toLocaleString('en-IN')}</div>
                    <div className="mt-0.5">{statusBadge(e.status)}</div>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No expenses yet</div>
              )}
            </div>
          </div>

          {project.description && (
            <div className="card p-4 sm:p-5 lg:col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Project Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{project.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m: {
            User: { id: string; firstName: string; lastName: string; email: string; role: string };
            role: string; joinedAt: string;
          }) => (
            <div key={m.User.id} className="card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-400 flex-shrink-0">
                  {m.User.firstName[0]}{m.User.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{m.User.firstName} {m.User.lastName}</div>
                  <div className="text-xs text-gray-500 truncate">{m.User.email}</div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <Badge variant="info">{m.User.role.replace(/_/g, ' ')}</Badge>
                    {canManageMembers && m.User.id !== user?.id && (
                      <button onClick={() => removeMemberMutation.mutate(m.User.id)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 flex-shrink-0" title="Remove">
                        <HiOutlineUserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-3">
                Joined {new Date(m.joinedAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 card p-12 text-center text-gray-400">
              No team members assigned yet.
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
            <p className="text-sm text-gray-500">All progress reports for this project</p>
            <Link to={`/daily-reports?projectId=${id}`} className="btn-secondary text-xs w-fit">
              <HiOutlineClipboardDocumentList className="w-3.5 h-3.5" /> View in Reports
            </Link>
          </div>
          <div className="table-container overflow-x-auto">
            <table className="table min-w-[600px]">
              <thead><tr><th>Date</th><th>Weather</th><th>Work Done</th><th>Completion</th><th>Submitted By</th></tr></thead>
              <tbody>
                {(dash?.recentReports || []).map((r: {
                  id: string; reportDate: string; weather: string; workDone: string;
                  completionPct: number; submitter: { firstName: string; lastName: string };
                }) => (
                  <tr key={r.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(r.reportDate).toLocaleDateString('en-IN')}</td>
                    <td className="whitespace-nowrap"><span>{r.weather === 'SUNNY' ? '☀️' : r.weather === 'RAINY' ? '🌧️' : '⛅'} {r.weather}</span></td>
                    <td className="max-w-xs truncate text-sm">{r.workDone}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${r.completionPct}%` }} />
                        </div>
                        <span className="text-xs font-medium">{Number(r.completionPct).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{r.submitter?.firstName} {r.submitter?.lastName}</td>
                  </tr>
                ))}
                {!(dash?.recentReports?.length) && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No reports found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
            <p className="text-sm text-gray-500">All expenses for this project</p>
            <Link to={`/expenses?projectId=${id}`} className="btn-secondary text-xs w-fit">
              <HiOutlineCurrencyRupee className="w-3.5 h-3.5" /> View in Expenses
            </Link>
          </div>
          <div className="table-container overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(dash?.recentExpenses || []).map((e: {
                  id: string; expenseDate: string; description: string;
                  category: string; amount: number; status: string;
                }) => (
                  <tr key={e.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(e.expenseDate).toLocaleDateString('en-IN')}</td>
                    <td className="text-sm max-w-xs truncate">{e.description}</td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{e.category}</td>
                    <td className="font-bold text-sm whitespace-nowrap">₹{Number(e.amount).toLocaleString('en-IN')}</td>
                    <td className="whitespace-nowrap">{statusBadge(e.status)}</td>
                  </tr>
                ))}
                {!(dash?.recentExpenses?.length) && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No expenses found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Project" size="lg">
        <form onSubmit={handleEditSub(d => updateMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project Name" required className="sm:col-span-2">
              <input {...regEdit('name', { required: true })} className="input" disabled={!isAdmin} />
            </FormField>
            <FormField label="Location">
              <input {...regEdit('location')} className="input" disabled={!isAdmin} />
            </FormField>
            <FormField label="Status">
              <select {...regEdit('status')} className="select" disabled={!isAdmin}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Budget (₹)">
              <input {...regEdit('budget')} type="number" className="input" disabled={!isAdmin} />
            </FormField>
            <FormField label="Progress %">
              <input {...regEdit('progress')} type="number" step="0.5" min="0" max="100" className="input" />
            </FormField>
            <FormField label="Start Date">
              <input {...regEdit('startDate')} type="date" className="input" disabled={!isAdmin} />
            </FormField>
            <FormField label="End Date">
              <input {...regEdit('endDate')} type="date" className="input" disabled={!isAdmin} />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <textarea {...regEdit('description')} rows={3} className="input resize-none" />
            </FormField>
          </div>
          {!isAdmin && (
            <p className="text-xs text-gray-400">
              As a Project Manager you can update progress and description. Other fields are managed by an admin.
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary w-full sm:w-auto">
              {updateMutation.isPending ? 'Saving...' : 'Update Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal — admin only */}
      {canManageMembers && (
        <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add Team Member" size="sm">
          <form onSubmit={handleMemberSub(d => addMemberMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
            <FormField label="Select User" required>
              <select {...regMember('userId', { required: true })} className="select">
                <option value="">Choose a user</option>
                {availableUsers.map((u: { id: string; firstName: string; lastName: string; role: string }) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.role.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Project Role">
              <select {...regMember('role')} className="select">
                {PROJECT_ROLES.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </FormField>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="submit" disabled={addMemberMutation.isPending} className="btn-primary w-full sm:w-auto">
                {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default ProjectDetailPage;