import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { truckEntriesApi, projectsApi, vendorsApi } from '../api/services';
import {
  PageHeader, Modal, FormField, SearchInput, Pagination,
  LoadingSpinner, EmptyState, ConfirmDialog
} from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTruck, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2';

// Used to cap any date/datetime input at "now" — entries are only made on
// or after work/payment completion, never for a future date.
const todayDateStr = () => new Date().toISOString().split('T')[0];
const nowDateTimeStr = () => new Date().toISOString().slice(0, 16);

interface AddVendorFormProps {
  onClose: () => void;
  onSuccess: (vendorId: string) => void;
}

const AddVendorForm: React.FC<AddVendorFormProps> = ({ onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createVendorMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string }) => vendorsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['vendors-select'] });
      toast.success('Vendor added!');
      const newId = res.data?.data?.id || res.data?.id;
      onSuccess(newId);
      onClose();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to add vendor'),
  });

  return (
    <form onSubmit={handleSubmit((d: any) => createVendorMutation.mutate({ name: d.vendorName, phone: d.vendorPhone }))} className="p-4 sm:p-6 space-y-4">
      <FormField label="Vendor Name" required>
        <input {...register('vendorName', { required: true })} className="input" placeholder="Company or Vendor Name" />
      </FormField>
      <FormField label="Phone Number">
        <input {...register('vendorPhone')} className="input" placeholder="9876543210" />
      </FormField>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
        <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="submit" disabled={createVendorMutation.isPending} className="btn-primary w-full sm:w-auto">
          {createVendorMutation.isPending ? 'Adding...' : 'Add Vendor'}
        </button>
      </div>
    </form>
  );
};

const TruckEntriesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['truck-entries', page, projectFilter, search, dateFrom, dateTo],
    queryFn: () => truckEntriesApi.list({
      page, pageSize: 15,
      projectId: projectFilter || undefined,
      vehicleNo: search || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['truck-summary', projectFilter],
    queryFn: () => truckEntriesApi.getSummary({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors-select'], queryFn: () => vendorsApi.list({ pageSize: 100 }) });

  const entries = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];
  const vendors = vendorsData?.data?.data || [];
  const summary = summaryData?.data?.data?.summary || summaryData?.data?.data;
  const costInfo = summaryData?.data?.data?.costInfo || { totalCost: 0, transferred: 0, pending: 0 };

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const isEditing = !!editingEntry;

  const {
    register: regTransfer, handleSubmit: handleTransferSub, reset: resetTransfer,
    watch: watchTransfer, setValue: setTransferValue,
    formState: { errors: transferErrors },
  } = useForm({
    defaultValues: { projectId: projectFilter || '', amount: '', date: '' },
  });

  const transferProjectId = watchTransfer('projectId');

  // Fetches pending balance for whichever project is picked inside the
  // transfer modal — independent of the page's own project filter, since
  // someone can open "Record Payment" from the all-projects view and pick
  // any project they have access to.
  const { data: transferSummaryData } = useQuery({
    queryKey: ['truck-summary-for-transfer', transferProjectId],
    queryFn: () => truckEntriesApi.getSummary({ projectId: transferProjectId }),
    enabled: !!transferProjectId,
  });
  const transferPending = transferSummaryData?.data?.data?.costInfo?.pending ?? 0;

  // Auto-fills the amount field with the pending balance whenever the
  // selected project (or its fetched balance) changes — still freely
  // editable by the user afterward for partial payments.
  useEffect(() => {
    if (transferProjectId && transferSummaryData) {
      setTransferValue('amount', transferPending > 0 ? transferPending : '');
    }
  }, [transferProjectId, transferSummaryData]);

  const saveMutation = useMutation({
    mutationFn: (formData: any) => {
      const payload = {
        projectId: formData.projectId,
        vehicleNo: formData.vehicleNo,
        driverName: formData.driverName,
        material: formData.material,
        netWeight: Number(formData.netWeight) / 1000, // form is in kg, backend stores tonnes
        vendorId: formData.vendorId || null,
        entryTime: formData.entryTime || new Date().toISOString(),
        exitTime: formData.exitTime || null,
        slipNo: formData.slipNo || null,
        notes: formData.notes || null,
        ratePerTrip: formData.ratePerTrip !== '' ? Number(formData.ratePerTrip) : null,
      };
      return isEditing
        ? truckEntriesApi.update(editingEntry.id, payload)
        : truckEntriesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-entries'] });
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      toast.success(isEditing ? 'Entry updated!' : 'Entry recorded!');
      setShowCreate(false); setEditingEntry(null); reset();
    },
    onError: (e: any) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => truckEntriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-entries'] });
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      toast.success('Entry deleted');
      setDeleteId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const transferMutation = useMutation({
    mutationFn: (data: { projectId: string; amount: number; date?: string }) => truckEntriesApi.transferToExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      qc.invalidateQueries({ queryKey: ['truck-summary-for-transfer'] });
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

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setValue('projectId', entry.projectId);
    setValue('vehicleNo', entry.vehicleNo);
    setValue('driverName', entry.driverName);
    setValue('material', entry.material);
    setValue('vendorId', entry.vendorId || '');
    setValue('netWeight', Number(entry.netWeight) * 1000); // tonnes stored → show as kg in form
    setValue('slipNo', entry.slipNo || '');
    setValue('notes', entry.notes || '');
    setValue('ratePerTrip', entry.ratePerTrip ?? '');
    if (entry.entryTime) {
      setValue('entryTime', new Date(entry.entryTime).toISOString().slice(0, 16));
    }
    setShowCreate(true);
  };

  const formatEntryTime = (entryTime: string) => {
    if (!entryTime) return '—';
    const d = new Date(entryTime);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Truck Entry Management"
        subtitle="Vehicle weighment, material delivery and trip cost tracking"
        action={
          <button onClick={() => { setEditingEntry(null); setShowCreate(true); }} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Entry
          </button>
        }
      />

      {/* Summary Cards — Total Trips, Net Weight, Pending (clickable), Paid Till Now */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">🚚</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{summary?._count?.id || 0}</div>
            <div className="text-xs text-gray-500 truncate">Total Trips</div>
          </div>
        </div>

        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">✅</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{Number(summary?._sum?.netWeight || 0).toFixed(1)} MT</div>
            <div className="text-xs text-gray-500 truncate">Net Weight</div>
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search vehicle number..." className="flex-1 sm:min-w-60" />
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
                    <th>Entry Time</th><th>Vehicle No</th><th>Driver</th><th>Material</th>
                    <th>Vendor</th><th>Net Weight</th><th>Rate</th><th>Project</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">{formatEntryTime(e.entryTime)}</td>
                      <td className="font-mono font-bold whitespace-nowrap">{e.vehicleNo}</td>
                      <td className="whitespace-nowrap">{e.driverName}</td>
                      <td className="whitespace-nowrap">{e.material || '—'}</td>
                      <td className="whitespace-nowrap">{e.Vendor?.name || e.vendor?.name || '—'}</td>
                      <td className="font-bold text-green-600 whitespace-nowrap">{Number(e.netWeight).toFixed(2)} MT</td>
                      <td className="text-sm whitespace-nowrap">{e.ratePerTrip ? `₹${Number(e.ratePerTrip).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{e.Project?.name || e.project?.name}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(e)} className="icon-button text-amber-600" title="Edit">
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(e.id)} className="icon-button text-red-500" title="Delete">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={9} className="py-12 text-center">
                      <EmptyState icon={<HiOutlineTruck className="w-10 h-10" />} title="No truck entries" description="Record your first weighment" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {entries.length > 0 ? entries.map((e: any) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">{e.vehicleNo}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatEntryTime(e.entryTime)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-600 text-sm">{Number(e.netWeight).toFixed(2)} MT</div>
                    <div className="text-xs text-gray-400">net weight</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Driver</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{e.driverName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Material</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{e.material || '—'}</div>
                  </div>
                </div>

                {e.ratePerTrip && (
                  <div className="mt-2 text-xs text-gray-500">
                    Rate: <span className="font-medium text-gray-700 dark:text-gray-300">₹{Number(e.ratePerTrip).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1 truncate">
                  📁 {e.Project?.name || e.project?.name || '—'}
                  {(e.Vendor?.name || e.vendor?.name) && <> · {e.Vendor?.name || e.vendor?.name}</>}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <button onClick={() => handleEdit(e)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-amber-600">
                    <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeleteId(e.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-red-500">
                    <HiOutlineTrash className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineTruck className="w-10 h-10" />} title="No truck entries" description="Record your first weighment" />
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

      {/* Create / Edit Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditingEntry(null); reset(); }}
        title={isEditing ? 'Edit Truck Entry' : 'New Truck Entry'} size="lg">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>

            <FormField label="Entry Time" required>
              <input
                type="datetime-local"
                {...register('entryTime', {
                  required: true,
                  validate: (v) => !v || new Date(v) <= new Date() || 'Entry time cannot be in the future',
                })}
                max={nowDateTimeStr()}
                defaultValue={nowDateTimeStr()}
                className="input"
              />
              {errors.entryTime && <p className="text-xs text-red-500 mt-1">{errors.entryTime.message as string}</p>}
            </FormField>

            <FormField label="Vehicle Number" required>
              <input
                {...register('vehicleNo', { required: true })}
                className="input uppercase"
                placeholder="PB10-CE-3456"
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  let formatted = raw;
                  if (raw.length > 4) formatted = raw.slice(0, 4) + '-' + raw.slice(4);
                  if (raw.length > 6) formatted = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 10);
                  setValue('vehicleNo', formatted);
                }}
              />
            </FormField>

            <FormField label="Driver Name" required>
              <input {...register('driverName', { required: true })} className="input" placeholder="Driver Name" />
            </FormField>

            <FormField label="Material" required>
              <input {...register('material', { required: true })} className="input" placeholder="e.g. Sand, Cement, Gravel" />
            </FormField>

            <FormField label="Slip No">
              <input {...register('slipNo')} className="input" placeholder="WB-001" />
            </FormField>

            <FormField label="Vendor">
              <div className="flex gap-2">
                <select {...register('vendorId')} className="select flex-1">
                  <option value="">Select Vendor</option>
                  {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowVendorModal(true)} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                  + Add
                </button>
              </div>
            </FormField>

            <FormField label="Rate per Trip (₹)">
              <input type="number" step="0.01" {...register('ratePerTrip')} className="input" placeholder="3000" />
            </FormField>

            <FormField label="Exit Time">
              <input
                type="datetime-local"
                {...register('exitTime', {
                  validate: (v) => !v || new Date(v) <= new Date() || 'Exit time cannot be in the future',
                })}
                max={nowDateTimeStr()}
                className="input"
              />
              {errors.exitTime && <p className="text-xs text-red-500 mt-1">{errors.exitTime.message as string}</p>}
            </FormField>

            <FormField label="Net Weight (kg)" required className="sm:col-span-2">
              <input type="number" step="1" {...register('netWeight', { required: true, min: 1 })} className="input" placeholder="18300" />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea {...register('notes')} className="input" rows={2} placeholder="Optional notes..." />
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <button type="button" onClick={() => { setShowCreate(false); setEditingEntry(null); reset(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full sm:w-auto sm:min-w-[140px]">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal isOpen={showVendorModal} onClose={() => setShowVendorModal(false)} title="Add New Vendor" size="md">
        <AddVendorForm onClose={() => setShowVendorModal(false)} onSuccess={(vendorId) => setValue('vendorId', vendorId)} />
      </Modal>

      {/* Record Payment Modal — project + amount required, amount auto-fills
          to the selected project's pending balance but stays freely
          editable; date optional and capped at today. */}
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
            <p className="text-xs text-gray-400 mt-1">Leave blank to use today's date. Set this if you're logging a payment made earlier.</p>
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
        title="Delete Truck Entry" message="Are you sure you want to delete this entry? This cannot be undone."
        confirmLabel="Delete" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default TruckEntriesPage;