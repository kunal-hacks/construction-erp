// utils/unitConversion.ts — add two passthrough units
const TO_METRES: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  inch: 0.0254,
  ft: 0.3048,
  nos: 1,   // passthrough — direct count (e.g. electrical points), not a real length conversion
  kg: 1,    // passthrough — direct weight entry (e.g. steel), not a real length conversion
};

export function convertToMetres(value: number, unit: string): number {
  const factor = TO_METRES[unit];
  if (!factor) throw new Error(`Unknown unit: ${unit}`);
  return value * factor;
}

export interface DimensionValue { value: number; unit: string }
export interface OpeningInput { label?: string; values: DimensionValue[] }
export interface ComponentInput { label?: string; values: DimensionValue[]; openings?: OpeningInput[] }

// Multiplies one component's own raw dimensions together (in metres).
// 1 value = linear, 2 = area, 3 = volume — unchanged rule, now per
// component instead of per whole task.
function computeComponentGross(values: DimensionValue[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((product, d) => product * convertToMetres(Number(d.value) || 0, d.unit), 1);
}

// A door/window is always width × height (2 values) — that's inherent to
// what an opening is, independent of the task type. If the parent
// component has a 3rd dimension (thickness, e.g. a wall for brickwork),
// the opening area is extended through that same thickness to get a
// volume deduction; for 2D components (e.g. plastering) the area is
// subtracted directly.
function computeOpeningDeduction(component: ComponentInput): number {
  if (!component.openings || component.openings.length === 0) return 0;
  const hasDepth = component.values.length >= 3;
  const depthMetres = hasDepth ? convertToMetres(Number(component.values[2].value) || 0, component.values[2].unit) : 1;

  return component.openings.reduce((sum, o) => {
    const area = (o.values || []).reduce((p, d) => p * convertToMetres(Number(d.value) || 0, d.unit), 1);
    return sum + area * depthMetres;
  }, 0);
}

// Sums every component's net quantity (gross minus its own openings) into
// one task total — this is what supports "more than one wall" per task,
// each with its own doors/windows deducted individually.
export function computeQuantityFromComponents(components: ComponentInput[]): number {
  if (!components || components.length === 0) return 0;
  return components.reduce((total, c) => {
    const gross = computeComponentGross(c.values);
    const deduction = computeOpeningDeduction(c);
    return total + Math.max(0, gross - deduction);
  }, 0);
}

export const SUPPORTED_UNITS = Object.keys(TO_METRES);