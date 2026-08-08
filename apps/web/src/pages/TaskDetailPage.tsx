import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, taskDailyLogsApi, dailyReportsApi } from '../api/services';
import { PageHeader, LoadingSpinner, EmptyState, Badge } from '../components/common';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle, HiOutlineArrowUturnLeft, HiOutlineClipboardDocumentList,
  HiOutlineUserGroup, HiOutlineCube, HiOutlineArrowLeft, HiOutlinePlus,
} from 'react-icons/hi2';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const WEATHER_ICONS: Record<string, string> = {
  SUNNY: '☀️', CLOUDY: '⛅', RAINY: '🌧️', FOGGY: '🌫️', STORMY: '⛈️',
};

const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const qc = useQueryClient();

  const { data: taskData, isLoading: taskLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id!),
    enabled: !!id,
  });
  const task = taskData?.data?.data;

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['daily-reports-for-task', id],
    queryFn: () => dailyReportsApi.list({ taskId: id, pageSize: 100 }),
    enabled: !!id,
  });
  const reports = reportsData?.data?.data || [];

  const reviewMutation = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REVERT') => taskDailyLogsApi.review(id!, decision),
    onSuccess: (_, decision) => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      toast.success(decision === 'APPROVE' ? 'Task approved!' : 'Sent back to In Progress');
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to review task'),
  });

  if (taskLoading) return <LoadingSpinner className="py-20" />;
  if (!task) return <EmptyState title="Task not found" />;

  const materials = task.taskType?.MaterialCoefficient || [];
  const pct = task.cumulativePercent || 0;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <button onClick={() => navigate('/tasks')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Tasks
      </button>

      <PageHeader
        title={task.title}
        subtitle={task.project?.name}
        action={
          task.status === 'REVIEW' && isAdmin ? (
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button onClick={() => reviewMutation.mutate('REVERT')} className="btn-secondary justify-center">
                <HiOutlineArrowUturnLeft className="w-4 h-4" /> Send Back
              </button>
              <button onClick={() => reviewMutation.mutate('APPROVE')} className="btn-primary justify-center">
                <HiOutlineCheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/daily-reports')} className="btn-primary w-full sm:w-auto">
              <HiOutlinePlus className="w-4 h-4" /> Submit Daily Report
            </button>
          )
        }
      />

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <Badge variant={task.status === 'REVIEW' ? 'warning' : task.status === 'DONE' ? 'success' : 'info'}>
            {task.status.replace('_', ' ')}
          </Badge>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{pct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
          <div className="bg-primary-600 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        {task.status === 'REVIEW' && (
          <p className="text-xs text-amber-600 mt-2">A daily report marked this 100% complete — awaiting Admin approval.</p>
        )}
        <p className="text-[11px] text-gray-400 mt-2">
          Progress, material usage and labour on this task are all driven by Daily Reports — submit one from the Daily Reports page and select this task to log today's work.
        </p>
      </div>

      {task.taskType && (
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{task.taskType.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-gray-400">Quantity</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {task.computedQuantity != null ? `${Number(task.computedQuantity).toFixed(2)} ${task.taskType.unit}` : 'Not set'}
              </div>
            </div>
            {task.totalPersonDays != null && (
              <div>
                <div className="text-gray-400">Ideal person-days</div>
                <div className="font-medium text-gray-900 dark:text-white">{Number(task.totalPersonDays).toFixed(1)}</div>
              </div>
            )}
            {!task.taskType.hasStandard && (
              <div className="col-span-2">
                <Badge variant="warning">Manual trade — no auto calculation</Badge>
              </div>
            )}
          </div>
          {materials.length > 0 && task.computedQuantity != null && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs font-medium text-gray-500 mb-2">Material Requirement (total for this task)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {materials.map((mc: any) => {
                  const totalNeeded = Number(task.computedQuantity) * mc.qtyPerUnit;
                  const usedSoFar = totalNeeded * (pct / 100);
                  return (
                    <div key={mc.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs">
                      <div className="text-gray-500">{mc.Material?.name}</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {usedSoFar.toFixed(1)} / {totalNeeded.toFixed(1)} {mc.Material?.unit}
                      </div>
                      <div className="text-[10px] text-gray-400">used so far / total</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HiOutlineClipboardDocumentList className="w-4 h-4" /> Daily Report History
        </h3>
        {reportsLoading ? <LoadingSpinner className="py-8" /> : reports.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<HiOutlineClipboardDocumentList className="w-8 h-8" />}
              title="No reports yet"
              description="Submit a Daily Report and select this task to start tracking progress."
              action={<button onClick={() => navigate('/daily-reports')} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Submit Report</button>}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r: any) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>{WEATHER_ICONS[r.weather] || '🌤️'}</span>
                    {new Date(r.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <Badge variant="info">{r.completionPct}% cumulative</Badge>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{r.workDone}</p>

                {r.workers?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <HiOutlineUserGroup className="w-3.5 h-3.5" /> Workers ({r.workers.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {r.workers.map((w: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                          <span className="text-gray-700 dark:text-gray-300">{w.name} · {w.role}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">₹{w.wageForDay}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.materialsUsed?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <HiOutlineCube className="w-3.5 h-3.5" /> Materials Used
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {r.materialsUsed.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-primary-50 dark:bg-primary-900/10 rounded px-2 py-1">
                          <span className="text-primary-700 dark:text-primary-400">{m.material?.name}</span>
                          <span className="font-semibold text-primary-900 dark:text-primary-300">{m.quantityUsed} {m.material?.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.notes && <p className="text-xs text-gray-500 mt-3 italic">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default TaskDetailPage;