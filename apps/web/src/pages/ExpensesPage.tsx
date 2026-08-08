import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, projectsApi, vendorsApi, documentCategoriesApi, getFileViewUrl } from '../api/services';
import {
  PageHeader, Modal, FormField, SearchInput, Pagination,
  LoadingSpinner, EmptyState, ConfirmDialog, Badge
} from '../components/common';
import ReceiptUploadField from '../components/common/ReceiptUploadField';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineEye, HiOutlineTrash,
  HiOutlineArrowDownTray, HiOutlinePencil
} from 'react-icons/hi2';

const MODULE = 'expenses';

// ── Isolated vendor form ──────────────────────────────────────────────────
interface AddVendorFormProps {
  onClose: () => void;
  onSuccess: (vendorName: string) => void;
}

const AddVendorForm: React.FC<AddVendorFormProps> = ({ onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createVendorMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string }) => vendorsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['vendors-select'] });
      toast.success('Vendor added!');
      const name = res.data?.data?.name || res.data?.name || '';
      onSuccess(name);
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

// ── Isolated category form — same real-time "+ Add" pattern as vendors ────
interface AddCategoryFormProps {
  onClose: () => void;
  onSuccess: (categoryName: string) => void;
}

const AddCategoryForm: React.FC<AddCategoryFormProps> = ({ onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string }) => documentCategoriesApi.create({ module: MODULE, name: data.name }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['document-categories', MODULE] });
      toast.success('Category added!');
      const name = res.data?.data?.name || res.data?.name || '';
      onSuccess(name);
      onClose();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to add category'),
  });

  return (
    <form onSubmit={handleSubmit((d: any) => createCategoryMutation.mutate({ name: d.categoryName }))} className="p-4 sm:p-6 space-y-4">
      <FormField label="Category Name" required>
        <input {...register('categoryName', { required: true })} className="input" placeholder="e.g. Fuel, Rentals..." />
      </FormField>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
        <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="submit" disabled={createCategoryMutation.isPending} className="btn-primary w-full sm:w-auto">
          {createCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
        </button>
      </div>
    </form>
  );
};

const ExpensesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [viewExpense, setViewExpense] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<{ id: string; originalName: string } | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, search, categoryFilter, projectFilter],
    queryFn: () => expensesApi.list({
      page, pageSize: 15, search: search || undefined,
      category: categoryFilter || undefined,
      projectId: projectFilter || undefined,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary', projectFilter],
    queryFn: () => expensesApi.getSummary({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors-select'], queryFn: () => vendorsApi.list({ pageSize: 100 }) });

  // Categories are now dynamic — fetched, not hardcoded — exactly like vendors.
  const { data: categoriesData } = useQuery({
    queryKey: ['document-categories', MODULE],
    queryFn: () => documentCategoriesApi.list({ module: MODULE }),
  });

  const expenses = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];
  const vendors = vendorsData?.data?.data || [];
  const categories = categoriesData?.data?.data || [];
  const summary = summaryData?.data?.data || summaryData?.data;

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const isEditing = !!editingExpense;
  const selectedProjectId = watch('projectId');
  const selectedCategory = watch('category');

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload = {
        projectId: formData.projectId,
        title: formData.title || formData.description,
        description: formData.description,
        expenseDate: formData.expenseDate,
        amount: formData.amount,
        category: formData.category,
        vendorName: formData.vendorName || null,
        invoiceNo: formData.invoiceNo || null,
        receiptUrl: currentReceipt ? getFileViewUrl(currentReceipt.id) : null,
      };
      if (isEditing) return expensesApi.update(editingExpense.id, payload);
      return expensesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      toast.success(isEditing ? 'Expense updated!' : 'Expense added!');
      setShowCreate(false); setEditingExpense(null); setCurrentReceipt(null); reset();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to save expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      toast.success('Expense deleted');
      setDeleteId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const totalAmount = summary?.total?._sum?.amount || 0;

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setValue('projectId', expense.projectId);
    setValue('expenseDate', expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : '');
    setValue('category', expense.category);
    setValue('amount', expense.amount);
    setValue('title', expense.title);
    setValue('description', expense.description);
    setValue('vendorName', expense.vendorName || '');
    setValue('invoiceNo', expense.invoiceNo || '');
    // We only stored the secure view URL, not the upload id/name, on older
    // records — so we can show a link but the upload widget starts fresh
    // if they want to replace it.
    setCurrentReceipt(null);
    setShowCreate(true);
  };

  const formatDate = (expense: any) => {
    const raw = expense.expenseDate || expense.createdAt;
    if (!raw) return '—';
    const d = new Date(raw);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Expense Management"
        subtitle="Track and manage project expenses"
        action={
          <button onClick={() => { setEditingExpense(null); setCurrentReceipt(null); setShowCreate(true); }} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4">
          <div className="text-lg sm:text-xl font-bold text-green-600">₹{(Number(totalAmount)/100000).toFixed(1)}L</div>
          <div className="text-xs text-gray-500 mt-1">Total Expenses</div>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="text-lg sm:text-xl font-bold text-blue-600">{meta?.total || expenses.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Records</div>
        </div>
        <div className="card p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="text-lg sm:text-xl font-bold text-purple-600">{summary?.byCategory?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Categories Used</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search expenses..." className="flex-1 sm:min-w-60" />
        <select className="select w-full sm:w-40" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select className="select w-full sm:w-52" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner className="py-20" /> : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Project</th>
                    <th>Vendor</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">{formatDate(e)}</td>
                      <td className="max-w-xs truncate">{e.title || e.description}</td>
                      <td className="whitespace-nowrap"><Badge>{e.category}</Badge></td>
                      <td className="font-semibold whitespace-nowrap">₹{Number(e.amount).toLocaleString('en-IN')}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{e.Project?.name || e.project?.name}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{e.vendorName || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => setViewExpense(e)} className="icon-button" title="View">
                            <HiOutlineEye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEdit(e)} className="icon-button text-amber-600" title="Edit">
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          {e.receiptUrl && (
                            <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="icon-button text-blue-600" title="Receipt">
                              <HiOutlineArrowDownTray className="w-4 h-4" />
                            </a>
                          )}
                          <button onClick={() => setDeleteId(e.id)} className="icon-button text-red-500" title="Delete">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center">
                      <EmptyState title="No expenses found" description="Add your first expense" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {expenses.length > 0 ? expenses.map((e: any) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{e.title || e.description}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(e)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-gray-900 dark:text-white">₹{Number(e.amount).toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge>{e.category}</Badge>
                  {(e.Project?.name || e.project?.name) && (
                    <span className="text-xs text-gray-500 truncate">📁 {e.Project?.name || e.project?.name}</span>
                  )}
                </div>
                {e.vendorName && (
                  <div className="text-xs text-gray-400 mt-1 truncate">Vendor: {e.vendorName}</div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-1">
                  <button onClick={() => setViewExpense(e)} className="btn-secondary flex-1 justify-center text-xs py-1.5">
                    <HiOutlineEye className="w-3.5 h-3.5" /> View
                  </button>
                  <button onClick={() => handleEdit(e)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-amber-600">
                    <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {e.receiptUrl && (
                    <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 justify-center text-xs py-1.5 text-blue-600">
                      <HiOutlineArrowDownTray className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => setDeleteId(e.id)} className="btn-secondary flex-shrink-0 justify-center text-xs py-1.5 px-3 text-red-500">
                    <HiOutlineTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState title="No expenses found" description="Add your first expense" />
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
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditingExpense(null); setCurrentReceipt(null); reset(); }}
        title={isEditing ? 'Edit Expense' : 'Add New Expense'} size="lg">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>

            <FormField label="Date" required>
              <input type="date" {...register('expenseDate', { required: true })}
                defaultValue={new Date().toISOString().split('T')[0]} className="input" />
            </FormField>

            <FormField label="Title" required className="sm:col-span-2">
              <input type="text" {...register('title', { required: true })} className="input" placeholder="e.g. Cement Purchase - June" />
            </FormField>

            <FormField label="Category" required>
              <div className="flex gap-2">
                <select {...register('category', { required: true })} className="select flex-1">
                  <option value="">Select Category</option>
                  {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowCategoryModal(true)} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                  + Add
                </button>
              </div>
            </FormField>

            <FormField label="Amount (₹)" required>
              <input type="number" step="0.01" {...register('amount', { required: true })} className="input" placeholder="0.00" />
            </FormField>

            <FormField label="Vendor Name (Optional)">
              <div className="flex gap-2">
                <select {...register('vendorName')} className="select flex-1">
                  <option value="">Select Vendor</option>
                  {vendors.map((v: any) => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowVendorModal(true)} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                  + Add
                </button>
              </div>
            </FormField>

            <FormField label="Invoice No (Optional)">
              <input type="text" {...register('invoiceNo')} className="input" placeholder="INV-2025-001" />
            </FormField>

            {/* Receipt upload — files land in uploads/{projectCode}/expenses/{category}/,
                created automatically, access-checked automatically. */}
            <FormField label="" className="sm:col-span-2">
              <ReceiptUploadField
                projectId={selectedProjectId}
                module={MODULE}
                category={selectedCategory}
                value={currentReceipt}
                onChange={setCurrentReceipt}
              />
            </FormField>

            <FormField label="Description" className="sm:col-span-2">
              <textarea {...register('description')} rows={3} className="input" placeholder="Additional details..." />
            </FormField>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <button type="button" onClick={() => { setShowCreate(false); setEditingExpense(null); setCurrentReceipt(null); reset(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full sm:w-auto sm:min-w-[140px]">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!viewExpense} onClose={() => setViewExpense(null)} title="Expense Details">
        {viewExpense && (
          <div className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
              <div><strong>Date:</strong> {formatDate(viewExpense)}</div>
              <div><strong>Category:</strong> {viewExpense.category}</div>
              <div><strong>Amount:</strong> ₹{Number(viewExpense.amount).toLocaleString('en-IN')}</div>
              <div className="truncate"><strong>Project:</strong> {viewExpense.Project?.name || viewExpense.project?.name}</div>
              {viewExpense.vendorName && <div className="truncate"><strong>Vendor:</strong> {viewExpense.vendorName}</div>}
              {viewExpense.invoiceNo && <div><strong>Invoice No:</strong> {viewExpense.invoiceNo}</div>}
              <div className="sm:col-span-2"><strong>Added by:</strong> {viewExpense.User?.firstName || viewExpense.user?.firstName} {viewExpense.User?.lastName || viewExpense.user?.lastName}</div>
            </div>
            {viewExpense.title && <div><strong>Title:</strong> {viewExpense.title}</div>}
            {viewExpense.description && <div><strong>Description:</strong><br />{viewExpense.description}</div>}
            {viewExpense.receiptUrl && (
              <div className="pt-4 border-t">
                <a href={viewExpense.receiptUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-2">
                  <HiOutlineArrowDownTray className="w-5 h-5 flex-shrink-0" /> View / Download Receipt
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Vendor Modal */}
      <Modal isOpen={showVendorModal} onClose={() => setShowVendorModal(false)} title="Add New Vendor" size="md">
        <AddVendorForm
          onClose={() => setShowVendorModal(false)}
          onSuccess={(vendorName) => setValue('vendorName', vendorName)}
        />
      </Modal>

      {/* Add Category Modal — same real-time UX as vendors */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Add New Category" size="md">
        <AddCategoryForm
          onClose={() => setShowCategoryModal(false)}
          onSuccess={(categoryName) => setValue('category', categoryName)}
        />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Expense" message="Are you sure you want to delete this expense? This cannot be undone."
        confirmLabel="Delete" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default ExpensesPage;