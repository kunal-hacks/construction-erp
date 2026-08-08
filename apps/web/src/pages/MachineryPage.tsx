import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machineryApi, projectsApi } from '../api/services';
import {
  PageHeader, Modal, FormField, SearchInput, Pagination,
  LoadingSpinner, EmptyState, ConfirmDialog
} from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineWrenchScrewdriver, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2';

const todayDateStr = () => new Date().toISOString().split('T')[0];

const MachineryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['machinery-logs', page, projectFilter, search, dateFrom, dateTo],
    queryFn: () => machineryApi.getLogs({
      page, pageSize: 15,
      projectId: projectFilter || undefined,
      search: search || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['machinery-summary', projectFilter],
    queryFn: () => machineryApi.getSummary({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });

  const logs = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];
  const summary = summaryData?.data?.data?.summary;
  const costInfo = summaryData?.data?.data?.costInfo || { totalCost: 0, transferred: 0, pending: 0 };

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const isEditing = !!editingLog;
  const logHours = Number(watch('hoursUsed') || 0);
  const logRate = Number(watch('hourlyRate') || 0);
  const logTotal = logHours * logRate;

  const {
    register: regTransfer, handleSubmit: handleTransferSub, reset: resetTransfer,
    watch: watchTransfer, setValue: setTransferValue,
    formState: { errors: transferErrors },
  } = useForm({
    defaultValues: { projectId: projectFilter || '', amount: '', date: '' },
  });
  const transferProjectId = watchTransfer('projectId');

  const { data: transferSummaryData } = useQuery({
    queryKey: ['machinery-summary-for-transfer', transferProjectId],
    queryFn: () => machineryApi.getSummary({ projectId: transferProjectId }),
    enabled: !!transferProjectId,
  });
  const transferPending = transferSummaryData?.data?.data?.costInfo?.pending ?? 0;

  useEffect(() => {
    if (transferProjectId && transferSummaryData) {
      setTransferValue('amount', transferPending > 0 ? transferPending : '');
    }
  }, [transferProjectId, transferSummaryData]);

  const saveMutation = useMutation({
    mutationFn: (formData: any) => {
      const payload = {
        projectId: formData.projectId,
        machineryName: formData.machineryName,
        logDate: formData.logDate,
        hoursUsed: Number(formData.hoursUsed),
        hourlyRate: formData.hourlyRate !== '' ? Number(formData.hourlyRate) : null,
        fuelUsed: formData.fuelUsed !== '' ? Number(formData.fuelUsed) : null,
        operatorName: formData.operatorName || null,
        workDone: formData.workDone || null,
        notes: formData.notes || null,
      };
      return isEditing
        ? machineryApi.updateLog(editingLog.id, payload)
        : machineryApi.createLog(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machinery-logs'] });
      qc.invalidateQueries({ queryKey: ['machinery-summary'] });
      toast.success(isEditing ? 'Log updated!' : 'Log recorded!');
      setShowCreate(false); setEditingLog(null); reset();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => machineryApi.deleteLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machinery-logs'] });
      qc.invalidateQueries({ queryKey: ['machinery-summary'] });
      toast.success('Log deleted');
      setDeleteId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const transferMutation = useMutation({
    mutationFn: (data: { projectId: string; amount: number; date?: string }) => machineryApi.transferToExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machinery-summary'] });
      qc.invalidateQueries({ queryKey: ['machinery-summary-for-transfer'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Payment recorded!');
      setShowTransfer(false); resetTransfer();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to record payment'),
  });

  const openTransfer = () => {
    resetTransfer({ projectId: projectFilter || '', amount: '', date: '' });
    setShowTransfer(true);
  };

  const handleEdit = (log: any) => {
    setEditingLog(log);
    reset({
      projectId: log.projectId || '',
      machineryName: log.machineryName || '',
      logDate: log.logDate ? new Date(log.logDate).toISOString().split('T')[0] : todayDateStr(),
      hoursUsed: log.hoursUsed,
      hourlyRate: log.hourlyRate ?? '',
      fuelUsed: log.fuelUsed ?? '',
      operatorName: log.operatorName || '',
      workDone: log.workDone || '',
      notes: log.notes || '',
    });
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false); setEditingLog(null);
    reset({ logDate: todayDateStr() });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Machinery Log"
        subtitle="Equipment usage logging and cost tracking"
        action={
          <button onClick={() => { setEditingLog(null); reset({ logDate: todayDateStr() }); setShowCreate(true); }} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Log Entry
          </button>
        }
      />

      {/* Summary Cards — Total Logs, Total Hours, Pending (clickable), Paid Till Now */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">🚜</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{summary?._count?.id || 0}</div>
            <div className="text-xs text-gray-500 truncate">Total Logs</div>
          </div>
        </div>

        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">⏱️</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{Number(summary?._sum?.hoursUsed || 0).toFixed(1)}h</div>
            <div className="text-xs text-gray-500 truncate">Total Hours</div>
          </div>
        </div>

        {costInfo.pending > 0 ? (
          <button
            onClick={openTransfer}
            className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 text-left hover:shadow-card-hover transition-shadow"
          >
            <span className="text-xl sm:text-2xl flex-shrink-0">⏳</span>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹{costInfo.pending.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500 truncate">Pending Payment</div>
              <div className="text-[10px] text-primary-600 font-medium mt-0.5">Tap to settle →</div>
            </div>
          </button>
        ) : (
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl flex-shrink-0">⏳</span>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹0</div>
              <div className="text-xs text-gray-500 truncate">Pending Payment</div>
            </div>
          </div>
        )}

        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">💰</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹{costInfo.transferred.toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 truncate">Paid Till Now</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search machinery name..." className="flex-1 sm:min-w-60" />
        <select className="select w-full sm:w-52" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input flex-1 sm:w-40 text-xs" />
          <span className="text-gray-400 text-sm flex-shrink-0">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input flex-1 sm:w-40 text-xs" />
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-20" /> : (
        <>
          <div className="hidden sm:block card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Machinery</th><th>Operator</th><th>Hours</th>
                    <th>Rate/hr</th><th>Total Cost</th><th>Fuel (L)</th><th>Project</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(l.logDate).toLocaleDateString('en-IN')}</td>
                      <td className="font-medium text-sm whitespace-nowrap">{l.machineryName}</td>
                      <td className="text-sm whitespace-nowrap">{l.operatorName || '—'}</td>
                      <td className="font-bold text-primary-600 whitespace-nowrap">{Number(l.hoursUsed).toFixed(1)}h</td>
                      <td className="text-sm whitespace-nowrap">{l.hourlyRate ? `₹${Number(l.hourlyRate).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="font-medium text-green-600 whitespace-nowrap">{l.totalCost ? `₹${Number(l.totalCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                      <td className="text-sm text-orange-600 whitespace-nowrap">{l.fuelUsed ? `${Number(l.fuelUsed).toFixed(1)}L` : '—'}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{l.Project?.name || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(l)} className="icon-button text-amber-600" title="Edit">
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(l.id)} className="icon-button text-red-500" title="Delete">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={9} className="py-12 text-center">
                      <EmptyState icon={<HiOutlineWrenchScrewdriver className="w-10 h-10" />} title="No machinery logs" description="Record your first usage entry" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {logs.length > 0 ? logs.map((l: any) => (
              <div key={l.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{l.machineryName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(l.logDate).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary-600 text-sm">{Number(l.hoursUsed).toFixed(1)}h</div>
                    {l.totalCost && <div className="text-xs text-green-600 font-medium">₹{Number(l.totalCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Operator</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{l.operatorName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Rate/hr</div>
                    <div className="text-gray-700 dark:text-gray-300">{l.hourlyRate ? `₹${Number(l.hourlyRate).toLocaleString('en-IN')}` : '—'}</div>
                  </div>
                </div>
                {l.fuelUsed && (
                  <div className="mt-2 text-xs text-orange-600">Fuel: {Number(l.fuelUsed).toFixed(1)}L</div>
                )}
                <div className="text-xs text-gray-400 mt-1 truncate">📁 {l.Project?.name || '—'}</div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <button onClick={() => handleEdit(l)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-amber-600">
                    <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeleteId(l.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-red-500">
                    <HiOutlineTrash className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineWrenchScrewdriver className="w-10 h-10" />} title="No machinery logs" description="Record your first usage entry" />
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

      {/* Create / Edit Log Modal */}
      <Modal isOpen={showCreate} onClose={closeCreate} title={isEditing ? 'Edit Log Entry' : 'New Log Entry'} size="lg">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>

            <FormField label="Date" required>
              <input
                type="date"
                {...register('logDate', {
                  required: true,
                  validate: (v) => !v || new Date(v) <= new Date() || 'Date cannot be in the future',
                })}
                max={todayDateStr()}
                defaultValue={todayDateStr()}
                className="input"
              />
              {errors.logDate && <p className="text-xs text-red-500 mt-1">{errors.logDate.message as string}</p>}
            </FormField>

            <FormField label="Machinery Name" required className="sm:col-span-2">
              <input {...register('machineryName', { required: true })} className="input" placeholder="e.g. JCB 3DX, Excavator CAT 320" />
            </FormField>

            <FormField label="Operator Name">
              <input {...register('operatorName')} className="input" placeholder="Operator name" />
            </FormField>

            <FormField label="Work Done">
              <input {...register('workDone')} className="input" placeholder="e.g. Excavation for foundation" />
            </FormField>

            <FormField label="Hours Used" required>
              <input type="number" step="0.1" {...register('hoursUsed', { required: true, min: 0.1 })} className="input" placeholder="7.5" />
            </FormField>

            <FormField label="Rate per Hour (₹)">
              <input type="number" step="0.01" {...register('hourlyRate')} className="input" placeholder="1500" />
            </FormField>

            <FormField label="Fuel Used (L)" className="sm:col-span-2">
              <input type="number" step="0.1" {...register('fuelUsed')} className="input" placeholder="45.0" />
            </FormField>
          </div>

          {(logHours > 0 && logRate > 0) && (
            <div className="p-3 sm:p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0">
                <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                  {logHours.toFixed(1)} hrs × ₹{logRate.toLocaleString('en-IN')}/hr
                </span>
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                  = ₹{logTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          )}

          <FormField label="Notes">
            <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Additional notes..." />
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={closeCreate} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full sm:w-auto">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Log' : 'Save Log'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal — same pattern as Truck Entries */}
      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Record Payment" size="sm">
        <form onSubmit={handleTransferSub(d => {
          transferMutation.mutate({
            projectId: d.projectId,
            amount: Number(d.amount),
            date: d.date || undefined,
          });
        })} className="p-4 sm:p-6 space-y-4">
          <FormField label="Project" required>
            <select {...regTransfer('projectId', { required: true })} className="select">
              <option value="">Select Project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          {transferProjectId && (
            <p className="text-sm text-gray-500">
              Pending balance: <span className="font-bold text-amber-600">₹{transferPending.toLocaleString('en-IN')}</span>
            </p>
          )}

          <FormField label="Amount Paid (₹)" required>
            <input type="number" step="0.01" {...regTransfer('amount', { required: true, min: 0.01 })} className="input" placeholder="20000" />
            <p className="text-xs text-gray-400 mt-1">Auto-filled with the pending balance — edit if paying a partial amount.</p>
          </FormField>

          <FormField label="Payment Date (Optional)">
            <input
              type="date"
              {...regTransfer('date', {
                validate: (v) => !v || new Date(v) <= new Date() || 'Payment date cannot be in the future',
              })}
              max={todayDateStr()}
              className="input"
            />
            {transferErrors.date && <p className="text-xs text-red-500 mt-1">{transferErrors.date.message as string}</p>}
            <p className="text-xs text-gray-400 mt-1">Leave blank to use today's date.</p>
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowTransfer(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={transferMutation.isPending} className="btn-primary w-full sm:w-auto">
              {transferMutation.isPending ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Log Entry" message="Are you sure you want to delete this log entry? This cannot be undone."
        confirmLabel="Delete" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default MachineryPage;