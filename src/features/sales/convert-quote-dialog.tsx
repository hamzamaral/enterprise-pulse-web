import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getSalesOrdersFindAllQueryKey,
  getSalesQuotesFindAllQueryKey,
  getSalesQuotesFindOneQueryKey,
  useSalesQuotesConvert,
} from '@/api/generated/endpoints/sales/sales';
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
import { today } from '@/features/trade/trade-components';

/** Turns an open sales quote into a draft sales order and opens it. */
export function ConvertQuoteDialog({
  quote,
  open,
  onOpenChange,
}: {
  quote: { id: string; number: string; partnerTitle: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const warehouses = useWarehouseOptions(open);
  const [warehouseId, setWarehouseId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const convert = useSalesQuotesConvert();

  const submit = () =>
    convert.mutate(
      {
        id: quote.id,
        data: {
          warehouseId,
          deliveryDate: deliveryDate || undefined,
          customerRef: customerRef.trim() || undefined,
        },
      },
      {
        onSuccess: async (order) => {
          toast.success(t('sales.quotes.converted', { number: order.number }));
          await invalidate(
            getSalesQuotesFindAllQueryKey(),
            getSalesQuotesFindOneQueryKey(quote.id),
            getSalesOrdersFindAllQueryKey(),
          );
          onOpenChange(false);
          await navigate({ to: '/sales/orders/$id', params: { id: order.id } });
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sales.quotes.convertTitle', { number: quote.number })}</DialogTitle>
          <DialogDescription>
            {t('sales.quotes.convertHint', { partner: quote.partnerTitle })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('sales.orders.warehouse')}</Label>
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
            <Label htmlFor="delivery-date">{t('sales.orders.deliveryDate')}</Label>
            <Input
              id="delivery-date"
              type="date"
              min={today()}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-ref">{t('sales.orders.customerRef')}</Label>
            <Input
              id="customer-ref"
              value={customerRef}
              onChange={(e) => setCustomerRef(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!warehouseId || convert.isPending} onClick={submit}>
            {convert.isPending && <Loader2 className="animate-spin" />}
            {t('sales.quotes.convert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
