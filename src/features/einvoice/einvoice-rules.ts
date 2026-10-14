import type { EInvoiceProfile, EInvoiceStatus } from '@/api/generated/model';
import type { Tone } from '@/shared/components/status-badge';

export const STATUS_TONES: Record<EInvoiceStatus, Tone> = {
  QUEUED: 'neutral',
  SENT: 'info',
  DELIVERED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  ERROR: 'danger',
  CANCELLED: 'neutral',
};

/** Statuses the integrator still has to move; the pages poll while one is shown. */
export const IN_FLIGHT: EInvoiceStatus[] = ['QUEUED', 'SENT'];

/**
 * Mirrors the API rule: an envelope in flight or a delivered e-Fatura blocks cancelling the
 * sales invoice; delivered e-Arşiv invoices are cancelled with it.
 */
export function blocksSalesCancel(
  eInvoice: { profile: EInvoiceProfile; status: EInvoiceStatus } | null | undefined,
): boolean {
  if (!eInvoice) return false;
  if (IN_FLIGHT.includes(eInvoice.status)) return true;
  return (
    (eInvoice.status === 'DELIVERED' || eInvoice.status === 'ACCEPTED') &&
    eInvoice.profile !== 'EARSIVFATURA'
  );
}

/** Whole days left until `deadline` (yyyy-MM-dd) counted from `today`; negative when past. */
export function daysLeft(deadline: string, today: string): number {
  const ms = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
