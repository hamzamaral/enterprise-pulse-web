import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, CheckCheck, Loader2, Plus, Save, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getStockCountsFindAllQueryKey,
  getStockCountsFindOneQueryKey,
  getStockFindLevelsQueryKey,
  getStockMovementsFindAllQueryKey,
  getStockSummaryQueryKey,
  useStockCountsAddLine,
  useStockCountsCancel,
  useStockCountsComplete,
  useStockCountsFindOne,
  useStockCountsUpdateLines,
} from '@/api/generated/endpoints/inventory/inventory';
import type { StockCountDetailDto, StockItemDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatDateTime, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { CountProgress } from './counts-page';
import { CountStatusBadge, ItemPicker, itemName, SignedQuantity } from './inventory-components';

const toNumber = (value: string) => Number(value.replace(',', '.'));
const isValidCount = (value: string) => value === '' || (toNumber(value) >= 0 && !!value.trim());

function AddLineDialog({
  count,
  open,
  onOpenChange,
}: {
  count: StockCountDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const addLine = useStockCountsAddLine();
  const [item, setItem] = useState<StockItemDto | null>(null);
  const [lotNo, setLotNo] = useState('');
  const [quantity, setQuantity] = useState('');

  const valid =
    !!item &&
    item.trackingType !== 'SERIAL' &&
    (item.trackingType !== 'LOT' || !!lotNo.trim()) &&
    isValidCount(quantity);

  const submit = () =>
    addLine.mutate(
      {
        id: count.id,
        data: {
          variantId: item!.variantId,
          lotNo: item!.trackingType === 'LOT' ? lotNo.trim() : undefined,
          countedQty: quantity ? toNumber(quantity) : undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('common.saved'));
          await invalidate(getStockCountsFindOneQueryKey(count.id));
          onOpenChange(false);
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inventory.counts.addLine')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('inventory.counts.addLineHint')}</p>
          <div className="space-y-2">
            <Label>{t('inventory.product')}</Label>
            <ItemPicker value={item} onChange={setItem} warehouseId={count.warehouseId} />
            {item?.trackingType === 'SERIAL' && (
              <p className="text-destructive text-sm">{t('inventory.counts.serialNotCounted')}</p>
            )}
          </div>
          {item?.trackingType === 'LOT' && (
            <div className="space-y-2">
              <Label>{t('inventory.movements.lot')}</Label>
              <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('inventory.counts.countedQty')}</Label>
            <Input
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid || addLine.isPending} onClick={submit}>
            {addLine.isPending && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CountDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidate();
  const { data: count, isLoading } = useStockCountsFindOne(id);
  const updateLines = useStockCountsUpdateLines();
  const complete = useStockCountsComplete();
  const cancel = useStockCountsCancel();
  /** Unsaved counted quantities by line id ("" clears the count). */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const editable = count?.status === 'DRAFT' && can('inventory:count');
  const dirty = Object.keys(edits).length > 0;
  const invalid = Object.values(edits).some((value) => !isValidCount(value));

  const lines = useMemo(() => {
    if (!count) return [];
    return count.lines.filter((line) => {
      if (!onlyDifferences) return true;
      const counted = edits[line.id] ?? line.countedQty ?? '';
      return counted !== '' && toNumber(counted) !== Number(line.expectedQty);
    });
  }, [count, edits, onlyDifferences]);

  if (isLoading || !count) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const refresh = () =>
    invalidate(getStockCountsFindOneQueryKey(id), getStockCountsFindAllQueryKey());

  const save = (onSaved?: () => void) => {
    if (!dirty) return onSaved?.();
    updateLines.mutate(
      {
        id,
        data: {
          lines: Object.entries(edits).map(([lineId, value]) => ({
            id: lineId,
            countedQty: value === '' ? null : toNumber(value),
          })),
        },
      },
      {
        onSuccess: async () => {
          setEdits({});
          await refresh();
          if (onSaved) onSaved();
          else toast.success(t('common.saved'));
        },
      },
    );
  };

  const finish = () =>
    save(() =>
      complete.mutate(
        { id },
        {
          onSuccess: async (result) => {
            toast.success(
              result.adjustmentNumber
                ? t('inventory.counts.completedWithAdjustment', {
                    number: result.adjustmentNumber,
                  })
                : t('inventory.counts.completedNoDifference'),
            );
            await Promise.all([
              refresh(),
              invalidate(
                getStockMovementsFindAllQueryKey(),
                getStockFindLevelsQueryKey(),
                getStockSummaryQueryKey(),
              ),
            ]);
          },
        },
      ),
    );

  const setCounted = (lineId: string, value: string) =>
    setEdits((e) => ({ ...e, [lineId]: value }));

  return (
    <>
      <Link
        to="/inventory/counts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('inventory.counts.title')}
      </Link>
      <PageHeader
        title={`${t('inventory.counts.sheet')} ${count.number}`}
        description={`${count.warehouseName} · ${formatDate(count.countDate)}`}
        actions={
          <>
            <CountStatusBadge status={count.status} />
            {editable && (
              <>
                <Button variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus /> {t('inventory.counts.addLine')}
                </Button>
                <Button
                  variant="outline"
                  disabled={!dirty || invalid || updateLines.isPending}
                  onClick={() => save()}
                >
                  <Save /> {t('common.save')}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="text-destructive">
                      <XCircle /> {t('inventory.counts.cancelCount')}
                    </Button>
                  }
                  title={t('inventory.counts.cancelTitle')}
                  description={t('inventory.counts.cancelDescription')}
                  confirmLabel={t('inventory.counts.cancelCount')}
                  onConfirm={() =>
                    cancel.mutate({ id }, { onSuccess: async () => void (await refresh()) })
                  }
                />
                {can('inventory:move') && (
                  <ConfirmDialog
                    trigger={
                      <Button disabled={invalid || complete.isPending}>
                        {complete.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                        {t('inventory.counts.complete')}
                      </Button>
                    }
                    title={t('inventory.counts.completeTitle')}
                    description={t('inventory.counts.completeDescription')}
                    confirmLabel={t('inventory.counts.complete')}
                    onConfirm={finish}
                  />
                )}
              </>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('inventory.counts.progress')}>
            <CountProgress count={count} />
          </Field>
          <Field label={t('inventory.counts.differences')}>{count.differenceCount}</Field>
          <Field label={t('inventory.movements.createdBy')}>{count.createdByName}</Field>
          {count.adjustmentId ? (
            <Field label={t('inventory.counts.adjustment')}>
              <Link
                to="/inventory/movements/$id"
                params={{ id: count.adjustmentId }}
                className="text-primary font-mono text-xs hover:underline"
              >
                {count.adjustmentNumber}
              </Link>
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(count.completedAt)}
              </span>
            </Field>
          ) : (
            <Field label={t('common.notes')}>{count.notes}</Field>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center gap-2">
        <Switch id="only-diff" checked={onlyDifferences} onCheckedChange={setOnlyDifferences} />
        <Label htmlFor="only-diff" className="text-sm font-normal">
          {t('inventory.counts.onlyDifferences')}
        </Label>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.sku')}</TableHead>
                <TableHead>{t('inventory.product')}</TableHead>
                <TableHead>{t('inventory.movements.lot')}</TableHead>
                <TableHead className="text-right">{t('inventory.counts.expected')}</TableHead>
                <TableHead className="w-44 text-right">
                  {t('inventory.counts.countedQty')}
                </TableHead>
                <TableHead className="text-right">{t('inventory.counts.difference')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length ? (
                lines.map((line) => {
                  const value = edits[line.id] ?? line.countedQty ?? '';
                  const difference =
                    value !== '' && isValidCount(value)
                      ? String(toNumber(value) - Number(line.expectedQty))
                      : null;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <code className="text-xs">{line.sku}</code>
                      </TableCell>
                      <TableCell>{itemName(line.productName, line.variantName)}</TableCell>
                      <TableCell>
                        {line.lotNo ? <code className="text-xs">{line.lotNo}</code> : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {formatQuantity(line.expectedQty, line.unitCode)}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title={t('inventory.counts.matchExpected')}
                              aria-label={t('inventory.counts.matchExpected')}
                              onClick={() => setCounted(line.id, line.expectedQty)}
                            >
                              <Check />
                            </Button>
                            <Input
                              inputMode="decimal"
                              value={value}
                              onChange={(e) => setCounted(line.id, e.target.value)}
                              className={cn(
                                'h-8 w-24 text-right tabular-nums',
                                !isValidCount(value) && 'border-destructive',
                              )}
                            />
                          </div>
                        ) : (
                          <span className="tabular-nums">
                            {formatQuantity(line.countedQty, line.unitCode)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {difference === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <SignedQuantity value={difference} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Mounted only while open, so every opening starts with an empty form. */}
      {editable && addOpen && <AddLineDialog count={count} open onOpenChange={setAddOpen} />}
    </>
  );
}
