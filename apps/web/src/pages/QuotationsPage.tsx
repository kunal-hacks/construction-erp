import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationsApi, vendorsApi, inventoryApi, projectsApi } from '../api/services';
import { PageHeader, Modal, FormField, Pagination, LoadingSpinner, EmptyState, Badge } from '../components/common';
import { useForm, useFieldArray } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineReceiptPercent, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi2';

// ── Isolated vendor form ──────────────────────────────────────────────────
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
    <form
      onSubmit={handleSubmit((d: any) =>
        createVendorMutation.mutate({ name: d.vendorName, phone: d.vendorPhone })
      )}
      className="p-4 sm:p-6 space-y-4"
    >
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const QuotationsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [vendorFilter, setVendorFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<any>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page, vendorFilter],
    queryFn: () => quotationsApi.list({ page, pageSize: 15, vendorId: vendorFilter || undefined }),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-select'],
    queryFn: () => vendorsApi.list({ pageSize: 100 }),
  });

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.getMaterials({ pageSize: 200 }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-select'],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const quotations = data?.data?.data || [];
  const meta = data?.data?.meta;
  const vendors = vendorsData?.data?.data || [];
  // Handle common response shapes for materials list
  const materials =
    materialsData?.data?.data?.materials ||
    materialsData?.data?.data ||
    materialsData?.data ||
    [];
  const projects = projectsData?.data?.data || [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      vendorId: '',
      projectId: '',
      validUntil: '',
      notes: '',
      items: [{ materialId: '', quantity: 1, rate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const totalAmount = (watchedItems || []).reduce(
    (s: number, i: any) => s + Number(i.quantity || 0) * Number(i.rate || 0),
    0
  );

  const createMutation = useMutation({
    mutationFn: (d: object) => quotationsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation created!');
      setShowCreate(false);
      reset();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const onCreateSubmit = (data: any) => {
    const validItems = (data.items || []).filter(
      (i: any) => i.materialId && Number(i.quantity) > 0
    );

    if (validItems.length === 0) {
      toast.error('Add at least one material with quantity');
      return;
    }

    const items = validItems.map((i: any) => {
      const qty = Number(i.quantity);
      const rate = Number(i.rate) || 0;
      return {
        materialId: i.materialId,
        quantity: qty,
        rate,
        unitPrice: rate,
        totalAmount: qty * rate,
      };
    });

    const payload = {
      vendorId: data.vendorId,
      projectId: data.projectId,
      validUntil: data.validUntil,
      notes: data.notes || undefined,
      items,
      totalAmount: items.reduce((s: number, i: any) => s + i.totalAmount, 0),
    };

    createMutation.mutate(payload);
  };

  const formatDate = (val: string) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  const isExpired = (val: string) => !!val && new Date(val) < new Date();

  const closeCreate = () => {
    setShowCreate(false);
    reset();
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Quotation Management"
        subtitle="Vendor quotations and rate comparisons"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Quotation
          </button>
        }
      />

      <div className="flex gap-3">
        <select
          className="select w-full sm:w-52"
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Vendors</option>
          {vendors.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Vendor</th>
                  <th>Items Quoted</th>
                  <th>Total Amount</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(quotations) &&
                  quotations.map((q: any) => (
                    <tr key={q.id}>
                      <td>
                        <div className="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm">
                          {q.quotationNo}
                        </div>
                        <div className="text-xs text-gray-400">{formatDate(q.createdAt)}</div>
                      </td>
                      <td className="text-sm font-medium">{q.vendor?.name || q.Vendor?.name}</td>
                      <td className="max-w-[200px]">
                        {(q.items || []).length > 0 ? (
                          <div className="space-y-0.5">
                            {(q.items || []).slice(0, 3).map((item: any, i: number) => (
                              <div
                                key={i}
                                className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                                <span className="truncate">
                                  {item.material?.name || item.Material?.name || '—'}
                                </span>
                                <span className="text-gray-400 flex-shrink-0">×{item.quantity}</span>
                              </div>
                            ))}
                            {(q.items || []).length > 3 && (
                              <div className="text-xs text-gray-400">
                                +{(q.items || []).length - 3} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No items</span>
                        )}
                      </td>
                      <td className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        ₹{Number(q.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        <span className={isExpired(q.validUntil) ? 'text-red-500' : 'text-gray-500'}>
                          {formatDate(q.validUntil)}
                          {isExpired(q.validUntil) && ' (Expired)'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <Badge variant={STATUS_COLORS[q.status] as any}>{q.status}</Badge>
                      </td>
                      <td>
                        <button
                          onClick={() => setViewQuotation(q)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                        >
                          <HiOutlineEye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {(!quotations || quotations.length === 0) && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={<HiOutlineReceiptPercent className="w-8 h-8" />}
                        title="No quotations"
                        description="Create quotations to compare vendor rates."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {Array.isArray(quotations) && quotations.length > 0 ? (
              quotations.map((q: any) => (
                <div key={q.id} className="card p-4" onClick={() => setViewQuotation(q)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm">
                        {q.quotationNo}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatDate(q.createdAt)}</div>
                    </div>
                    <Badge variant={STATUS_COLORS[q.status] as any}>{q.status}</Badge>
                  </div>

                  <div className="mt-2 text-xs">
                    <div className="text-gray-400">Vendor</div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {q.vendor?.name || q.Vendor?.name || '—'}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1">Items</div>
                    {(q.items || []).length > 0 ? (
                      <div className="space-y-0.5">
                        {(q.items || []).slice(0, 2).map((item: any, i: number) => (
                          <div
                            key={i}
                            className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                            <span className="truncate">
                              {item.material?.name || item.Material?.name || '—'}
                            </span>
                            <span className="text-gray-400 flex-shrink-0">×{item.quantity}</span>
                          </div>
                        ))}
                        {(q.items || []).length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{(q.items || []).length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No items</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <div className="text-xs text-gray-400">Total</div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        ₹{Number(q.totalAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Valid Until</div>
                      <div
                        className={`text-xs font-medium ${
                          isExpired(q.validUntil)
                            ? 'text-red-500'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {formatDate(q.validUntil)}
                        {isExpired(q.validUntil) && ' (Expired)'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewQuotation(q);
                      }}
                      className="btn-secondary w-full justify-center text-xs py-1.5"
                    >
                      <HiOutlineEye className="w-3.5 h-3.5" /> View Details
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="card">
                <EmptyState
                  icon={<HiOutlineReceiptPercent className="w-8 h-8" />}
                  title="No quotations"
                  description="Create quotations to compare vendor rates."
                />
              </div>
            )}
          </div>

          {meta && (
            <div className="card overflow-hidden">
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={meta.pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={closeCreate} title="Create Quotation" size="xl">
        <form onSubmit={handleSubmit(onCreateSubmit)} className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Vendor" required>
              <div className="flex gap-2">
                <select {...register('vendorId', { required: true })} className="select flex-1">
                  <option value="">Select Vendor</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowVendorModal(true)}
                  className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0"
                >
                  + Add
                </button>
              </div>
              {errors.vendorId && (
                <p className="text-xs text-red-500 mt-1">Vendor is required</p>
              )}
            </FormField>

            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.projectId && (
                <p className="text-xs text-red-500 mt-1">Project is required</p>
              )}
            </FormField>

            <FormField label="Valid Until" required>
              <input
                {...register('validUntil', { required: true })}
                type="date"
                className="input"
              />
              {errors.validUntil && (
                <p className="text-xs text-red-500 mt-1">Valid until is required</p>
              )}
            </FormField>

            <FormField label="Notes">
              <input {...register('notes')} className="input" placeholder="Terms and conditions..." />
            </FormField>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Quoted Items</h3>
              <button
                type="button"
                onClick={() => append({ materialId: '', quantity: 1, rate: 0 })}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <HiOutlinePlus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {materials.length === 0 && (
              <p className="text-xs text-amber-600 mb-2">
                No materials loaded. Check that materials exist in Inventory.
              </p>
            )}

            <div className="space-y-2">
              {/* Column headers — desktop only */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
                <span className="col-span-6">Material</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-3">Rate (₹)</span>
                <span className="col-span-1"></span>
              </div>

              {fields.map((field, i) => {
                const item = watchedItems?.[i] || { quantity: 0, rate: 0 };
                const lineTotal = Number(item.quantity || 0) * Number(item.rate || 0);
                const selectedMat = materials.find((m: any) => m.id === (item as any).materialId);

                return (
                  <div key={field.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                    {/* Desktop: single grid row */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select
                          {...register(`items.${i}.materialId`, { required: 'Material required' })}
                          className="select text-xs py-1.5"
                        >
                          <option value="">— Select Material —</option>
                          {materials.map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                              {m.unit ? ` (${m.unit})` : ''}
                            </option>
                          ))}
                        </select>
                        {selectedMat && (
                          <div className="text-xs text-primary-600 mt-0.5 px-1">
                            {selectedMat.category}
                          </div>
                        )}
                        {(errors.items as any)?.[i]?.materialId && (
                          <p className="text-xs text-red-500 mt-0.5">Select a material</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input
                          {...register(`items.${i}.quantity`, {
                            required: true,
                            min: { value: 0.01, message: 'Min 0.01' },
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          className="input text-xs py-1.5"
                          placeholder="10"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          {...register(`items.${i}.rate`, {
                            min: 0,
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          className="input text-xs py-1.5"
                          placeholder="370"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            className="p-1 text-red-400 hover:text-red-600"
                          >
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {lineTotal > 0 && (
                        <div className="col-span-12 text-right text-xs text-gray-500 px-1">
                          Line Total:{' '}
                          <span className="font-bold text-gray-900 dark:text-white">
                            ₹{lineTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Mobile: stacked labeled fields */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Item {i + 1}</span>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            className="p-1 text-red-400 hover:text-red-600"
                          >
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <select
                        {...register(`items.${i}.materialId`, { required: 'Material required' })}
                        className="select text-xs w-full"
                      >
                        <option value="">— Select Material —</option>
                        {materials.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {m.unit ? ` (${m.unit})` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedMat && (
                        <div className="text-xs text-primary-600 px-1">{selectedMat.category}</div>
                      )}
                      {(errors.items as any)?.[i]?.materialId && (
                        <p className="text-xs text-red-500">Select a material</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Qty</label>
                          <input
                            {...register(`items.${i}.quantity`, {
                              required: true,
                              min: { value: 0.01, message: 'Min 0.01' },
                              valueAsNumber: true,
                            })}
                            type="number"
                            step="0.01"
                            className="input text-xs py-1.5 w-full"
                            placeholder="10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Rate (₹)</label>
                          <input
                            {...register(`items.${i}.rate`, {
                              min: 0,
                              valueAsNumber: true,
                            })}
                            type="number"
                            step="0.01"
                            className="input text-xs py-1.5 w-full"
                            placeholder="370"
                          />
                        </div>
                      </div>
                      {lineTotal > 0 && (
                        <div className="text-right text-xs font-bold text-gray-900 dark:text-white">
                          Line Total: ₹{lineTotal.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalAmount > 0 && (
              <div className="flex justify-end mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total Amount</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={closeCreate} className="btn-secondary w-full sm:w-auto">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary w-full sm:w-auto"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={!!viewQuotation}
        onClose={() => setViewQuotation(null)}
        title={`Quotation: ${viewQuotation?.quotationNo}`}
        size="lg"
      >
        {viewQuotation && (
          <div className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['Vendor', viewQuotation.vendor?.name || viewQuotation.Vendor?.name],
                ['Project', viewQuotation.project?.name || viewQuotation.Project?.name || '—'],
                ['Valid Until', formatDate(viewQuotation.validUntil)],
                ['Total', `₹${Number(viewQuotation.totalAmount || 0).toLocaleString('en-IN')}`],
                ['Status', viewQuotation.status],
                ['Notes', viewQuotation.notes || '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="min-w-0">
                  <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {String(v ?? '—')}
                  </div>
                </div>
              ))}
            </div>

            {(viewQuotation.items || []).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Quoted Items</div>
                <div className="overflow-x-auto">
                  <table className="table text-xs min-w-[440px]">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Rate (₹)</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewQuotation.items || []).map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium whitespace-nowrap">
                            {item.material?.name || item.Material?.name || '—'}
                          </td>
                          <td className="whitespace-nowrap">
                            {item.material?.unit || item.Material?.unit || '—'}
                          </td>
                          <td className="whitespace-nowrap">{Number(item.quantity).toFixed(2)}</td>
                          <td className="whitespace-nowrap">
                            ₹{Number(item.rate || item.unitPrice || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="font-bold whitespace-nowrap">
                            ₹
                            {Number(item.totalAmount || item.totalPrice || 0).toLocaleString(
                              'en-IN'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        title="Add New Vendor"
        size="md"
      >
        <AddVendorForm
          onClose={() => setShowVendorModal(false)}
          onSuccess={(vendorId) => setValue('vendorId', vendorId)}
        />
      </Modal>
    </div>
  );
};

export default QuotationsPage;