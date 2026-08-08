import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tasksApi, taskTypesApi, projectsApi, usersApi } from '../api/services';
import { PageHeader, Modal, FormField, LoadingSpinner, EmptyState, Badge } from '../components/common';
import DimensionsEditor, { ComponentInput, emptyValues } from '../components/common/DimensionsEditor';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineClipboard, HiOutlineChatBubbleLeft, HiOutlineCalendar, HiOutlineUser } from 'react-icons/hi2';

const STATUS_COLS = ['TODO', 'IN_PROGRESS',  'DONE', 'BLOCKED'] as const;
const STATUS_LABELS: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress',  DONE: 'Done', BLOCKED: 'Blocked' };
const STATUS_COLORS: Record<string, string> = { TODO: 'bg-gray-100 dark:bg-gray-800', IN_PROGRESS: 'bg-blue-50 dark:bg-blue-900/10',  DONE: 'bg-green-50 dark:bg-green-900/10', BLOCKED: 'bg-red-50 dark:bg-red-900/10' };
const PRIORITY_COLORS: Record<string, string> = { LOW: 'text-gray-400', MEDIUM: 'text-yellow-500', HIGH: 'text-orange-500', CRITICAL: 'text-red-500' };
const PRIORITY_ICONS: Record<string, string> = { LOW: '↓', MEDIUM: '→', HIGH: '↑', CRITICAL: '⚡' };
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

type Task = {
  id: string; title: string; description?: string; priority: string; status: string;
  dueDate?: string; assignee?: { firstName: string; lastName: string; avatar?: string };
  _count?: { comments: number }; tags?: string[];
};

const TasksPage: React.FC = () => {
  const [projectId, setProjectId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewTask, setViewTask] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState('');
  const [mobileStatus, setMobileStatus] = useState<typeof STATUS_COLS[number]>('TODO');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => usersApi.list({ pageSize: 100 }),
    enabled: isAdmin,
  });
  const { data: taskTypesData } = useQuery({ queryKey: ['task-types'], queryFn: () => taskTypesApi.list() });
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks-board', projectId],
    queryFn: () => projectId ? tasksApi.getByProject(projectId) : tasksApi.list({ pageSize: 100 }),
    enabled: true,
  });

  const projects = projectsData?.data?.data || [];
  const adminUsers = usersData?.data?.data || [];
  const taskTypes = taskTypesData?.data?.data || [];
  const rawTasks = tasksData?.data?.data;
  const grouped = projectId
    ? (rawTasks?.grouped || {})
    : STATUS_COLS.reduce((acc, s) => {
        acc[s] = (Array.isArray(rawTasks) ? rawTasks : []).filter((t: { status: string }) => t.status === s);
        return acc;
      }, {} as Record<string, unknown[]>);

  const { register, handleSubmit, reset, watch } = useForm();
  const formProjectId = watch('projectId');
  const formTaskTypeId = watch('taskTypeId');
  const selectedTaskType = taskTypes.find((tt: any) => tt.id === formTaskTypeId);

  const { data: projectMembersData } = useQuery({
    queryKey: ['project-members-for-task', formProjectId],
    queryFn: () => projectsApi.get(formProjectId),
    enabled: !isAdmin && !!formProjectId,
  });
  const projectMembers = (projectMembersData?.data?.data?.ProjectMember || []).map((m: any) => m.User);
  const assignableUsers = isAdmin ? adminUsers : projectMembers;

  // ── Dimensions (multiple components + openings) + live estimate ──
  const [components, setComponents] = useState<ComponentInput[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    setEstimate(null);
    if (selectedTaskType?.dimensionFields?.length > 0) {
      setComponents([{ label: 'Section 1', values: emptyValues(selectedTaskType.dimensionFields), openings: [] }]);
    } else {
      setComponents([]);
    }
  }, [formTaskTypeId]);

  const componentsFilled = components.length > 0 && components.every(c => c.values.every(v => v.value !== ''));

  const buildComponentsPayload = () => components.map(c => ({
    label: c.label,
    values: c.values.map(v => ({ value: Number(v.value), unit: v.unit })),
    openings: (c.openings || [])
      .filter(o => o.values[0]?.value && o.values[1]?.value)
      .map(o => ({ label: o.label, values: o.values.map(v => ({ value: Number(v.value), unit: v.unit })) })),
  }));

  useEffect(() => {
    if (!selectedTaskType || !componentsFilled) { setEstimate(null); return; }
    setEstimating(true);
    tasksApi.getEstimate({ taskTypeId: selectedTaskType.id, components: buildComponentsPayload() })
      .then(res => setEstimate(res.data.data))
      .catch(() => setEstimate(null))
      .finally(() => setEstimating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(components), selectedTaskType?.id]);

  const createMutation = useMutation({
    mutationFn: (d: object) => tasksApi.create(d),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['tasks-board'] });
      const warnings = res.data?.data?.materialWarnings || [];
      if (warnings.length > 0) {
        toast.error(
          `Task created, but inventory is short: ${warnings.map((w: any) => `${w.materialName} (need ${w.qtyNeeded.toFixed(0)}, have ${w.available.toFixed(0)} ${w.unit})`).join(', ')}`,
          { duration: 8000 }
        );
      } else {
        toast.success('Task created!');
      }
      setShowCreate(false); reset(); setComponents([]); setEstimate(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => tasksApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks-board'] }); toast.success('Task updated!'); },
    onError: (e) => toast.error(formatError(e)),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => tasksApi.addComment(id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-board'] });
      if (viewTask) tasksApi.get(viewTask.id as string).then(r => setViewTask(r.data.data));
      setComment('');
      toast.success('Comment added!');
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks-board'] }); setViewTask(null); toast.success('Task deleted'); },
    onError: (e) => toast.error(formatError(e)),
  });

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const openTask = (taskId: string) => tasksApi.get(taskId).then(r => setViewTask(r.data.data));

  const onCreateSubmit = (d: any) => {
    const payload: any = { ...d };
    if (selectedTaskType && componentsFilled) {
      payload.components = buildComponentsPayload();
    }
    createMutation.mutate(payload);
  };

  const closeCreate = () => {
    setShowCreate(false);
    reset();
    setComponents([]);
    setEstimate(null);
  };

  const renderTaskCard = (task: Task) => (
    <div key={task.id}
      className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800"
      onClick={() => openTask(task.id)}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white leading-snug flex-1">{task.title}</span>
        <span className={`${PRIORITY_COLORS[task.priority]} text-sm font-bold flex-shrink-0`} title={task.priority}>
          {PRIORITY_ICONS[task.priority]}
        </span>
      </div>
      {task.description && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</p>}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <div className="flex items-center gap-1" title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
              <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-400">
                {task.assignee.firstName[0]}{task.assignee.lastName[0]}
              </div>
            </div>
          )}
          {task._count?.comments ? (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <HiOutlineChatBubbleLeft className="w-3 h-3" />{task._count.comments}
            </span>
          ) : null}
        </div>
        {task.dueDate && (
          <span className={`text-xs flex items-center gap-0.5 ${new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            <HiOutlineCalendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Task Management"
        subtitle="Kanban board for project task tracking"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Task
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select className="select w-full sm:w-64" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="hidden sm:flex gap-2 text-xs text-gray-500">
          {Object.entries(PRIORITY_ICONS).map(([k, v]) => (
            <span key={k} className={`${PRIORITY_COLORS[k]} font-medium`}>{v} {k}</span>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <>
          <div className="hidden sm:flex gap-4 overflow-x-auto pb-4">
            {STATUS_COLS.map(status => {
              const colTasks = (grouped[status] || []) as Task[];
              return (
                <div key={status} className="flex-shrink-0 w-72">
                  <div className={`rounded-xl ${STATUS_COLORS[status]} p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{STATUS_LABELS[status]}</span>
                      <span className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium shadow-sm">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[60px]">
                      {colTasks.map(renderTaskCard)}
                      {colTasks.length === 0 && <div className="text-center py-4 text-xs text-gray-400">No tasks</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
              {STATUS_COLS.map(status => {
                const count = ((grouped[status] || []) as Task[]).length;
                const isActive = mobileStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => setMobileStatus(status)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                  >
                    {STATUS_LABELS[status]}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-white dark:bg-gray-700'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className={`rounded-xl ${STATUS_COLORS[mobileStatus]} p-3`}>
              <div className="space-y-2 min-h-[60px]">
                {((grouped[mobileStatus] || []) as Task[]).map(renderTaskCard)}
                {((grouped[mobileStatus] || []) as Task[]).length === 0 && (
                  <div className="text-center py-8">
                    <EmptyState icon={<HiOutlineClipboard className="w-7 h-7" />} title={`No tasks in ${STATUS_LABELS[mobileStatus]}`} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={showCreate} onClose={closeCreate} title="Create Task" size="lg">
        <form onSubmit={handleSubmit(onCreateSubmit)} className="p-4 sm:p-6 space-y-4">
          <FormField label="Title" required>
            <input {...register('title', { required: true })} className="input" placeholder="Task title..." />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Assignee">
              <select {...register('assigneeId')} className="select" disabled={!isAdmin && !formProjectId}>
                <option value="">{!isAdmin && !formProjectId ? 'Select a project first' : 'Unassigned'}</option>
                {Array.isArray(assignableUsers) && assignableUsers.map((u: { id: string; firstName: string; lastName: string; role: string }) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role.replace('_',' ')})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <select {...register('priority')} className="select" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
            <FormField label="Due Date">
              <input {...register('dueDate')} type="date" className="input" />
            </FormField>
            <FormField label="Task Type (Optional)" className="sm:col-span-2">
              <select {...register('taskTypeId')} className="select">
                <option value="">No standard — plain task</option>
                {taskTypes.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
              </select>
            </FormField>
          </div>

          {selectedTaskType?.dimensionFields?.length > 0 && (
            <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500">
                Dimensions {!selectedTaskType.hasStandard && '(optional — no standard for this trade)'}
              </div>
              <DimensionsEditor fields={selectedTaskType.dimensionFields} components={components} onChange={setComponents} />
              <p className="text-[10px] text-gray-400">Leave blank if unknown — PM can fill these in later from the Daily Reports form.</p>
              {estimating && <p className="text-xs text-gray-400">Calculating...</p>}
              {estimate && (
                <div className="bg-primary-50 dark:bg-primary-900/10 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-primary-700 dark:text-primary-400">
                    {estimate.computedQuantity.toFixed(2)} {estimate.taskType.unit}
                  </div>
                  {/* {estimate.totalPersonDays && (
                    <div className="text-gray-600 dark:text-gray-400">
                      ≈ {estimate.totalPersonDays.toFixed(1)} mason-days
                      {estimate.helperDays && <> + {estimate.helperDays.toFixed(1)} helper-days</>}
                    </div>
                  )} */}
                  {estimate.materials.length > 0 && (
                    <div className="text-gray-600 dark:text-gray-400">
                      {estimate.materials.map((m: any) => `${m.materialName}: ${m.qtyNeeded.toFixed(0)} ${m.unit}`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <FormField label="Description">
            <textarea {...register('description')} rows={3} className="input resize-none" placeholder="Task description..." />
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={closeCreate} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">{createMutation.isPending ? 'Creating...' : 'Create Task'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTask} onClose={() => setViewTask(null)} title="Task Details" size="lg">
        {viewTask && (
          <div className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight flex-1">{String(viewTask.title)}</h3>
                <button onClick={() => deleteMutation.mutate(viewTask.id as string)} className="p-1.5 rounded hover:bg-red-50 text-red-400 flex-shrink-0" title="Delete task">
                  🗑️
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={String(viewTask.status)}
                  onChange={e => { handleStatusChange(viewTask.id as string, e.target.value); setViewTask({ ...viewTask, status: e.target.value }); }}
                  className="select text-xs py-1.5 w-full sm:flex-1">
                  {STATUS_COLS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <button onClick={() => navigate(`/tasks/${viewTask.id}`)} className="btn-secondary text-xs py-1.5 w-full sm:w-auto justify-center whitespace-nowrap">
                  Full Details →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                <div className="text-gray-400 mb-1">Priority</div>
                <div className={`font-bold ${PRIORITY_COLORS[viewTask.priority as string]}`}>
                  {PRIORITY_ICONS[viewTask.priority as string]} {String(viewTask.priority)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                <div className="text-gray-400 mb-1">Assignee</div>
                <div className="font-medium truncate">
                  {(viewTask.assignee as { firstName: string; lastName: string }) ?
                    `${(viewTask.assignee as { firstName: string; lastName: string }).firstName} ${(viewTask.assignee as { firstName: string; lastName: string }).lastName}` : 'Unassigned'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                <div className="text-gray-400 mb-1">Due Date</div>
                <div className={`font-medium ${viewTask.dueDate && new Date(viewTask.dueDate as string) < new Date() && viewTask.status !== 'DONE' ? 'text-red-500' : ''}`}>
                  {viewTask.dueDate ? new Date(viewTask.dueDate as string).toLocaleDateString('en-IN') : 'No deadline'}
                </div>
              </div>
            </div>

            {(viewTask.taskType as any) && (
              <div className="bg-primary-50 dark:bg-primary-900/10 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-primary-700 dark:text-primary-400">{(viewTask.taskType as any).name}</div>
                {viewTask.computedQuantity != null && (
                  <div className="text-gray-600 dark:text-gray-400">
                    Quantity: {Number(viewTask.computedQuantity).toFixed(2)} {(viewTask.taskType as any).unit}
                  </div>
                )}
                {viewTask.totalPersonDays != null && (
                  <div className="text-gray-600 dark:text-gray-400">Ideal: {Number(viewTask.totalPersonDays).toFixed(1)} person-days</div>
                )}
                <div className="text-gray-600 dark:text-gray-400">Progress: {Number(viewTask.cumulativePercent || 0).toFixed(0)}%</div>
              </div>
            )}

            {Boolean(viewTask.description) && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Description</div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{String(viewTask.description)}</p>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Comments ({(viewTask.comments as unknown[])?.length || 0})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {((viewTask.comments || []) as { id: string; content: string; createdAt: string; user: { firstName: string; lastName: string } }[]).map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-600 flex-shrink-0 mt-0.5">
                      {c.user?.firstName?.[0]}{c.user?.lastName?.[0]}
                    </div>
                    <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.user?.firstName} {c.user?.lastName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words">{c.content}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{new Date(c.createdAt).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
                {(!(viewTask.comments as unknown[])?.length) && <p className="text-xs text-gray-400">No comments yet.</p>}
              </div>
              <div className="flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  className="input flex-1 text-xs" placeholder="Add a comment..."
                  onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { commentMutation.mutate({ id: viewTask.id as string, content: comment }); } }} />
                <button onClick={() => comment.trim() && commentMutation.mutate({ id: viewTask.id as string, content: comment })}
                  disabled={!comment.trim() || commentMutation.isPending} className="btn-primary text-xs px-3 flex-shrink-0">
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default TasksPage;