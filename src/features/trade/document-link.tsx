import type { LedgerDocumentType } from '@/api/generated/model';

/** Ledger document number; linked to the source document once that module has a detail page. */
export function DocumentLink({
  number,
}: {
  type: LedgerDocumentType;
  id: string | null;
  number: string;
}) {
  return <code className="text-xs">{number}</code>;
}
