import type { MaterialAvailability, WorkOrderStatus } from '@/api/generated/model';
import type { Tone } from '@/shared/components/status-badge';

export const STATUS_TONES: Record<WorkOrderStatus, Tone> = {
  DRAFT: 'neutral',
  RELEASED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const AVAILABILITY_TONES: Record<MaterialAvailability, Tone> = {
  OK: 'success',
  PARTIAL: 'warning',
  MISSING: 'danger',
};

export const OPEN_STATUSES: WorkOrderStatus[] = ['DRAFT', 'RELEASED', 'IN_PROGRESS'];

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Component quantity per unit of output, scrap included (the API keeps 6 decimals). */
export function perUnit(quantity: number, scrapRate: number, batch: number): number {
  if (!(batch > 0)) return 0;
  return round((quantity * (1 + scrapRate / 100)) / batch, 6);
}

/** Quantity needed for `output` units; rounded up to 3 decimals like the API. */
export function required(quantityPer: number, output: number): number {
  return Math.ceil(round(quantityPer * output * 1000, 6)) / 1000;
}

/**
 * Standard consumption of one component for a production record: what `output` units need,
 * capped by what is still to be issued; the finishing record takes the whole remainder.
 */
export function standardConsumption(
  component: { quantityPer: number; requiredQty: number; consumedQty: number },
  output: number,
  finishes: boolean,
): number {
  const remaining = Math.max(round(component.requiredQty - component.consumedQty, 3), 0);
  if (finishes) return remaining;
  return Math.min(required(component.quantityPer, output), remaining);
}

/** Live cost preview of a bill of materials while it is being edited. */
export function bomCost(
  lines: { quantity: number; scrapRate: number; unitCost: number }[],
  batch: number,
  labor: number,
  overhead: number,
) {
  const material = lines.reduce(
    (sum, line) => sum + line.quantity * (1 + line.scrapRate / 100) * line.unitCost,
    0,
  );
  const total = material + labor + overhead;
  return {
    material: round(material, 2),
    total: round(total, 2),
    unitCost: batch > 0 ? round(total / batch, 4) : 0,
  };
}

/** Quantity that can still be produced on an order. */
export function remainingOutput(order: { quantity: string; producedQty: string }): number {
  return Math.max(round(Number(order.quantity) - Number(order.producedQty), 3), 0);
}
