import React from 'react';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';

const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

export interface DimensionValue { value: string; unit: string }
export interface OpeningInput { label: string; values: DimensionValue[] }
export interface ComponentInput { label: string; values: DimensionValue[]; openings: OpeningInput[] }

interface DimensionFieldDef { label: string; defaultUnit: string }

interface Props {
  fields: DimensionFieldDef[];
  components: ComponentInput[];
  onChange: (components: ComponentInput[]) => void;
}

export const emptyValues = (fields: DimensionFieldDef[]): DimensionValue[] =>
  fields.map(f => ({ value: '', unit: f.defaultUnit }));

const DimensionsEditor: React.FC<Props> = ({ fields, components, onChange }) => {
  const addComponent = () => {
    onChange([...components, { label: `Section ${components.length + 1}`, values: emptyValues(fields), openings: [] }]);
  };
  const removeComponent = (i: number) => onChange(components.filter((_, idx) => idx !== i));
  const updateComponent = (i: number, patch: Partial<ComponentInput>) => {
    onChange(components.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  };
  const updateValue = (ci: number, vi: number, patch: Partial<DimensionValue>) => {
    const comp = components[ci];
    updateComponent(ci, { values: comp.values.map((v, idx) => idx === vi ? { ...v, ...patch } : v) });
  };
  const addOpening = (ci: number) => {
    const comp = components[ci];
    updateComponent(ci, { openings: [...comp.openings, { label: `Opening ${comp.openings.length + 1}`, values: [{ value: '', unit: 'ft' }, { value: '', unit: 'ft' }] }] });
  };
  const removeOpening = (ci: number, oi: number) => {
    const comp = components[ci];
    updateComponent(ci, { openings: comp.openings.filter((_, idx) => idx !== oi) });
  };
  const updateOpeningLabel = (ci: number, oi: number, label: string) => {
    const comp = components[ci];
    updateComponent(ci, { openings: comp.openings.map((o, idx) => idx === oi ? { ...o, label } : o) });
  };
  const updateOpeningValue = (ci: number, oi: number, vi: number, patch: Partial<DimensionValue>) => {
    const comp = components[ci];
    updateComponent(ci, {
      openings: comp.openings.map((o, idx) => idx === oi
        ? { ...o, values: o.values.map((v, vidx) => vidx === vi ? { ...v, ...patch } : v) }
        : o),
    });
  };

  if (!fields || fields.length === 0) {
    return <p className="text-xs text-amber-600">This task type has no dimension fields configured — set them up on the Task Types page first.</p>;
  }

  return (
    <div className="space-y-3">
      {components.map((comp, ci) => (
        <div key={ci} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={comp.label}
              onChange={e => updateComponent(ci, { label: e.target.value })}
              className="input text-sm flex-1 font-medium"
              placeholder="e.g. Wall 1 — North side"
            />
            {components.length > 1 && (
              <button type="button" onClick={() => removeComponent(ci)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {fields.map((f, vi) => (
              <div key={vi} className="flex gap-1">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-0.5">{f.label}</label>
                  <input
                    type="number" step="0.01" className="input text-sm"
                    value={comp.values[vi]?.value || ''}
                    onChange={e => updateValue(ci, vi, { value: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="w-16">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Unit</label>
                  <select
                    className="select text-sm"
                    value={comp.values[vi]?.unit || f.defaultUnit}
                    onChange={e => updateValue(ci, vi, { unit: e.target.value })}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-gray-500">Doors / Windows to deduct (optional)</span>
              <button type="button" onClick={() => addOpening(ci)} className="text-[11px] text-primary-600 hover:underline">+ Add Opening</button>
            </div>
            {comp.openings.length === 0 ? (
              <p className="text-[10px] text-gray-400">No openings — full area/volume will be used.</p>
            ) : (
              <div className="space-y-1.5">
                {comp.openings.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-1.5 flex-wrap">
                    <input
                      value={o.label}
                      onChange={e => updateOpeningLabel(ci, oi, e.target.value)}
                      className="input text-xs w-20 flex-shrink-0"
                      placeholder="Door 1"
                    />
                    <input
                      type="number" step="0.01" className="input text-xs w-16"
                      value={o.values[0]?.value || ''}
                      onChange={e => updateOpeningValue(ci, oi, 0, { value: e.target.value })}
                      placeholder="Width"
                    />
                    <select className="select text-xs w-14" value={o.values[0]?.unit || 'ft'} onChange={e => updateOpeningValue(ci, oi, 0, { unit: e.target.value })}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <span className="text-xs text-gray-400">×</span>
                    <input
                      type="number" step="0.01" className="input text-xs w-16"
                      value={o.values[1]?.value || ''}
                      onChange={e => updateOpeningValue(ci, oi, 1, { value: e.target.value })}
                      placeholder="Height"
                    />
                    <select className="select text-xs w-14" value={o.values[1]?.unit || 'ft'} onChange={e => updateOpeningValue(ci, oi, 1, { unit: e.target.value })}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button type="button" onClick={() => removeOpening(ci, oi)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <HiOutlineTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={addComponent} className="btn-secondary text-xs py-1.5 w-full justify-center">
        <HiOutlinePlus className="w-3.5 h-3.5" /> Add Another Section
      </button>
    </div>
  );
};

export default DimensionsEditor;