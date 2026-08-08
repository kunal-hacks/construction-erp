import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, projectsApi } from '../api/services';
import { PageHeader, Modal, FormField, SearchInput, Pagination, LoadingSpinner, EmptyState, ConfirmDialog, Badge } from '../components/common';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineUsers, HiOutlinePencil, HiOutlineTrash, HiOutlineKey, HiOutlineFolderOpen, HiOutlineCheckCircle, HiOutlineXMark } from 'react-icons/hi2';

// Only two roles exist in this system: SUPER_ADMIN (you — created outside this UI)
// and PROJECT_MANAGER (created here, scoped to assigned projects).
// ADMIN remains in the schema enum for backward compatibility but is never
// offered as a choice — nothing should create new ADMIN-role accounts.
const CREATABLE_ROLES = ['PROJECT_MANAGER'];
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'danger',
  PROJECT_MANAGER: 'purple',
};
// Used only for the "All Roles" filter dropdown, so existing accounts with
// legacy roles (if any turn up in your check-users.ts output) can still be
// filtered/found and cleaned up from this page.
const FILTER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'];

type CreateStep = 'details' | 'assign-projects';

const UsersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>('details');
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [newUserRole, setNewUserRole] = useState<string>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null);
  const [resetUser, setResetUser] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () => usersApi.list({ page, pageSize: 15, search: search || undefined, role: roleFilter || undefined }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-select-all'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
    enabled: createStep === 'assign-projects',
  });

  const users = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];

  const { register, handleSubmit, reset, watch } = useForm();
  const { register: regEdit, handleSubmit: handleEditSub, setValue: setEditVal } = useForm();
  const { register: regReset, handleSubmit: handleResetSub } = useForm();
  const { register: regNewProject, handleSubmit: handleNewProjectSub, reset: resetNewProject } = useForm();

  const watchedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: (d: object) => usersApi.create({ ...d, role: 'PROJECT_MANAGER' }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      const createdUser = res.data?.data || res.data;

      // Every user created here is a PM — always move to project assignment.
      setNewUserId(createdUser.id);
      setNewUserRole('PROJECT_MANAGER');
      setCreateStep('assign-projects');
      toast.success('User created! Now assign project(s).');
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const createProjectMutation = useMutation({
    mutationFn: (d: object) => projectsApi.create(d),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['projects-select-all'] });
      const newProject = res.data?.data || res.data;
      setSelectedProjectIds(prev => [...prev, newProject.id]);
      setNewProjectMode(false);
      resetNewProject();
      toast.success('New project created and selected!');
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const assignProjectsMutation = useMutation({
    mutationFn: async () => {
      if (!newUserId) return;
      await Promise.all(
        selectedProjectIds.map(projectId =>
          projectsApi.addMember(projectId, { userId: newUserId, role: 'PROJECT_MANAGER' })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Assigned to ${selectedProjectIds.length} project(s)!`);
      closeCreateFlow();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to assign projects'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated!'); setEditUser(null); },
    onError: (e) => toast.error(formatError(e)),
  });

  const resetPassMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => usersApi.resetPassword(id, data),
    onSuccess: () => { toast.success('Password reset successfully!'); setResetUser(null); },
    onError: (e) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); setDeleteId(null); },
    onError: (e) => toast.error(formatError(e)),
  });
  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.hardDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User permanently deleted'); setHardDeleteId(null); },
    onError: (e) => toast.error(formatError(e)),
  });

  function openEdit(u: Record<string, unknown>) {
    setEditUser(u);
    ['firstName', 'lastName', 'phone'].forEach(k => setEditVal(k, u[k]));
    // Role is intentionally not editable for existing users — a PM stays a PM.
    // If you ever need to promote someone to Admin, do it directly in the database.
  }

  const closeCreateFlow = () => {
    setShowCreate(false);
    setCreateStep('details');
    setNewUserId(null);
    setNewUserRole('');
    setSelectedProjectIds([]);
    setNewProjectMode(false);
    reset();
    resetNewProject();
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="User Management"
        subtitle="Manage Project Managers and their project assignments"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> Add Project Manager
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name or email..." className="flex-1 sm:max-w-sm" />
        <select className="select w-full sm:w-48" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {FILTER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block table-container">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {Array.isArray(users) && users.map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400 flex-shrink-0">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white whitespace-nowrap">{u.firstName} {u.lastName}</div>
                            {u.id === currentUser?.id && <div className="text-xs text-primary-500">You</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{u.email}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{u.phone || '—'}</td>
                      <td className="whitespace-nowrap">
                        <Badge variant={ROLE_COLORS[u.role] as any}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap">
                        {u.isActive
                          ? <Badge variant="success">Active</Badge>
                          : <Badge variant="danger">Inactive</Badge>}
                      </td>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {u.role !== 'SUPER_ADMIN' && (
                            <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Edit">
                              <HiOutlinePencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setResetUser(u)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600" title="Reset Password">
                            <HiOutlineKey className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser?.id && u.role !== 'SUPER_ADMIN' && (
                            <>
                              <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded hover:bg-orange-50 text-orange-500" title="Deactivate">
                                <HiOutlineTrash className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setHardDeleteId(u.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete Permanently">
                                <HiOutlineXMark className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!users || users.length === 0) && (
                    <tr><td colSpan={7}><EmptyState icon={<HiOutlineUsers className="w-8 h-8" />} title="No users found" /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {Array.isArray(users) && users.length > 0 ? users.map((u: any) => (
              <div key={u.id} className="card p-4">
                {/* Row 1: avatar + name + role/status badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400 flex-shrink-0">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName}</div>
                      {u.id === currentUser?.id && <div className="text-xs text-primary-500">You</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant={ROLE_COLORS[u.role] as any}>{ROLE_LABELS[u.role] || u.role}</Badge>
                    {u.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                  </div>
                </div>

                {/* Row 2: email / phone / last login */}
                <div className="mt-3 space-y-1 text-xs">
                  <div className="text-gray-600 dark:text-gray-400 truncate">{u.email}</div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>{u.phone || '—'}</span>
                    <span>Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}</span>
                  </div>
                </div>

                {/* Row 3: actions */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-wrap">
                  {u.role !== 'SUPER_ADMIN' && (
                    <button onClick={() => openEdit(u)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-blue-600">
                      <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  <button onClick={() => setResetUser(u)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-yellow-600">
                    <HiOutlineKey className="w-3.5 h-3.5" /> Reset
                  </button>
                  {u.id !== currentUser?.id && u.role !== 'SUPER_ADMIN' && (
                    <>
                      <button onClick={() => setDeleteId(u.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-orange-500">
                        <HiOutlineTrash className="w-3.5 h-3.5" /> Deactivate
                      </button>
                      <button onClick={() => setHardDeleteId(u.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-red-600">
                        <HiOutlineXMark className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineUsers className="w-8 h-8" />} title="No users found" />
              </div>
            )}
          </div>

          {meta && (
            <div className="card overflow-hidden">
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* ── Create Project Manager Modal — Two Steps ───────────────────── */}
      <Modal isOpen={showCreate} onClose={closeCreateFlow}
        title={createStep === 'details' ? 'Add Project Manager' : 'Assign Project(s)'} size={createStep === 'assign-projects' ? 'lg' : 'md'}>

        {/* STEP 1: User details — role is fixed to Project Manager, not a choice */}
        {createStep === 'details' && (
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="First Name" required>
                <input {...register('firstName', { required: true })} className="input" placeholder="Rajesh" />
              </FormField>
              <FormField label="Last Name" required>
                <input {...register('lastName', { required: true })} className="input" placeholder="Kumar" />
              </FormField>
              <FormField label="Email" required className="sm:col-span-2">
                <input {...register('email', { required: true })} type="email" className="input" placeholder="user@company.com" />
              </FormField>
              <FormField label="Password" required className="sm:col-span-2">
                <input {...register('password', { required: true, minLength: 8 })} type="password" className="input" placeholder="Min 8 characters" />
              </FormField>
              <FormField label="Phone" className="sm:col-span-2">
                <input {...register('phone')} className="input" placeholder="9876543210" />
              </FormField>
            </div>
            <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-2">
              <HiOutlineFolderOpen className="w-4 h-4 flex-shrink-0 mt-0.5" />
              This user will be created as a Project Manager. After creating them, you'll assign the project(s) they're responsible for.
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button type="button" onClick={closeCreateFlow} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">
                {createMutation.isPending ? 'Creating...' : 'Create Project Manager'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Assign Projects */}
        {createStep === 'assign-projects' && (
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Select the project(s) this Project Manager will be responsible for. They can be assigned multiple projects, including projects in the same location.
            </p>

            {!newProjectMode ? (
              <button
                type="button"
                onClick={() => setNewProjectMode(true)}
                className="text-sm text-primary-600 hover:underline flex items-center gap-1.5"
              >
                <HiOutlinePlus className="w-4 h-4" /> Create a new project for this PM instead
              </button>
            ) : (
              <form onSubmit={handleNewProjectSub(d => createProjectMutation.mutate(d))}
                className="border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase">New Project</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Project Name" required className="sm:col-span-2">
                    <input {...regNewProject('name', { required: true })} className="input text-sm" placeholder="Project Name" />
                  </FormField>
                  <FormField label="Client Name" required>
                    <input {...regNewProject('clientName', { required: true })} className="input text-sm" placeholder="Client Name" />
                  </FormField>
                  <FormField label="Location">
                    <input {...regNewProject('location')} className="input text-sm" placeholder="City, State" />
                  </FormField>
                  <FormField label="Budget (₹)" required>
                    <input {...regNewProject('budget', { required: true })} type="number" className="input text-sm" placeholder="50000000" />
                  </FormField>
                  <FormField label="Start Date" required>
                    <input {...regNewProject('startDate', { required: true })} type="date" className="input text-sm" />
                  </FormField>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button type="button" onClick={() => { setNewProjectMode(false); resetNewProject(); }} className="btn-secondary text-xs w-full sm:w-auto">Cancel</button>
                  <button type="submit" disabled={createProjectMutation.isPending} className="btn-primary text-xs w-full sm:w-auto">
                    {createProjectMutation.isPending ? 'Creating...' : 'Create & Select'}
                  </button>
                </div>
              </form>
            )}

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
              {projects.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-400">No existing projects. Create one above.</div>
              )}
              {projects.map((p: any) => {
                const isSelected = selectedProjectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProjectSelection(p.id)}
                    className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                      isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-400 truncate">{p.projectCode} · {p.location || '—'}</div>
                    </div>
                    {isSelected && <HiOutlineCheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            {selectedProjectIds.length > 0 && (
              <div className="text-xs text-gray-500">
                {selectedProjectIds.length} project{selectedProjectIds.length > 1 ? 's' : ''} selected
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
              <button type="button" onClick={closeCreateFlow} className="btn-secondary w-full sm:w-auto">Skip for now</button>
              <button
                type="button"
                onClick={() => assignProjectsMutation.mutate()}
                disabled={selectedProjectIds.length === 0 || assignProjectsMutation.isPending}
                className="btn-primary w-full sm:w-auto"
              >
                {assignProjectsMutation.isPending ? 'Assigning...' : `Assign to ${selectedProjectIds.length || ''} Project${selectedProjectIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal — no role field; a PM's role never changes here */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="md">
        <form onSubmit={handleEditSub(d => editUser && updateMutation.mutate({ id: editUser.id as string, data: d }))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" required>
              <input {...regEdit('firstName', { required: true })} className="input" />
            </FormField>
            <FormField label="Last Name" required>
              <input {...regEdit('lastName', { required: true })} className="input" />
            </FormField>
            <FormField label="Phone" className="sm:col-span-2">
              <input {...regEdit('phone')} className="input" />
            </FormField>
            <FormField label="Status" className="sm:col-span-2">
              <select {...regEdit('isActive')} className="select">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setEditUser(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary w-full sm:w-auto">
              {updateMutation.isPending ? 'Saving...' : 'Update User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetUser} onClose={() => setResetUser(null)} title={`Reset Password — ${resetUser?.firstName} ${resetUser?.lastName}`} size="sm">
        <form onSubmit={handleResetSub(d => resetUser && resetPassMutation.mutate({ id: resetUser.id as string, data: d }))} className="p-4 sm:p-6 space-y-4">
          <FormField label="New Password" required>
            <input {...regReset('newPassword', { required: true, minLength: 8 })} type="password" className="input" placeholder="Min 8 characters" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setResetUser(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={resetPassMutation.isPending} className="btn-primary w-full sm:w-auto">
              {resetPassMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Deactivate User" message="This will deactivate the user account. They will no longer be able to login."
        confirmLabel="Deactivate" variant="danger" isLoading={deleteMutation.isPending} />

      <ConfirmDialog isOpen={!!hardDeleteId} onClose={() => setHardDeleteId(null)}
        onConfirm={() => hardDeleteId && hardDeleteMutation.mutate(hardDeleteId)}
        title="Permanently Delete User"
        message="This cannot be undone. The user and all their reports, expenses, and history will be permanently removed."
        confirmLabel="Delete Permanently" variant="danger" isLoading={hardDeleteMutation.isPending} />
    </div>
  );
};
export default UsersPage;