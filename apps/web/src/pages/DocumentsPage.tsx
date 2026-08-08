import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadsApi, documentCategoriesApi, projectsApi, getFileViewUrl, viewSecureFile } from '../api/services';
import { PageHeader, Modal, FormField, SearchInput, LoadingSpinner, EmptyState, ConfirmDialog } from '../components/common';
import ReceiptUploadField from '../components/common/ReceiptUploadField';
import AddCategoryForm from '../components/common/AddCategoryForm';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineDocumentDuplicate, HiOutlineEye, HiOutlineTrash,
  HiOutlinePhoto, HiOutlineDocumentText, HiOutlineFolderOpen,
} from 'react-icons/hi2';

// Fixed set of filters — matches the six upload-enabled areas of the app.
// Keep the keys in sync with middleware/documentUpload.ts's MODULE_FOLDER_NAMES.
const MODULE_FILTERS: { key: string; label: string }[] = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'truck-entries', label: 'Truck Entries' },
  { key: 'machinery', label: 'Machinery' },
  { key: 'documents', label: 'Documents' },
  { key: 'purchase-orders', label: 'Purchase Orders' },
  { key: 'quotations', label: 'Quotations' },
];

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageType = (mimeType?: string) => !!mimeType?.startsWith('image/');
const isPdfType = (mimeType?: string) => mimeType === 'application/pdf';

const fileIconFor = (mimeType?: string) => {
  if (isImageType(mimeType)) return <HiOutlinePhoto className="w-6 h-6" />;
  if (isPdfType(mimeType)) return <HiOutlineDocumentText className="w-6 h-6" />;
  return <HiOutlineDocumentDuplicate className="w-6 h-6" />;
};

const fileColorFor = (mimeType?: string) => {
  if (isImageType(mimeType)) return 'bg-pink-100 text-pink-600';
  if (isPdfType(mimeType)) return 'bg-blue-100 text-blue-600';
  return 'bg-gray-100 text-gray-600';
};

const OWN_MODULE = 'documents'; // this page's own standalone uploads

const DocumentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<{ id: string; originalName: string } | null>(null);
  const qc = useQueryClient();

  // Projects come straight from the Projects page's own data — this is
  // also what drives PM-vs-Admin scoping, since the backend already
  // filters this list to "assigned projects only" for a PM.
  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const projects = projectsData?.data?.data || [];

  // Categories for the currently selected filter module — used as a
  // secondary dropdown filter, not a folder level.
  const { data: categoriesData } = useQuery({
    queryKey: ['document-categories', moduleFilter],
    queryFn: () => documentCategoriesApi.list({ module: moduleFilter }),
    enabled: !!moduleFilter,
  });
  const categories = categoriesData?.data?.data || [];

  const { data, isLoading } = useQuery({
    queryKey: ['uploads', moduleFilter, categoryFilter, projectFilter],
    queryFn: () => uploadsApi.list({
      module: moduleFilter || undefined,
      category: categoryFilter || undefined,
      projectId: projectFilter || undefined,
    }),
  });
  const allFiles = data?.data?.data || [];

  const files = search
    ? allFiles.filter((f: any) => f.originalName.toLowerCase().includes(search.toLowerCase()))
    : allFiles;

  const { register, watch, reset, setValue } = useForm({
    defaultValues: { category: '', projectId: '' },
  });
  const formProjectId = watch('projectId');
  const formCategory = watch('category');

  const { data: formCategoriesData } = useQuery({
    queryKey: ['document-categories', OWN_MODULE],
    queryFn: () => documentCategoriesApi.list({ module: OWN_MODULE }),
  });
  const formCategories = formCategoriesData?.data?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => uploadsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] });
      toast.success('Document deleted');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to delete document'),
  });

  const closeUploadModal = () => {
    setShowUpload(false);
    setCurrentFile(null);
    reset();
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Document Management"
        subtitle="All uploaded files across every module, in one place"
        action={
          <button onClick={() => setShowUpload(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> Upload Document
          </button>
        }
      />

      {/* Fixed module filters */}
      <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => { setModuleFilter(''); setCategoryFilter(''); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${!moduleFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
        >
          All
        </button>
        {MODULE_FILTERS.map((m) => (
          <button
            key={m.key}
            onClick={() => { setModuleFilter(m.key === moduleFilter ? '' : m.key); setCategoryFilter(''); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${moduleFilter === m.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by file name..." className="flex-1 sm:max-w-xs" />
        <select className="select w-full sm:w-52" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {moduleFilter && categories.length > 0 && (
          <select className="select w-full sm:w-52" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Documents grid */}
      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {files.length > 0 ? files.map((f: any) => (
            <div key={f.id} className="card p-3 sm:p-4 hover:shadow-card-hover transition-shadow">
              <div className={`w-full h-20 sm:h-24 rounded-lg flex items-center justify-center mb-3 ${fileColorFor(f.mimeType)}`}>
                <div className="scale-125 sm:scale-150 opacity-70">{fileIconFor(f.mimeType)}</div>
              </div>

              <div className="font-medium text-sm text-gray-900 dark:text-white truncate" title={f.originalName}>{f.originalName}</div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                  {MODULE_FILTERS.find(m => m.key === f.module)?.label || f.module}
                </span>
                {f.category && (
                  <span className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 px-1.5 py-0.5 rounded">
                    {f.category}
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-400 mt-1.5 space-y-0.5">
                <div className="truncate">📁 {f.Project?.name || 'General'}</div>
                <div className="truncate">{new Date(f.createdAt).toLocaleDateString('en-IN')} · {formatBytes(f.size)}</div>
                {f.User && <div className="truncate">by {f.User.firstName} {f.User.lastName}</div>}
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => viewSecureFile(getFileViewUrl(f.id))}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
                >
                  <HiOutlineEye className="w-3.5 h-3.5" /> View
                </button>
                <button
                  onClick={() => setDeleteId(f.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  <HiOutlineTrash className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <EmptyState
                icon={<HiOutlineFolderOpen className="w-8 h-8" />}
                title="No documents found"
                description="Files uploaded here, or from Expenses, Truck Entries, and other pages, will appear in this list."
                action={<button onClick={() => setShowUpload(true)} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Upload</button>}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={closeUploadModal} title="Upload Document" size="md">
        <div className="p-4 sm:p-6 space-y-4">
          <FormField label="Project (Optional)">
            <select {...register('projectId')} className="select">
              <option value="">No Project — standalone document</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          <FormField label="Category">
            <div className="flex gap-2">
              <select {...register('category')} className="select flex-1">
                <option value="">No Category</option>
                {formCategories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setShowCategoryModal(true)} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                + Add
              </button>
            </div>
          </FormField>

          <ReceiptUploadField
            label="File"
            projectId={formProjectId || undefined}
            module={OWN_MODULE}
            category={formCategory || undefined}
            value={currentFile}
            onChange={(f) => {
              setCurrentFile(f);
              if (f) {
                qc.invalidateQueries({ queryKey: ['uploads'] });
                toast.success('Document saved!');
                closeUploadModal();
              }
            }}
            requireProject={false}
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <button type="button" onClick={closeUploadModal} className="btn-secondary w-full sm:w-auto">Close</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Add New Category" size="md">
        <AddCategoryForm
          module={OWN_MODULE}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={(categoryName) => setValue('category', categoryName)}
        />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Document" message="Permanently delete this document? This cannot be undone."
        confirmLabel="Delete" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default DocumentsPage;