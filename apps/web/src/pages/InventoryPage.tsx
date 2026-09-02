import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, projectsApi } from '../api/services';
import {
  PageHeader, Modal, FormField, SearchInput, Pagination,
  LoadingSpinner, EmptyState, Badge
} from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlineCube, HiOutlineArrowDown,
  HiOutlineArrowUp, HiOutlineArrowsRightLeft, HiOutlineExclamationTriangle,
} from 'react-icons/hi2';

const UNIT_OPTIONS = ['Bags', 'MT', 'KG', 'CuM', 'Ltrs', 'Nos', 'RFT', 'SFT', 'RMT', 'Sheets', 'Sets'];

// ── Isolated "+ Add Material" form — same real-time pattern as Vendors/Categories ──
interface AddMaterialFormProps {
  onClose: () => void;
  onSuccess: (materialId: string) => void;
}

const AddMaterialForm: React.FC<AddMaterialFormProps> = ({ onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; unit: string; category?: string; description?: string }) =>
      inventoryApi.createMaterial(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material added!');
      const id = res.data?.data?.id || res.data?.id;
      onSuccess(id);
      onClose();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to add material'),
  });

  return (
    <form onSubmit={handleSubmit((d: any) => createMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
      <FormField label="Material Name" required>
        <input {...register('name', { required: true })} className="input" placeholder="e.g. Door Frame (Teak, 7x3ft)" />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Unit" required>
          <select {...register('unit', { required: true })} className="select">
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </FormField>
        <FormField label="Category">
          <input {...register('category')} className="input" placeholder="e.g. Carpentry, Hardware" />
        </FormField>
      </div>
      <FormField label="Description">
        <input {...register('description')} className="input" placeholder="Optional description" />
      </FormField>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
        <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">
          {createMutation.isPending ? 'Adding...' : 'Add Material'}
        </button>
      </div>
    </form>
  );
};

const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory'|'movements'|'materials'>('inventory');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState<'in' | 'out' | null>(null);
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const projects = projectsData?.data?.data || [];

  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['inventory', projectId, page],
    queryFn: () => inventoryApi.getAllInventory({ projectId: projectId || undefined, page, pageSize: 20 }),
  });

  const { data: materialsData, isLoading: matsLoading } = useQuery({
    queryKey: ['materials', search],
    queryFn: () => inventoryApi.getMaterials({ search: search || undefined, pageSize: 50 }),
  });

  const { data: movementsData, isLoading: movLoading } = useQuery({
    queryKey: ['movements', projectId, page],
    queryFn: () => inventoryApi.getMovements({ projectId: projectId || undefined, page, pageSize: 20 }),
  });

  const inventory = inventoryData?.data?.data || [];
  const invMeta = inventoryData?.data?.meta;
  const materials = materialsData?.data?.data || [];
  const movements = movementsData?.data?.data || [];
  const movMeta = movementsData?.data?.meta;

  const { register: regIn, handleSubmit: handleIn, reset: resetIn, setValue: setValueIn } = useForm();
  const { register: regOut, handleSubmit: handleOut, reset: resetOut, setValue: setValueOut } = useForm();

  const stockInMutation = useMutation({
    mutationFn: (d: object) => inventoryApi.stockIn(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Stock received!');
      setShowStockIn(false); resetIn();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const stockOutMutation = useMutation({
    mutationFn: (d: object) => inventoryApi.stockOut(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      toast.success('Stock issued!');
      setShowStockOut(false); resetOut();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const TYPE_COLORS: Record<string, string> = {
    IN: 'text-green-600', OUT: 'text-red-500',
    TRANSFER: 'text-blue-500', ADJUSTMENT: 'text-purple-500',
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Inventory Management"
        subtitle="Materials, stock levels and movement tracking"
        action={
          <div className="grid grid-cols-2 sm:flex gap-2">
            <button onClick={() => setShowStockOut(true)} className="btn-secondary justify-center">
              <HiOutlineArrowUp className="w-4 h-4" /> Issue
            </button>
            <button onClick={() => setShowStockIn(true)} className="btn-primary justify-center">
              <HiOutlineArrowDown className="w-4 h-4" /> Receive
            </button>
          </div>
        }
      />

      {/* Project selector (now a filter, not a gate) + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select className="select w-full sm:w-64" value={projectId} onChange={e => { setProjectId(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar">
          {(['inventory','movements','materials'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize whitespace-nowrap flex-shrink-0 ${
                activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ Inventory Tab ══════════════ */}
      {activeTab === 'inventory' && (
        invLoading ? <LoadingSpinner className="py-12" /> : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block card">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Project</th><th>Material</th><th>Category</th><th>Unit</th>
                      <th>Stock</th><th>Unit Price</th><th>Total Value</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(inventory) && inventory.map((item: any) => {
                      const isLow = Number(item.currentStock) <= Number(item.material?.minStockLevel || 0);
                      return (
                        <tr key={item.id}>
                          <td className="text-xs text-gray-500 whitespace-nowrap">{item.project?.name}</td>
                          <td className="whitespace-nowrap">
                            <div className="font-medium text-sm flex items-center gap-1">
                              {isLow && <HiOutlineExclamationTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                              {item.material?.name}
                            </div>
                          </td>
                          <td className="text-xs text-gray-500 whitespace-nowrap">{item.material?.category?.name}</td>
                          <td className="text-xs whitespace-nowrap">{item.material?.unit}</td>
                          <td className={`font-bold whitespace-nowrap ${isLow ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {Number(item.currentStock).toFixed(2)}
                          </td>
                          <td className="text-sm whitespace-nowrap">₹{Number(item.avgRate).toLocaleString('en-IN')}</td>
                          <td className="font-medium text-green-600 whitespace-nowrap">₹{Number(item.totalValue || 0).toLocaleString('en-IN')}</td>
                          <td className="whitespace-nowrap">{isLow ? <Badge variant="warning">Low Stock</Badge> : <Badge variant="success">Normal</Badge>}</td>
                        </tr>
                      );
                    })}
                    {(!inventory || inventory.length === 0) && (
                      <tr><td colSpan={8}>
                        <EmptyState icon={<HiOutlineCube className="w-8 h-8" />} title="No inventory" description="Receive stock to populate inventory." />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {Array.isArray(inventory) && inventory.length > 0 ? inventory.map((item: any) => {
                const isLow = Number(item.currentStock) <= Number(item.material?.minStockLevel || 0);
                return (
                  <div key={item.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-1 truncate">
                          {isLow && <HiOutlineExclamationTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                          {item.material?.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{item.project?.name}</div>
                      </div>
                      {isLow ? <Badge variant="warning">Low Stock</Badge> : <Badge variant="success">Normal</Badge>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <div className="text-gray-400">Category</div>
                        <div className="text-gray-700 dark:text-gray-300 truncate">{item.material?.category?.name || '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Unit</div>
                        <div className="text-gray-700 dark:text-gray-300">{item.material?.unit || '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Stock</div>
                        <div className={`font-bold ${isLow ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {Number(item.currentStock).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <span className="text-gray-500">Rate: ₹{Number(item.avgRate).toLocaleString('en-IN')}</span>
                      <span className="font-semibold text-green-600">₹{Number(item.totalValue || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="card">
                  <EmptyState icon={<HiOutlineCube className="w-8 h-8" />} title="No inventory" description="Receive stock to populate inventory." />
                </div>
              )}
            </div>

            {invMeta && (
              <div className="card overflow-hidden">
                <Pagination page={page} totalPages={invMeta.totalPages} total={invMeta.total} pageSize={invMeta.pageSize} onPageChange={setPage} />
              </div>
            )}
          </>
        )
      )}

      {/* ══════════════ Movements Tab ══════════════ */}
      {activeTab === 'movements' && (
        movLoading ? <LoadingSpinner className="py-12" /> : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block card">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Material</th><th>Type</th><th>Quantity</th><th>Rate</th><th>Value</th><th>Reference</th></tr>
                  </thead>
                  <tbody>
                    {Array.isArray(movements) && movements.map((m: any) => (
                      <tr key={m.id}>
                        <td className="text-xs text-gray-500 whitespace-nowrap">
                          {m.date ? new Date(m.date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="font-medium text-sm whitespace-nowrap">
                          {m.material?.name}<br />
                          <span className="text-xs text-gray-400">{m.material?.unit}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={`text-xs font-bold ${TYPE_COLORS[m.type] || 'text-gray-500'}`}>
                            {m.type}
                          </span>
                        </td>
                        <td className="font-bold whitespace-nowrap">{Number(m.quantity).toFixed(2)}</td>
                        <td className="text-sm whitespace-nowrap">{m.rate ? `₹${Number(m.rate).toLocaleString('en-IN')}` : '—'}</td>
                        <td className="text-sm whitespace-nowrap">{m.totalValue ? `₹${Number(m.totalValue).toLocaleString('en-IN')}` : '—'}</td>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{m.referenceNo || '—'}</td>
                      </tr>
                    ))}
                    {(!movements || movements.length === 0) && (
                      <tr><td colSpan={7}>
                        <EmptyState icon={<HiOutlineArrowsRightLeft className="w-8 h-8" />} title="No movements" description="Stock movements will appear here." />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {Array.isArray(movements) && movements.length > 0 ? movements.map((m: any) => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{m.material?.name}</div>
                      <div className="text-xs text-gray-400">{m.material?.unit} · {m.date ? new Date(m.date).toLocaleDateString('en-IN') : '—'}</div>
                    </div>
                    <span className={`text-xs font-bold flex-shrink-0 ${TYPE_COLORS[m.type] || 'text-gray-500'}`}>{m.type}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div>
                      <div className="text-gray-400">Quantity</div>
                      <div className="font-bold text-gray-900 dark:text-white">{Number(m.quantity).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Rate</div>
                      <div className="text-gray-700 dark:text-gray-300">{m.rate ? `₹${Number(m.rate).toLocaleString('en-IN')}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Value</div>
                      <div className="text-gray-700 dark:text-gray-300">{m.totalValue ? `₹${Number(m.totalValue).toLocaleString('en-IN')}` : '—'}</div>
                    </div>
                  </div>

                  {m.referenceNo && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                      Ref: {m.referenceNo}
                    </div>
                  )}
                </div>
              )) : (
                <div className="card">
                  <EmptyState icon={<HiOutlineArrowsRightLeft className="w-8 h-8" />} title="No movements" description="Stock movements will appear here." />
                </div>
              )}
            </div>

            {movMeta && (
              <div className="card overflow-hidden">
                <Pagination page={page} totalPages={movMeta.totalPages} total={movMeta.total} pageSize={movMeta.pageSize} onPageChange={setPage} />
              </div>
            )}
          </>
        )
      )}

      {/* ══════════════ Materials Tab ══════════════ */}
      {activeTab === 'materials' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search materials..." className="flex-1 sm:max-w-sm" />
            <button onClick={() => setShowAddMaterial('in')} className="btn-secondary w-full sm:w-auto justify-center">
              + Add Material
            </button>
          </div>

          {matsLoading ? <LoadingSpinner className="py-12" /> : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block card">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr><th>Material Name</th><th>Category</th><th>Unit</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      {Array.isArray(materials) && materials.map((m: any) => (
                        <tr key={m.id}>
                          <td className="font-medium text-sm whitespace-nowrap">{m.name}</td>
                          <td className="text-sm text-gray-500 whitespace-nowrap">{m.category}</td>
                          <td className="text-sm whitespace-nowrap">{m.unit}</td>
                          <td className="text-xs text-gray-400">{m.description || '—'}</td>
                        </tr>
                      ))}
                      {(!materials || materials.length === 0) && (
                        <tr><td colSpan={4}>
                          <EmptyState title="No materials" description="Add materials to the master list." />
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {Array.isArray(materials) && materials.length > 0 ? materials.map((m: any) => (
                  <div key={m.id} className="card p-4">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{m.name}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{m.category}</span>
                      <span className="text-xs text-gray-400">{m.unit}</span>
                    </div>
                    {m.description && <div className="text-xs text-gray-400 mt-2">{m.description}</div>}
                  </div>
                )) : (
                  <div className="card">
                    <EmptyState title="No materials" description="Add materials to the master list." />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Stock In Modal ── */}
      <Modal isOpen={showStockIn} onClose={() => setShowStockIn(false)} title="Receive Stock" size="md">
        <form onSubmit={handleIn(d => stockInMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Project" required>
            <select {...regIn('projectId', { required: true })} className="select">
              <option value="">Select Project</option>
              {Array.isArray(projects) && projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Material" required>
            <div className="flex gap-2">
              <select {...regIn('materialId', { required: true })} className="select flex-1">
                <option value="">Select Material</option>
                {Array.isArray(materials) && materials.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowAddMaterial('in')} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                + Add
              </button>
            </div>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Quantity" required>
              <input {...regIn('quantity', { required: true, min: 0.01 })} type="number" step="0.01" className="input" placeholder="100" />
            </FormField>
            <FormField label="Rate per unit (₹)" required>
              <input {...regIn('rate', { required: true, min: 0 })} type="number" step="0.01" className="input" placeholder="370" />
            </FormField>
          </div>
          <FormField label="Vendor Name (Optional)">
            <input {...regIn('vendorName')} className="input" placeholder="Company or Vendor Name" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Reference No">
              <input {...regIn('referenceNo')} className="input" placeholder="PO-2024-001" />
            </FormField>
            <FormField label="Notes">
              <input {...regIn('notes')} className="input" placeholder="Optional notes" />
            </FormField>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowStockIn(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={stockInMutation.isPending} className="btn-primary w-full sm:w-auto">
              {stockInMutation.isPending ? 'Saving...' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Stock Out Modal ── */}
      <Modal isOpen={showStockOut} onClose={() => setShowStockOut(false)} title="Issue Stock" size="md">
        <form onSubmit={handleOut(d => stockOutMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Project" required>
            <select {...regOut('projectId', { required: true })} className="select">
              <option value="">Select Project</option>
              {Array.isArray(projects) && projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Material" required>
            <div className="flex gap-2">
              <select {...regOut('materialId', { required: true })} className="select flex-1">
                <option value="">Select Material</option>
                {Array.isArray(materials) && materials.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowAddMaterial('out')} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                + Add
              </button>
            </div>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Quantity" required>
              <input {...regOut('quantity', { required: true, min: 0.01 })} type="number" step="0.01" className="input" placeholder="50" />
            </FormField>
            <FormField label="Reference No">
              <input {...regOut('referenceNo')} className="input" placeholder="WO-001" />
            </FormField>
          </div>
          <FormField label="Notes">
            <input {...regOut('notes')} className="input" placeholder="Purpose / location" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowStockOut(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={stockOutMutation.isPending} className="btn-primary w-full sm:w-auto">
              {stockOutMutation.isPending ? 'Saving...' : 'Issue Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Add Material Modal — shared by Materials tab, Stock In and Stock Out ── */}
      <Modal isOpen={!!showAddMaterial} onClose={() => setShowAddMaterial(null)} title="Add Material" size="md">
        <AddMaterialForm
          onClose={() => setShowAddMaterial(null)}
          onSuccess={(materialId) => {
            if (showAddMaterial === 'in') setValueIn('materialId', materialId);
            if (showAddMaterial === 'out') setValueOut('materialId', materialId);
          }}
        />
      </Modal>
    </div>
  );
};

export default InventoryPage;