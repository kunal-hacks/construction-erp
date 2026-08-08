import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentCategoriesApi } from '../../api/services';
import { formatError } from '../../api/client';
import { FormField } from './index';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface AddCategoryFormProps {
  module: string;
  onClose: () => void;
  onSuccess: (categoryName: string) => void;
}

// Same real-time "+ Add" pattern used for vendors — types a name, saves
// instantly, becomes available everywhere that fetches categories for this
// module. Reusable across any page (Expenses, Documents, Truck Entries...).
const AddCategoryForm: React.FC<AddCategoryFormProps> = ({ module, onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string }) => documentCategoriesApi.create({ module, name: data.name }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['document-categories', module] });
      qc.invalidateQueries({ queryKey: ['document-categories-all'] });
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
        <input {...register('categoryName', { required: true })} className="input" placeholder="e.g. Site Photos, Contracts..." />
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

export default AddCategoryForm;