import { Link } from '@tanstack/react-router';
import type { LedgerDocumentType } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';

/** Ledger document number, linked to the source document when the user may open it. */
export function DocumentLink({
  type,
  id,
  number,
}: {
  type: LedgerDocumentType;
  id: string | null;
  number: string;
}) {
  const can = usePermission();
  const className = 'text-primary font-mono text-xs hover:underline print:no-underline';
  if (id && type === 'PURCHASE_INVOICE' && can(['purchasing:read', 'finance:read'])) {
    return (
      <Link to="/purchasing/invoices/$id" params={{ id }} className={className}>
        {number}
      </Link>
    );
  }
  return <code className="text-xs">{number}</code>;
}
