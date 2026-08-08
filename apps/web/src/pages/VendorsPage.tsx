import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorsApi } from '../api/services';
import { PageHeader, Modal, FormField, SearchInput, Pagination, LoadingSpinner, EmptyState, ConfirmDialog, Badge } from '../components/common';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineBuildingOffice, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineStar } from 'react-icons/hi2';

type VendorData = Record<string, any>;

const VendorsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editVendor, setEditVendor] = useState<VendorData | null>(null);
  const [viewVendor, setViewVendor] = useState<VendorData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, search],
    queryFn: () => vendorsApi.list({ page, pageSize: 12, search: search || undefined }),
  });

  const vendors = data?.data?.data || [];
  const meta = data?.data?.meta;

  const { register, handleSubmit, reset, setValue } = useForm();
  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit, setValue: setEditValue } = useForm();

  const createMutation = useMutation({
    mutationFn: (d: object) => vendorsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor created!'); setShowCreate(false); reset(); },
    onError: (e) => toast.error(formatError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => vendorsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor updated!'); setEditVendor(null); },
    onError: (e) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor deactivated'); setDeleteId(null); },
    onError: (e) => toast.error(formatError(e)),
  });

  const openEdit = (v: Record<string, unknown>) => {
    setEditVendor(v);
    Object.entries(v).forEach(([k, val]) => setEditValue(k, val));
  };

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const VendorForm = ({ onSubmit, reg, isPending, onClose }: { onSubmit: React.FormEventHandler<HTMLFormElement>; reg: ReturnType<typeof useForm>['register']; isPending: boolean; onClose: () => void }) => (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Vendor Name" required className="col-span-2">
          <input {...reg('name', { required: true })} className="input" placeholder="Ultratech Cement Pvt Ltd" />
        </FormField>
        <FormField label="Phone" required>
          <input {...reg('phone', { required: true })} className="input" placeholder="9876543210" />
        </FormField>
        <FormField label="Email">
          <input {...reg('email')} type="email" className="input" placeholder="vendor@email.com" />
        </FormField>
        <FormField label="GST Number">
          <input {...reg('gstNumber')} className="input" placeholder="27AABCU1234B1Z5" style={{ textTransform: 'uppercase' }} />
        </FormField>
        <FormField label="PAN Number">
          <input {...reg('panNumber')} className="input" placeholder="AAAPL1234C" style={{ textTransform: 'uppercase' }} />
        </FormField>
        <FormField label="Contact Person">
          <input {...reg('contactPerson')} className="input" placeholder="Mohan Patel" />
        </FormField>
        <FormField label="City">
          <input {...reg('city')} className="input" placeholder="Mumbai" />
        </FormField>
        <FormField label="State">
          <select {...reg('state')} className="select">
            <option value="">Select State</option>
            {['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Address" className="col-span-2">
          <textarea {...reg('address')} rows={2} className="input resize-none" placeholder="Full address" />
        </FormField>
        <FormField label="Bank Name">
          <input {...reg('bankName')} className="input" placeholder="State Bank of India" />
        </FormField>
        <FormField label="Account Number">
          <input {...reg('bankAccount')} className="input" placeholder="123456789012" />
        </FormField>
        <FormField label="IFSC Code">
          <input {...reg('ifscCode')} className="input" placeholder="SBIN0001234" style={{ textTransform: 'uppercase' }} />
        </FormField>
        <FormField label="Rating (1-5)">
          <select {...reg('rating')} className="select">
            {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
          </select>
        </FormField>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">{isPending ? 'Saving...' : 'Save Vendor'}</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Vendor Management"
        subtitle="Manage suppliers, contractors and service providers"
        action={canManage && <button onClick={() => setShowCreate(true)} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add Vendor</button>}
      />

      <div className="flex gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name, GST, phone..." className="flex-1 max-w-sm" />
      </div>

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(vendors) && vendors.map((v: {
              id: string; name: string; code: string; phone: string; email?: string;
              city?: string; state?: string; contactPerson?: string; gstNumber?: string;
              rating?: number; isActive: boolean;
              _count: { expenses: number; purchaseOrders: number };
            }) => (
              <div key={v.id} className="card p-5 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    <HiOutlineBuildingOffice className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!v.isActive && <Badge variant="danger">Inactive</Badge>}
                    {v.rating && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <HiOutlineStar key={i} className={`w-3 h-3 ${i < v.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">{v.name}</div>
                <div className="text-xs text-primary-600 font-mono mt-0.5">{v.code}</div>
                {v.contactPerson && <div className="text-xs text-gray-500 mt-1">👤 {v.contactPerson}</div>}
                <div className="text-xs text-gray-500 mt-0.5">📞 {v.phone}</div>
                {(v.city || v.state) && (
                  <div className="text-xs text-gray-400 mt-0.5">📍 {[v.city, v.state].filter(Boolean).join(', ')}</div>
                )}
                {v.gstNumber && <div className="text-xs font-mono text-gray-400 mt-0.5">GST: {v.gstNumber}</div>}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{v._count?.expenses || 0} expenses</span>
                    <span>{v._count?.purchaseOrders || 0} POs</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewVendor(v as Record<string, unknown>)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(v as Record<string, unknown>)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(v.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(!vendors || vendors.length === 0) && (
              <div className="col-span-3">
                <EmptyState icon={<HiOutlineBuildingOffice className="w-8 h-8" />} title="No vendors" description="Add your first vendor to get started." />
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Vendor" size="xl">
        <VendorForm onSubmit={handleSubmit(d => createMutation.mutate(d))} reg={register} isPending={createMutation.isPending} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal isOpen={!!editVendor} onClose={() => setEditVendor(null)} title="Edit Vendor" size="xl">
        <VendorForm
          onSubmit={handleEditSubmit(d => editVendor && updateMutation.mutate({ id: editVendor.id as string, data: d }))}
          reg={regEdit} isPending={updateMutation.isPending} onClose={() => setEditVendor(null)}
        />
      </Modal>

      <Modal isOpen={!!viewVendor} onClose={() => setViewVendor(null)} title="Vendor Details" size="md">
        {viewVendor && (
          <div className="p-6 space-y-2 text-sm">
            {[
              ['Name', viewVendor.name], ['Code', viewVendor.code], ['Phone', viewVendor.phone],
              ['Email', viewVendor.email || '—'], ['Contact Person', viewVendor.contactPerson || '—'],
              ['GST Number', viewVendor.gstNumber || '—'], ['PAN Number', viewVendor.panNumber || '—'],
              ['Address', viewVendor.address || '—'], ['City', viewVendor.city || '—'],
              ['State', viewVendor.state || '—'], ['Bank Name', viewVendor.bankName || '—'],
              ['Account No', viewVendor.bankAccount || '—'], ['IFSC Code', viewVendor.ifscCode || '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 w-32 flex-shrink-0">{k}</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Deactivate Vendor" message="Are you sure you want to deactivate this vendor?"
        confirmLabel="Deactivate" variant="danger" isLoading={deleteMutation.isPending} />
    </div>
  );
};
export default VendorsPage;
