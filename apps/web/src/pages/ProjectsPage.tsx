import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi, usersApi } from '../api/services';
import { PageHeader, Badge, SearchInput, Pagination, Modal, FormField, LoadingSpinner, EmptyState, ConfirmDialog } from '../components/common';
import { useForm } from 'react-hook-form';
import { HiOutlinePlus, HiOutlineFolderOpen, HiOutlineEye, HiOutlineTrash, HiOutlineUserPlus, HiOutlineUserGroup } from 'react-icons/hi2';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { formatError } from '../api/client';

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'neutral', ACTIVE: 'success', ON_HOLD: 'warning', COMPLETED: 'info', CANCELLED: 'danger',
};

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const ProjectsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignPmProject, setAssignPmProject] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const isAdmin = ADMIN_ROLES.includes(user?.role || '');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, search, statusFilter],
    queryFn: () => projectsApi.list({ page, pageSize: 10, search, status: statusFilter || undefined }),
  });

  const { data: pmUsersData } = useQuery({
    queryKey: ['pm-users-select'],
    queryFn: () => usersApi.list({ pageSize: 100, role: 'PROJECT_MANAGER' }),
    enabled: isAdmin,
  });

  const projects = data?.data?.data || [];
  const meta = data?.data?.meta;
  const pmUsers = pmUsersData?.data?.data || [];

  const { register, handleSubmit, reset } = useForm();
  const { register: regAssign, handleSubmit: handleAssignSub, reset: resetAssign } = useForm();

  const createMutation = useMutation({
    mutationFn: (d: object) => projectsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created!');
      setShowCreateModal(false); reset();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project cancelled');
      setDeleteId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const assignPmMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      projectsApi.addMember(projectId, { userId, role: 'PROJECT_MANAGER' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project Manager assigned!');
      setAssignPmProject(null); resetAssign();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to assign PM'),
  });

  const removePmMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      projectsApi.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project Manager removed');
    },
    onError: (e: any) => toast.error(formatError(e)),
  });

  const canCreate = isAdmin;
  const canManage = isAdmin;

  const getAssignedPMs = (project: any) => {
    return (project.ProjectMember || []).filter((m: any) => m.role === 'PROJECT_MANAGER');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage all construction projects"
        action={canCreate && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Project
          </button>
        )}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects..." className="flex-1 sm:min-w-48" />
        <select className="select w-full sm:w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'].map(s => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
      </div>

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th><th>Client</th><th>Location</th><th>Budget</th>
                  <th>Progress</th><th>Project Manager</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(projects) && projects.map((p: any) => {
                  const assignedPMs = getAssignedPMs(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-gray-900 dark:text-white">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          {p.projectCode} · {p.startDate ? new Date(p.startDate).getFullYear() : '—'}
                        </div>
                      </td>
                      <td className="text-sm">{p.clientName || '—'}</td>
                      <td className="text-sm text-gray-500">{p.location || '—'}</td>
                      <td className="font-medium text-sm">₹{(Number(p.budget || 0) / 10000000).toFixed(2)}Cr</td>
                      <td>
                        <div className="flex items-center gap-2 min-w-24">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                          </div>
                          <span className="text-xs font-medium">{Number(p.progress || 0).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        {assignedPMs.length > 0 ? (
                          <div className="space-y-1">
                            {assignedPMs.map((m: any) => (
                              <div key={m.userId} className="flex items-center gap-1.5 group">
                                <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-700 flex-shrink-0">
                                  {m.User?.firstName?.[0]}{m.User?.lastName?.[0]}
                                </div>
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {m.User?.firstName} {m.User?.lastName}
                                </span>
                                {canManage && (
                                  <button
                                    onClick={() => removePmMutation.mutate({ projectId: p.id, userId: m.userId })}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                        {canManage && (
                          <button
                            onClick={() => setAssignPmProject(p)}
                            className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <HiOutlineUserPlus className="w-3 h-3" /> {assignedPMs.length > 0 ? 'Add another' : 'Assign PM'}
                          </button>
                        )}
                      </td>
                      <td><Badge variant={STATUS_COLORS[p.status] as any}>{p.status?.replace('_', ' ')}</Badge></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link to={`/projects/${p.id}`} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                            <HiOutlineEye className="w-3.5 h-3.5" />
                          </Link>
                          {canManage && (
                            <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                              <HiOutlineTrash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(!projects || projects.length === 0) && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={<HiOutlineFolderOpen className="w-8 h-8" />} title="No projects found" description="Create your first project to get started." />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {Array.isArray(projects) && projects.length > 0 ? projects.map((p: any) => {
              const assignedPMs = getAssignedPMs(p);
              return (
                <div key={p.id} className="card p-4">
                  {/* Row 1: name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {p.projectCode} · {p.startDate ? new Date(p.startDate).getFullYear() : '—'}
                      </div>
                    </div>
                    <Badge variant={STATUS_COLORS[p.status] as any}>{p.status?.replace('_', ' ')}</Badge>
                  </div>

                  {/* Row 2: client + location, side by side */}
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <div className="text-gray-400">Client</div>
                      <div className="text-gray-700 dark:text-gray-300 truncate">{p.clientName || '—'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Location</div>
                      <div className="text-gray-700 dark:text-gray-300 truncate">{p.location || '—'}</div>
                    </div>
                  </div>

                  {/* Row 3: budget + progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Budget: <span className="font-medium text-gray-700 dark:text-gray-300">₹{(Number(p.budget || 0) / 10000000).toFixed(2)}Cr</span></span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{Number(p.progress || 0).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                    </div>
                  </div>

                  {/* Row 4: assigned PM */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">Project Manager</div>
                    {assignedPMs.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assignedPMs.map((m: any) => (
                          <div key={m.userId} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-full pl-1 pr-2 py-0.5">
                            <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-700 flex-shrink-0">
                              {m.User?.firstName?.[0]}{m.User?.lastName?.[0]}
                            </div>
                            <span className="text-xs text-gray-700 dark:text-gray-300">{m.User?.firstName} {m.User?.lastName}</span>
                            {canManage && (
                              <button onClick={() => removePmMutation.mutate({ projectId: p.id, userId: m.userId })} className="text-red-400 text-xs ml-1">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unassigned</span>
                    )}
                    {canManage && (
                      <button onClick={() => setAssignPmProject(p)} className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1.5">
                        <HiOutlineUserPlus className="w-3 h-3" /> {assignedPMs.length > 0 ? 'Add another' : 'Assign PM'}
                      </button>
                    )}
                  </div>

                  {/* Row 5: actions */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                    <Link to={`/projects/${p.id}`} className="btn-secondary flex-1 justify-center text-xs">
                      <HiOutlineEye className="w-3.5 h-3.5" /> View
                    </Link>
                    {canManage && (
                      <button onClick={() => setDeleteId(p.id)} className="btn-secondary flex-1 justify-center text-xs text-red-500">
                        <HiOutlineTrash className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <EmptyState icon={<HiOutlineFolderOpen className="w-8 h-8" />} title="No projects found" description="Create your first project to get started." />
            )}
          </div>

          {meta && (
            <div className="card overflow-hidden">
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); reset(); }} title="Create New Project" size="lg">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project Name" required className="sm:col-span-2">
              <input {...register('name', { required: true })} className="input" placeholder="Green Valley Residential Complex" />
            </FormField>
            <FormField label="Client Name" required>
              <input {...register('clientName', { required: true })} className="input" placeholder="Client Name" />
            </FormField>
            <FormField label="Client Phone">
              <input {...register('clientPhone')} className="input" placeholder="9876543210" />
            </FormField>
            <FormField label="Location">
              <input {...register('location')} className="input" placeholder="City, State" />
            </FormField>
            <FormField label="Budget (₹)" required>
              <input {...register('budget', { required: true })} type="number" className="input" placeholder="50000000" />
            </FormField>
            <FormField label="Start Date" required>
              <input {...register('startDate', { required: true })} type="date" className="input" />
            </FormField>
            <FormField label="End Date">
              <input {...register('endDate')} type="date" className="input" />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <textarea {...register('description')} rows={3} className="input resize-none" placeholder="Project description..." />
            </FormField>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => { setShowCreateModal(false); reset(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign PM Modal */}
      <Modal isOpen={!!assignPmProject} onClose={() => { setAssignPmProject(null); resetAssign(); }}
        title={`Assign Project Manager — ${assignPmProject?.name}`} size="sm">
        <form
          onSubmit={handleAssignSub((d: any) => assignPmProject && assignPmMutation.mutate({ projectId: assignPmProject.id, userId: d.userId }))}
          className="p-4 sm:p-6 space-y-4"
        >
          <FormField label="Project Manager" required>
            <select {...regAssign('userId', { required: true })} className="select">
              <option value="">Select a Project Manager</option>
              {pmUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
              ))}
            </select>
          </FormField>
          {pmUsers.length === 0 && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex items-start gap-2">
              <HiOutlineUserGroup className="w-4 h-4 flex-shrink-0 mt-0.5" />
              No Project Managers found. Create a user with the "Project Manager" role first from the Users page.
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => { setAssignPmProject(null); resetAssign(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={assignPmMutation.isPending || pmUsers.length === 0} className="btn-primary w-full sm:w-auto">
              {assignPmMutation.isPending ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Cancel Project" message="This will mark the project as cancelled. Are you sure?"
        confirmLabel="Cancel Project" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default ProjectsPage;