import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi, projectsApi, vendorsApi, inventoryApi } from '../api/services';
import { PageHeader, Modal, FormField, Pagination, LoadingSpinner, EmptyState, ConfirmDialog, Badge } from '../components/common';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineShoppingCart, HiOutlineEye, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineTrash } from 'react-icons/hi2';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'neutral', SUBMITTED: 'info', APPROVED: 'success', REJECTED: 'danger',
  PARTIALLY_RECEIVED: 'warning', RECEIVED: 'success', CANCELLED: 'danger',
};

const PurchaseOrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewPO, setViewPO] = useState<any>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, statusFilter, projectFilter],
    queryFn: () => purchaseOrdersApi.list({ page, pageSize: 15, status: statusFilter || undefined, projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors-select'], queryFn: () => vendorsApi.list({ pageSize: 100 }) });
  const { data: materialsData } = useQuery({ queryKey: ['materials'], queryFn: () => inventoryApi.getMaterials({ pageSize: 200 }) });

  const orders = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];
  const vendors = vendorsData?.data?.data || [];
  const materials = materialsData?.data?.data || [];

  const { register, handleSubmit, control, watch, reset } = useForm({
    defaultValues: {
      projectId: '', vendorId: '', deliveryDate: '', notes: '',
      items: [{ materialId: '', quantity: 1, unitPrice: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const totalAmount = (watchedItems || []).reduce(
    (sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0
  );

  const createMutation = useMutation({
    mutationFn: (d: object) => purchaseOrdersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('PO created!');
      setShowCreate(false); reset();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.submit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); toast.success('PO submitted!'); },
    onError: (e) => toast.error(formatError(e)),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseOrdersApi.approve(id, { status }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success(`PO ${v.status.toLowerCase()}!`);
      setApproveId(null); setRejectId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const canApprove = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Purchase Orders"
        subtitle="Create, approve and track material purchase orders"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New PO
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <select className="select w-full sm:w-44" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {['DRAFT','SUBMITTED','APPROVED','REJECTED','PARTIALLY_RECEIVED','RECEIVED'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select className="select w-full sm:w-52" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr><th>PO Number</th><th>Project</th><th>Vendor</th><th>Items Ordered</th><th>Total</th><th>Delivery</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {Array.isArray(orders) && orders.map((po: any) => (
                  <tr key={po.id}>
                    <td>
                      <div className="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm">{po.poNumber}</div>
                      <div className="text-xs text-gray-400">{new Date(po.createdAt).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td className="text-sm max-w-[130px] truncate">{po.Project?.name || po.project?.name}</td>
                    <td className="text-sm max-w-[130px] truncate">{po.Vendor?.name || po.vendor?.name}</td>
                    <td className="max-w-[200px]">
                      {(po.POItem || []).length > 0 ? (
                        <div className="space-y-0.5">
                          {(po.POItem || []).slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                              <span className="truncate">{item.Material?.name || '—'}</span>
                              <span className="text-gray-400 flex-shrink-0">×{item.quantity}</span>
                            </div>
                          ))}
                          {(po.POItem || []).length > 3 && (
                            <div className="text-xs text-gray-400">+{(po.POItem || []).length - 3} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No items</span>
                      )}
                    </td>
                    <td className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      ₹{Number(po.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge variant={STATUS_COLORS[po.status] as any}>{po.status.replace('_', ' ')}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewPO(po)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                          <HiOutlineEye className="w-3.5 h-3.5" />
                        </button>
                        {po.status === 'DRAFT' && (
                          <button onClick={() => submitMutation.mutate(po.id)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 text-xs font-medium whitespace-nowrap">
                            Submit
                          </button>
                        )}
                        {canApprove && po.status === 'SUBMITTED' && (
                          <>
                            <button onClick={() => setApproveId(po.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600">
                              <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setRejectId(po.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                              <HiOutlineXCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={<HiOutlineShoppingCart className="w-8 h-8" />} title="No purchase orders" description="Create your first PO." />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {Array.isArray(orders) && orders.length > 0 ? orders.map((po: any) => (
              <div key={po.id} className="card p-4">
                {/* Row 1: PO number + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm">{po.poNumber}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(po.createdAt).toLocaleDateString('en-IN')}</div>
                  </div>
                  <Badge variant={STATUS_COLORS[po.status] as any}>{po.status.replace('_', ' ')}</Badge>
                </div>

                {/* Row 2: project + vendor */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Project</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{po.Project?.name || po.project?.name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Vendor</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{po.Vendor?.name || po.vendor?.name || '—'}</div>
                  </div>
                </div>

                {/* Row 3: items preview */}
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-1">Items</div>
                  {(po.POItem || []).length > 0 ? (
                    <div className="space-y-0.5">
                      {(po.POItem || []).slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                          <span className="truncate">{item.Material?.name || '—'}</span>
                          <span className="text-gray-400 flex-shrink-0">×{item.quantity}</span>
                        </div>
                      ))}
                      {(po.POItem || []).length > 2 && (
                        <div className="text-xs text-gray-400">+{(po.POItem || []).length - 2} more</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No items</span>
                  )}
                </div>

                {/* Row 4: total + delivery */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-xs text-gray-400">Total</div>
                    <div className="font-bold text-gray-900 dark:text-white">₹{Number(po.totalAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Delivery</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300">
                      {po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-IN') : '—'}
                    </div>
                  </div>
                </div>

                {/* Row 5: actions */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <button onClick={() => setViewPO(po)} className="btn-secondary flex-1 justify-center text-xs py-1.5">
                    <HiOutlineEye className="w-3.5 h-3.5" /> View
                  </button>
                  {po.status === 'DRAFT' && (
                    <button onClick={() => submitMutation.mutate(po.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-blue-600">
                      Submit
                    </button>
                  )}
                  {canApprove && po.status === 'SUBMITTED' && (
                    <>
                      <button onClick={() => setApproveId(po.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-green-600">
                        <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => setRejectId(po.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-red-500">
                        <HiOutlineXCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineShoppingCart className="w-8 h-8" />} title="No purchase orders" description="Create your first PO." />
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

      {/* Create PO Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="Create Purchase Order" size="2xl">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Vendor" required>
              <select {...register('vendorId', { required: true })} className="select">
                <option value="">Select Vendor</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </FormField>
            <FormField label="Expected Delivery Date">
              <input {...register('deliveryDate')} type="date" className="input" />
            </FormField>
            <FormField label="Notes">
              <input {...register('notes')} className="input" placeholder="Special instructions..." />
            </FormField>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Line Items</h3>
              <button type="button" onClick={() => append({ materialId: '', quantity: 1, unitPrice: 0 })}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <HiOutlinePlus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {/* Column headers — desktop only, mobile items are labeled inline */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
                <span className="col-span-5">Material</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-3">Unit Price (₹)</span>
                <span className="col-span-2">Line Total</span>
              </div>

              {fields.map((field, i) => {
                const item = watchedItems?.[i] || { quantity: 0, unitPrice: 0 };
                const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                const selectedMat = materials.find((m: any) => m.id === item.materialId);
                return (
                  <div key={field.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-2">
                    {/* Desktop: single grid row */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select {...register(`items.${i}.materialId`, { required: true })} className="select text-xs py-1.5">
                          <option value="">— Select Material —</option>
                          {materials.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                          ))}
                        </select>
                        {selectedMat && (
                          <div className="text-xs text-primary-600 mt-0.5 px-1">{selectedMat.category}</div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input {...register(`items.${i}.quantity`, { min: 0.01 })} type="number" step="0.01"
                          className="input text-xs py-1.5" placeholder="10" />
                      </div>
                      <div className="col-span-3">
                        <input {...register(`items.${i}.unitPrice`, { min: 0 })} type="number" step="0.01"
                          className="input text-xs py-1.5" placeholder="370" />
                      </div>
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {lineTotal > 0 ? `₹${lineTotal.toLocaleString('en-IN')}` : '—'}
                        </span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600">
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile: stacked labeled fields */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Item {i + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600">
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <select {...register(`items.${i}.materialId`, { required: true })} className="select text-xs w-full">
                        <option value="">— Select Material —</option>
                        {materials.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                      {selectedMat && (
                        <div className="text-xs text-primary-600 px-1">{selectedMat.category}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Qty</label>
                          <input {...register(`items.${i}.quantity`, { min: 0.01 })} type="number" step="0.01"
                            className="input text-xs py-1.5 w-full" placeholder="10" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Unit Price (₹)</label>
                          <input {...register(`items.${i}.unitPrice`, { min: 0 })} type="number" step="0.01"
                            className="input text-xs py-1.5 w-full" placeholder="370" />
                        </div>
                      </div>
                      <div className="text-right text-xs font-bold text-gray-900 dark:text-white">
                        Line Total: {lineTotal > 0 ? `₹${lineTotal.toLocaleString('en-IN')}` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-right">
                <div className="text-sm text-gray-500">Total Amount</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">
              {createMutation.isPending ? 'Creating...' : 'Create PO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View PO Modal */}
      <Modal isOpen={!!viewPO} onClose={() => setViewPO(null)} title={`PO: ${viewPO?.poNumber}`} size="lg">
        {viewPO && (
          <div className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['Project', viewPO.Project?.name || viewPO.project?.name],
                ['Vendor', viewPO.Vendor?.name || viewPO.vendor?.name],
                ['Total', `₹${Number(viewPO.totalAmount || 0).toLocaleString('en-IN')}`],
                ['Status', viewPO.status?.replace('_', ' ')],
                ['Delivery', viewPO.deliveryDate ? new Date(viewPO.deliveryDate).toLocaleDateString('en-IN') : '—'],
                ['Notes', viewPO.notes || '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="min-w-0">
                  <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                  <div className="font-medium text-gray-900 dark:text-white truncate">{String(v ?? '—')}</div>
                </div>
              ))}
            </div>

            {(viewPO.POItem?.length > 0 || viewPO.items?.length > 0) && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</div>
                <div className="overflow-x-auto">
                  <table className="table text-xs min-w-[480px]">
                    <thead>
                      <tr><th>Material</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Received</th></tr>
                    </thead>
                    <tbody>
                      {(viewPO.POItem || viewPO.items || []).map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium whitespace-nowrap">{item.Material?.name || item.material?.name || '—'}</td>
                          <td className="whitespace-nowrap">{item.Material?.unit || item.material?.unit || '—'}</td>
                          <td className="whitespace-nowrap">{item.quantity}</td>
                          <td className="whitespace-nowrap">₹{Number(item.unitPrice || item.rate || 0).toLocaleString('en-IN')}</td>
                          <td className="font-bold whitespace-nowrap">₹{Number(item.totalPrice || item.totalAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="whitespace-nowrap">{item.receivedQty ?? 0}/{item.quantity}</td>
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

      <ConfirmDialog isOpen={!!approveId} onClose={() => setApproveId(null)}
        onConfirm={() => approveId && approveMutation.mutate({ id: approveId, status: 'APPROVED' })}
        title="Approve Purchase Order" message="Approve this purchase order for procurement?"
        confirmLabel="Approve" variant="info" isLoading={approveMutation.isPending} />

      <ConfirmDialog isOpen={!!rejectId} onClose={() => setRejectId(null)}
        onConfirm={() => rejectId && approveMutation.mutate({ id: rejectId, status: 'REJECTED' })}
        title="Reject Purchase Order" message="Reject this purchase order?"
        confirmLabel="Reject" variant="danger" isLoading={approveMutation.isPending} />
    </div>
  );
};

export default PurchaseOrdersPage;