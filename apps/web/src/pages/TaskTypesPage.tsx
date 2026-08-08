import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskTypesApi, inventoryApi } from '../api/services';
import { PageHeader, Modal, FormField, LoadingSpinner, EmptyState, Badge } from '../components/common';
import { useForm, useFieldArray } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineBookOpen, HiOutlinePencil, HiOutlineTrash, HiOutlineExclamationTriangle } from 'react-icons/hi2';

const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

const TaskTypesPage: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [addMaterialFor, setAddMaterialFor] = useState<any>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['task-types'], queryFn: () => taskTypesApi.list() });
  const { data: materialsData } = useQuery({ queryKey: ['materials'], queryFn: () => inventoryApi.getMaterials({ pageSize: 200 }) });

  const taskTypes = data?.data?.data || [];
  const materials = materialsData?.data?.data || [];
  const isEditing = !!editingType;

  const { register, handleSubmit, reset, watch, setValue, control } = useForm({
    defaultValues: {
      name: '',
      trade: '',
      unit: '',
      hasStandard: true,
      outputPerDay: '',
      efficiencyFactor: 0.85,
      helperRatio: '',
      sourceCitation: '',
      dimensionFields: [{ label: '', defaultUnit: 'ft' }],
    },
  });
  const hasStandard = watch('hasStandard');
  const { fields, append, remove } = useFieldArray({ control, name: 'dimensionFields' });

  const { register: regMat, handleSubmit: handleMatSubmit, reset: resetMat } = useForm();

  const saveMutation = useMutation({
    mutationFn: (d: any) => isEditing ? taskTypesApi.update(editingType.id, d) : taskTypesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success(isEditing ? 'Task type updated!' : 'Task type created!');
      setShowCreate(false); setEditingType(null); reset();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to save task type'),
  });

  const addMaterialMutation = useMutation({
    mutationFn: (d: { materialId: string; qtyPerUnit: number }) =>
      taskTypesApi.upsertMaterial(addMaterialFor.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Material coefficient saved!');
      setAddMaterialFor(null); resetMat();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to save'),
  });

  const removeMaterialMutation = useMutation({
    mutationFn: ({ taskTypeId, coefficientId }: { taskTypeId: string; coefficientId: string }) =>
      taskTypesApi.deleteMaterial(taskTypeId, coefficientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Removed');
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to remove'),
  });

  const openCreate = () => {
    setEditingType(null);
    reset({ hasStandard: true, efficiencyFactor: 0.85, dimensionFields: [{ label: '', defaultUnit: 'ft' }] });
    setShowCreate(true);
  };

  const openEdit = (tt: any) => {
    setEditingType(tt);
    setValue('name', tt.name);
    setValue('trade', tt.trade);
    setValue('unit', tt.unit);
    setValue('hasStandard', tt.hasStandard);
    setValue('outputPerDay', tt.outputPerDay ?? '');
    setValue('efficiencyFactor', tt.efficiencyFactor);
    setValue('helperRatio', tt.helperRatio ?? '');
    setValue('sourceCitation', tt.sourceCitation ?? '');
    setValue('dimensionFields', tt.dimensionFields?.length > 0 ? tt.dimensionFields : [{ label: '', defaultUnit: 'ft' }]);
    setShowCreate(true);
  };

  // Group by trade so tiers of the same trade (e.g. Brickwork's two floor
  // tiers) sit together visually.
  const grouped = taskTypes.reduce((acc: Record<string, any[]>, tt: any) => {
    (acc[tt.trade] = acc[tt.trade] || []).push(tt);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Task Type Standards"
        subtitle="The reference library driving automatic labour and material calculation"
        action={
          <button onClick={openCreate} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Task Type
          </button>
        }
      />

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <>
          {Object.keys(grouped).length === 0 && (
            <EmptyState icon={<HiOutlineBookOpen className="w-8 h-8" />} title="No task types yet" description="Add a trade standard to enable automatic task calculation." />
          )}

          {Object.entries(grouped).map(([trade, types]: [string, any]) => (
            <div key={trade} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{trade}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {types.map((tt: any) => (
                  <div key={tt.id} className="card p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{tt.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Unit: {tt.unit}</div>
                      </div>
                      {tt.hasStandard
                        ? <Badge variant="success">Calculated</Badge>
                        : <Badge variant="warning">Manual only</Badge>}
                    </div>

                    {tt.hasStandard ? (
                      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                        <div>
                          <div className="text-gray-400">Output/day</div>
                          <div className="font-medium text-gray-900 dark:text-white">{tt.outputPerDay} {tt.unit}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Helper ratio</div>
                          <div className="font-medium text-gray-900 dark:text-white">{tt.helperRatio ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Efficiency</div>
                          <div className="font-medium text-gray-900 dark:text-white">{(tt.efficiencyFactor * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg">
                        <HiOutlineExclamationTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        No standards source available — PM logs workers and materials manually for this trade.
                      </div>
                    )}

                    {tt.sourceCitation && (
                      <div className="text-[10px] text-gray-400 mt-2 italic">Source: {tt.sourceCitation}</div>
                    )}

                    {/* Dimension fields configured for this type */}
                    {tt.dimensionFields?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-medium text-gray-500">Dimension inputs</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {tt.dimensionFields.map((f: any, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                              {f.label} ({f.defaultUnit})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Material coefficients */}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">Materials per {tt.unit}</span>
                        <button onClick={() => setAddMaterialFor(tt)} className="text-xs text-primary-600 hover:underline">+ Add</button>
                      </div>
                      {tt.MaterialCoefficient?.length > 0 ? (
                        <div className="space-y-1">
                          {tt.MaterialCoefficient.map((mc: any) => (
                            <div key={mc.id} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">{mc.Material?.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">{mc.qtyPerUnit} {mc.Material?.unit}</span>
                                <button onClick={() => removeMaterialMutation.mutate({ taskTypeId: tt.id, coefficientId: mc.id })} className="text-red-400 hover:text-red-600">
                                  <HiOutlineTrash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No materials configured yet</p>
                      )}
                    </div>

                    <button onClick={() => openEdit(tt)} className="btn-secondary w-full justify-center text-xs py-1.5 mt-3">
                      <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Create / Edit Task Type Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditingType(null); reset(); }}
        title={isEditing ? 'Edit Task Type' : 'New Task Type'} size="lg">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required className="sm:col-span-2">
              <input {...register('name', { required: true })} className="input" placeholder="e.g. ..." />
            </FormField>
            <FormField label="Trade" required>
              <input {...register('trade', { required: true })} className="input" placeholder="e.g. Brickwork" />
            </FormField>
            <FormField label="Unit" required>
              <input {...register('unit', { required: true })} className="input" placeholder="e.g. cum, sqm" />
            </FormField>
          </div>

          <FormField label="">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('hasStandard')} className="w-4 h-4" />
              This trade has a sourced standard (uncheck for manual-only trades like Electrical)
            </label>
          </FormField>

          {hasStandard && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Output per day" required>
                <input type="number" step="0.01" {...register('outputPerDay', { required: hasStandard })} className="input" placeholder="1.39" />
              </FormField>
              <FormField label="Efficiency factor">
                <input type="number" step="0.01" min="0" max="1" {...register('efficiencyFactor')} className="input" placeholder="0.85" />
              </FormField>
              <FormField label="Helper ratio">
                <input type="number" step="0.01" {...register('helperRatio')} className="input" placeholder="1.90" />
              </FormField>
            </div>
          )}

          <FormField label="Source Citation">
            <input {...register('sourceCitation')} className="input" placeholder="e.g. CPWD DAR 2023, Vol.1, Item 6.1.1" />
          </FormField>

          {/* Dimension Fields — what measurements this task type needs at creation time */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label text-xs">Dimension Fields</label>
              <button type="button" onClick={() => append({ label: '', defaultUnit: 'ft' })} className="text-xs text-primary-600 hover:underline">+ Add Field</button>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              e.g. Brickwork needs Length, Height, Thickness (3 fields → volume). Plastering needs Length, Height (2 fields → area).
            </p>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2">
                  <input {...register(`dimensionFields.${i}.label`)} className="input flex-1" placeholder="e.g. Length" />
                  <select {...register(`dimensionFields.${i}.defaultUnit`)} className="select w-28">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditingType(null); reset(); }} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full sm:w-auto">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Material Coefficient Modal */}
      <Modal isOpen={!!addMaterialFor} onClose={() => setAddMaterialFor(null)} title={`Add Material — ${addMaterialFor?.name}`} size="sm">
        <form onSubmit={handleMatSubmit(d => addMaterialMutation.mutate({ materialId: d.materialId, qtyPerUnit: Number(d.qtyPerUnit) }))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Material" required>
            <select {...regMat('materialId', { required: true })} className="select">
              <option value="">Select Material</option>
              {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </FormField>
          <FormField label={`Quantity per ${addMaterialFor?.unit || 'unit'}`} required>
            <input type="number" step="0.001" {...regMat('qtyPerUnit', { required: true, min: 0.001 })} className="input" placeholder="500" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setAddMaterialFor(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={addMaterialMutation.isPending} className="btn-primary w-full sm:w-auto">
              {addMaterialMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TaskTypesPage;