import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyReportsApi, projectsApi, tasksApi, inventoryApi } from '../api/services';
import {
  PageHeader, Modal, FormField, Pagination,
  LoadingSpinner, EmptyState
} from '../components/common';
import DimensionsEditor, { ComponentInput, emptyValues } from '../components/common/DimensionsEditor';
import { useForm, useFieldArray } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineClipboardDocumentList,
  HiOutlineTrash, HiOutlineCube, HiOutlineExclamationTriangle
} from 'react-icons/hi2';

const WEATHER_ICONS: Record<string, string> = {
  SUNNY: '☀️', CLOUDY: '⛅', RAINY: '🌧️', FOGGY: '🌫️', STORMY: '⛈️',
};
const ROLE_OPTIONS = ['Mason', 'Helper', 'Bhisti', 'Electrician', 'Carpenter', 'Steel Fixer', 'Other'];
const todayDateStr = () => new Date().toISOString().split('T')[0];

const DailyReportsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewReport, setViewReport] = useState<Record<string, unknown> | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSetDimensions, setShowSetDimensions] = useState(false);
  const [dimComponents, setDimComponents] = useState<ComponentInput[]>([]);
  const [activeNameDropdown, setActiveNameDropdown] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', page, projectFilter, dateFrom, dateTo],
    queryFn: () => dailyReportsApi.list({
      page, pageSize: 15,
      projectId: projectFilter || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });

  const reports = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];

  const { register, handleSubmit, reset, watch, control, setValue } = useForm({
    defaultValues: {
      projectId: '', taskId: '', reportDate: todayDateStr(), weather: 'SUNNY',
      completionPct: '', workDone: '', notes: '',
      workers: [] as any[], materialsUsed: [] as any[],
    },
  });
  const { fields: workerFields, append: appendWorker, remove: removeWorker } = useFieldArray({ control, name: 'workers' });
  const { fields: materialFields, append: appendMaterial, remove: removeMaterial, replace: replaceMaterials } = useFieldArray({ control, name: 'materialsUsed' });

  const formProjectId = watch('projectId');
  const formTaskId = watch('taskId');
  const watchedWorkers = watch('workers');
  const watchedMaterials = watch('materialsUsed');
  const completionPctValue = watch('completionPct');

  const { data: projectTasksData } = useQuery({
    queryKey: ['tasks-for-project', formProjectId],
    queryFn: () => tasksApi.getByProject(formProjectId as unknown as string),
    enabled: !!formProjectId && typeof formProjectId === 'string',
  });
  const projectTasks = projectTasksData?.data?.data?.tasks || [];
  const selectedTask = projectTasks.find((t: any) => t.id === formTaskId);

  const { data: materialCheckData, isFetching: checkingMaterials } = useQuery({
    queryKey: ['task-material-check', formTaskId, completionPctValue],
    queryFn: () => tasksApi.getMaterialCheck(formTaskId as string, Number(completionPctValue)),
    enabled: !!formTaskId && !!completionPctValue && Number(completionPctValue) > 0,
  });
  const materialCheck = materialCheckData?.data?.data;

  const { data: workerOptionsData } = useQuery({
    queryKey: ['worker-options', formProjectId],
    queryFn: () => dailyReportsApi.getWorkerOptions({ projectId: formProjectId }),
    enabled: !!formProjectId,
  });
  const existingWorkers = workerOptionsData?.data?.data?.existingWorkers || [];
  const tempWorkers = workerOptionsData?.data?.data?.tempWorkers || [];

  const { data: materialsData } = useQuery({ queryKey: ['materials'], queryFn: () => inventoryApi.getMaterials({ pageSize: 200 }) });
  const allMaterials = materialsData?.data?.data || [];

  useEffect(() => {
    setValue('taskId', '');
    setValue('workers', []);
  }, [formProjectId]);

  useEffect(() => {
    setShowSetDimensions(false);
    setDimComponents([]);
  }, [formTaskId]);

  // Auto-fills the materials list the moment a valid completion % check
  // comes back for a standard task — no manual trigger needed. Only fires
  // for standard trades; manual/no-standard tasks keep an empty, freely
  // editable list as before.
  useEffect(() => {
    if (selectedTask?.taskType?.hasStandard && materialCheck?.materials?.length) {
      replaceMaterials(materialCheck.materials.map((m: any) => ({
        materialId: m.materialId, quantityUsed: m.qtyNeeded.toFixed(2),
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialCheck]);

  const setDimensionsMutation = useMutation({
    mutationFn: (comps: object[]) => tasksApi.update(formTaskId as string, { components: comps }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-for-project'] });
      toast.success('Dimensions saved — you can now submit this report.');
      setShowSetDimensions(false);
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to save dimensions'),
  });

  const createMutation = useMutation({
    mutationFn: (d: object) => dailyReportsApi.create(d),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['daily-reports'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['task'] });
      qc.invalidateQueries({ queryKey: ['worker-options'] });
      const warnings = res.data?.data?.warnings || [];
      warnings.forEach((w: string) => toast(w, { duration: 6000, icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E' } }));
      toast.success('Daily report submitted!');
      setShowCreate(false);
      reset({ reportDate: todayDateStr(), weather: 'SUNNY', completionPct: '', workers: [], materialsUsed: [] });
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const onSubmit = (data: any) => {
    const payload = {
      projectId: data.projectId,
      taskId: data.taskId || null,
      reportDate: data.reportDate,
      weather: data.weather,
      workDone: data.workDone,
      completionPct: Number(data.completionPct) || 0,
      notes: data.notes,
      workers: (data.workers || []).map((w: any) => ({
        name: w.name, workerId: w.workerId || null, role: w.role, wageForDay: Number(w.wageForDay),
      })),
      materialsUsed: (data.materialsUsed || []).filter((m: any) => m.materialId && m.quantityUsed).map((m: any) => ({
        materialId: m.materialId, quantityUsed: Number(m.quantityUsed),
      })),
    };
    createMutation.mutate(payload);
  };

  const nameOptions = [
    ...existingWorkers.map((w: any) => ({ source: 'existing', ...w })),
    ...tempWorkers
      .filter((tw: any) => !existingWorkers.some((ew: any) => ew.name.toLowerCase() === tw.name.toLowerCase()))
      .map((w: any) => ({ source: 'temp', name: w.name, skill: w.role, dailyWage: w.wageForDay })),
  ];

  const handleNameSelect = (index: number, picked: any | null, typedName: string) => {
    if (picked) {
      setValue(`workers.${index}.name`, picked.name);
      setValue(`workers.${index}.workerId`, picked.source === 'existing' ? picked.id : '');
      setValue(`workers.${index}.role`, picked.skill || 'Helper');
      setValue(`workers.${index}.wageForDay`, picked.dailyWage || '');
    } else {
      setValue(`workers.${index}.name`, typedName);
      setValue(`workers.${index}.workerId`, '');
    }
    setActiveNameDropdown(null);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setShowSetDimensions(false);
    setDimComponents([]);
    reset({ reportDate: todayDateStr(), weather: 'SUNNY', completionPct: '', workers: [], materialsUsed: [] });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Daily Progress Reports"
        subtitle="The single entry point for task progress, attendance and material usage"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <HiOutlinePlus className="w-4 h-4" /> New Report
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <select className="select w-full sm:w-48" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input flex-1 sm:w-36 text-xs" />
          <span className="text-gray-400 text-sm flex-shrink-0">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input flex-1 sm:w-36 text-xs" />
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-16" /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.isArray(reports) && reports.map((r: any) => (
              <div key={r.id} className="card p-4 sm:p-5 hover:shadow-card-hover transition-shadow cursor-pointer active:scale-[0.99]"
                onClick={() => setViewReport(r)}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">
                      {new Date(r.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 truncate">{r.project?.name}</div>
                    {r.task && <div className="text-xs text-gray-400 truncate">Task: {r.task.title}</div>}
                  </div>
                  <span className="text-xl sm:text-2xl flex-shrink-0" title={r.weather}>{WEATHER_ICONS[r.weather] || '🌤️'}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{r.workDone}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.min(r.completionPct, 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-10 text-right flex-shrink-0">
                    {Number(r.completionPct).toFixed(0)}%
                  </span>
                </div>
                {r.workers?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {r.workers.slice(0, 4).map((w: any, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{w.name}</span>
                    ))}
                    {r.workers.length > 4 && <span className="text-xs text-gray-400">+{r.workers.length - 4} more</span>}
                  </div>
                )}
                <div className="text-xs text-gray-400 truncate">{r.submitter?.firstName} {r.submitter?.lastName}</div>
              </div>
            ))}
          </div>

          {reports.length === 0 && (
            <EmptyState icon={<HiOutlineClipboardDocumentList className="w-8 h-8" />}
              title="No reports yet" description="Submit your first daily progress report."
              action={<button onClick={() => setShowCreate(true)} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> New Report</button>} />
          )}

          {meta && (
            <div className="card overflow-hidden">
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      <Modal isOpen={showCreate} onClose={closeCreate} title="Submit Daily Report" size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {Array.isArray(projects) && projects.map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Task (Optional)">
              <select {...register('taskId')} className="select" disabled={!formProjectId}>
                <option value="">{formProjectId ? 'General report — no specific task' : 'Select a project first'}</option>
                {projectTasks.filter((t: any) => t.status !== 'DONE').map((t: any) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </FormField>

            {/* Set-dimensions flow */}
            {selectedTask && selectedTask.taskType?.hasStandard && selectedTask.computedQuantity == null && (
              <div className="sm:col-span-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">
                  This task has no dimensions set — material can't be calculated until they're entered.
                </p>
                {!selectedTask.taskType.dimensionFields || selectedTask.taskType.dimensionFields.length === 0 ? (
                  <p className="text-xs text-red-600">This task type has no dimension fields configured. Ask an Admin to set them up on the Task Types page.</p>
                ) : !showSetDimensions ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDimComponents([{ label: 'Section 1', values: emptyValues(selectedTask.taskType.dimensionFields), openings: [] }]);
                      setShowSetDimensions(true);
                    }}
                    className="text-xs text-primary-600 hover:underline font-medium"
                  >
                    + Set Dimensions Now
                  </button>
                ) : (
                  <div className="space-y-2">
                    <DimensionsEditor fields={selectedTask.taskType.dimensionFields} components={dimComponents} onChange={setDimComponents} />
                    <button
                      type="button"
                      onClick={() => {
                        const payload = dimComponents.map(c => ({
                          label: c.label,
                          values: c.values.map(v => ({ value: Number(v.value), unit: v.unit })),
                          openings: (c.openings || [])
                            .filter(o => o.values[0]?.value && o.values[1]?.value)
                            .map(o => ({ label: o.label, values: o.values.map(v => ({ value: Number(v.value), unit: v.unit })) })),
                        }));
                        setDimensionsMutation.mutate(payload);
                      }}
                      disabled={setDimensionsMutation.isPending}
                      className="btn-primary text-xs py-1.5"
                    >
                      {setDimensionsMutation.isPending ? 'Saving...' : 'Save Dimensions'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <FormField label="Date" required>
              <input {...register('reportDate', { required: true })} type="date" max={todayDateStr()} className="input" />
            </FormField>
            <FormField label="Weather" required>
              <select {...register('weather', { required: true })} className="select">
                {Object.entries(WEATHER_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
              </select>
            </FormField>
            <FormField label="Completion %" required className="sm:col-span-2">
              <input
                {...register('completionPct', { required: true, min: selectedTask?.cumulativePercent || 0, max: 100 })}
                type="number" step="0.5" className="input" placeholder="e.g. 35"
              />
              {selectedTask && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Task currently at {selectedTask.cumulativePercent}%. Enter the new cumulative total, not just today's increment.
                </p>
              )}
            </FormField>
            <FormField label="Work Done Today" required className="sm:col-span-2">
              <textarea {...register('workDone', { required: true })} rows={3} className="input resize-none" placeholder="Describe the work completed today..." />
            </FormField>
          </div>

          {/* Worker table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label text-xs">Workers Today {formTaskId && '(= their attendance for this task)'}</label>
              <button
                type="button"
                onClick={() => appendWorker({ name: '', workerId: '', role: 'Mason', wageForDay: '' })}
                disabled={!formProjectId}
                className="text-xs text-primary-600 hover:underline disabled:opacity-40"
              >
                + Add Worker
              </button>
            </div>
            {!formProjectId && <p className="text-xs text-gray-400 italic">Select a project first.</p>}

            <div className="space-y-2">
              {workerFields.map((field, i) => {
                const currentName = watchedWorkers?.[i]?.name || '';
                const filtered = currentName
                  ? nameOptions.filter((o: any) => o.name.toLowerCase().includes(currentName.toLowerCase()))
                  : nameOptions;
                return (
                  <div key={field.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          {...register(`workers.${i}.name`)}
                          className="input text-sm w-full"
                          placeholder="Type worker name..."
                          autoComplete="off"
                          onChange={(e) => {
                            setValue(`workers.${i}.name`, e.target.value);
                            const match = nameOptions.find((o: any) => o.name.toLowerCase() === e.target.value.toLowerCase());
                            if (match) handleNameSelect(i, match, e.target.value);
                            else setValue(`workers.${i}.workerId`, '');
                          }}
                          onFocus={() => setActiveNameDropdown(i)}
                          onBlur={() => setTimeout(() => setActiveNameDropdown(null), 150)}
                        />
                        {activeNameDropdown === i && filtered.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {filtered.map((o: any, oi: number) => (
                              <button
                                key={oi}
                                type="button"
                                onMouseDown={() => handleNameSelect(i, o, o.name)}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
                              >
                                <span>{o.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.source === 'existing' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {o.source === 'existing' ? 'Permanent' : 'Temp'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removeWorker(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select {...register(`workers.${i}.role`)} className="select text-sm">
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input type="number" step="1" {...register(`workers.${i}.wageForDay`, { required: true, min: 0 })} className="input text-sm" placeholder="Wage for day (₹)" />
                    </div>
                    {watchedWorkers?.[i]?.workerId ? (
                      <p className="text-[10px] text-green-600">✓ Matched to existing worker — this counts as their attendance today.</p>
                    ) : currentName ? (
                      <p className="text-[10px] text-amber-600">New/temporary worker — will appear in the dropdown for this project for 10 days and can be paid via the Salary page, but won't be added to the Labour page.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {existingWorkers.length === 0 && formProjectId && (
              <p className="text-[10px] text-amber-600 mt-1">
                No permanent workers found for this project yet — names typed here will be treated as temporary. Add permanent staff from the Labour page.
              </p>
            )}
          </div>

          {/* Materials — auto-populated the moment a valid completion % is
              entered for a standard task, no manual trigger needed. Still
              fully editable afterward, and manual/no-standard tasks keep
              the "+ Add Material" flow. */}
          {formTaskId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label text-xs flex items-center gap-1.5">
                  <HiOutlineCube className="w-3.5 h-3.5" /> Materials Used
                  {selectedTask && !selectedTask.taskType?.hasStandard && <span className="text-amber-600">(required — no standard for this trade)</span>}
                  {selectedTask?.taskType?.hasStandard && checkingMaterials && <span className="text-gray-400 font-normal">(calculating...)</span>}
                </label>
                <button type="button" onClick={() => appendMaterial({ materialId: '', quantityUsed: '' })} className="text-xs text-primary-600 hover:underline">
                  + Add Material
                </button>
              </div>

              {materialFields.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  {selectedTask?.taskType?.hasStandard
                    ? `Enter a completion % above ${selectedTask.cumulativePercent}% to auto-calculate material required.`
                    : 'Add materials actually used today.'}
                </p>
              )}

              <div className="space-y-2">
                {materialFields.map((field, i) => {
                  const rowMaterialId = watchedMaterials?.[i]?.materialId;
                  const rowQty = Number(watchedMaterials?.[i]?.quantityUsed || 0);
                  const suggestion = materialCheck?.materials?.find((m: any) => m.materialId === rowMaterialId);
                  const isShort = suggestion && rowQty > suggestion.available;
                  return (
                    <div key={field.id} className={`flex gap-2 items-start ${isShort ? 'bg-red-50 dark:bg-red-900/10 rounded-lg p-1.5' : ''}`}>
                      <div className="flex-1">
                        <select {...register(`materialsUsed.${i}.materialId`)} className="select text-sm w-full">
                          <option value="">Select Material</option>
                          {allMaterials.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                        </select>
                        {suggestion && (
                          <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isShort ? 'text-red-600' : 'text-gray-400'}`}>
                            {isShort && <HiOutlineExclamationTriangle className="w-3 h-3 flex-shrink-0" />}
                            Suggested: {suggestion.qtyNeeded.toFixed(1)} {suggestion.unit} · In stock: {suggestion.available.toFixed(1)}
                          </p>
                        )}
                      </div>
                      <input type="number" step="0.01" {...register(`materialsUsed.${i}.quantityUsed`)} className="input text-sm w-28" placeholder="Qty" />
                      <button type="button" onClick={() => removeMaterial(i)} className="text-red-400 hover:text-red-600 px-1 flex-shrink-0">
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <FormField label="Notes">
            <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Additional observations, issues, or notes..." />
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={closeCreate} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full sm:w-auto">
              {createMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewReport} onClose={() => setViewReport(null)} title="Report Details" size="lg">
        {viewReport && (
          <div className="p-4 sm:p-6 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  {new Date(viewReport.reportDate as string).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </div>
                <div className="text-primary-600 truncate">{(viewReport.project as { name: string })?.name}</div>
                {(viewReport.task as any) && <div className="text-xs text-gray-400 truncate">Task: {(viewReport.task as any).title}</div>}
              </div>
              <div className="text-center flex-shrink-0">
                <div className="text-3xl sm:text-4xl">{WEATHER_ICONS[(viewReport.weather as string)] || '🌤️'}</div>
                <div className="text-xs text-gray-400 mt-1">{String(viewReport.weather)}</div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Done</div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{String(viewReport.workDone)}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-500 flex-shrink-0">Completion:</span>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(Number(viewReport.completionPct), 100)}%` }} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white flex-shrink-0">{Number(viewReport.completionPct).toFixed(1)}%</span>
            </div>

            {(viewReport.workers as any[])?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Workers</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(viewReport.workers as any[]).map((w, i) => (
                    <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                      <span className="text-gray-600 dark:text-gray-400">{w.name} · {w.role}</span>
                      <span className="font-bold text-gray-900 dark:text-white">₹{w.wageForDay}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(viewReport.materialsUsed as any[])?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <HiOutlineCube className="w-3.5 h-3.5 inline mr-1" /> Materials Used
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(viewReport.materialsUsed as any[]).map((m, i) => (
                    <span key={i} className="text-xs bg-primary-50 dark:bg-primary-900/10 text-primary-600 px-2 py-0.5 rounded-full">
                      {m.material?.name}: {m.quantityUsed} {m.material?.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Boolean(viewReport.notes) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-yellow-800 dark:text-yellow-300 text-xs">
                <span className="font-semibold">Notes: </span>{String(viewReport.notes)}
              </div>
            )}

            <div className="text-xs text-gray-400">
              Submitted by: {(viewReport.submitter as { firstName: string; lastName: string })?.firstName}{' '}
              {(viewReport.submitter as { firstName: string; lastName: string })?.lastName}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default DailyReportsPage;