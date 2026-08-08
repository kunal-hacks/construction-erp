import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryApi, usersApi, projectsApi } from '../api/services';
import { PageHeader, Modal, FormField, Pagination, LoadingSpinner, EmptyState, Badge, statusBadge } from '../components/common';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineBanknotes, HiOutlineCheckCircle, HiOutlineUserGroup } from 'react-icons/hi2';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const todayDateStr = () => new Date().toISOString().split('T')[0];

const SalaryPage: React.FC = () => {
  const [tab, setTab] = useState<'staff' | 'workers'>('staff');
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const projects = projectsData?.data?.data || [];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Salary Management"
        subtitle="Staff payroll and automatic worker wage tracking"
      />

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-fit gap-1">
        {(['staff', 'workers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'staff' ? 'Staff Salary' : 'Worker Wages'}
          </button>
        ))}
      </div>

      {tab === 'staff' ? <StaffSalaryTab isAdmin={isAdmin} projects={projects} /> : <WorkerWagesTab projects={projects} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// STAFF SALARY — unchanged manual generate/pay flow (Users only)
// ══════════════════════════════════════════════════════════════════════════

const StaffSalaryTab: React.FC<{ isAdmin: boolean; projects: any[] }> = ({ isAdmin, projects }) => {
  const [page, setPage] = useState(1);
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [statusFilter, setStatusFilter] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['salaries', page, monthFilter, yearFilter, statusFilter],
    queryFn: () => salaryApi.list({ page, pageSize: 15, month: monthFilter || undefined, year: yearFilter || undefined, status: statusFilter || undefined }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => usersApi.list({ pageSize: 100 }),
    enabled: isAdmin,
  });
  const adminUsers = usersData?.data?.data || [];

  const salaries = data?.data?.data || [];
  const meta = data?.data?.meta;

  const { register: regGen, handleSubmit: handleGen, control, watch, reset: resetGen } = useForm({
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      projectId: '',
      entries: [] as { userId: string; basicSalary: number; allowances: number; deductions: number }[],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });
  const genProjectId = watch('projectId');

  const { data: projectDetailData } = useQuery({
    queryKey: ['project-members-for-salary', genProjectId],
    queryFn: () => projectsApi.get(genProjectId),
    enabled: !!genProjectId,
  });
  const projectStaff = (projectDetailData?.data?.data?.ProjectMember || []).map((m: any) => m.User);
  const staffOptions = isAdmin ? adminUsers : projectStaff;

  const { register: regPay, handleSubmit: handlePaySub, reset: resetPay } = useForm();

  const generateMutation = useMutation({
    mutationFn: (d: object) => salaryApi.generate(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salaries'] }); toast.success('Salaries generated!'); setShowGenerate(false); resetGen(); },
    onError: (e) => toast.error(formatError(e)),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => salaryApi.processPayment(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salaries'] }); toast.success('Payment processed!'); setPayId(null); resetPay(); },
    onError: (e) => toast.error(formatError(e)),
  });

  const totalSalaries = Array.isArray(salaries) ? salaries.reduce((sum: number, s: { netSalary: number }) => sum + Number(s.netSalary || 0), 0) : 0;
  const paidCount = Array.isArray(salaries) ? salaries.filter((s: { status: string }) => s.status === 'PAID').length : 0;
  const pendingCount = Array.isArray(salaries) ? salaries.filter((s: { status: string }) => s.status === 'PENDING').length : 0;

  const watchedEntries = watch('entries') || [];

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowGenerate(true)} className="btn-primary w-full sm:w-auto">
          <HiOutlinePlus className="w-4 h-4" /> Generate Staff Salaries
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-5 text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">₹{(totalSalaries/100000).toFixed(1)}L</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Total Payroll</div>
        </div>
        <div className="card p-3 sm:p-5 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{paidCount}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Paid</div>
        </div>
        <div className="card p-3 sm:p-5 text-center">
          <div className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <select className="select w-full sm:w-36" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="select w-full sm:w-28" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="select w-full sm:w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSED">Processed</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          <div className="hidden sm:block table-container">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Employee</th><th>Project</th><th>Month/Year</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net Salary</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {Array.isArray(salaries) && salaries.map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <div className="font-medium text-sm text-gray-900 dark:text-white whitespace-nowrap">
                          {s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}
                        </div>
                        <div className="text-xs text-gray-400">{s.user?.role?.replace(/_/g,' ')}</div>
                      </td>
                      <td className="text-xs text-gray-500 whitespace-nowrap">{s.project?.name || '—'}</td>
                      <td className="text-sm whitespace-nowrap">{MONTHS[s.month - 1]} {s.year}</td>
                      <td className="text-sm font-medium whitespace-nowrap">₹{Number(s.basicSalary).toLocaleString('en-IN')}</td>
                      <td className="text-sm text-green-600 whitespace-nowrap">+₹{Number(s.allowances).toLocaleString('en-IN')}</td>
                      <td className="text-sm text-red-500 whitespace-nowrap">-₹{Number(s.deductions).toLocaleString('en-IN')}</td>
                      <td className="font-bold text-gray-900 dark:text-white whitespace-nowrap">₹{Number(s.netSalary).toLocaleString('en-IN')}</td>
                      <td className="whitespace-nowrap">{statusBadge(s.status)}</td>
                      <td className="whitespace-nowrap">
                        {s.status !== 'PAID' && (
                          <button onClick={() => setPayId(s.id)}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                            <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Pay
                          </button>
                        )}
                        {s.status === 'PAID' && s.paidAt && (
                          <span className="text-xs text-gray-400">{new Date(s.paidAt).toLocaleDateString('en-IN')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!salaries || salaries.length === 0) && (
                    <tr><td colSpan={9}><EmptyState icon={<HiOutlineBanknotes className="w-8 h-8" />} title="No salary records" description="Generate salaries for the selected period." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {Array.isArray(salaries) && salaries.length > 0 ? salaries.map((s: any) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.user?.role?.replace(/_/g,' ')} · {s.project?.name || '—'}
                    </div>
                  </div>
                  <div className="flex-shrink-0">{statusBadge(s.status)}</div>
                </div>
                <div className="text-xs text-gray-400 mt-2">{MONTHS[s.month - 1]} {s.year}</div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Basic</div>
                    <div className="text-gray-700 dark:text-gray-300 font-medium">₹{Number(s.basicSalary).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Allowances</div>
                    <div className="text-green-600 font-medium">+₹{Number(s.allowances).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Deductions</div>
                    <div className="text-red-500 font-medium">-₹{Number(s.deductions).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-xs text-gray-400">Net Salary</div>
                    <div className="font-bold text-gray-900 dark:text-white">₹{Number(s.netSalary).toLocaleString('en-IN')}</div>
                  </div>
                  {s.status !== 'PAID' ? (
                    <button onClick={() => setPayId(s.id)} className="btn-secondary text-xs py-1.5 px-3 text-green-600">
                      <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Pay
                    </button>
                  ) : s.paidAt ? (
                    <span className="text-xs text-gray-400">Paid {new Date(s.paidAt).toLocaleDateString('en-IN')}</span>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineBanknotes className="w-8 h-8" />} title="No salary records" description="Generate salaries for the selected period." />
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

      {/* Generate Salaries Modal — staff (Users) only now, workers pay
          automatically from the Worker Wages tab instead */}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Staff Salaries" size="xl">
        <form onSubmit={handleGen(d => generateMutation.mutate(d))} className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Project" required>
              <select {...regGen('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {Array.isArray(projects) && projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Month" required>
              <select {...regGen('month', { required: true })} className="select">
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Year" required>
              <input {...regGen('year', { required: true })} type="number" className="input" defaultValue={new Date().getFullYear()} />
            </FormField>
          </div>

          {!genProjectId && (
            <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-center">
              Select a project to load its staff.
            </div>
          )}

          {genProjectId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Salary Entries</h3>
                <button type="button" onClick={() => append({ userId: '', basicSalary: 0, allowances: 0, deductions: 0 })}
                  className="text-xs text-primary-600 hover:underline">+ Add Staff</button>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  Click "+ Add Staff" to add salary entries
                </div>
              )}

              <div className="space-y-2 sm:space-y-3">
                {fields.length > 0 && (
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-3">
                    <span className="col-span-3">Person</span>
                    <span className="col-span-2">Basic</span>
                    <span className="col-span-2">Allowances</span>
                    <span className="col-span-2">Deductions</span>
                    <span className="col-span-2">Net</span>
                    <span className="col-span-1"></span>
                  </div>
                )}

                {fields.map((field, i) => {
                  const entry: any = watchedEntries[i] || {};
                  const net = Number(entry.basicSalary || 0) + Number(entry.allowances || 0) - Number(entry.deductions || 0);
                  return (
                    <div key={field.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
                      <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <select {...regGen(`entries.${i}.userId`)} className="select text-xs py-1.5">
                            <option value="">Select Staff</option>
                            {Array.isArray(staffOptions) && staffOptions.map((u: { id: string; firstName: string; lastName: string }) => (
                              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input {...regGen(`entries.${i}.basicSalary`, { min: 0 })} type="number" className="input text-xs py-1.5" placeholder="Basic" />
                        </div>
                        <div className="col-span-2">
                          <input {...regGen(`entries.${i}.allowances`)} type="number" className="input text-xs py-1.5" placeholder="Allow." />
                        </div>
                        <div className="col-span-2">
                          <input {...regGen(`entries.${i}.deductions`)} type="number" className="input text-xs py-1.5" placeholder="Deduct." />
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">₹{net.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      </div>

                      <div className="sm:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Staff {i + 1}</span>
                          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs">✕ Remove</button>
                        </div>
                        <select {...regGen(`entries.${i}.userId`)} className="select text-xs w-full">
                          <option value="">Select Staff</option>
                          {Array.isArray(staffOptions) && staffOptions.map((u: { id: string; firstName: string; lastName: string }) => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Basic</label>
                            <input {...regGen(`entries.${i}.basicSalary`, { min: 0 })} type="number" className="input text-xs py-1.5 w-full" placeholder="0" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Allow.</label>
                            <input {...regGen(`entries.${i}.allowances`)} type="number" className="input text-xs py-1.5 w-full" placeholder="0" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Deduct.</label>
                            <input {...regGen(`entries.${i}.deductions`)} type="number" className="input text-xs py-1.5 w-full" placeholder="0" />
                          </div>
                        </div>
                        <div className="text-right text-xs font-bold text-gray-900 dark:text-white">
                          Net: ₹{net.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {fields.length > 0 && (
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total Payroll</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      ₹{watchedEntries.reduce((sum: number, e: { basicSalary: number; allowances: number; deductions: number }) =>
                        sum + Number(e.basicSalary || 0) + Number(e.allowances || 0) - Number(e.deductions || 0), 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowGenerate(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={generateMutation.isPending || fields.length === 0 || !genProjectId} className="btn-primary w-full sm:w-auto">
              {generateMutation.isPending ? 'Generating...' : `Generate ${fields.length} Salaries`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Process Payment Modal */}
      <Modal isOpen={!!payId} onClose={() => setPayId(null)} title="Process Payment" size="sm">
        <form onSubmit={handlePaySub(d => payId && payMutation.mutate({ id: payId, data: d }))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Payment Mode" required>
            <select {...regPay('paymentMode', { required: true })} className="select">
              <option value="">Select Mode</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="UPI">UPI</option>
            </select>
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setPayId(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={payMutation.isPending} className="btn-primary w-full sm:w-auto">
              {payMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// WORKER WAGES — automatic ledger, driven by Attendance (from Labour page
// or Daily Reports). No manual entry — just view pending/paid and settle.
// ══════════════════════════════════════════════════════════════════════════

const WorkerWagesTab: React.FC<{ projects: any[] }> = ({ projects }) => {
  const [projectFilter, setProjectFilter] = useState('');
  const [payWorker, setPayWorker] = useState<any>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['worker-salary-summary', projectFilter],
    queryFn: () => salaryApi.getWorkerSummary({ projectId: projectFilter || undefined }),
  });
  const workers = data?.data?.data || [];

  const totalPending = workers.reduce((sum: number, w: any) => sum + Math.max(0, w.pending), 0);
  const totalPaid = workers.reduce((sum: number, w: any) => sum + w.totalPaid, 0);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { projectId: '', amount: '', date: '' },
  });

  const openPay = (w: any) => {
    // If the worker's pending is scoped to a single project already
    // (projectFilter set), pre-select it; otherwise default to their home
    // project since payment must be recorded against one specific project.
    reset({ projectId: projectFilter || w.project?.id || '', amount: Math.max(0, w.pending).toFixed(2), date: '' });
    setPayWorker(w);
  };

  const payMutation = useMutation({
    mutationFn: (d: { workerId: string; projectId: string; amount: number; date?: string }) => salaryApi.payWorker(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-salary-summary'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Wage payment recorded!');
      setPayWorker(null);
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to record payment'),
  });

  const onSubmitPay = (d: any) => {
    if (!payWorker) return;
    payMutation.mutate({
      workerId: payWorker.workerId,
      projectId: d.projectId,
      amount: Number(d.amount),
      date: d.date || undefined,
    });
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-5 text-center">
          <div className="text-lg sm:text-2xl font-bold text-amber-600">₹{totalPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Total Pending</div>
        </div>
        <div className="card p-3 sm:p-5 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Total Paid</div>
        </div>
      </div>

      <select className="select w-full sm:w-64" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
        <option value="">All Projects</option>
        {Array.isArray(projects) && projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <p className="text-xs text-gray-400 -mt-2">
        Calculated automatically from marked attendance (Labour page or Daily Reports) × each worker's daily wage. No manual entry needed here — just settle what's owed.
      </p>

      {isLoading ? <LoadingSpinner className="py-12" /> : workers.length === 0 ? (
        <div className="card">
          <EmptyState icon={<HiOutlineUserGroup className="w-8 h-8" />} title="No wage activity yet" description="Once attendance is marked for workers, their earned wages will appear here." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w: any) => (
            <div key={w.workerId} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{w.name}</div>
                  <div className="text-xs text-gray-400 truncate">{w.skill} · {w.project?.name || '—'}</div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">₹{w.dailyWage}/day</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <div className="text-gray-400">Earned</div>
                  <div className="font-semibold text-gray-900 dark:text-white">₹{w.totalEarned.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-gray-400">Paid</div>
                  <div className="font-semibold text-green-600">₹{w.totalPaid.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-gray-400">Pending</div>
                  <div className={`font-semibold ${w.pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>₹{w.pending.toLocaleString('en-IN')}</div>
                </div>
              </div>
              {w.pending > 0 && (
                <button onClick={() => openPay(w)} className="btn-primary w-full justify-center text-xs py-1.5 mt-3">
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Pay Worker
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pay Worker Modal */}
      <Modal isOpen={!!payWorker} onClose={() => setPayWorker(null)} title={`Pay ${payWorker?.name || ''}`} size="sm">
        <form onSubmit={handleSubmit(onSubmitPay)} className="p-4 sm:p-6 space-y-4">
          <FormField label="Project" required>
            <select {...register('projectId', { required: true })} className="select">
              <option value="">Select Project</option>
              {Array.isArray(projects) && projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <p className="text-sm text-gray-500">
            Pending balance: <span className="font-bold text-amber-600">₹{payWorker ? Math.max(0, payWorker.pending).toLocaleString('en-IN') : 0}</span>
          </p>
          <FormField label="Amount Paid (₹)" required>
            <input type="number" step="0.01" {...register('amount', { required: true, min: 0.01 })} className="input" placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">Auto-filled with the full pending balance — edit if paying a partial amount.</p>
          </FormField>
          <FormField label="Payment Date (Optional)">
            <input
              type="date"
              {...register('date', { validate: (v) => !v || new Date(v) <= new Date() || 'Payment date cannot be in the future' })}
              max={todayDateStr()}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to use today's date.</p>
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setPayWorker(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={payMutation.isPending} className="btn-primary w-full sm:w-auto">
              {payMutation.isPending ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default SalaryPage;