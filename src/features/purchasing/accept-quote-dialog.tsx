import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getPurchaseOrdersFindAllQueryKey,
  getPurchaseRequestsComparisonQueryKey,
  getPurchaseRequestsFindAllQueryKey,
  getPurchaseRequestsFindOneQueryKey,
  getSupplierQuotesFindAllQueryKey,
  getSupplierQuotesFindOneQueryKey,
  useSupplierQuotesAccept,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { today } from './purchasing-components';

/** Turns a supplier quote into a draft purchase order and opens it. */
export function AcceptQuoteDialog({
  quote,
  requestId,
  open,
  onOpenChange,
}: {
  quote: { id: string; number: string; partnerTitle: string; deliveryDays: number | null };
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const warehouses = useWarehouseOptions(open);
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const accept = useSupplierQuotesAccept();

  const submit = () =>
    accept.mutate(
      {
        id: quote.id,
        data: { warehouseId, expectedDate: expectedDate || undefined },
      },
      {
        onSuccess: async (order) => {
          toast.success(t('purchasing.quotes.accepted', { number: order.number }));
          await invalidate(
            getSupplierQuotesFindAllQueryKey(),
            getSupplierQuotesFindOneQueryKey(quote.id),
            getPurchaseOrdersFindAllQueryKey(),
            getPurchaseRequestsFindAllQueryKey(),
            ...(requestId
              ? [
                  getPurchaseRequestsFindOneQueryKey(requestId),
                  getPurchaseRequestsComparisonQueryKey(requestId),
                ]
              : []),
          );
          onOpenChange(false);
          await navigate({ to: '/purchasing/orders/$id', params: { id: order.id } });
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('purchasing.quotes.acceptTitle', { number: quote.number })}</DialogTitle>
          <DialogDescription>
            {t('purchasing.quotes.acceptHint', { partner: quote.partnerTitle })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('purchasing.orders.warehouse')}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected-date">{t('purchasing.orders.expectedDate')}</Label>
            <Input
              id="expected-date"
              type="date"
              min={today()}
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!warehouseId || accept.isPending} onClick={submit}>
            {accept.isPending && <Loader2 className="animate-spin" />}
            {t('purchasing.quotes.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
